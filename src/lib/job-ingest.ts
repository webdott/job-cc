import { prisma } from "@/lib/prisma";
import type { JobSource, NormalizedJob } from "@/lib/job-sources";
import { dedupeKeyFor, matchesPreferences, type JobPreferences } from "@/lib/job-match";

export interface IngestResult {
  /** Rows actually inserted for this user — not the size of the incoming feed. */
  discovered: number;
  /** Of those, how many matched the user's target roles and will be scored. */
  queued: number;
  /** Of those, how many were skipped as not matching. */
  filtered: number;
}

/**
 * Lower wins when the same role shows up on more than one source.
 *
 * HN is last because its titles and companies come from `parseHNListing`
 * guessing at free-text comments, so its version of a listing is the least
 * trustworthy one to keep.
 */
const SOURCE_PRECEDENCE: Record<JobSource, number> = {
  remotive: 0,
  arbeitnow: 1,
  hn: 2,
};

/**
 * Bulk-inserts a feed for one user, skipping duplicates and marking which of
 * the new rows are worth scoring.
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
  jobs: NormalizedJob[],
  preferences: JobPreferences
): Promise<IngestResult> {
  if (jobs.length === 0) return { discovered: 0, queued: 0, filtered: 0 };

  const candidates = dedupeBatch(jobs);

  // Bounded by the batch, so this stays a small query even as the user's job
  // table grows.
  const existing = await prisma.job.findMany({
    where: {
      userId,
      OR: [
        { sourceUrl: { in: candidates.map((j) => j.sourceUrl) } },
        { dedupeKey: { in: candidates.map((j) => dedupeKeyFor(j)).filter(isString) } },
      ],
    },
    select: { sourceUrl: true, dedupeKey: true },
  });

  const seenUrls = new Set(existing.map((j) => j.sourceUrl));
  const seenKeys = new Set(existing.map((j) => j.dedupeKey).filter(isString));

  const fresh = candidates.filter((job) => {
    if (seenUrls.has(job.sourceUrl)) return false;
    const key = dedupeKeyFor(job);
    return !(key && seenKeys.has(key));
  });

  if (fresh.length === 0) return { discovered: 0, queued: 0, filtered: 0 };

  const created = await prisma.job.createManyAndReturn({
    // Listed explicitly rather than spread: `NormalizedJob.source` is
    // provenance used for dedupe precedence, not a column.
    data: fresh.map((job) => ({
      userId,
      sourceUrl: job.sourceUrl,
      sourceId: job.sourceId,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      remote: job.remote,
      postedAt: job.postedAt,
      dedupeKey: dedupeKeyFor(job),
      prefMatch: matchesPreferences(
        // The feeds never populate salary, so there's nothing to compare
        // against the user's floor at ingest time.
        { title: job.title, remote: job.remote, salaryMax: null },
        preferences
      ),
    })),
    skipDuplicates: true,
    select: { prefMatch: true },
  });

  const queued = created.filter((j) => j.prefMatch !== false).length;

  return {
    discovered: created.length,
    queued,
    filtered: created.length - queued,
  };
}

/**
 * Re-evaluates `prefMatch` for a user's unscored jobs against current
 * preferences.
 *
 * Called when job preferences change. Recomputing rather than clearing to null
 * matters because it has to work in both directions: broadening `targetRoles`
 * should bring previously-skipped jobs back into the queue, and narrowing them
 * should take jobs out of it.
 *
 * Scoped to unscored, non-archived jobs — a job that already has an evaluation
 * has had its outcome decided, and an archived low scorer was rejected on merit
 * rather than on preferences.
 */
export async function recomputePrefMatch(
  userId: string,
  preferences: JobPreferences
): Promise<{ queued: number; filtered: number }> {
  const jobs = await prisma.job.findMany({
    where: { userId, status: "UNSEEN", evaluation: { is: null } },
    select: { id: true, title: true, remote: true, salaryMax: true },
  });

  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const job of jobs) {
    (matchesPreferences(job, preferences) ? matched : unmatched).push(job.id);
  }

  await Promise.all([
    matched.length > 0
      ? prisma.job.updateMany({ where: { id: { in: matched } }, data: { prefMatch: true } })
      : Promise.resolve(),
    unmatched.length > 0
      ? prisma.job.updateMany({ where: { id: { in: unmatched } }, data: { prefMatch: false } })
      : Promise.resolve(),
  ]);

  return { queued: matched.length, filtered: unmatched.length };
}

/**
 * Collapses repeats inside a single fetch: first exact URL, then the same role
 * appearing on two different sources under different URLs.
 */
function dedupeBatch(jobs: NormalizedJob[]): NormalizedJob[] {
  const byUrl = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const held = byUrl.get(job.sourceUrl);
    if (!held || SOURCE_PRECEDENCE[job.source] < SOURCE_PRECEDENCE[held.source]) {
      byUrl.set(job.sourceUrl, job);
    }
  }

  const byKey = new Map<string, NormalizedJob>();
  const unkeyed: NormalizedJob[] = [];

  for (const job of Array.from(byUrl.values())) {
    const key = dedupeKeyFor(job);
    // No usable key (typically a mis-parsed HN listing). Keep it rather than
    // lumping every unparseable job together.
    if (!key) {
      unkeyed.push(job);
      continue;
    }

    const held = byKey.get(key);
    if (!held || SOURCE_PRECEDENCE[job.source] < SOURCE_PRECEDENCE[held.source]) {
      byKey.set(key, job);
    }
  }

  return [...Array.from(byKey.values()), ...unkeyed];
}

function isString(value: string | null): value is string {
  return value !== null;
}
