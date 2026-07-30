/**
 * Wire-format types — what API routes actually return, after JSON serialization.
 *
 * Distinct from the Prisma payload types in `./index.ts`, which describe rows as
 * they exist server-side: `Date` becomes a string over JSON, and routes select a
 * subset of columns rather than returning whole rows.
 *
 * These previously existed as three separate hand-written copies
 * (`discover/types.ts`, `job-detail-sheet.tsx`, `application-detail/types.ts`)
 * that had already drifted apart — one was missing `fetchedAt` entirely. Keep
 * this in step with `JOB_CLIENT_SELECT` in `lib/job-select.ts`, which decides
 * what the server actually sends.
 */

import type { JobStatus } from "@prisma/client";

export interface ClientJobEvaluation {
  overallScore: number | null;
  recommendation: string | null;
  blockA?: { summary?: string; reason?: string } | null;
  blockB?: { strengths?: string[]; gaps?: string[] } | null;
}

export interface ClientJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  sourceUrl: string;
  /** ISO string — `Date` doesn't survive JSON. */
  fetchedAt: string;
  status: JobStatus;
  /** null when the job predates preference filtering. */
  prefMatch: boolean | null;
  /** "low_score" | "user", set when status is ARCHIVED. */
  archivedReason: string | null;
  evaluation: ClientJobEvaluation | null;
}
