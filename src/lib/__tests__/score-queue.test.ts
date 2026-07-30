import { beforeEach, describe, expect, it, vi } from "vitest";
import { APICallError, RetryError, TypeValidationError } from "ai";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { scoreJob } from "@/lib/job-scorer";
import {
  classifyScoreError,
  countQueued,
  listUsersWithQueuedJobs,
  scoreQueuedForUser,
  MAX_SCORE_ATTEMPTS,
} from "@/lib/score-queue";

vi.mock("@/lib/job-scorer", () => ({ scoreJob: vi.fn() }));

// Always allow — throttling behaviour is Upstash's, not ours, and we don't want
// a live Redis in unit tests.
vi.mock("@/lib/rate-limit", () => ({
  scoringRatelimit: { limit: vi.fn(async () => ({ success: true })) },
  aiRatelimit: { limit: vi.fn(async () => ({ success: true })) },
  checkRateLimit: vi.fn(async () => null),
}));

const mockScoreJob = scoreJob as unknown as ReturnType<typeof vi.fn>;

const FAR_FUTURE = () => Date.now() + 60_000;

async function userWithResume() {
  const user = await createTestUser();
  await prisma.resume.create({
    data: {
      userId: user.id,
      label: "Active",
      fileUrl: "https://example.com/r.pdf",
      isActive: true,
      parsedData: { skills: ["TypeScript"], experience: [] },
    },
  });
  return user;
}

