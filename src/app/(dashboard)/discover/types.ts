// Single source of truth for the wire format; see src/types/client.ts.
import type { ClientJob, ClientJobEvaluation } from "@/types/client";

export type Job = ClientJob;
export type JobEvaluation = ClientJobEvaluation;

export interface JobsResponse {
  jobs: Job[];
  hasMore: boolean;
  total: number;
  page: number;
}

/** POST /api/jobs/discover — ingest only; scoring is drained separately. */
export interface DiscoverResponse {
  /** Rows newly inserted for this user. */
  discovered: number;
  /** Of those, how many don't match the user's target roles and won't be scored. */
  filtered: number;
  /** Jobs now waiting to be scored, including any left over from earlier scans. */
  remainingToScore: number;
  /** Listings returned by the three sources, before dedupe. */
  total: number;
}

/** POST /api/jobs/score-batch — one chunk of the scoring queue. */
export interface ScoreBatchResponse {
  scored: number;
  /** Of those scored, how many fell below the threshold and were hidden. */
  archived: number;
  /** Permanent failures; these consumed a retry attempt. */
  failed: number;
  /** Left queued — rate-limited, out of time, or a transient error. */
  deferred: number;
  remaining: number;
}

export type ScanStatus = "ingesting" | "scoring" | "done" | "paused" | "error";

/** Drives the discover page's progress indicator across the ingest + drain cycle. */
export interface ScanProgress {
  status: ScanStatus;
  discovered: number;
  /** Skipped as not matching the user's target roles — surfaced so the
   * prefilter is visible rather than looking like jobs went missing. */
  filtered: number;
  scored: number;
  /** Hidden because they scored below the threshold. */
  archived: number;
  /** Queue depth when the drain started, so progress reads "scored N of M". */
  queuedAtStart: number;
  remaining: number;
  message?: string;
}
