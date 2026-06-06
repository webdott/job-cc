import { generateObject } from "ai";
import { z } from "zod";
import { flashModel } from "@/lib/ai";
import type { ParsedResume } from "@/lib/resume-parser";

const JobScoreSchema = z.object({
  overallScore: z.number().min(0).max(100),
  recommendation: z.enum(["APPLY", "SKIP", "MAYBE"]),
  reason: z.string(),
  archetype: z.enum(["FDE", "SA", "PM", "LLMOps", "Agentic", "Transformation", "Other"]).optional(),
});

export type JobScore = z.infer<typeof JobScoreSchema>;

export async function scoreJob(
  jobDescription: string,
  jobTitle: string,
  resume: ParsedResume
): Promise<JobScore> {
  const { object } = await generateObject({
    model: flashModel,
    schema: JobScoreSchema,
    prompt: `You are a career advisor scoring job fit. Score how well this candidate matches the job.

Scoring criteria:
- Skills match (40 pts): how many required skills does the candidate have?
- Experience level (30 pts): does their seniority/years match?
- Role alignment (20 pts): is the job title/function a natural next step?
- Compensation/location fit (10 pts): if salary/location info available, does it align?

Recommendation:
- APPLY: score ≥ 70 — strong match, candidate should apply
- MAYBE: score 40-69 — partial match, worth considering
- SKIP: score < 40 — poor fit

Archetype (pick closest): FDE=Frontend/Design Engineer, SA=Solutions Architect, PM=Product Manager, LLMOps=ML/AI Ops, Agentic=AI Agent developer, Transformation=Digital transformation, Other

Candidate profile:
- Skills: ${resume.skills.join(", ")}
- Experience: ${resume.experience.map((e) => `${e.title} at ${e.company} (${e.duration})`).join("; ")}

Job Title: ${jobTitle}
Job Description:
${jobDescription.slice(0, 3000)}`,
  });

  return object;
}
