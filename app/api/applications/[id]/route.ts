import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sanitizeJobDescription } from "@/lib/sanitize";
import { parseBody, ApplicationStageSchema, dateStringSchema } from "@/lib/validation";

// Contact fields autosave on blur as the user tabs through an in-progress row,
// so blank strings are valid (not-yet-filled) — only reject malformed non-empty values.
const ContactSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  linkedin: z.union([z.string().url(), z.literal("")]).optional(),
});

const UpdateApplicationSchema = z.object({
  stage: ApplicationStageSchema.optional(),
  notes: z.string().optional(),
  followUpAt: dateStringSchema.nullable().optional(),
  contacts: z.array(ContactSchema).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const application = await prisma.application.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      job: { include: { evaluation: true } },
      coverLetter: true,
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ application });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const application = await prisma.application.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: body, error } = await parseBody(req, UpdateApplicationSchema);
  if (error) return error;

  // For timeline, we need to read first then append
  const existing = await prisma.application.findFirst({
    where: { id: params.id, userId: user.id },
    select: { timelineEvents: true },
  });
  const prevEvents = (existing?.timelineEvents ?? []) as object[];
  const newEvents = body.stage
    ? [...prevEvents, { type: "stage_change", stage: body.stage, at: new Date().toISOString() }]
    : prevEvents;

  const updated = await prisma.application.update({
    where: { id: params.id },
    data: {
      ...(body.stage !== undefined && { stage: body.stage }),
      ...(body.notes !== undefined && { notes: sanitizeJobDescription(body.notes) }),
      ...(body.followUpAt !== undefined && {
        followUpAt: body.followUpAt ? new Date(body.followUpAt) : null,
      }),
      ...(body.contacts !== undefined && { contacts: body.contacts }),
      lastActivityAt: new Date(),
      timelineEvents: newEvents,
    },
    include: { job: { include: { evaluation: true } }, coverLetter: true },
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
