import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { ParsedResume } from "@/lib/resume-parser";
import { COMMON_SKILLS } from "@/lib/skills-taxonomy";

const TOP_SKILLS_LIMIT = 10;

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

/** Case-insensitive, word-boundary-aware match for a skill inside free text. */
function buildSkillRegex(skill: string): RegExp {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isWordChar = (c: string) => /[A-Za-z0-9]/.test(c);
  const lead = isWordChar(skill[0]) ? "(?<![A-Za-z0-9])" : "";
  const trail = isWordChar(skill[skill.length - 1]) ? "(?![A-Za-z0-9])" : "";
  return new RegExp(`${lead}${escaped}${trail}`, "i");
}

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ stats: null });

  const [applications, activeResume] = await Promise.all([
    prisma.application.findMany({
      where: { userId: user.id },
      include: { job: { include: { evaluation: true } }, evaluation: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.resume.findFirst({ where: { userId: user.id, isActive: true } }),
  ]);

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

  // Skills gap — top skills demanded across the tracked pipeline vs. the
  // active resume's skills. There's no structured "required skills" field on
  // Job/JobEvaluation, so we mine Job.description text against a curated
  // skill vocabulary (COMMON_SKILLS) merged with the resume's own skills.
  let skillsGap: {
    hasResume: boolean;
    hasData: boolean;
    resumeSkillCount: number;
    topSkills: { skill: string; count: number; status: "have" | "gap" }[];
  };

  if (!activeResume) {
    skillsGap = { hasResume: false, hasData: false, resumeSkillCount: 0, topSkills: [] };
  } else {
    const resumeSkills = (activeResume.parsedData as ParsedResume)?.skills ?? [];
    const resumeSkillSet = new Set(resumeSkills.map(normalizeSkill));

    // Vocabulary: canonical skills + any resume skill not already covered,
    // keyed by normalized name so "have" skills never appear twice.
    const vocab = new Map<string, string>();
    for (const skill of COMMON_SKILLS) vocab.set(normalizeSkill(skill), skill);
    for (const skill of resumeSkills) {
      const key = normalizeSkill(skill);
      if (!vocab.has(key)) vocab.set(key, skill);
    }

    // Dedupe job descriptions by job id so a skill counts once per job even
    // if multiple applications somehow reference it.
    const jobDescriptions = new Map<string, string>();
    for (const a of applications) {
      if (a.job?.id && a.job.description) jobDescriptions.set(a.job.id, a.job.description);
    }

    const counts = new Map<string, number>();
    for (const description of Array.from(jobDescriptions.values())) {
      for (const [key, label] of Array.from(vocab.entries())) {
        if (buildSkillRegex(label).test(description)) {
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }

    const topSkills = Array.from(counts.entries())
      .map(([key, count]) => ({
        skill: vocab.get(key) as string,
        count,
        status: (resumeSkillSet.has(key) ? "have" : "gap") as "have" | "gap",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_SKILLS_LIMIT);

    skillsGap = {
      hasResume: true,
      hasData: jobDescriptions.size > 0,
      resumeSkillCount: resumeSkills.length,
      topSkills,
    };
  }

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
      skillsGap,
      funnel,
      byDay,
      weeklyTrend,
    },
  });
}
