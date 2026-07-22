-- Remove the never-finished ATS portal-scan stub: PortalConfig model, AtsType
-- enum, and their relations on Job/User (see issue #19).
ALTER TABLE "Job" DROP CONSTRAINT IF EXISTS "Job_portalConfigId_fkey";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "portalConfigId";
DROP TABLE IF EXISTS "PortalConfig";
DROP TYPE IF EXISTS "AtsType";
