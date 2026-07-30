// Client-safe AI model catalog — no server/AI-SDK imports.
// Keep in step with what buildModelsForProvider accepts in lib/ai.ts.

import type { AiProviderId } from "@/lib/ai-providers";

export interface AiModelOption {
  id: string;
  label: string;
  description: string;
  /** Whether this model is usable on the provider's free API tier. */
  freeTier: boolean;
}

const GOOGLE_MODELS: AiModelOption[] = [
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    description: "Fast / general — good default for scoring and cover letters",
    freeTier: true,
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    description: "Cheapest / high volume",
    freeTier: true,
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    description: "Strongest reasoning",
    freeTier: false,
  },
];

const ANTHROPIC_MODELS: AiModelOption[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    description: "Fast — requires Anthropic credits",
    freeTier: false,
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    description: "Strong — requires Anthropic credits",
    freeTier: false,
  },
];

const MODELS_BY_PROVIDER: Record<AiProviderId, AiModelOption[]> = {
  GOOGLE: GOOGLE_MODELS,
  ANTHROPIC: ANTHROPIC_MODELS,
};

const DEFAULTS_BY_PROVIDER: Record<AiProviderId, { flash: string; pro: string }> = {
  GOOGLE: { flash: "gemini-3.6-flash", pro: "gemini-3.6-flash" },
  ANTHROPIC: { flash: "claude-haiku-4-5", pro: "claude-sonnet-4-6" },
};

export function getModelsForProvider(provider: AiProviderId): AiModelOption[] {
  return MODELS_BY_PROVIDER[provider];
}

export function getDefaultModels(provider: AiProviderId): { flash: string; pro: string } {
  return DEFAULTS_BY_PROVIDER[provider];
}

export function isKnownModel(provider: AiProviderId, modelId: string): boolean {
  return MODELS_BY_PROVIDER[provider].some((m) => m.id === modelId);
}

export function getModelOption(provider: AiProviderId, modelId: string): AiModelOption | undefined {
  return MODELS_BY_PROVIDER[provider].find((m) => m.id === modelId);
}

/** Resolve stored prefs against the active provider; fall back to defaults if unknown/stale. */
export function resolveModelIds(
  provider: AiProviderId,
  flashModel: string | null | undefined,
  proModel: string | null | undefined
): { flash: string; pro: string } {
  const defaults = getDefaultModels(provider);
  return {
    flash: flashModel && isKnownModel(provider, flashModel) ? flashModel : defaults.flash,
    pro: proModel && isKnownModel(provider, proModel) ? proModel : defaults.pro,
  };
}

export function paidTierWarning(provider: AiProviderId): string {
  switch (provider) {
    case "GOOGLE":
      return "This model requires a paid Gemini plan — enable billing in AI Studio or pick a free-tier model.";
    case "ANTHROPIC":
      return "Anthropic models require API credits on your Anthropic account.";
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unhandled AI provider: ${_exhaustive}`);
    }
  }
}
