import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";

// ── Stages that should not receive follow-up reminders ───────────────────────

const TERMINAL_STAGES = ["Offer", "Rejected", "Ghosted", "Withdrawn", "Archived"];

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  });

  let sent = 0;
  let cleared = 0;

  for (const app of dueApplications) {
    const role =
      app.job?.title ?? (app.inlineJobData as { title?: string } | null)?.title ?? "this role";
    const company =
      app.job?.company ??
      (app.inlineJobData as { company?: string } | null)?.company ??
      "this company";

    const body = `Follow up on ${role} at ${company} — no response yet`;

    const { pushed } = await notifyUser({
      userId: app.user.id,
      type: "follow_up_reminder",
      title: "Follow-up Reminder",
      body,
      url: "/pipeline",
      preferences: app.user.preferences,
      subscriptions: app.user.pushSubscriptions,
    });
    sent += pushed;

    // Clear followUpAt regardless of whether a notification was sent
    await prisma.application.update({
      where: { id: app.id },
      data: { followUpAt: null },
    });
    cleared++;
  }

  return NextResponse.json({ ok: true, processed: dueApplications.length, sent, cleared });
}
