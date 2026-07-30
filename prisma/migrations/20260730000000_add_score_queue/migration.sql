-- Resumable job-scoring queue (see issue #35). Splits ingestion from scoring so
-- neither /api/jobs/discover nor the nightly crons have to finish an unbounded
-- amount of AI work inside a single function invocation.
--
-- The queue itself needs no table: an unscored job is a Job with no
-- JobEvaluation row (JobEvaluation.jobId is already @unique). These columns only
-- track *failure*, so one malformed listing can't block the head of the queue.
--
-- Every statement is guarded with IF NOT EXISTS. This repo iterates with
-- `prisma db push`, which applies schema changes without recording anything in
-- `_prisma_migrations`, so any database that was pushed to before this migration
-- shipped already has these objects. Without the guards `migrate deploy` aborts
-- with 42701 (duplicate column) and then blocks every later migration. Same
-- defensive posture as 20260722220000_drop_portal_config.
--
-- No new tables, so no RLS block here — Job and Application already carry the
-- "service only" policy from 20260604000000_enable_rls.

-- Permanent scoring failures only. Transient failures (429/5xx) deliberately do
-- not increment this, so a rate-limited job is retried for free next drain.
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "scoreAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "scoreError" TEXT;

-- Drives the scoring queue (a user's unscored jobs, newest first) and the
-- discover list. Job previously had no index on userId at all.
CREATE INDEX IF NOT EXISTS "Job_userId_status_fetchedAt_idx" ON "Job"("userId", "status", "fetchedAt");

-- The reminders cron scans for due follow-ups across all users; without this it
-- is a full table scan.
CREATE INDEX IF NOT EXISTS "Application_followUpAt_stage_idx" ON "Application"("followUpAt", "stage");
