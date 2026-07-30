import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { GET } from "./route";

// The lock is a Redis round-trip; tests shouldn't need a live Upstash.
vi.mock("@/lib/run-lock", () => ({
  acquireLock: vi.fn(async (key: string) => ({ key, token: "test-token" })),
  releaseLock: vi.fn(async () => {}),
}));

function cronRequest(bearer?: string) {
  return new NextRequest("http://localhost/api/cron/ingest", {
    headers: bearer !== undefined ? { authorization: `Bearer ${bearer}` } : {},
  });
}

const REMOTIVE_JOB = {
  id: 1,
  url: "https://remotive.com/job/1",
  title: "Backend Engineer",
  company_name: "Acme",
  candidate_required_location: "Remote",
  description: "<p>Build things</p>",
  salary: "",
  publication_date: "2026-01-01",
};

/**
 * Stubs the three feeds. Also captures the self-call to the score drain so we
 * can assert on it without a second server running.
 */
function stubSources(remotiveJobs: unknown[] = []) {
  const drainCalls: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("remotive.com"))
        return Promise.resolve({ json: async () => ({ jobs: remotiveJobs }) });
      if (url.includes("arbeitnow.com"))
        return Promise.resolve({ json: async () => ({ data: [], links: {} }) });
      if (url.includes("algolia.com/api/v1/search"))
        return Promise.resolve({ json: async () => ({ hits: [] }) });
      if (url.includes("/api/internal/score-drain")) {
        drainCalls.push(url);
        return Promise.resolve({ ok: true, status: 202, json: async () => ({ ok: true }) });
      }
      return Promise.resolve({ json: async () => ({}) });
    })
  );

  return drainCalls;
}

async function userWithActiveResume() {
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

beforeEach(async () => {
  await resetTestDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/cron/ingest", () => {
  it("returns 401 without the correct bearer token", async () => {
    stubSources();
    const res = await GET(cronRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when no authorization header is sent at all", async () => {
    stubSources();
    const res = await GET(cronRequest());
    expect(res.status).toBe(401);
  });

  it("only ingests for users with an active resume", async () => {
    stubSources([REMOTIVE_JOB]);

    await createTestUser(); // no resume
    const withResume = await userWithActiveResume();

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.usersProcessed).toBe(1);
    expect(body.discovered).toBe(1);

    const jobs = await prisma.job.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].userId).toBe(withResume.id);
    expect(jobs[0].title).toBe("Backend Engineer");
    // sanitizeJobDescription runs on Remotive's HTML description
    expect(jobs[0].description).toBe("<p>Build things</p>");
  });

  it("does no AI scoring — jobs land unscored and queued", async () => {
    stubSources([REMOTIVE_JOB]);
    await userWithActiveResume();

    await GET(cronRequest(process.env.CRON_SECRET));

    expect(await prisma.jobEvaluation.count()).toBe(0);
    const job = await prisma.job.findFirstOrThrow();
    expect(job.scoreAttempts).toBe(0);
    expect(job.status).toBe("UNSEEN");
  });

  it("is idempotent — a second run inserts nothing and reports zero discovered", async () => {
    stubSources([REMOTIVE_JOB]);
    await userWithActiveResume();

    const first = await (await GET(cronRequest(process.env.CRON_SECRET))).json();
    expect(first.discovered).toBe(1);

    const second = await (await GET(cronRequest(process.env.CRON_SECRET))).json();
    expect(second.discovered).toBe(0);

    expect(await prisma.job.count()).toBe(1);
  });

  it("kicks the scoring drain only when something was ingested", async () => {
    const drainCalls = stubSources([REMOTIVE_JOB]);
    await userWithActiveResume();

    const first = await (await GET(cronRequest(process.env.CRON_SECRET))).json();
    expect(first.drainStarted).toBe(true);
    expect(drainCalls).toHaveLength(1);
    expect(drainCalls[0]).toContain("depth=0");

    // Nothing new the second time, so there's nothing to score.
    const second = await (await GET(cronRequest(process.env.CRON_SECRET))).json();
    expect(second.drainStarted).toBe(false);
    expect(drainCalls).toHaveLength(1);
  });

  it("keeps ingesting for other users when one user's insert fails", async () => {
    stubSources([REMOTIVE_JOB]);
    const failing = await userWithActiveResume();
    await userWithActiveResume();

    const spy = vi.spyOn(prisma.job, "createManyAndReturn");
    spy.mockImplementationOnce((async (args: { data: Array<{ userId: string }> }) => {
      if (args.data[0]?.userId === failing.id) throw new Error("simulated DB failure");
      return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    // The other user still went through.
    expect(body.usersProcessed).toBe(1);
    spy.mockRestore();
  });
});
