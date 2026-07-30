-- Per-user AI model preferences (allowlisted + BYOC).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiFlashModel" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiProModel" TEXT;
