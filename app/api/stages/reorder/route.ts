import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validation";

const ReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
});

// POST /api/stages/reorder — { ids: [...] } in the new display order
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await parseBody(req, ReorderSchema);
  if (error) return error;

  const owned = await prisma.stage.count({ where: { userId: user.id, id: { in: data.ids } } });
  if (owned !== data.ids.length) {
    return NextResponse.json({ error: "Invalid stage ids" }, { status: 400 });
  }

  await prisma.$transaction(
    data.ids.map((id, position) => prisma.stage.update({ where: { id }, data: { position } }))
  );

  return NextResponse.json({ success: true });
}
