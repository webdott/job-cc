import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { parseAiProvider, type AiProviderId } from "@/lib/ai-providers";
import { getDefaultModels, resolveModelIds } from "@/lib/ai-models";

// Probe type from a real provider factory so ModelHandle stays in sync with
// whatever @ai-sdk/google / @ai-sdk/anthropic return (the `ai` package's
// exported LanguageModel type lags behind).

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _typeProbe = createGoogleGenerativeAI({ apiKey: "type-probe" })("gemini-3.6-flash");
export type ModelHandle = typeof _typeProbe;

function assertUnreachableProvider(provider: never): never {
  throw new Error(`Unhandled AI provider: ${provider}`);
}

/** Operator AI provider from `AI_PROVIDER` (google / anthropic, case-insensitive). */
export function getOperatorProvider(): AiProviderId {
  const parsed = parseAiProvider(process.env.AI_PROVIDER);
  if (!parsed) {
    throw new Error(
      'AI_PROVIDER must be set to "google" or "anthropic" (got ' +
        JSON.stringify(process.env.AI_PROVIDER ?? "") +
        ")."
    );
  }
  return parsed;
}

/** Operator API key from `AI_API_KEY` — never use the SDK's provider-specific env defaults. */
export function getOperatorApiKey(): string {
  const key = process.env.AI_API_KEY?.trim();
  if (!key) {
    throw new Error("AI_API_KEY is not set.");
  }
  return key;
}

/**
 * Builds a { proModel, flashModel } pair for a provider + API key + model IDs.
 * Used for both the operator (env) and BYOC users.
 */
export function buildModelsForProvider(
  provider: AiProviderId,
  apiKey: string,
  flashModelId?: string,
  proModelId?: string
): { proModel: ModelHandle; flashModel: ModelHandle } {
  const { flash, pro } = resolveModelIds(provider, flashModelId, proModelId);
  switch (provider) {
    case "GOOGLE": {
      const googleProvider = createGoogleGenerativeAI({ apiKey });
      return {
        proModel: googleProvider(pro),
        flashModel: googleProvider(flash),
      };
    }
    case "ANTHROPIC": {
      const anthropicProvider = createAnthropic({ apiKey });
      return {
        proModel: anthropicProvider(pro),
        flashModel: anthropicProvider(flash),
      };
    }
    default:
      return assertUnreachableProvider(provider);
  }
}

/** Operator defaults when a user has no saved model prefs (safe free-tier baseline for Google). */
export function buildOperatorModels(
  flashModelId?: string | null,
  proModelId?: string | null
): { proModel: ModelHandle; flashModel: ModelHandle } {
  const provider = getOperatorProvider();
  const defaults = getDefaultModels(provider);
  return buildModelsForProvider(
    provider,
    getOperatorApiKey(),
    flashModelId ?? defaults.flash,
    proModelId ?? defaults.pro
  );
}
