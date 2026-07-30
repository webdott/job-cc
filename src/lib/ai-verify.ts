import { generateText } from "ai";
import { buildModelsForProvider } from "@/lib/ai";
import { getModelOption, isKnownModel, paidTierWarning, resolveModelIds } from "@/lib/ai-models";
import type { AiProviderId } from "@/lib/ai-providers";

function statusCodeFromError(err: unknown): number | undefined {
  if (err && typeof err === "object" && "statusCode" in err) {
    const code = (err as { statusCode: unknown }).statusCode;
    return typeof code === "number" ? code : undefined;
  }
  return undefined;
}

export function aiKeyVerifyErrorMessage(
  err: unknown,
  provider: AiProviderId,
  flashModelId: string,
  proModelId: string
): string {
  const status = statusCodeFromError(err);
  if (status === 429) {
    return "This API key is rate-limited or out of quota — check your provider billing and try again.";
  }
  const flashPaid = getModelOption(provider, flashModelId)?.freeTier === false;
  const proPaid = getModelOption(provider, proModelId)?.freeTier === false;
  if ((status === 404 || status === 403) && (flashPaid || proPaid)) {
    return paidTierWarning(provider);
  }
  return "Couldn't verify this API key / model — double-check them and try again.";
}

export function validateModelPair(
  provider: AiProviderId,
  flashModelId: string,
  proModelId: string
): { flash: string; pro: string } | { error: string } {
  if (!isKnownModel(provider, flashModelId) || !isKnownModel(provider, proModelId)) {
    return { error: "Unknown model for this provider — pick from the list." };
  }
  return resolveModelIds(provider, flashModelId, proModelId);
}

/** Cheap ping against both selected models. */
export async function verifyAiModels(
  provider: AiProviderId,
  apiKey: string,
  flashModelId: string,
  proModelId: string
): Promise<void> {
  const { flashModel, proModel } = buildModelsForProvider(
    provider,
    apiKey,
    flashModelId,
    proModelId
  );
  const googleOpts =
    provider === "GOOGLE"
      ? {
          providerOptions: {
            google: { thinkingConfig: { thinkingLevel: "minimal" as const } },
          },
        }
      : {};

  await generateText({
    model: flashModel,
    prompt: "ping",
    maxOutputTokens: 64,
    ...googleOpts,
  });
  // Skip second call when both slots use the same model.
  if (flashModelId !== proModelId) {
    await generateText({
      model: proModel,
      prompt: "ping",
      maxOutputTokens: 64,
      ...googleOpts,
    });
  }
}
