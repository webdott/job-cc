import { redis } from "@/lib/redis";

/**
 * Cross-invocation mutual exclusion for background runs.
 *
 * There is no other coordination between cron invocations, the self-chaining
 * drain, and a user hitting "Scan for jobs" — without a lock, two overlapping
 * runs would score the same jobs twice. The DB makes that harmless (the
 * jobEvaluation upsert is idempotent) but it wastes real money on model calls.
 *
 * The TTL is the actual safety net: a function killed mid-run can't release its
 * lock, so every lock must expire on its own. Set the TTL slightly above the
 * caller's maxDuration.
 */

/** Only delete the key if we still own it — a lock that expired and was retaken
 * by another invocation must not be released by the previous holder. */
const RELEASE_IF_OWNED = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export interface RunLock {
  key: string;
  token: string;
}

/**
 * Attempts to take `key` for `ttlSeconds`. Returns a handle on success, or null
 * if another invocation already holds it.
 *
 * Fails **open** (returns a handle) when Redis is unreachable, matching the
 * posture in `checkRateLimit`. A misconfigured Redis should not silently stop
 * the nightly digest from running; the cost of the alternative is duplicate
 * model calls, not incorrect data.
 */
export async function acquireLock(key: string, ttlSeconds: number): Promise<RunLock | null> {
  const token = crypto.randomUUID();
  try {
    const result = await redis.set(key, token, { nx: true, ex: ttlSeconds });
    return result === "OK" ? { key, token } : null;
  } catch (err) {
    console.error(`Run lock unavailable for "${key}", proceeding without it:`, err);
    return { key, token };
  }
}

export async function releaseLock(lock: RunLock): Promise<void> {
  try {
    await redis.eval(RELEASE_IF_OWNED, [lock.key], [lock.token]);
  } catch (err) {
    // Not fatal — the TTL will clear it.
    console.error(`Failed to release run lock "${lock.key}":`, err);
  }
}
