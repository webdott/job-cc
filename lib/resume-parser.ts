import { generateObject } from "ai";
import { z } from "zod";
import { flashModel } from "@/lib/ai";

const ParsedResumeSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      duration: z.string(),
      bullets: z.array(z.string()),
    })
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      year: z.string().optional(),
    })
  ),
  strengthScore: z.number().min(0).max(100),
  strengthFeedback: z.string(),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

export async function parseResume(text: string): Promise<ParsedResume> {
  const { object } = await generateObject({
    model: flashModel,
    schema: ParsedResumeSchema,
    prompt: `You are a resume parser. Extract structured data from the following resume text.

For strengthScore (0-100), evaluate:
- Completeness: does it have contact info, experience, education, skills? (30 pts)
- Clarity: are achievements quantified with numbers/impact? (30 pts)
- Relevance: modern skills and recent experience? (20 pts)
- Formatting signals: clean structure, no walls of text? (20 pts)

For strengthFeedback: provide 2-3 actionable improvement tips in one paragraph.

Resume text:
---
${text}
---`,
  });

  return object;
}
