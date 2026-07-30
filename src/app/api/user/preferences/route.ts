import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validation";
import { recomputePrefMatch } from "@/lib/job-ingest";
import { readJobPreferences } from "@/lib/job-match";

/** The subset of preferences that affects which jobs are worth scoring.
 * Editing only notification settings shouldn't touch the queue. */
const JOB_PREFERENCE_KEYS = [
  "targetRoles",
  "locations",
  "salaryMin",
  "salaryMax",
  "workType",
] as const;

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM (24h)");

const NotificationPrefsSchema = z.object({
  jobMatches: z.boolean().optional(),
  followUpReminders: z.boolean().optional(),
  quietHoursStart: timeOfDaySchema.nullable().optional(),
  quietHoursEnd: timeOfDaySchema.nullable().optional(),
});

const PreferencesSchema = z.object({
  targetRoles: z.array(z.string().max(200)).max(50).optional(),
  locations: z.array(z.string().max(200)).max(50).optional(),
  salaryMin: z.string().max(20).optional(),
  salaryMax: z.string().max(20).optional(),
  workType: z
    .array(z.enum(["Remote", "Hybrid", "On-site"]))
    .max(3)
    .optional(),
  notifications: NotificationPrefsSchema.optional(),
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
  const { data: patch, error } = await parseBody(req, PreferencesSchema);
  if (error) return error;

  // Preferences covers several unrelated sections (job prefs, notification
  // settings, ...) saved independently from different parts of the UI — merge
  // rather than replace so saving one section doesn't wipe out another.
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  const existingPreferences = (existing?.preferences as Record<string, unknown>) ?? {};
  const preferences = { ...existingPreferences, ...patch };

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

  // Changing what you're looking for has to change what gets scored — both
  // ways. Broadening targetRoles brings previously-skipped jobs back into the
  // queue; narrowing them takes jobs out of it.
  if (JOB_PREFERENCE_KEYS.some((key) => key in patch)) {
    await recomputePrefMatch(user.id, readJobPreferences(preferences));
  }

  return NextResponse.json({ user });
}
