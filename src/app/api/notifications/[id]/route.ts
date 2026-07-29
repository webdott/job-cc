import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/notifications/:id — mark a single notification as read
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const notification = await prisma.notification.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt ?? new Date() },
  });

  return NextResponse.json({ notification: updated });
}
