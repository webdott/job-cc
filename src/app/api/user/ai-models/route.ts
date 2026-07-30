import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validation";
import { isAllowlisted } from "@/lib/allowlist";
import { decrypt } from "@/lib/crypto";
import { getOperatorApiKey, getOperatorProvider } from "@/lib/ai";
import { getDefaultModels, resolveModelIds } from "@/lib/ai-models";
import { aiKeyVerifyErrorMessage, validateModelPair, verifyAiModels } from "@/lib/ai-verify";
import type { AiProviderId } from "@/lib/ai-providers";

const AiModelsSchema = z.object({
  aiFlashModel: z.string().min(1).max(100),
  aiProModel: z.string().min(1).max(100),
});

async function resolveProviderAndKey(
  email: string,
  userId: string
): Promise<
  | { provider: AiProviderId; apiKey: string; error?: undefined }
  | { provider?: undefined; apiKey?: undefined; error: NextResponse }
> {
  if (isAllowlisted(email)) {
    try {
      return { provider: getOperatorProvider(), apiKey: getOperatorApiKey() };
    } catch (err) {
      return {
        error: NextResponse.json(
          {
            error: err instanceof Error ? err.message : "Operator AI is not configured.",
          },
          { status: 500 }
        ),
      };
    }
  }

  const stored = await prisma.userCredentials.findUnique({ where: { userId } });
  if (!stored) {
    return {
      error: NextResponse.json(
        {
          error: "Connect your AI credentials before choosing models.",
          code: "BYOC_REQUIRED",
        },
        { status: 403 }
      ),
    };
  }
  return { provider: stored.aiProvider, apiKey: decrypt(stored.aiApiKeyEnc) };
}

// GET /api/user/ai-models — current provider + resolved model picks
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { credentials: { select: { aiProvider: true } } },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let provider: AiProviderId;
  try {
    provider = isAllowlisted(user.email)
      ? getOperatorProvider()
      : (user.credentials?.aiProvider ?? "GOOGLE");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Operator AI is not configured." },
      { status: 500 }
    );
  }

  // BYOC without credentials yet — still return defaults for the form.
  if (!isAllowlisted(user.email) && !user.credentials) {
    const defaults = getDefaultModels("GOOGLE");
    return NextResponse.json({
      aiProvider: "GOOGLE" as const,
      aiFlashModel: defaults.flash,
      aiProModel: defaults.pro,
      canSave: false,
    });
  }

  const resolved = resolveModelIds(provider, user.aiFlashModel, user.aiProModel);
  return NextResponse.json({
    aiProvider: provider,
    aiFlashModel: resolved.flash,
    aiProModel: resolved.pro,
    canSave: true,
  });
}

// POST /api/user/ai-models — verify + persist flash/pro picks on User
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await parseBody(req, AiModelsSchema);
  if (error) return error;

  const resolved = await resolveProviderAndKey(user.email, user.id);
  if (resolved.error) return resolved.error;
  const { provider, apiKey } = resolved;

  const validated = validateModelPair(provider, data.aiFlashModel, data.aiProModel);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error, field: "ai" }, { status: 400 });
  }

  try {
    await verifyAiModels(provider, apiKey, validated.flash, validated.pro);
  } catch (err) {
    console.error("[ai-models] verification failed:", err);
    return NextResponse.json(
      {
        error: aiKeyVerifyErrorMessage(err, provider, validated.flash, validated.pro),
        field: "ai",
      },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { aiFlashModel: validated.flash, aiProModel: validated.pro },
  });

  return NextResponse.json({
    success: true,
    aiProvider: provider,
    aiFlashModel: validated.flash,
    aiProModel: validated.pro,
  });
}
