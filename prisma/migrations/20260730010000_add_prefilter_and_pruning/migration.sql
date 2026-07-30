-- Cross-source dedupe, preference prefiltering, and low-score pruning (issue #36).
--
-- Guarded with IF NOT EXISTS / IF EXISTS throughout: this repo iterates with
-- `prisma db push`, which applies schema changes without recording anything in
-- `_prisma_migrations`, so a database that was pushed to before this migration
-- shipped already has these objects. Without the guards `migrate deploy` aborts
-- and then blocks every later migration.
--
-- No new tables, so no RLS block — Job already carries the "service only"
-- policy from 20260604000000_enable_rls.

-- Normalized "company|title" so the same role on two sources collapses to one
-- row. Indexed but NOT unique on purpose: HN titles are parsed heuristically
-- from free text, and a bad parse must not be able to permanently block a
-- legitimate posting from being stored.
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

-- Whether the job matched the user's targetRoles at ingest time.
-- NULL = never evaluated (ingested before filtering existed), treated as
-- eligible so nothing already in the queue gets stranded by this migration.
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "prefMatch" BOOLEAN;

-- "low_score" | "user".
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;

-- Supersedes Job_userId_status_fetchedAt_idx from 20260730000000: both the
-- scoring queue and the discover list now also filter on prefMatch, and a
-- partial-prefix index can't serve the fetchedAt ordering once prefMatch is
-- constrained.
CREATE INDEX IF NOT EXISTS "Job_userId_status_prefMatch_fetchedAt_idx" ON "Job"("userId", "status", "prefMatch", "fetchedAt");
DROP INDEX IF EXISTS "Job_userId_status_fetchedAt_idx";

CREATE INDEX IF NOT EXISTS "Job_userId_dedupeKey_idx" ON "Job"("userId", "dedupeKey");
