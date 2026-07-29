import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validation";
import { encrypt, decrypt } from "@/lib/crypto";
import { buildModelsForProvider } from "@/lib/ai";
import { createR2Client } from "@/lib/r2";
import { verifyBrevoCredentials } from "@/lib/email";
import { AI_PROVIDERS, type AiProviderId } from "@/lib/ai-providers";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const CredentialsSchema = z.object({
  aiProvider: z.enum(AI_PROVIDERS).optional(),
  aiApiKey: z.preprocess(emptyToUndefined, z.string().min(10).max(300).optional()),
  r2AccountId: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  r2AccessKeyId: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  r2SecretAccessKey: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  r2BucketName: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  r2PublicUrl: z.preprocess(emptyToUndefined, z.string().url().optional()),
  brevoApiKey: z.preprocess(emptyToUndefined, z.string().min(10).max(300).optional()),
  brevoFromEmail: z.preprocess(emptyToUndefined, z.string().email().optional()),
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
  return "Couldn't verify this API key — double-check it and try again.";
}

async function verifyAiKey(provider: AiProviderId, apiKey: string) {
  const { flashModel } = buildModelsForProvider(provider, apiKey);
  await generateText({
    model: flashModel,
    prompt: "ping",
    maxOutputTokens: 64,
    ...(provider === "GOOGLE"
      ? {
          providerOptions: {
            google: { thinkingConfig: { thinkingBudget: 0 } },
          },
        }
      : {}),
  });
}

async function verifyR2(
  userId: string,
  creds: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
  }
) {
  const r2 = createR2Client(creds);
  const verifyKey = `_byoc-verify/${userId}.txt`;
  await r2.uploadFile(verifyKey, Buffer.from("ok"), "text/plain");
  await r2.deleteFile(verifyKey);
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

// POST /api/user/credentials — create (all fields) or partial update (blank = keep).
// Only groups with new/changed values are re-verified before encrypt/save.
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { credentials: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await parseBody(req, CredentialsSchema);
  if (error) return error;

  const existing = user.credentials;
  const isUpdate = !!existing;

  if (!isUpdate) {
    const missing =
      !data.aiProvider ||
      !data.aiApiKey ||
      !data.r2AccountId ||
      !data.r2AccessKeyId ||
      !data.r2SecretAccessKey ||
      !data.r2BucketName ||
      !data.r2PublicUrl ||
      !data.brevoApiKey ||
      !data.brevoFromEmail;
    if (missing) {
      return NextResponse.json(
        { error: "All AI, R2, and Brevo fields are required for the first save." },
        { status: 400 }
      );
    }
  }

  const touchAi =
    !!data.aiApiKey ||
    (!!data.aiProvider && (!existing || data.aiProvider !== existing.aiProvider));
  const touchR2 = !!(
    data.r2AccountId ||
    data.r2AccessKeyId ||
    data.r2SecretAccessKey ||
    data.r2BucketName ||
    data.r2PublicUrl
  );
  const touchBrevo = !!(data.brevoApiKey || data.brevoFromEmail);

  if (isUpdate && !touchAi && !touchR2 && !touchBrevo) {
    return NextResponse.json(
      { error: "Enter at least one new value to update — leave the rest blank to keep them." },
      { status: 400 }
    );
  }

  let aiProvider: AiProviderId = data.aiProvider ?? existing?.aiProvider ?? "GOOGLE";
  let aiApiKeyEnc = existing?.aiApiKeyEnc ?? "";
  let r2AccountIdEnc = existing?.r2AccountIdEnc ?? "";
  let r2AccessKeyIdEnc = existing?.r2AccessKeyIdEnc ?? "";
  let r2SecretAccessKeyEnc = existing?.r2SecretAccessKeyEnc ?? "";
  let r2BucketNameEnc = existing?.r2BucketNameEnc ?? "";
  let r2PublicUrlEnc = existing?.r2PublicUrlEnc ?? "";
  let brevoApiKeyEnc = existing?.brevoApiKeyEnc ?? null;
  let brevoFromEmailEnc = existing?.brevoFromEmailEnc ?? null;

  if (touchAi) {
    const aiApiKey = data.aiApiKey?.trim() || (existing ? decrypt(existing.aiApiKeyEnc) : "");
    if (!aiApiKey) {
      return NextResponse.json(
        { error: "AI API key is required when setting or changing the provider.", field: "ai" },
        { status: 400 }
      );
    }
    aiProvider = data.aiProvider ?? existing!.aiProvider;
    try {
      await verifyAiKey(aiProvider, aiApiKey);
    } catch (err) {
      console.error("[credentials] AI key verification failed:", err);
      return NextResponse.json(
        { error: aiKeyVerifyErrorMessage(err), field: "ai" },
        { status: 400 }
      );
    }
    aiApiKeyEnc = encrypt(aiApiKey);
  }

  if (touchR2) {
    const r2 = {
      accountId: data.r2AccountId?.trim() || (existing ? decrypt(existing.r2AccountIdEnc) : ""),
      accessKeyId:
        data.r2AccessKeyId?.trim() || (existing ? decrypt(existing.r2AccessKeyIdEnc) : ""),
      secretAccessKey:
        data.r2SecretAccessKey?.trim() || (existing ? decrypt(existing.r2SecretAccessKeyEnc) : ""),
      bucketName: data.r2BucketName?.trim() || (existing ? decrypt(existing.r2BucketNameEnc) : ""),
      publicUrl: data.r2PublicUrl?.trim() || (existing ? decrypt(existing.r2PublicUrlEnc) : ""),
    };
    if (
      !r2.accountId ||
      !r2.accessKeyId ||
      !r2.secretAccessKey ||
      !r2.bucketName ||
      !r2.publicUrl
    ) {
      return NextResponse.json(
        {
          error: "R2 fields are incomplete — fill all of them, or leave blank to keep current.",
          field: "r2",
        },
        { status: 400 }
      );
    }
    try {
      await verifyR2(user.id, r2);
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
    r2AccountIdEnc = encrypt(r2.accountId);
    r2AccessKeyIdEnc = encrypt(r2.accessKeyId);
    r2SecretAccessKeyEnc = encrypt(r2.secretAccessKey);
    r2BucketNameEnc = encrypt(r2.bucketName);
    r2PublicUrlEnc = encrypt(r2.publicUrl);
  }

  if (touchBrevo) {
    const brevoApiKey =
      data.brevoApiKey?.trim() ||
      (existing?.brevoApiKeyEnc ? decrypt(existing.brevoApiKeyEnc) : "");
    const brevoFromEmail =
      data.brevoFromEmail?.trim() ||
      (existing?.brevoFromEmailEnc ? decrypt(existing.brevoFromEmailEnc) : "");
    if (!brevoApiKey || !brevoFromEmail) {
      return NextResponse.json(
        {
          error:
            "Brevo needs both API key and verified sender — fill both, or leave blank to keep current.",
          field: "brevo",
        },
        { status: 400 }
      );
    }
    try {
      await verifyBrevoCredentials(brevoApiKey, brevoFromEmail);
    } catch (err) {
      console.error("[credentials] Brevo verification failed:", err);
      return NextResponse.json(
        {
          error:
            "Couldn't verify Brevo — check your API key and that the sender email is verified in Brevo.",
          field: "brevo",
        },
        { status: 400 }
      );
    }
    brevoApiKeyEnc = encrypt(brevoApiKey);
    brevoFromEmailEnc = encrypt(brevoFromEmail);
  }

  const encrypted = {
    aiProvider,
    aiApiKeyEnc,
    r2AccountIdEnc,
    r2AccessKeyIdEnc,
    r2SecretAccessKeyEnc,
    r2BucketNameEnc,
    r2PublicUrlEnc,
    brevoApiKeyEnc,
    brevoFromEmailEnc,
    verifiedAt: new Date(),
  };

  await prisma.userCredentials.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...encrypted },
    update: encrypted,
  });

  return NextResponse.json({ success: true, hasCredentials: true });
}
