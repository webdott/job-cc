import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// GET /api/user/me — upsert user on first load, return their profile
export async function GET() {
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
    update: {
      // Keep name/email in sync if Clerk profile changes
      email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
      name: clerkUser?.fullName ?? "",
    },
    include: {
      resumes: { where: { isActive: true }, take: 1 },
    },
  });

  return NextResponse.json({
    user,
    hasResume: user.resumes.length > 0,
  });
}
