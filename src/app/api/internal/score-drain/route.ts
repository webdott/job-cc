import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { requireCronSecret } from "@/lib/cron-auth";
import { acquireLock, releaseLock, type RunLock } from "@/lib/run-lock";
import { listUsersWithQueuedJobs, scoreQueuedForUser, countQueued } from "@/lib/score-queue";
import { triggerScoreDrain } from "@/lib/drain-trigger";

/**
 * Drains the scoring queue across all users, then hands off to a fresh
 * invocation if it runs out of time.
 *
 * Why chaining rather than a worker cron: Hobby only allows daily crons, so
 * there's no "run every 5 minutes" option. And `waitUntil` does not extend
 * `maxDuration` — Vercel cancels its promises when the function times out — so
 * backgrounding alone buys no extra compute. The only way to exceed one
 * invocation's budget is to start another one.
 *
 * Responds 202 before doing any work so the caller (the ingest cron, or the
 * previous link in the chain) isn't held open for the whole drain.
 */

export const maxDuration = 300;

/** 60s of slack under the 300s ceiling, so an in-flight chunk and the handoff
 * both have room to finish before Vercel kills the function. */
const DRAIN_BUDGET_MS = 240_000;

/** 20 links x 240s is ~80 minutes of processing — far more than the queue
 * should ever need, and a hard backstop against a runaway self-invocation loop. */
const MAX_CHAIN_DEPTH = 20;

const CHUNK_SIZE = 12;
const LOCK_KEY = "lock:score-drain";

/** Slightly above maxDuration: a killed invocation can't release its own lock,
 * so expiry is the real safety net. */
const LOCK_TTL_SECONDS = 310;

export async function POST(req: NextRequest) {
  const authError = requireCronSecret(req);
  if (authError) return authError;

  const depth = Number(req.nextUrl.searchParams.get("depth") ?? 0);
  if (!Number.isFinite(depth) || depth < 0 || depth > MAX_CHAIN_DEPTH) {
    return NextResponse.json({ ok: false, reason: "max-chain-depth", depth }, { status: 200 });
  }

  const lock = await acquireLock(LOCK_KEY, LOCK_TTL_SECONDS);
  if (!lock) {
    return NextResponse.json({ ok: false, reason: "already-running" }, { status: 409 });
  }

  waitUntil(drain(lock, depth));

  return NextResponse.json({ ok: true, status: "draining", depth }, { status: 202 });
}

/**
 * Never rejects. This runs inside `waitUntil`, where a rejected promise is an
 * unhandled rejection with nothing left to catch it — the request has already
 * been answered.
 */
async function drain(lock: RunLock, depth: number): Promise<void> {
  const deadline = Date.now() + DRAIN_BUDGET_MS;
  let scored = 0;
  let ranOutOfTime = false;

  try {
    for (;;) {
      if (Date.now() >= deadline) {
        ranOutOfTime = true;
        break;
      }

      const userIds = await listUsersWithQueuedJobs();
      if (userIds.length === 0) break;

      // Tracks whether this pass moved at all. Without it, a queue where every
      // remaining user is rate-limited or missing credentials would spin
      // against the DB until the budget expired.
      let progressed = false;

      for (const userId of userIds) {
        if (Date.now() >= deadline) {
          ranOutOfTime = true;
          break;
        }

        try {
          const outcome = await scoreQueuedForUser(userId, { take: CHUNK_SIZE, deadline });
          scored += outcome.scored;
          if (outcome.scored > 0 || outcome.failed > 0) progressed = true;
        } catch (err) {
          // One user's failure must not end the drain for everyone else.
          console.error(`Score drain failed for user ${userId}:`, err);
        }
      }

      if (!progressed) {
        // Everyone left is blocked (rate limits, missing credentials, no active
        // resume). Chaining would just burn invocations hitting the same wall,
        // so stop and let the next scheduled run pick it up.
        console.warn("Score drain made no progress; leaving the rest queued.");
        break;
      }
    }
  } catch (err) {
    console.error("Score drain aborted:", err);
    return;
  } finally {
    // Release before handing off, or the next link would collide with our lock.
    await releaseLock(lock);
  }

  try {
    const remaining = await countQueued();
    console.log(`Score drain (depth ${depth}): scored ${scored}, ${remaining} remaining.`);

    if (ranOutOfTime && remaining > 0 && depth < MAX_CHAIN_DEPTH) {
      await triggerScoreDrain(depth + 1);
    }
  } catch (err) {
    console.error("Score drain handoff failed; remaining jobs stay queued:", err);
  }
}
