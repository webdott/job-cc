import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const application = await prisma.application.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as { followUpAt: string };
  if (!body.followUpAt) {
    return NextResponse.json({ error: "followUpAt is required" }, { status: 400 });
  }

  const updated = await prisma.application.update({
    where: { id: params.id },
    data: { followUpAt: new Date(body.followUpAt) },
  });

  return NextResponse.json({ application: updated });
}
