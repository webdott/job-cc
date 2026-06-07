import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { scoreJob } from "@/lib/job-scorer";
import type { ParsedResume } from "@/lib/resume-parser";
import { sanitizeJobDescription, stripToPlainText } from "@/lib/sanitize";

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

async function fetchRemotive() {
  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?limit=20", {
      next: { revalidate: 3600 },
    });
    const data = (await res.json()) as { jobs: RemotiveJob[] };
    return (data.jobs ?? []).map((j: RemotiveJob) => ({
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

function validDate(raw: string | number | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchArbeitnow() {
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      next: { revalidate: 3600 },
    });
    const data = (await res.json()) as { data: ArbeitnowJob[] };
    return (data.data ?? []).slice(0, 20).map((j: ArbeitnowJob) => ({
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

    return (story.children ?? [])
      .slice(0, 20)
      .map((comment: { text: string; objectID: string }) => {
        const text = stripToPlainText(comment.text ?? "");
        const lines = text.split("\n").filter(Boolean);
        const firstLine = lines[0] ?? "";

        // Best-effort parse: "Company | Role | Location"
        const parts = firstLine.split("|").map((s) => s.trim());
        const company = parts[0] || "Unknown Company";
        const title = parts[1] || "Software Engineer";
        const location = parts[2] || "Remote";

        return {
          sourceUrl: `https://news.ycombinator.com/item?id=${comment.objectID}`,
          sourceId: `hn-${comment.objectID}`,
          title,
          company,
          location,
          description: text.slice(0, 2000),
          remote: text.toLowerCase().includes("remote"),
          postedAt: new Date(),
        };
      });
  } catch {
    return [];
  }
}

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });

  // Get active resume for scoring
  const activeResume = await prisma.resume.findFirst({
    where: { userId: user.id, isActive: true },
  });

  // Fetch all sources in parallel
  const [remotive, arbeitnow, hn] = await Promise.all([
    fetchRemotive(),
    fetchArbeitnow(),
    fetchHNHiring(),
  ]);

  const allJobs = [...remotive, ...arbeitnow, ...hn];
  let discovered = 0;
  let scored = 0;
  const savedJobs = [];

  for (const jobData of allJobs) {
    // Upsert job (skip duplicates)
    const job = await prisma.job.upsert({
      where: { sourceUrl_userId: { sourceUrl: jobData.sourceUrl, userId: user.id } },
      create: { ...jobData, userId: user.id },
      update: {},
    });

    const isNew = job.fetchedAt > new Date(Date.now() - 5000); // created in last 5s
    if (isNew) discovered++;

    // Score if we have a resume and no existing evaluation
    if (activeResume && isNew) {
      try {
        const parsedData = activeResume.parsedData as ParsedResume;
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
        scored++;
      } catch {
        // Scoring failed for this job — continue
      }
    }

    savedJobs.push(job);
  }

  return NextResponse.json({ discovered, scored, total: allJobs.length });
}
