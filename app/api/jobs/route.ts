import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ jobs: [], nextCursor: null, total: 0 });

  const { searchParams } = new URL(req.url);
  const minScore = searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined;
  const remoteOnly = searchParams.get("remote") === "true";
  const sortBy = (searchParams.get("sortBy") ?? "newest") as "newest" | "score";
  const PAGE_SIZE = 20;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    userId: user.id,
    ...(remoteOnly ? { remote: true } : {}),
  };

  // Fetch all matching jobs (we need to sort by score after join)
  const allJobs = await prisma.job.findMany({
    where,
    include: { evaluation: true },
    orderBy: { fetchedAt: "desc" },
  });

  type JobItem = (typeof allJobs)[number];

  // Filter by minScore
  const filtered = minScore
    ? allJobs.filter((j: JobItem) => (j.evaluation?.overallScore ?? 0) >= minScore)
    : allJobs;

  // Sort
  const sorted =
    sortBy === "score"
      ? [...filtered].sort(
          (a, b) => (b.evaluation?.overallScore ?? -1) - (a.evaluation?.overallScore ?? -1)
        )
      : filtered; // already sorted by fetchedAt desc from Prisma

  const total = sorted.length;
  const pageJobs = sorted.slice(skip, skip + PAGE_SIZE);
  const hasMore = skip + PAGE_SIZE < total;

  return NextResponse.json({ jobs: pageJobs, hasMore, total, page });
}

export async function DELETE(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = (await req.json()) as { id: string };

  await prisma.job.deleteMany({ where: { id, userId: user.id } });

  return NextResponse.json({ success: true });
}
