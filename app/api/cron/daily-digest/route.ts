import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreJob } from "@/lib/job-scorer";
import { sanitizeJobDescription, stripToPlainText } from "@/lib/sanitize";
import webpush from "web-push";
import type { ParsedResume } from "@/lib/resume-parser";

// ── web-push setup ────────────────────────────────────────────────────────────

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "admin@example.com"}`,
  process.env.VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
);

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

function validDate(raw: string | number | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchRemotive() {
  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?limit=20");
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

async function fetchArbeitnow() {
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api");
    const data = (await res.json()) as { data: ArbeitnowJob[] };
    return (data.data ?? []).slice(0, 20).map((j) => ({
      sourceUrl: j.url,
      sourceId: `arbeitnow-${j.slug}`,
      title: j.title,
      company: j.company_name,
      location: j.location,
      description: stripToPlainText(j.description),
      remote: j.remote ?? false,
      postedAt: validDate(String(j.published_at)),
    }));
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

  // Fetch jobs from external sources once (shared across all users)
  const [remotive, arbeitnow] = await Promise.all([fetchRemotive(), fetchArbeitnow()]);
  const allJobData = [...remotive, ...arbeitnow];

  // Get all users who have at least one push subscription
  const subscriptions = await prisma.pushSubscription.findMany({
    include: {
      user: {
        include: {
          resumes: { where: { isActive: true }, take: 1 },
        },
      },
    },
  });

  let totalNotificationsSent = 0;

  for (const sub of subscriptions) {
    const user = sub.user;
    const activeResume = user.resumes[0] ?? null;
    if (!activeResume) continue;

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

        const isNew = job.fetchedAt > new Date(Date.now() - 10_000);
        if (!isNew) continue;

        // Score the new job
        const score = await scoreJob(job.description, job.title, parsedData);

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

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: "Job Command Center",
          body,
          icon: "/icons/icon-192x192.png",
          url: "/discover",
        })
      );
      totalNotificationsSent++;
    } catch {
      // Subscription may be expired — remove it
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    usersProcessed: subscriptions.length,
    notificationsSent: totalNotificationsSent,
  });
}
