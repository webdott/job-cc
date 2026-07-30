import { APICallError, RetryError, NoObjectGeneratedError, TypeValidationError } from "ai";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scoreJob } from "@/lib/job-scorer";
import { mapWithConcurrency } from "@/lib/concurrency";
import { resolveUserCredentials } from "@/lib/byoc";
import { scoringRatelimit } from "@/lib/rate-limit";
import type { ParsedResume } from "@/lib/resume-parser";

/**
 * The scoring queue.
 *
 * There is no queue *table*: an unscored job is simply a Job with no
 * JobEvaluation row, which `JobEvaluation.jobId @unique` already guarantees is
 * one-to-one. That makes the queue derived state, and the whole pipeline
 * self-healing — a chunk killed mid-flight leaves its jobs still unscored, so
 * the next chunk, the next scan, or tonight's cron picks them up. Nothing to
 * reconcile, nothing to leak.
 */

/** After this many *permanent* failures a job leaves the queue, so one
 * malformed listing can't block the head forever. */
export const MAX_SCORE_ATTEMPTS = 3;

const SCORE_CONCURRENCY = Number(process.env.SCORE_CONCURRENCY ?? 4);

function queuedWhere(userId?: string): Prisma.JobWhereInput {
  return {
    ...(userId ? { userId } : {}),
    status: "UNSEEN",
    evaluation: { is: null },
    scoreAttempts: { lt: MAX_SCORE_ATTEMPTS },
  };
}

export function countQueued(userId?: string): Promise<number> {
  return prisma.job.count({ where: queuedWhere(userId) });
}

/** User IDs with at least one job waiting to be scored. Used by the drain to
 * walk users without loading their jobs. */
export async function listUsersWithQueuedJobs(limit = 100): Promise<string[]> {
  const rows = await prisma.job.groupBy({
    by: ["userId"],
    where: queuedWhere(),
    // Stable ordering so a chained drain walks users in the same sequence each
    // link rather than revisiting the same ones.
    orderBy: { userId: "asc" },
    take: limit,
  });
  return rows.map((r) => r.userId);
}

/**
 * Transient failures (rate limits, upstream 5xx, network) must not burn an
 * attempt — the job should be retried for free on the next drain. Permanent
 * failures (bad model output, 4xx) must burn one, or the queue never drains.
 *
 * Unknown errors are treated as **permanent** on purpose. Misclassifying a
 * transient blip costs a job one of its three attempts, which is recoverable;
 * misclassifying a permanently-broken job as transient would stall the queue
 * head indefinitely, which is the exact failure this design exists to prevent.
 */
export function classifyScoreError(err: unknown): "transient" | "permanent" {
  // The SDK already retried internally before surfacing this; unwrap to the
  // real cause.
  if (RetryError.isInstance(err) && err.lastError) {
    return classifyScoreError(err.lastError);
  }

  if (APICallError.isInstance(err)) {
    return err.isRetryable ? "transient" : "permanent";
  }

  // The model returned something that didn't satisfy the Zod schema. Retrying
  // the same prompt will keep producing the same shape.
  if (NoObjectGeneratedError.isInstance(err) || TypeValidationError.isInstance(err)) {
    return "permanent";
  }

  return "permanent";
}

type JobToScore = {
  id: string;
  title: string;
  description: string;
};

export interface ScoreOutcome {
  scored: number;
  /** Permanent failures — these consumed an attempt. */
  failed: number;
  /** Left queued: rate-limited, deadline reached, or a transient error. */
  deferred: number;
  /** Jobs still waiting after this pass. */
  remaining: number;
}

const EMPTY: Omit<ScoreOutcome, "remaining"> = { scored: 0, failed: 0, deferred: 0 };

/**
 * Scores up to `take` of one user's queued jobs, stopping early if `deadline`
 * passes or the provider starts pushing back.
 *
 * Returns rather than throws: a user with no credentials, no active resume, or
 * nothing queued is a normal outcome, not an error. The caller (a cron drain
 * walking every user) must not be derailed by any single user.
 */
export async function scoreQueuedForUser(
  userId: string,
  opts: { take: number; deadline: number }
): Promise<ScoreOutcome> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) return { ...EMPTY, remaining: 0 };

  const activeResume = await prisma.resume.findFirst({
    where: { userId, isActive: true },
    select: { parsedData: true },
  });
  // Nothing to score against. These jobs stay queued until a resume is added.
  if (!activeResume) return { ...EMPTY, remaining: await countQueued(userId) };

  const credentials = await resolveUserCredentials(user.email, userId);
  // Non-allowlisted user who hasn't saved BYOC credentials yet.
  if (!credentials) return { ...EMPTY, remaining: await countQueued(userId) };

  const jobs = await prisma.job.findMany({
    where: queuedWhere(userId),
    orderBy: { fetchedAt: "desc" },
    take: opts.take,
    select: { id: true, title: true, description: true },
  });
  if (jobs.length === 0) return { ...EMPTY, remaining: 0 };

  const parsedData = activeResume.parsedData as ParsedResume;
  const model = credentials.ai.flashModel;

  // Set once a worker sees back-pressure or the clock runs out; every other
  // worker then short-circuits instead of piling more load onto the provider.
  let stop = false;

  const results = await mapWithConcurrency(
    jobs,
    SCORE_CONCURRENCY,
    async (job: JobToScore): Promise<"scored" | "failed" | "deferred"> => {
      if (stop || Date.now() >= opts.deadline) return "deferred";

      const { success } = await scoringRatelimit.limit(userId).catch(() => ({ success: true }));
      if (!success) {
        stop = true;
        return "deferred";
      }

      try {
        const score = await scoreJob(job.description, job.title, parsedData, model);

        await prisma.jobEvaluation.upsert({
          where: { jobId: job.id },
          create: {
            jobId: job.id,
            userId,
            overallScore: score.overallScore,
            recommendation: score.recommendation,
            archetype: score.archetype,
            blockA: { reason: score.reason },
          },
          update: {},
        });
        return "scored";
      } catch (err) {
        if (classifyScoreError(err) === "transient") {
          stop = true;
          return "deferred";
        }
        await recordScoreFailure(job.id, err);
        return "failed";
      }
    }
  );

  return {
    scored: results.filter((r) => r === "scored").length,
    failed: results.filter((r) => r === "failed").length,
    deferred: results.filter((r) => r === "deferred").length,
    remaining: await countQueued(userId),
  };
}

/** Burns one attempt and records why, so a repeatedly-failing job eventually
 * drops out of the queue instead of blocking it. */
export async function recordScoreFailure(jobId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  try {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        scoreAttempts: { increment: 1 },
        scoreError: message.slice(0, 500),
      },
    });
  } catch (updateErr) {
    // The job may have been deleted mid-run. Not worth failing the chunk over.
    console.error(`Failed to record scoring failure for job ${jobId}:`, updateErr);
  }
}
