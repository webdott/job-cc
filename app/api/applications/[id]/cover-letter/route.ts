import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { streamText } from "ai";
import { proModel } from "@/lib/ai";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const application = await prisma.application.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      job: true,
      coverLetter: true,
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find active resume
  const resume = await prisma.resume.findFirst({
    where: { userId: user.id, isActive: true },
  });
  if (!resume) return NextResponse.json({ error: "No active resume" }, { status: 400 });

  const body = (await req.json()) as { tone?: string };
  const tone = body.tone ?? "Professional";

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
Name: ${parsedData.name ?? user.name ?? "Applicant"}
Skills: ${(parsedData.skills ?? []).slice(0, 20).join(", ")}
Experience:
${(parsedData.experience ?? [])
  .slice(0, 3)
  .map((e) => `- ${e.title} at ${e.company} (${e.duration})\n  ${e.bullets.slice(0, 2).join("; ")}`)
  .join("\n")}
`.trim();

  const toneInstruction =
    {
      Professional: "Use a formal, polished tone. Structured paragraphs. No exclamation marks.",
      Enthusiastic:
        "Use an energetic, warm tone. Show genuine excitement for the role and company.",
      Concise: "Be direct and brief. Maximum 200 words. Every sentence must earn its place.",
    }[tone] ?? "Use a professional tone.";

  const result = streamText({
    model: proModel,
    prompt: `You are an expert career coach writing a cover letter.

Tone instruction: ${toneInstruction}

Job: ${jobTitle} at ${company}
Job description excerpt:
${jobDescription.slice(0, 2000)}

Candidate resume summary:
${resumeSummary}

Write a compelling cover letter (200–350 words) that:
1. Opens with a strong hook — not "I am writing to apply"
2. Connects 2–3 specific resume achievements to the job requirements
3. Shows genuine interest in ${company} specifically
4. Closes with a confident call to action

Output ONLY the cover letter text. No subject line, no "Dear Hiring Manager" prefix needed — start directly with the opening paragraph.`,
  });

  // Save / update cover letter in DB after stream completes
  // We use onFinish callback to persist
  const stream = result.toTextStreamResponse();

  // Persist after the stream - fire and forget
  result.text.then(async (text) => {
    try {
      const existing = await prisma.coverLetter.findUnique({
        where: { applicationId: params.id },
      });

      if (existing) {
        // Append old content to versions (keep last 5)
        const versions = [
          ...(existing.versions as object[]),
          { content: existing.content, tone: existing.tone, at: new Date().toISOString() },
        ].slice(-5);
        await prisma.coverLetter.update({
          where: { applicationId: params.id },
          data: { content: text, tone, versions, updatedAt: new Date() },
        });
      } else {
        await prisma.coverLetter.create({
          data: {
            applicationId: params.id,
            resumeId: resume.id,
            content: text,
            tone,
            versions: [],
          },
        });
      }
    } catch (e) {
      console.error("Failed to persist cover letter:", e);
    }
  });

  return stream;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const coverLetter = await prisma.coverLetter.findFirst({
    where: {
      application: { id: params.id, userId: user.id },
    },
  });

  return NextResponse.json({ coverLetter });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = (await req.json()) as { content: string };

  const coverLetter = await prisma.coverLetter.findFirst({
    where: { application: { id: params.id, userId: user.id } },
  });
  if (!coverLetter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.coverLetter.update({
    where: { id: coverLetter.id },
    data: { content: body.content, updatedAt: new Date() },
  });

  return NextResponse.json({ coverLetter: updated });
}
