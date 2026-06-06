import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ jobs: [], nextCursor: null });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const minScore = searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const cursor = searchParams.get("cursor") ?? undefined;

  const jobs = await prisma.job.findMany({
    where: {
      userId: user.id,
      ...(status ? { status: status as "UNSEEN" | "SAVED" | "APPLIED" | "ARCHIVED" } : {}),
    },
    include: { evaluation: true },
    orderBy: { fetchedAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  type JobItem = (typeof jobs)[number];

  // Filter by minScore after join
  const filtered = minScore
    ? jobs.filter((j: JobItem) => (j.evaluation?.overallScore ?? 0) >= minScore)
    : jobs;

  const hasMore = filtered.length > limit;
  const page = filtered.slice(0, limit);
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;

  return NextResponse.json({ jobs: page, nextCursor });
}
