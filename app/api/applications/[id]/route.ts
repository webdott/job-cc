import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const application = await prisma.application.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    stage?: string;
    notes?: string;
    followUpAt?: string;
  };

  const updated = await prisma.application.update({
    where: { id: params.id },
    data: {
      ...(body.stage !== undefined && { stage: body.stage }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.followUpAt !== undefined && { followUpAt: new Date(body.followUpAt) }),
      lastActivityAt: new Date(),
      timelineEvents: {
        push: body.stage
          ? { type: "stage_change", stage: body.stage, at: new Date().toISOString() }
          : undefined,
      },
    },
    include: { job: { include: { evaluation: true } } },
  });

  return NextResponse.json({ application: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.application.deleteMany({
    where: { id: params.id, userId: user.id },
  });

  return NextResponse.json({ success: true });
}
