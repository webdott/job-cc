import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { LabelSchema } from "@/lib/validation";
import type { ParsedResume } from "@/lib/resume-parser";
import { requireUserCredentials } from "@/lib/byoc";

const ExperienceSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  duration: z.string().max(100),
  bullets: z.array(z.string().max(500)).max(20),
});

const EducationSchema = z.object({
  degree: z.string().min(1).max(200),
  institution: z.string().min(1).max(200),
  year: z.string().max(20).optional(),
});

const UpdateResumeSchema = z.object({
  label: LabelSchema.optional(),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  skills: z.array(z.string().min(1).max(100)).max(100).optional(),
  experience: z.array(ExperienceSchema).max(30).optional(),
  education: z.array(EducationSchema).max(20).optional(),
});

// PATCH /api/resumes/:id — edit label or manually override parsed fields
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const resume = await prisma.resume.findFirst({ where: { id: params.id, userId: user.id } });
  if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const result = UpdateResumeSchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { label, ...parsedFields } = result.data;
  const hasParsedEdits = Object.keys(parsedFields).length > 0;
  const existingParsed = resume.parsedData as ParsedResume;

  const updated = await prisma.resume.update({
    where: { id: resume.id },
    data: {
      ...(label !== undefined && { label }),
      ...(hasParsedEdits && {
        parsedData: { ...existingParsed, ...parsedFields } as object,
      }),
    },
  });

  return NextResponse.json({ resume: updated });
}

// DELETE /api/resumes/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const resume = await prisma.resume.findFirst({ where: { id: params.id, userId: user.id } });
  if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  const { data: creds, error: credError } = await requireUserCredentials(user.email, user.id);
  if (credError) return credError;

  try {
    await prisma.resume.delete({ where: { id: resume.id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json(
        { error: "This resume has cover letters generated from it and can't be deleted." },
        { status: 409 }
      );
    }
    throw err;
  }

  // If the deleted resume was active, promote the most recently added remaining one
  if (resume.isActive) {
    const next = await prisma.resume.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (next) await prisma.resume.update({ where: { id: next.id }, data: { isActive: true } });
  }

  // Best-effort R2 cleanup — the DB row is already gone either way
  try {
    const publicBase = creds.r2.publicUrl.replace(/\/$/, "");
    if (resume.fileUrl.startsWith(publicBase)) {
      await creds.r2.deleteFile(resume.fileUrl.slice(publicBase.length + 1));
    }
  } catch (err) {
    console.error("Failed to delete resume file from R2:", err);
  }

  return NextResponse.json({ success: true });
}
