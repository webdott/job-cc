import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateObject } from "ai";
import { z } from "zod";
import { flashModel } from "@/lib/ai";
import { scoreJob } from "@/lib/job-scorer";
import type { ParsedResume } from "@/lib/resume-parser";
import * as cheerio from "cheerio";

const JobFieldsSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  description: z.string(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  remote: z.boolean(),
});

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { url, rawText } = (await req.json()) as { url?: string; rawText?: string };

  if (!url && !rawText) {
    return NextResponse.json({ error: "Provide either url or rawText" }, { status: 400 });
  }

  let textContent = rawText ?? "";
  const sourceUrl = url ?? `manual-${Date.now()}`;

  // Fetch + strip HTML if URL provided
  if (url) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await res.text();
      const $ = cheerio.load(html);
      $("script, style, nav, footer, header").remove();
      textContent = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
    } catch {
      return NextResponse.json({ error: "Could not fetch the URL" }, { status: 400 });
    }
  }

  // Extract job fields with AI
  const { object: fields } = await generateObject({
    model: flashModel,
    schema: JobFieldsSchema,
    prompt: `Extract job posting details from the following text. If salary isn't mentioned, omit it. Detect if the role is remote.

Text:
${textContent}`,
  });

  // Save job
  const job = await prisma.job.create({
    data: {
      sourceUrl,
      title: fields.title,
      company: fields.company,
      location: fields.location,
      description: fields.description,
      salaryMin: fields.salaryMin,
      salaryMax: fields.salaryMax,
      remote: fields.remote,
      userId: user.id,
    },
  });

  // Score against active resume
  let evaluation = null;
  const activeResume = await prisma.resume.findFirst({
    where: { userId: user.id, isActive: true },
  });

  if (activeResume) {
    const parsedData = activeResume.parsedData as ParsedResume;
    const score = await scoreJob(job.description, job.title, parsedData);
    evaluation = await prisma.jobEvaluation.create({
      data: {
        jobId: job.id,
        userId: user.id,
        overallScore: score.overallScore,
        recommendation: score.recommendation,
        archetype: score.archetype,
        blockA: { reason: score.reason },
      },
    });
  }

  return NextResponse.json({ job, evaluation });
}
