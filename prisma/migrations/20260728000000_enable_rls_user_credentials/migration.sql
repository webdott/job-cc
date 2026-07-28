-- UserCredentials stores encrypted BYOC secrets — RLS here is defense-in-depth
-- on top of at-rest encryption, matching every other table (see
-- 20260604000000_enable_rls). Service role bypasses RLS.
ALTER TABLE "UserCredentials" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service only" ON "UserCredentials" USING (false);