function createJob(userId: string, n: number, overrides: Record<string, unknown> = {}) {
  return prisma.job.create({
    data: {
      userId,
      sourceUrl: `https://example.com/job/${n}`,
      title: `Job ${n}`,
      company: "Acme",
      description: "desc",
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await resetTestDb();
  mockScoreJob.mockReset();
  mockScoreJob.mockResolvedValue({
    overallScore: 80,
    recommendation: "APPLY",
    reason: "Great fit",
  });
});

describe("classifyScoreError", () => {
  function apiError(statusCode: number, isRetryable: boolean) {
    return new APICallError({
      message: `HTTP ${statusCode}`,
      url: "https://example.com",
      requestBodyValues: {},
      statusCode,
      isRetryable,
    });
  }

  it("treats a retryable API error (rate limit) as transient", () => {
    expect(classifyScoreError(apiError(429, true))).toBe("transient");
  });

  it("treats a non-retryable API error (bad request) as permanent", () => {
    expect(classifyScoreError(apiError(400, false))).toBe("permanent");
  });

  it("unwraps RetryError to classify the underlying cause", () => {
    const wrapped = new RetryError({
      message: "retries exhausted",
      reason: "maxRetriesExceeded",
      errors: [apiError(503, true)],
    });
    expect(classifyScoreError(wrapped)).toBe("transient");
  });

  it("treats model output that fails the schema as permanent", () => {
    // What generateObject raises when the model returns the wrong shape.
    // Retrying the same prompt would just produce the same shape again.
    const err = new TypeValidationError({
      value: { overallScore: "not a number" },
      cause: new Error("expected number"),
    });
    expect(classifyScoreError(err)).toBe("permanent");
  });

  it("defaults unknown errors to permanent so they can't stall the queue head", () => {
    expect(classifyScoreError(new Error("something odd"))).toBe("permanent");
    expect(classifyScoreError("a string")).toBe("permanent");
  });
});

describe("countQueued / listUsersWithQueuedJobs", () => {
  it("counts only unscored, un-exhausted jobs", async () => {
    const user = await userWithResume();
    await createJob(user.id, 1);
    await createJob(user.id, 2, { scoreAttempts: MAX_SCORE_ATTEMPTS });
    const scored = await createJob(user.id, 3);
    await prisma.jobEvaluation.create({
      data: { jobId: scored.id, userId: user.id, overallScore: 70 },
    });

    expect(await countQueued(user.id)).toBe(1);
  });

  it("lists users who have work waiting", async () => {
    const withWork = await userWithResume();
    const withoutWork = await userWithResume();
    await createJob(withWork.id, 1);
    await createJob(withoutWork.id, 2, { scoreAttempts: MAX_SCORE_ATTEMPTS });

    const ids = await listUsersWithQueuedJobs();
    expect(ids).toEqual([withWork.id]);
  });
});

describe("scoreQueuedForUser", () => {
  it("scores queued jobs and writes evaluations", async () => {
    const user = await userWithResume();
    await createJob(user.id, 1);
    await createJob(user.id, 2);

    const outcome = await scoreQueuedForUser(user.id, { take: 10, deadline: FAR_FUTURE() });

    expect(outcome.scored).toBe(2);
    expect(outcome.failed).toBe(0);
    expect(outcome.remaining).toBe(0);
    expect(await prisma.jobEvaluation.count()).toBe(2);
  });

  it("does not re-score a job that already has an evaluation", async () => {
    const user = await userWithResume();
    const job = await createJob(user.id, 1);
    await prisma.jobEvaluation.create({
      data: { jobId: job.id, userId: user.id, overallScore: 42 },
    });

    const outcome = await scoreQueuedForUser(user.id, { take: 10, deadline: FAR_FUTURE() });

    expect(outcome.scored).toBe(0);
    expect(mockScoreJob).not.toHaveBeenCalled();
    const evaluation = await prisma.jobEvaluation.findFirstOrThrow();
    expect(evaluation.overallScore).toBe(42);
  });

  it("burns an attempt and records the reason on a permanent failure", async () => {
    const user = await userWithResume();
    await createJob(user.id, 1);
    mockScoreJob.mockRejectedValue(new Error("model returned nonsense"));

    const outcome = await scoreQueuedForUser(user.id, { take: 10, deadline: FAR_FUTURE() });

    expect(outcome.failed).toBe(1);
    expect(outcome.scored).toBe(0);

    const job = await prisma.job.findFirstOrThrow();
    expect(job.scoreAttempts).toBe(1);
    expect(job.scoreError).toContain("model returned nonsense");
    // Still queued — it has attempts left.
    expect(outcome.remaining).toBe(1);
  });

  it("does NOT burn an attempt on a transient failure", async () => {
    const user = await userWithResume();
    await createJob(user.id, 1);
    mockScoreJob.mockRejectedValue(
      new APICallError({
        message: "rate limited",
        url: "https://example.com",
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: true,
      })
    );

    const outcome = await scoreQueuedForUser(user.id, { take: 10, deadline: FAR_FUTURE() });

    expect(outcome.scored).toBe(0);
    expect(outcome.failed).toBe(0);
    expect(outcome.deferred).toBe(1);

    const job = await prisma.job.findFirstOrThrow();
    expect(job.scoreAttempts).toBe(0);
    expect(job.scoreError).toBeNull();
  });

  it("drops a job from the queue once it exhausts its attempts", async () => {
    const user = await userWithResume();
    await createJob(user.id, 1, { scoreAttempts: MAX_SCORE_ATTEMPTS - 1 });
    mockScoreJob.mockRejectedValue(new Error("still broken"));

    await scoreQueuedForUser(user.id, { take: 10, deadline: FAR_FUTURE() });

    const job = await prisma.job.findFirstOrThrow();
    expect(job.scoreAttempts).toBe(MAX_SCORE_ATTEMPTS);
    // Gone from the queue, so it can't block the head forever.
    expect(await countQueued(user.id)).toBe(0);
  });

  it("respects the chunk size", async () => {
    const user = await userWithResume();
    for (let i = 0; i < 5; i++) await createJob(user.id, i);

    const outcome = await scoreQueuedForUser(user.id, { take: 2, deadline: FAR_FUTURE() });

    expect(outcome.scored).toBe(2);
    expect(outcome.remaining).toBe(3);
  });

  it("defers everything once the deadline has passed", async () => {
    const user = await userWithResume();
    await createJob(user.id, 1);

    const outcome = await scoreQueuedForUser(user.id, { take: 10, deadline: Date.now() - 1 });

    expect(outcome.scored).toBe(0);
    expect(outcome.deferred).toBe(1);
    expect(mockScoreJob).not.toHaveBeenCalled();
    // Still queued for the next pass.
    expect(outcome.remaining).toBe(1);
  });

  it("leaves jobs queued when the user has no active resume", async () => {
    const user = await createTestUser();
    await createJob(user.id, 1);

    const outcome = await scoreQueuedForUser(user.id, { take: 10, deadline: FAR_FUTURE() });

    expect(outcome.scored).toBe(0);
    expect(outcome.remaining).toBe(1);
    expect(mockScoreJob).not.toHaveBeenCalled();
  });
});
