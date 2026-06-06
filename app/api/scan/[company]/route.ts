import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// TODO: install agent-browser when confirmed compatible with Vercel deployment target
// import { AgentBrowser } from "agent-browser";

export async function POST(req: NextRequest, { params }: { params: { company: string } }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { company } = params;

  // 1. Look up the PortalConfig for this company + user
  // TODO: resolve clerkId → internal User.id via prisma
  const portalConfig = await prisma.portalConfig.findFirst({
    where: { company, isActive: true },
  });

  if (!portalConfig) {
    return NextResponse.json(
      { error: `No active portal config found for company: ${company}` },
      { status: 404 }
    );
  }

  // 2. Run agent-browser to scrape the careers page
  // TODO: replace this stub with real agent-browser invocation
  // Strategy order mirrors career-ops scan.md:
  //   Level 0 — ATS API (Greenhouse / Ashby / Lever / BambooHR / Teamtailor / Workday)
  //   Level 1 — agent-browser Playwright navigation of careersUrl
  //   Level 2 — WebSearch fallback
  const rawJobs: unknown[] = [];

  switch (portalConfig.atsType) {
    case "GREENHOUSE":
      // TODO: GET https://boards-api.greenhouse.io/v1/boards/{atsSlug}/jobs
      break;
    case "ASHBY":
      // TODO: GraphQL POST to jobs.ashbyhq.com/api/non-user-graphql
      break;
    case "LEVER":
      // TODO: GET https://api.lever.co/v0/postings/{atsSlug}?mode=json
      break;
    case "BAMBOOHR":
      // TODO: GET https://{atsSlug}.bamboohr.com/careers/list
      break;
    case "TEAMTAILOR":
      // TODO: GET https://{atsSlug}.teamtailor.com/jobs.rss
      break;
    case "WORKDAY":
      // TODO: POST to Workday jobs endpoint
      break;
    default:
      // CUSTOM — use agent-browser
      // TODO:
      // const browser = new AgentBrowser();
      // await browser.navigate(portalConfig.careersUrl);
      // const snapshot = await browser.snapshot();
      // rawJobs = parseJobsFromSnapshot(snapshot, portalConfig.titleFilterPositive, portalConfig.titleFilterNegative);
      break;
  }

  // 3. Upsert discovered jobs into DB
  // TODO: for each rawJob, upsert into Job table, then enqueue Claude scoring

  // 4. Update lastScannedAt
  await prisma.portalConfig.update({
    where: { id: portalConfig.id },
    data: { lastScannedAt: new Date() },
  });

  return NextResponse.json({
    company,
    scanned: new Date().toISOString(),
    discovered: rawJobs.length,
    jobs: rawJobs,
  });
}
