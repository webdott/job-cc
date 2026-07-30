// Client-safe AI provider metadata — no server/AI-SDK imports, so this can
// be used from "use client" components as well as lib/ai.ts and lib/byoc.ts.
// Adding a provider means adding one entry here and one switch case per
// function below — assertUnreachableProvider makes the compiler point at
// every spot that still needs updating.

export const AI_PROVIDERS = ["GOOGLE", "ANTHROPIC"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_OPTIONS: { value: AiProviderId; label: string }[] = [
  { value: "GOOGLE", label: "Google Gemini" },
  { value: "ANTHROPIC", label: "Anthropic Claude" },
];

/** Env / form values like "google" or "GOOGLE" → AiProviderId, or null if unknown. */
export function parseAiProvider(raw: string | undefined | null): AiProviderId | null {
  if (!raw?.trim()) return null;
  const normalized = raw.trim().toUpperCase();
  return (AI_PROVIDERS as readonly string[]).includes(normalized)
    ? (normalized as AiProviderId)
    : null;
}

function assertUnreachableProvider(provider: never): never {
  throw new Error(`Unhandled AI provider: ${provider}`);
}

export function getProviderLabel(provider: AiProviderId): string {
  switch (provider) {
    case "GOOGLE":
      return "Google Gemini";
    case "ANTHROPIC":
      return "Anthropic Claude";
    default:
      return assertUnreachableProvider(provider);
  }
}

/** Where a user gets an API key for this provider. */
export function getProviderApiKeyUrl(provider: AiProviderId): string {
  switch (provider) {
    case "GOOGLE":
      return "https://aistudio.google.com/apikey";
    case "ANTHROPIC":
      return "https://console.anthropic.com/settings/keys";
    default:
      return assertUnreachableProvider(provider);
  }
}
