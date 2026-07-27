import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

// AI-calling routes hit Gemini + the DB per request — keep this tight.
export const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:ai",
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
