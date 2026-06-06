import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/r2";
import { parseResume } from "@/lib/resume-parser";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse/lib/pdf-parse");
import mammoth from "mammoth";

// GET /api/resumes — list user's resumes
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ resumes: [] });

  const resumes = await prisma.resume.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ resumes });
}

// POST /api/resumes — upload + parse a new resume
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const clerkUser = await currentUser();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const label = (formData.get("label") as string) || "My Resume";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only PDF and DOCX files are supported" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
    }

    // Extract text
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text = "";
    if (file.type === "application/pdf") {
      const data = await pdfParse(buffer);
      text = data.text;
    } else {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });
    }

    // Upsert user
    const user = await prisma.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
        name: clerkUser?.fullName ?? "",
      },
      update: {},
    });

    // Check if this is the first resume
    const existingCount = await prisma.resume.count({ where: { userId: user.id } });

    // Upload to R2
    const key = `resumes/${user.id}/${Date.now()}-${label.replace(/\s+/g, "-")}.${file.type === "application/pdf" ? "pdf" : "docx"}`;
    const fileUrl = await uploadFile(key, buffer, file.type);

    // Parse with AI
    const parsed = await parseResume(text);

    // Save to DB
    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        label,
        fileUrl,
        isActive: existingCount === 0,
        parsedData: parsed as object,
        strengthScore: parsed.strengthScore,
        strengthFeedback: parsed.strengthFeedback,
      },
    });

    return NextResponse.json({ resume, parsed });
  } catch (err) {
    console.error("[POST /api/resumes]", err);
    return NextResponse.json(
      { error: "Failed to process resume. Please try again." },
      { status: 500 }
    );
  }
}
