import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ stats: null });

  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: { job: { include: { evaluation: true } }, evaluation: true },
    orderBy: { createdAt: "asc" },
  });

  type App = (typeof applications)[number];

  const total = applications.length;
  const applied = applications.filter((a: App) => a.stage !== "Saved").length;
  const responded = applications.filter((a: App) =>
    ["Screening", "Interview", "Offer", "Rejected"].includes(a.stage)
  ).length;
  const interviews = applications.filter((a: App) =>
    ["Interview", "Offer"].includes(a.stage)
  ).length;
  const offers = applications.filter((a: App) => a.stage === "Offer").length;
  const rejected = applications.filter((a: App) => a.stage === "Rejected").length;

  const responseRate = applied > 0 ? Math.round((responded / applied) * 100) : 0;
  const interviewRate = responded > 0 ? Math.round((interviews / responded) * 100) : 0;

  // Stage funnel
  const funnel = [
    {
      stage: "Saved",
      count: applications.filter((a: App) => a.stage === "Saved").length,
    },
    {
      stage: "Applied",
      count: applications.filter((a: App) => a.stage === "Applied").length,
    },
    {
      stage: "Screening",
      count: applications.filter((a: App) => a.stage === "Screening").length,
    },
    {
      stage: "Interview",
      count: applications.filter((a: App) => a.stage === "Interview").length,
    },
    { stage: "Offer", count: offers },
    { stage: "Rejected", count: rejected },
  ];

  // Applications by day of week
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDay = dayNames.map((day, i) => ({
    day,
    count: applications.filter((a: App) => new Date(a.createdAt).getDay() === i).length,
  }));

  // Weekly trend — last 8 weeks
  const now = new Date();
  const weeklyTrend = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (7 - i) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const label = `W${8 - i}`;
    return {
      week: label,
      applied: applications.filter((a: App) => {
        const d = new Date(a.createdAt);
        return d >= weekStart && d < weekEnd && a.stage !== "Saved";
      }).length,
      responses: applications.filter((a: App) => {
        const d = new Date(a.lastActivityAt);
        return (
          d >= weekStart && d < weekEnd && ["Screening", "Interview", "Offer"].includes(a.stage)
        );
      }).length,
    };
  });

  // Average score of applications
  const scores = applications.flatMap((a: App) => {
    const score = a.job?.evaluation?.overallScore;
    return score != null ? [score] : [];
  });
  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return NextResponse.json({
    stats: {
      total,
      applied,
      responded,
      interviews,
      offers,
      rejected,
      responseRate,
      interviewRate,
      avgScore,
      funnel,
      byDay,
      weeklyTrend,
    },
  });
}
