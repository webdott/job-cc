import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

// AI-calling routes hit Gemini + the DB per request — keep this tight.
export const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:ai",
});

/**
 * Bulk scoring runs many model calls back to back, so it gets its own budget
 * rather than competing with interactive AI routes for `aiRatelimit`.
 *
 * Sized for the worst case we have to tolerate: a BYOC user on the AI Studio
 * free tier, where Flash models are capped near 10 RPM. Paid tiers allow far
 * more, so raise SCORE_RATE_LIMIT_PER_MINUTE if every user is on billing.
 */
const SCORE_RATE_LIMIT_PER_MINUTE = Number(process.env.SCORE_RATE_LIMIT_PER_MINUTE ?? 10);

export const scoringRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(SCORE_RATE_LIMIT_PER_MINUTE, "1 m"),
  prefix: "ratelimit:scoring",
});

/**
 * Checks a per-user rate limit. Returns a ready-to-return 429 response if the
 * limit is exceeded, or null if the caller should proceed.
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<NextResponse | null> {
  let result;
  try {
    result = await limiter.limit(identifier);
  } catch (err) {
    // Fail open — an unreachable/misconfigured Redis shouldn't take down the
    // feature it's meant to merely bound.
    console.error("Rate limit check failed, allowing request:", err);
    return null;
  }

  if (result.success) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}
