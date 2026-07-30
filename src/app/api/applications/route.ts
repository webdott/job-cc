import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { JOB_CLIENT_SELECT } from "@/lib/job-select";
import { parseBody } from "@/lib/validation";
import { getOrSeedStages, isValidStageKey } from "@/lib/stages";

const CreateApplicationSchema = z
  .object({
    jobId: z.string().min(1).optional(),
    stage: z.string().min(1).max(50).optional(),
    inlineJobData: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((body) => body.jobId ?? body.inlineJobData, {
    message: "Provide either jobId or inlineJobData",
  });

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ applications: [] });

  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: { job: { select: JOB_CLIENT_SELECT } },
    orderBy: { lastActivityAt: "desc" },
  });

  return NextResponse.json({ applications });
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await parseBody(req, CreateApplicationSchema);
  if (error) return error;
  const { jobId, inlineJobData } = data;

  let stage = data.stage;
  if (stage === undefined) {
    const stages = await getOrSeedStages(user.id);
    stage = stages[0]?.key ?? "Saved";
  } else if (!(await isValidStageKey(user.id, stage))) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

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
      inlineJobData: inlineJobData as object,
      stage,
      lastActivityAt: new Date(),
    },
    include: { job: { select: JOB_CLIENT_SELECT } },
  });

  return NextResponse.json({ application }, { status: 201 });
}
