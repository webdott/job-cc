import { Redis } from "@upstash/redis";

/**
 * Operator-level Redis. Used for rate limiting (lib/rate-limit.ts) and for
 * cross-invocation run locks (lib/run-lock.ts).
 *
 * Deliberately not per-user: BYOC covers the AI provider, R2, and Brevo, but
 * not Upstash — coordination between cron invocations is an operator concern.
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});
