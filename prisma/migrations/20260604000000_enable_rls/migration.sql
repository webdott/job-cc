-- Enable RLS on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Resume" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobEvaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoverLetter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterviewStory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PdfExport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;

-- Block direct anon/browser access (service role bypasses RLS)
CREATE POLICY "service only" ON "User" USING (false);
CREATE POLICY "service only" ON "Resume" USING (false);
CREATE POLICY "service only" ON "PortalConfig" USING (false);
CREATE POLICY "service only" ON "Job" USING (false);
CREATE POLICY "service only" ON "JobEvaluation" USING (false);
CREATE POLICY "service only" ON "Application" USING (false);
CREATE POLICY "service only" ON "CoverLetter" USING (false);
CREATE POLICY "service only" ON "InterviewStory" USING (false);
CREATE POLICY "service only" ON "PdfExport" USING (false);
CREATE POLICY "service only" ON "PushSubscription" USING (false);
