import { selfBaseUrl } from "@/lib/cron-auth";

/**
 * Kicks the background scoring drain.
 *
 * Hobby crons can only run once per day, so there is no way to schedule a
 * "drain the queue every few minutes" worker. Instead the drain re-invokes
 * itself over HTTP, and this is how both the nightly ingest cron and the drain
 * itself start the next link.
 *
 * Safe to await: the target acquires its lock, responds 202, and does the
 * actual work in `waitUntil`, so this returns in roughly the time of one
 * round-trip rather than the length of the drain.
 */
export async function triggerScoreDrain(depth = 0): Promise<boolean> {
  const base = selfBaseUrl();
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    console.warn(
      "Cannot trigger score drain: set CRON_SECRET and NEXT_PUBLIC_APP_URL (or deploy to Vercel for VERCEL_URL)."
    );
    return false;
  }

  try {
    const res = await fetch(`${base}/api/internal/score-drain?depth=${depth}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    // 409 means a drain is already running, which is a success for our purposes.
    return res.ok || res.status === 409;
  } catch (err) {
    console.error("Failed to trigger score drain:", err);
    return false;
  }
}
