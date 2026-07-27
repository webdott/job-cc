import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validation";

const PreferencesSchema = z.object({
  targetRoles: z.array(z.string().max(200)).max(50).optional(),
  locations: z.array(z.string().max(200)).max(50).optional(),
  salaryMin: z.string().max(20).optional(),
  salaryMax: z.string().max(20).optional(),
  workType: z
    .array(z.enum(["Remote", "Hybrid", "On-site"]))
    .max(3)
    .optional(),
});

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  return NextResponse.json({ preferences: user?.preferences ?? {} });
}

export async function PATCH(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clerkUser = await currentUser();
  const { data: preferences, error } = await parseBody(req, PreferencesSchema);
  if (error) return error;

  const user = await prisma.user.upsert({
    where: { clerkId },
    create: {
      clerkId,
      email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
      name: clerkUser?.fullName ?? "",
      preferences,
    },
    update: { preferences },
  });

  return NextResponse.json({ user });
}
