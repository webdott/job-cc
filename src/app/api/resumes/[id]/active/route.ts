import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/resumes/:id/active — set this resume as active
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify ownership
  const resume = await prisma.resume.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  // Deactivate all, then activate the target
  await prisma.resume.updateMany({ where: { userId: user.id }, data: { isActive: false } });
  await prisma.resume.update({ where: { id: params.id }, data: { isActive: true } });

  return NextResponse.json({ success: true });
}
