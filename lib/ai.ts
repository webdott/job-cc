import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AiProviderId } from "@/lib/ai-providers";

// Primary model — Gemini 2.5 Pro for complex tasks (cover letters, job evaluation)
export const proModel = google("gemini-2.5-pro");

// Fast model — Gemini 2.5 Flash for cheaper tasks (scoring, parsing, field extraction)
export const flashModel = google("gemini-2.5-flash");

// The `ai` package's own exported `LanguageModel` type lags behind the
// model spec version @ai-sdk/google and @ai-sdk/anthropic actually produce
// (v4) — derive the type structurally from a real model instead of relying
// on that name, so it always matches what these provider packages return.
export type ModelHandle = typeof proModel;

// To swap to Claude later, replace the above with:
// import { anthropic } from "@ai-sdk/anthropic";
// export const proModel = anthropic("claude-sonnet-4-6");
// export const flashModel = anthropic("claude-haiku-4-5");

function assertUnreachableProvider(provider: never): never {
  throw new Error(`Unhandled AI provider: ${provider}`);
}

/** Builds a { proModel, flashModel } pair from a BYOC user's own provider + API key (see lib/byoc.ts). */
export function buildModelsForProvider(
  provider: AiProviderId,
  apiKey: string
): { proModel: ModelHandle; flashModel: ModelHandle } {
  switch (provider) {
    case "GOOGLE": {
      const googleProvider = createGoogleGenerativeAI({ apiKey });
      return {
        proModel: googleProvider("gemini-2.5-pro"),
        flashModel: googleProvider("gemini-2.5-flash"),
      };
    }
    case "ANTHROPIC": {
      const anthropicProvider = createAnthropic({ apiKey });
      return {
        proModel: anthropicProvider("claude-sonnet-4-6"),
        flashModel: anthropicProvider("claude-haiku-4-5"),
      };
    }
    default:
      return assertUnreachableProvider(provider);
  }
}
