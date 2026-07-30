import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { resolveUserCredentials } from "@/lib/byoc";
import { requireCronSecret } from "@/lib/cron-auth";

// ── Stages that should not receive follow-up reminders ───────────────────────

const TERMINAL_STAGES = ["Offer", "Rejected", "Ghosted", "Withdrawn", "Archived"];

/** Bounded so a backlog can't push the run past the function timeout. Anything
 * left over keeps its followUpAt and is picked up by tomorrow's run. */
const MAX_PER_RUN = 200;

// ── Main handler ──────────────────────────────────────────────────────────────

// Previously declared none and inherited the platform default.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authError = requireCronSecret(req);
  if (authError) return authError;

  const now = new Date();

  // Find all applications with a due follow-up that aren't in terminal stages
  const dueApplications = await prisma.application.findMany({
    where: {
      followUpAt: { lte: now },
      stage: { notIn: TERMINAL_STAGES },
    },
    include: {
      user: {
        include: { pushSubscriptions: true },
      },
      job: true,
    },
    orderBy: { followUpAt: "asc" },
    take: MAX_PER_RUN,
  });

  let sent = 0;
  let cleared = 0;

  for (const app of dueApplications) {
    // One bad application must not abort the run and strand every reminder
    // after it. Anything that throws keeps its followUpAt and retries tomorrow.
    try {
      const role =
        app.job?.title ?? (app.inlineJobData as { title?: string } | null)?.title ?? "this role";
      const company =
        app.job?.company ??
        (app.inlineJobData as { company?: string } | null)?.company ??
        "this company";

      const body = `Follow up on ${role} at ${company} — no response yet`;

      const credentials = await resolveUserCredentials(app.user.email, app.user.id);

      const { pushed, emailed } = await notifyUser({
        userId: app.user.id,
        type: "follow_up_reminder",
        title: "Follow-up Reminder",
        body,
        url: "/pipeline",
        preferences: app.user.preferences,
        subscriptions: app.user.pushSubscriptions,
        userEmail: app.user.email,
        emailCredentials: credentials?.email ?? null,
      });
      sent += Math.max(pushed, emailed ? 1 : 0);

      // Clear followUpAt regardless of whether a notification was sent
      await prisma.application.update({
        where: { id: app.id },
        data: { followUpAt: null },
      });
      cleared++;
    } catch (err) {
      console.error(`Follow-up reminder failed for application ${app.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, processed: dueApplications.length, sent, cleared });
}
