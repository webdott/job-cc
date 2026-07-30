export interface JobEvaluation {
  overallScore: number | null;
  recommendation: string | null;
  blockA?: { summary?: string; reason?: string } | null;
  blockB?: { strengths?: string[]; gaps?: string[] } | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  sourceUrl: string;
  fetchedAt: string;
  evaluation: JobEvaluation | null;
}

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
  /** Jobs now waiting to be scored, including any left over from earlier scans. */
  remainingToScore: number;
  /** Listings returned by the three sources, before dedupe. */
  total: number;
}

/** POST /api/jobs/score-batch — one chunk of the scoring queue. */
export interface ScoreBatchResponse {
  scored: number;
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
  scored: number;
  /** Queue depth when the drain started, so progress reads "scored N of M". */
  queuedAtStart: number;
  remaining: number;
  message?: string;
}
