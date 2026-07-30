import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCronSecret } from "@/lib/cron-auth";
import { fetchAllSources } from "@/lib/job-sources";
import { ingestJobsForUser } from "@/lib/job-ingest";
import { readJobPreferences } from "@/lib/job-match";
import { acquireLock, releaseLock } from "@/lib/run-lock";
import { triggerScoreDrain } from "@/lib/drain-trigger";

/**
 * Deliberately does no AI work. It fetches the three sources once, bulk-inserts
 * whatever is new for each user, and hands scoring off to the drain — which is
 * what keeps this bounded no matter how many users exist. The old daily digest
 * did fetch + insert + score in one nested loop and could not finish.
 *
 * Runs two hours before the digest so most of the queue is scored by the time
 * the email goes out, but the digest does not depend on that.
 */

export const maxDuration = 300;

const LOCK_KEY = "lock:ingest";
const LOCK_TTL_SECONDS = 310;

export async function GET(req: NextRequest) {
  const authError = requireCronSecret(req);
  if (authError) return authError;

  const lock = await acquireLock(LOCK_KEY, LOCK_TTL_SECONDS);
  if (!lock) {
    return NextResponse.json({ ok: false, reason: "already-running" }, { status: 409 });
  }

  try {
    // Fetched once and reused for every user — the expensive part of a scan is
    // the AI scoring, not the feeds.
    const sourceJobs = await fetchAllSources();

    const users = await prisma.user.findMany({
      where: { resumes: { some: { isActive: true } } },
      select: { id: true, preferences: true },
    });

    let discovered = 0;
    let filtered = 0;
    let usersProcessed = 0;

    for (const user of users) {
      try {
        const result = await ingestJobsForUser(
          user.id,
          sourceJobs,
          readJobPreferences(user.preferences)
        );
        discovered += result.discovered;
        filtered += result.filtered;
        usersProcessed++;
      } catch (err) {
        // A single user's insert failing must not abort ingestion for the rest.
        console.error(`Ingest failed for user ${user.id}:`, err);
      }
    }

    const drainStarted = discovered > 0 ? await triggerScoreDrain() : false;

    return NextResponse.json({
      ok: true,
      sourceJobs: sourceJobs.length,
      usersProcessed,
      discovered,
      filtered,
      drainStarted,
    });
  } finally {
    await releaseLock(lock);
  }
}
