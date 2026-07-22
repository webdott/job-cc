# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Job Command Center — an AI-powered job application tracker / PWA (Next.js 14 App Router). Users upload a resume, the app discovers and scores jobs from public sources, tracks applications through a Kanban pipeline, and generates cover letters / interview prep with Gemini.

## Commands

```bash
npm run dev          # start dev server (PWA disabled in development)
npm run build        # production build
npm run build:clean  # rm -rf .next && next build
npm run typecheck    # tsc --noEmit — also runs automatically on pre-commit (husky)
npm run lint         # next lint
npm run format       # prettier --write .

npx prisma db push        # push schema.prisma to the DB (no migration file)
npx prisma migrate dev     # create a migration (schema changes that need a migration, e.g. RLS)
npx prisma generate        # regenerate client (also runs on postinstall)
```

There is no test runner configured in this repo — do not assume `npm test` exists.

Pre-commit (husky) runs `npm run typecheck` then `lint-staged` (eslint --fix + prettier on staged files). Commit messages are linted via commitlint (conventional commits) on `commit-msg`.

## Architecture

**Route groups**: `app/(auth)` (Clerk sign-in/sign-up) and `app/(dashboard)` (main app: home, discover, pipeline, analytics, profile) are parallel top-level layouts. `app/onboarding` sits outside both — first-run flow before a `User` row exists.

**Auth flow**: `middleware.ts` guards every route except `/sign-in`, `/sign-up`, and webhook/push-subscribe endpoints via Clerk's `clerkMiddleware`. Every API route independently re-derives the app-level `User` from the Clerk `clerkId` (`prisma.user.findUnique({ where: { clerkId } })`) — Clerk's `userId` is never used directly as a DB foreign key. Routes that run before onboarding completes return a 400 ("Complete onboarding first") rather than erroring.

**Data layer**: Prisma 7 with the `@prisma/adapter-pg` driver adapter (raw `pg.Pool`), not Prisma's built-in connection handling — see `lib/prisma.ts`. `DATABASE_URL` (pooled/transaction mode) is used at runtime; `DIRECT_URL` (session mode) is used by `prisma.config.ts` for migrations/introspection — both point at Supabase Postgres. Row-Level Security is enabled on every table with `USING (false)` policies (see `prisma/migrations/20260604000000_enable_rls/`), meaning **all access must go through the service-role Postgres credentials in the app layer** — there is no anon/browser Postgres access path, RLS is a defense-in-depth backstop, not the authorization mechanism.

**AI layer** (`lib/ai.ts`): two Vercel AI SDK model handles — `proModel` (Gemini 2.5 Pro, used for cover letters and job evaluation) and `flashModel` (Gemini 2.5 Flash, used for cheaper structured extraction: resume parsing, job scoring). Structured output uses `generateObject` with Zod schemas (`lib/resume-parser.ts`, `lib/job-scorer.ts`); cover letters use `streamText` + `toTextStreamResponse()` for SSE streaming, with DB persistence done in a fire-and-forget `.then()` after `result.text` resolves (the response is returned to the client before persistence completes). The model provider is intentionally swappable — comments in `lib/ai.ts` show the two-line change to switch to Anthropic.

**Job discovery** (`app/api/jobs/discover/route.ts`): fetches three free sources in parallel (Remotive API, Arbeitnow API, HN "Who's Hiring" via Algolia), normalizes each into a common shape, and `upsert`s on the `[sourceUrl, userId]` unique constraint so re-running discovery is idempotent. Newly-inserted jobs (detected via `fetchedAt` timestamp, not a separate flag) are scored against the user's active resume if one exists; scoring failures for an individual job are swallowed so one bad job doesn't fail the whole batch. HN listings are heuristically parsed from free-text comments (`Company | Role | Location` pattern) and are inherently noisier than the two structured APIs.

**Sanitization**: all externally-sourced job description HTML must go through `lib/sanitize.ts` (`sanitizeJobDescription` for sources with real HTML, `stripToPlainText` for already-plain sources) before being stored — this is the only line of defense against XSS from third-party job feeds rendered later in the UI.

**File storage**: resumes upload to Cloudflare R2 via `lib/r2.ts` (S3-compatible client, `region: "auto"`); only the resulting public URL is stored in Postgres (`Resume.fileUrl`), not the file itself.

**Cron jobs**: scheduled in `vercel.json` — daily digest at 09:00 UTC (`app/api/cron/daily-digest`) and follow-up reminder check at 08:00 UTC (`app/api/cron/reminders`). Both are protected by `CRON_SECRET` and only invokable by Vercel's cron scheduler / matching bearer token, not by end users.

**Push notifications**: web-push VAPID keys; subscriptions are stored per-user in the `PushSubscription` table (not just `User.pushSubscription`, which appears to be a legacy/simpler single-subscription field — check both when touching push code).

**PWA**: `next-pwa` (Workbox) is configured in `next.config.mjs` and disabled in development. Note the runtime caching rule explicitly excludes `/api/scan` and `/api/push/` from the generic `NetworkFirst` API cache — don't add caching to those without re-checking why they were excluded.

**Data model shape worth knowing** (`prisma/schema.prisma`): `Application` can reference a `Job` OR carry `inlineJobData` (Json) for manually-added applications with no scraped `Job` row — always check both when reading job info off an `Application` (see the `jobTitle`/`company` fallback pattern in the cover-letter route). `JobEvaluation` stores scoring results in loosely-typed `blockA`–`blockG` Json columns rather than dedicated columns — expect this to evolve as scoring criteria change. `Application.stage` is a free-text string, not an enum in the DB; valid values are defined only in TypeScript as `ApplicationStage` (`types/index.ts`).

**Path alias**: `@/*` maps to the repo root (see `tsconfig.json`), e.g. `@/lib/ai`, `@/lib/prisma`.

## Environment

See `.env.example` for the full list. Notable non-obvious ones: `DIRECT_URL` vs `DATABASE_URL` (session vs transaction pooling mode — both required), `CRON_SECRET` (must match between Vercel env and the deployed value, arbitrary string), `GOOGLE_GENERATIVE_AI_KEY` (Gemini, from AI Studio, not Google Cloud).
