import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validation";
import { PREF_MATCH_ELIGIBLE } from "@/lib/score-queue";
import { JOB_CLIENT_SELECT } from "@/lib/job-select";

const DeleteJobSchema = z.object({
  id: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ jobs: [], nextCursor: null, total: 0 });

  const { searchParams } = new URL(req.url);
  const minScore = searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined;
  const remoteOnly = searchParams.get("remote") === "true";
  const showArchived = searchParams.get("showArchived") === "true";
  const sortBy = (searchParams.get("sortBy") ?? "newest") as "newest" | "score";
  const PAGE_SIZE = 20;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const skip = (page - 1) * PAGE_SIZE;

  // Built as an AND list because several clauses each need their own OR.
  const conditions: Prisma.JobWhereInput[] = [
    { userId: user.id },
    ...(remoteOnly ? [{ remote: true }] : []),
  ];

  // Hidden by default: jobs that scored below the threshold, and jobs that
  // don't match the user's target roles. Both stay reachable via
  // ?showArchived=true so nothing is invisible AND unrecoverable.
  if (!showArchived) {
    conditions.push({ status: { not: "ARCHIVED" } }, { OR: PREF_MATCH_ELIGIBLE });
  }

  if (minScore !== undefined && minScore > 0) {
    // An unscored job is pending, not a zero. The previous
    // `(overallScore ?? 0) >= minScore` made every job still in the scoring
    // queue disappear the moment the slider left 0, which now happens
    // constantly because scoring is asynchronous.
    conditions.push({
      OR: [{ evaluation: { overallScore: { gte: minScore } } }, { evaluation: { is: null } }],
    });
  }

  const where: Prisma.JobWhereInput = { AND: conditions };

  const orderBy: Prisma.JobOrderByWithRelationInput[] =
    sortBy === "score"
      ? // Unscored jobs sort last rather than first, which is what Postgres
        // would otherwise do with NULLs on a DESC ordering.
        [{ evaluation: { overallScore: { sort: "desc", nulls: "last" } } }, { fetchedAt: "desc" }]
      : [{ fetchedAt: "desc" }];

  // Previously this loaded every job the user had into memory, then filtered,
  // sorted and sliced in JS — while advertising pagination.
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({ where, select: JOB_CLIENT_SELECT, orderBy, skip, take: PAGE_SIZE }),
  ]);

  return NextResponse.json({ jobs, hasMore: skip + jobs.length < total, total, page });
}

export async function DELETE(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await parseBody(req, DeleteJobSchema);
  if (error) return error;

  const job = await prisma.job.findFirst({
    where: { id: data.id, userId: user.id },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      sourceUrl: true,
      remote: true,
      salaryMin: true,
      salaryMax: true,
      _count: { select: { applications: true } },
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // `Application.jobId` is optional, so Prisma's default is `onDelete: SetNull`
  // — deleting the job doesn't error, it silently nulls the link. And because
  // `jobId` and `inlineJobData` are mutually exclusive, the pipeline card would
  // survive with no title, company, or score. Copy the details onto the
  // application first so removing a job from Discover never guts the pipeline.
  if (job._count.applications > 0) {
    await prisma.$transaction([
      prisma.application.updateMany({
        where: { jobId: job.id },
        data: {
          inlineJobData: {
            title: job.title,
            company: job.company,
            location: job.location,
            sourceUrl: job.sourceUrl,
            remote: job.remote,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
          },
        },
      }),
      prisma.job.delete({ where: { id: job.id } }),
    ]);
  } else {
    await prisma.job.delete({ where: { id: job.id } });
  }

  return NextResponse.json({ success: true });
}
