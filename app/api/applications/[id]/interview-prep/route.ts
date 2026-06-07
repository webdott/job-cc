import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateObject } from "ai";
import { flashModel } from "@/lib/ai";
import { z } from "zod";

const InterviewPrepSchema = z.object({
  questions: z.array(
    z.object({
      category: z.enum(["Behavioural", "Technical", "Situational", "Culture", "Role-specific"]),
      question: z.string(),
      hint: z.string().describe("A 1-sentence tip on how to answer this question well"),
    })
  ),
  keyThemes: z.array(z.string()).describe("3-5 themes the interviewer will likely probe"),
  redFlags: z.array(z.string()).describe("Potential gaps or weaknesses to prepare for"),
});

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const application = await prisma.application.findFirst({
    where: { id: params.id, userId: user.id },
    include: { job: { include: { evaluation: true } } },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const resume = await prisma.resume.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!resume) return NextResponse.json({ error: "No active resume" }, { status: 400 });

  const jobTitle =
    application.job?.title ??
    (application.inlineJobData as { title?: string })?.title ??
    "this role";
  const company =
    application.job?.company ??
    (application.inlineJobData as { company?: string })?.company ??
    "the company";
  const jobDescription = application.job?.description ?? "";

  const parsedData = resume.parsedData as {
    name?: string;
    skills?: string[];
    experience?: { title: string; company: string; duration: string; bullets: string[] }[];
  };

  const resumeSummary = `
Skills: ${(parsedData.skills ?? []).slice(0, 20).join(", ")}
Experience:
${(parsedData.experience ?? [])
  .slice(0, 3)
  .map((e) => `- ${e.title} at ${e.company} (${e.duration})`)
  .join("\n")}
`.trim();

  const { object } = await generateObject({
    model: flashModel,
    schema: InterviewPrepSchema,
    prompt: `You are an interview coach preparing a candidate for a job interview.

Role: ${jobTitle} at ${company}
Job description:
${jobDescription.slice(0, 2500)}

Candidate background:
${resumeSummary}

Generate 8–10 interview questions that are highly likely to be asked for this specific role and company. Mix categories. For each question include a practical hint on how to answer it well given the candidate's background.

Also identify 3-5 key interview themes and 2-3 potential red flags/gaps the candidate should be ready to address.`,
  });

  return NextResponse.json({ prep: object });
}
