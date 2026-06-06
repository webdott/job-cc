import { google } from "@ai-sdk/google";

// Primary model — Gemini 2.5 Pro for complex tasks (cover letters, job evaluation)
export const proModel = google("gemini-2.5-pro");

// Fast model — Gemini 2.5 Flash for cheaper tasks (scoring, parsing, field extraction)
export const flashModel = google("gemini-2.5-flash");

// To swap to Claude later, replace the above with:
// import { anthropic } from "@ai-sdk/anthropic";
// export const proModel = anthropic("claude-sonnet-4-6");
// export const flashModel = anthropic("claude-haiku-4-5");
