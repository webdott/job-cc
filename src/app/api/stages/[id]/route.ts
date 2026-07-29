import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { STAGE_COLOR_OPTIONS } from "@/lib/stage-constants";
import { parseBody } from "@/lib/validation";

const UpdateStageSchema = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  color: z.enum(STAGE_COLOR_OPTIONS).optional(),
});

// PATCH /api/stages/:id — rename and/or recolor a stage (key is stable, never renamed)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const stage = await prisma.stage.findFirst({ where: { id: params.id, userId: user.id } });
  if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

  const { data, error } = await parseBody(req, UpdateStageSchema);
  if (error) return error;

  const updated = await prisma.stage.update({ where: { id: stage.id }, data });
  return NextResponse.json({ stage: updated });
}

// DELETE /api/stages/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const stage = await prisma.stage.findFirst({ where: { id: params.id, userId: user.id } });
  if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

  const stageCount = await prisma.stage.count({ where: { userId: user.id } });
  if (stageCount <= 1) {
    return NextResponse.json({ error: "You must keep at least one stage." }, { status: 400 });
  }

  const inUse = await prisma.application.count({ where: { userId: user.id, stage: stage.key } });
  if (inUse > 0) {
    return NextResponse.json(
      {
        error: `${inUse} application${inUse === 1 ? "" : "s"} still in "${stage.label}". Move them to another stage first.`,
      },
      { status: 409 }
    );
  }

  await prisma.stage.delete({ where: { id: stage.id } });
  return NextResponse.json({ success: true });
}
