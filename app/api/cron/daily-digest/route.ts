import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreJob } from "@/lib/job-scorer";
import { sanitizeJobDescription, stripToPlainText } from "@/lib/sanitize";
import { notifyUser } from "@/lib/notifications";
import type { ParsedResume } from "@/lib/resume-parser";
import { parseHNListing, HN_LOW_CONFIDENCE_NOTICE } from "@/lib/hn-job-parser";
import { resolveUserCredentials } from "@/lib/byoc";

// ── Job fetch helpers (mirrors /api/jobs/discover) ───────────────────────────

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location: string;
  description: string;
  salary: string;
  publication_date: string;
}

interface ArbeitnowJob {
  slug: string;
  url: string;
  title: string;
  company_name: string;
  location: string;
  description: string;
  remote: boolean;
  published_at: string;
}

interface HNStory {
  hits: Array<{ objectID: string }>;
}

interface HNItem {
  children: Array<{ text: string; objectID: string }>;
}

function validDate(raw: string | number | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchRemotive() {
  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?limit=100");
    const data = (await res.json()) as { jobs: RemotiveJob[] };
    return (data.jobs ?? []).map((j) => ({
      sourceUrl: j.url,
      sourceId: `remotive-${j.id}`,
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || "Remote",
      description: sanitizeJobDescription(j.description),
      remote: true,
      postedAt: validDate(j.publication_date),
    }));
  } catch {
    return [];
  }
}

// Arbeitnow's API is genuinely paginated (`links.next` points at the next
// page). Follow it instead of slicing a single page, capped so a run
// doesn't balloon into hundreds of jobs needing per-job AI scoring.
const ARBEITNOW_CAP = 60;
const ARBEITNOW_MAX_PAGES = 3;

async function fetchArbeitnow() {
  const jobs: ArbeitnowJob[] = [];
  let url: string | null = "https://www.arbeitnow.com/api/job-board-api";

  for (let page = 0; url && page < ARBEITNOW_MAX_PAGES && jobs.length < ARBEITNOW_CAP; page++) {
    try {
      const res = await fetch(url);
      const data = (await res.json()) as {
        data: ArbeitnowJob[];
        links?: { next?: string | null };
      };
      jobs.push(...(data.data ?? []));
      url = data.links?.next ?? null;
    } catch {
      break; // keep whatever pages were already fetched
    }
  }

  return jobs.slice(0, ARBEITNOW_CAP).map((j) => ({
    sourceUrl: j.url,
    sourceId: `arbeitnow-${j.slug}`,
    title: j.title,
    company: j.company_name,
    location: j.location,
    description: stripToPlainText(j.description),
    remote: j.remote ?? false,
    postedAt: validDate(String(j.published_at)),
  }));
}

async function fetchHNHiring() {
  try {
    // Find latest "Ask HN: Who's Hiring" thread
    const searchRes = await fetch(
      "https://hn.algolia.com/api/v1/search?query=Ask+HN+Who+is+hiring&tags=story,ask_hn&hitsPerPage=1"
    );
    const searchData = (await searchRes.json()) as HNStory;
    const storyId = searchData.hits?.[0]?.objectID;
    if (!storyId) return [];

    const storyRes = await fetch(`https://hn.algolia.com/api/v1/items/${storyId}`);
    const story = (await storyRes.json()) as HNItem;

    return (story.children ?? []).slice(0, 20).map((comment) => {
      const text = stripToPlainText(comment.text ?? "");
      const parsed = parseHNListing(text);
      const description = parsed.lowConfidence
        ? `${HN_LOW_CONFIDENCE_NOTICE}\n\n${text}`.slice(0, 2000)
        : text.slice(0, 2000);

      return {
        sourceUrl: `https://news.ycombinator.com/item?id=${comment.objectID}`,
        sourceId: `hn-${comment.objectID}`,
        title: parsed.title,
        company: parsed.company,
        location: parsed.location,
        description,
        remote: text.toLowerCase().includes("remote"),
        postedAt: new Date(),
      };
    });
  } catch {
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runStartedAt = new Date();

  // Fetch jobs from external sources once (shared across all users)
  const [remotive, arbeitnow, hn] = await Promise.all([
    fetchRemotive(),
    fetchArbeitnow(),
    fetchHNHiring(),
  ]);
  const allJobData = [...remotive, ...arbeitnow, ...hn];

  // Run discovery for every user with an active resume — not just those with
  // a push subscription, so users who never enabled notifications still get
  // automatic re-discovery. Notifications are sent afterward, only to users
  // who have at least one PushSubscription.
  const users = await prisma.user.findMany({
    where: { resumes: { some: { isActive: true } } },
    include: {
      resumes: { where: { isActive: true }, take: 1 },
      pushSubscriptions: true,
    },
  });

  let totalNotificationsSent = 0;

  for (const user of users) {
    const activeResume = user.resumes[0] ?? null;
    if (!activeResume) continue;

    const credentials = await resolveUserCredentials(user.email, user.id);
    if (!credentials) continue; // non-allowlisted user with no saved/verified BYOC credentials

    const parsedData = activeResume.parsedData as ParsedResume;
    const newJobs = [];
    let bestJob: { title: string; company: string; score: number } | null = null;

    for (const jobData of allJobData) {
      try {
        // Upsert job for this user
        const job = await prisma.job.upsert({
          where: { sourceUrl_userId: { sourceUrl: jobData.sourceUrl, userId: user.id } },
          create: { ...jobData, userId: user.id },
          update: {},
        });

        const isNew = job.fetchedAt >= runStartedAt;
        if (!isNew) continue;

        // Score the new job
        const score = await scoreJob(
          job.description,
          job.title,
          parsedData,
          credentials.ai.flashModel
        );

        await prisma.jobEvaluation.upsert({
          where: { jobId: job.id },
          create: {
            jobId: job.id,
            userId: user.id,
            overallScore: score.overallScore,
            recommendation: score.recommendation,
            archetype: score.archetype,
            blockA: { reason: score.reason },
          },
          update: {},
        });

        newJobs.push({ title: job.title, company: job.company, score: score.overallScore });

        if (!bestJob || score.overallScore > bestJob.score) {
          bestJob = { title: job.title, company: job.company, score: score.overallScore };
        }
      } catch {
        // Continue on per-job failure
      }
    }

    if (newJobs.length === 0) continue;

    const body = bestJob
      ? `${newJobs.length} new job match${newJobs.length !== 1 ? "es" : ""} — best: ${bestJob.title} at ${bestJob.company} (${Math.round(bestJob.score)}%)`
      : `${newJobs.length} new job match${newJobs.length !== 1 ? "es" : ""} found for you`;

    const { pushed } = await notifyUser({
      userId: user.id,
      type: "job_match",
      title: "Job Command Center",
      body,
      url: "/discover",
      preferences: user.preferences,
      subscriptions: user.pushSubscriptions,
    });
    totalNotificationsSent += pushed;
  }

  return NextResponse.json({
    ok: true,
    usersProcessed: users.length,
    notificationsSent: totalNotificationsSent,
  });
}
