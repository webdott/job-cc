import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validation";
import { encrypt } from "@/lib/crypto";
import { buildModelsForProvider } from "@/lib/ai";
import { createR2Client } from "@/lib/r2";
import { AI_PROVIDERS } from "@/lib/ai-providers";

const CredentialsSchema = z.object({
  aiProvider: z.enum(AI_PROVIDERS),
  aiApiKey: z.string().min(10).max(300),
  r2AccountId: z.string().min(1).max(200),
  r2AccessKeyId: z.string().min(1).max(200),
  r2SecretAccessKey: z.string().min(1).max(200),
  r2BucketName: z.string().min(1).max(200),
  r2PublicUrl: z.string().url(),
});

function statusCodeFromError(err: unknown): number | undefined {
  if (err && typeof err === "object" && "statusCode" in err) {
    const code = (err as { statusCode: unknown }).statusCode;
    return typeof code === "number" ? code : undefined;
  }
  return undefined;
}

function aiKeyVerifyErrorMessage(err: unknown): string {
  const status = statusCodeFromError(err);
  if (status === 429) {
    return "This API key is rate-limited or out of quota — check your provider billing and try again.";
  }
  if (status === 401 || status === 403) {
    return "Couldn't verify this API key — double-check it and try again.";
  }
  return "Couldn't verify this API key — double-check it and try again.";
}

// GET /api/user/credentials — never returns plaintext, just whether creds are on file
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { credentials: { select: { aiProvider: true, verifiedAt: true } } },
  });
  if (!user) {
    return NextResponse.json({ hasCredentials: false, aiProvider: null, verifiedAt: null });
  }

  return NextResponse.json({
    hasCredentials: !!user.credentials,
    aiProvider: user.credentials?.aiProvider ?? null,
    verifiedAt: user.credentials?.verifiedAt.toISOString() ?? null,
  });
}

// POST /api/user/credentials — validates + test-verifies both the AI key and
// R2 credentials with real calls before saving, and encrypts everything at rest.
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await parseBody(req, CredentialsSchema);
  if (error) return error;

  const aiApiKey = data.aiApiKey.trim();

  try {
    const { flashModel } = buildModelsForProvider(data.aiProvider, aiApiKey);
    await generateText({
      model: flashModel,
      prompt: "ping",
      maxOutputTokens: 64,
      ...(data.aiProvider === "GOOGLE"
        ? {
            providerOptions: {
              google: { thinkingConfig: { thinkingBudget: 0 } },
            },
          }
        : {}),
    });
  } catch (err) {
    console.error("[credentials] AI key verification failed:", err);
    return NextResponse.json({ error: aiKeyVerifyErrorMessage(err), field: "ai" }, { status: 400 });
  }

  const r2 = createR2Client({
    accountId: data.r2AccountId,
    accessKeyId: data.r2AccessKeyId,
    secretAccessKey: data.r2SecretAccessKey,
    bucketName: data.r2BucketName,
    publicUrl: data.r2PublicUrl,
  });

  const verifyKey = `_byoc-verify/${user.id}.txt`;

  try {
    await r2.uploadFile(verifyKey, Buffer.from("ok"), "text/plain");
    await r2.deleteFile(verifyKey);
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn't verify these R2 credentials — double-check the account ID, keys, and bucket name.",
        field: "r2",
      },
      { status: 400 }
    );
  }

  const encrypted = {
    aiProvider: data.aiProvider,
    aiApiKeyEnc: encrypt(aiApiKey),
    r2AccountIdEnc: encrypt(data.r2AccountId),
    r2AccessKeyIdEnc: encrypt(data.r2AccessKeyId),
    r2SecretAccessKeyEnc: encrypt(data.r2SecretAccessKey),
    r2BucketNameEnc: encrypt(data.r2BucketName),
    r2PublicUrlEnc: encrypt(data.r2PublicUrl),
    verifiedAt: new Date(),
  };

  await prisma.userCredentials.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...encrypted },
    update: encrypted,
  });

  return NextResponse.json({ success: true, hasCredentials: true });
}
