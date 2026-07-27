import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOrSeedStages } from "@/lib/stages";
import { STAGE_COLOR_OPTIONS } from "@/lib/stage-constants";
import { parseBody } from "@/lib/validation";

const CreateStageSchema = z.object({
  label: z.string().trim().min(1).max(40),
  color: z.enum(STAGE_COLOR_OPTIONS).optional(),
});

function slugify(label: string): string {
  return label.trim().replace(/\s+/g, "-").slice(0, 40) || "Stage";
}

// GET /api/stages — the user's ordered Kanban columns (seeds the six defaults on first use)
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ stages: [] });

  const stages = await getOrSeedStages(user.id);
  return NextResponse.json({ stages });
}

// POST /api/stages — add a custom stage, appended to the end
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clerkUser = await currentUser();
  const user = await prisma.user.upsert({
    where: { clerkId },
    create: {
      clerkId,
      email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
      name: clerkUser?.fullName ?? "",
    },
    update: {},
  });

  const { data, error } = await parseBody(req, CreateStageSchema);
  if (error) return error;

  const stages = await getOrSeedStages(user.id);

  const baseKey = slugify(data.label);
  const existingKeys = new Set(stages.map((s) => s.key));
  let key = baseKey;
  let suffix = 2;
  while (existingKeys.has(key)) {
    key = `${baseKey}-${suffix++}`;
  }

  const stage = await prisma.stage.create({
    data: {
      userId: user.id,
      key,
      label: data.label,
      color: data.color ?? "bg-slate-500",
      position: stages.length > 0 ? Math.max(...stages.map((s) => s.position)) + 1 : 0,
    },
  });

  return NextResponse.json({ stage }, { status: 201 });
}
