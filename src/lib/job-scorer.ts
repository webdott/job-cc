import { generateObject } from "ai";
import { z } from "zod";
import type { ParsedResume } from "@/lib/resume-parser";
import type { ModelHandle } from "@/lib/ai";
import type { JobPreferences } from "@/lib/job-match";

const JobScoreSchema = z.object({
  overallScore: z.number().min(0).max(100),
  recommendation: z.enum(["APPLY", "SKIP", "MAYBE"]),
  reason: z.string(),
  archetype: z.enum(["FDE", "SA", "PM", "LLMOps", "Agentic", "Transformation", "Other"]).optional(),
});

export type JobScore = z.infer<typeof JobScoreSchema>;

/** The job fields the model gets. Structured columns are passed alongside the
 * description so the model isn't left guessing at whatever survived the slice. */
export interface ScorableJob {
  title: string;
  description: string;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (min !== null) return `from $${min.toLocaleString()}`;
  if (max !== null) return `up to $${max.toLocaleString()}`;
  return null;
}

function list(values: string[]): string | null {
  return values.length > 0 ? values.join(", ") : null;
}

/** Renders only the lines we actually have, so the model never sees "null". */
function section(title: string, lines: Array<[string, string | null]>): string {
  const present = lines.filter((l): l is [string, string] => Boolean(l[1]));
  if (present.length === 0) return "";
  return `${title}\n${present.map(([label, value]) => `- ${label}: ${value}`).join("\n")}\n`;
}

export async function scoreJob(
  job: ScorableJob,
  resume: ParsedResume,
  preferences: JobPreferences,
  model: ModelHandle
): Promise<JobScore> {
  const candidate = section("Candidate profile:", [
    ["Skills", list(resume.skills)],
    [
      "Experience",
      list(resume.experience.map((e) => `${e.title} at ${e.company} (${e.duration})`)),
    ],
  ]);

  // Previously absent entirely, which made the "compensation/location fit"
  // criterion below unanswerable — the model was asked to judge alignment
  // against preferences it was never shown.
  const wants = section("What the candidate is looking for:", [
    ["Target roles", list(preferences.targetRoles)],
    ["Preferred locations", list(preferences.locations)],
    ["Work type", list(preferences.workType)],
    ["Minimum salary", preferences.salaryMin ? `$${preferences.salaryMin}` : null],
  ]);

  const posting = section("Job:", [
    ["Title", job.title],
    ["Location", job.location],
    ["Remote", job.remote ? "yes" : "no"],
    ["Salary", formatSalary(job.salaryMin, job.salaryMax)],
  ]);

  const { object } = await generateObject({
    model,
    schema: JobScoreSchema,
    prompt: `You are a career advisor scoring job fit. Score how well this candidate matches the job.

Scoring criteria:
- Skills match (40 pts): how many required skills does the candidate have?
- Experience level (30 pts): does their seniority/years match?
- Role alignment (20 pts): is the job title/function a natural next step, and does it fit the roles they say they're targeting?
- Compensation/location fit (10 pts): does the job's salary, location, and remote policy align with what they're looking for?

If a piece of information isn't given, treat that criterion as neutral — award roughly half its points rather than penalising the job for missing data.

Recommendation:
- APPLY: score ≥ 70 — strong match, candidate should apply
- MAYBE: score 40-69 — partial match, worth considering
- SKIP: score < 40 — poor fit

Archetype (pick closest): FDE=Frontend/Design Engineer, SA=Solutions Architect, PM=Product Manager, LLMOps=ML/AI Ops, Agentic=AI Agent developer, Transformation=Digital transformation, Other

${candidate}
${wants}
${posting}
Job Description:
${job.description.slice(0, 3000)}`,
  });

  return object;
}
