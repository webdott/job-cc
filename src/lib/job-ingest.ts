import { prisma } from "@/lib/prisma";
import type { NormalizedJob } from "@/lib/job-sources";

export interface IngestResult {
  /** Rows actually inserted for this user — not the size of the incoming feed. */
  discovered: number;
}

/**
 * Bulk-inserts a feed for one user, skipping anything they already have.
 *
 * Replaces the per-job `prisma.job.upsert` loop that used to run in both
 * /api/jobs/discover and the daily digest: 180 sequential round-trips per user,
 * every run, even when nothing was new.
 *
 * `createManyAndReturn` returns *exactly* the rows that were inserted, which
 * also removes the two "is this new?" heuristics the old code needed and got
 * subtly wrong — discover compared `fetchedAt` against a 5-second wall-clock
 * window (misfiring whenever the digest had touched the same row moments
 * earlier), and the digest compared it against the run start (correct, but it
 * still had to upsert all 180 rows to find out).
 *
 * Archived jobs are their own tombstone: because the row survives, its
 * sourceUrl stays a duplicate and it is never re-inserted or re-scored.
 */
export async function ingestJobsForUser(
  userId: string,
  jobs: NormalizedJob[]
): Promise<IngestResult> {
  if (jobs.length === 0) return { discovered: 0 };

  // Collapse exact-URL repeats within the incoming batch. `skipDuplicates`
  // would handle these too, but doing it here keeps the inserted count
  // meaningful and makes the behaviour explicit rather than relying on
  // ON CONFLICT semantics for rows in the same statement.
  const byUrl = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    if (!byUrl.has(job.sourceUrl)) byUrl.set(job.sourceUrl, job);
  }

  const created = await prisma.job.createManyAndReturn({
    // Listed explicitly rather than spread: `NormalizedJob.source` is
    // provenance used for dedupe precedence, not a column.
    data: Array.from(byUrl.values(), (job) => ({
      userId,
      sourceUrl: job.sourceUrl,
      sourceId: job.sourceId,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      remote: job.remote,
      postedAt: job.postedAt,
    })),
    skipDuplicates: true,
    select: { id: true },
  });

  return { discovered: created.length };
}
