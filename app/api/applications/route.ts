import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ applications: [] });

  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: { job: { include: { evaluation: true } } },
    orderBy: { lastActivityAt: "desc" },
  });

  return NextResponse.json({ applications });
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const {
    jobId,
    stage = "Saved",
    inlineJobData,
  } = (await req.json()) as {
    jobId?: string;
    stage?: string;
    inlineJobData?: object;
  };

  // Prevent duplicate applications for the same job
  if (jobId) {
    const existing = await prisma.application.findFirst({
      where: { userId: user.id, jobId },
    });
    if (existing) return NextResponse.json({ application: existing });
  }

  const application = await prisma.application.create({
    data: {
      userId: user.id,
      jobId,
      inlineJobData,
      stage,
      lastActivityAt: new Date(),
    },
    include: { job: true },
  });

  return NextResponse.json({ application }, { status: 201 });
}
