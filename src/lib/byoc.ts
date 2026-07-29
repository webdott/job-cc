import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAllowlisted } from "@/lib/allowlist";
import { decrypt } from "@/lib/crypto";
import { proModel, flashModel, buildModelsForProvider, type ModelHandle } from "@/lib/ai";
import { operatorR2Client, createR2Client, type R2Client } from "@/lib/r2";
import type { EmailCredentials } from "@/lib/email";

export interface ResolvedCredentials {
  ai: { proModel: ModelHandle; flashModel: ModelHandle };
  r2: R2Client;
  email: EmailCredentials | null;
}

function operatorEmailCredentials(): EmailCredentials | null {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) return null;
  return { apiKey, fromEmail };
}

const operatorCredentials: ResolvedCredentials = {
  ai: { proModel, flashModel },
  r2: operatorR2Client,
  email: null, // resolved per-call so env changes are picked up without restart in tests
};

/**
 * Resolves the AI models + R2 client + Brevo email creds a given user should use:
 * the operator's own (allowlisted, or no allowlist configured — the default)
 * or the user's own BYOC credentials, decrypted on the fly. Returns null
 * when a non-allowlisted user hasn't saved (verified) credentials yet.
 */
export async function resolveUserCredentials(
  email: string,
  userId: string
): Promise<ResolvedCredentials | null> {
  if (isAllowlisted(email)) {
    return {
      ...operatorCredentials,
      email: operatorEmailCredentials(),
    };
  }

  const stored = await prisma.userCredentials.findUnique({ where: { userId } });
  if (!stored) return null;

  return {
    ai: buildModelsForProvider(stored.aiProvider, decrypt(stored.aiApiKeyEnc)),
    r2: createR2Client({
      accountId: decrypt(stored.r2AccountIdEnc),
      accessKeyId: decrypt(stored.r2AccessKeyIdEnc),
      secretAccessKey: decrypt(stored.r2SecretAccessKeyEnc),
      bucketName: decrypt(stored.r2BucketNameEnc),
      publicUrl: decrypt(stored.r2PublicUrlEnc),
    }),
    email:
      stored.brevoApiKeyEnc && stored.brevoFromEmailEnc
        ? {
            apiKey: decrypt(stored.brevoApiKeyEnc),
            fromEmail: decrypt(stored.brevoFromEmailEnc),
          }
        : null,
  };
}

/** Same as `resolveUserCredentials`, but shaped like `lib/validation.ts`'s `parseBody` for routes to early-return on. */
export async function requireUserCredentials(
  email: string,
  userId: string
): Promise<
  { data: ResolvedCredentials; error?: undefined } | { data?: undefined; error: NextResponse }
> {
  const resolved = await resolveUserCredentials(email, userId);
  if (!resolved) {
    return {
      error: NextResponse.json(
        {
          error:
            "Connect your AI provider, storage, and Brevo credentials in Profile before using this feature.",
          code: "BYOC_REQUIRED",
        },
        { status: 403 }
      ),
    };
  }
  return { data: resolved };
}
