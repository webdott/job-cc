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

npm test             # vitest run (unit + route integration, needs the test DB below)
npm run test:watch   # vitest
npm run test:coverage
npm run test:e2e     # playwright

npm run db:test:up    # start the dockerized Postgres used by integration tests (port 5433)
npm run db:test:push  # push schema.prisma to the test DB (reads .env.test)
npm run db:test:down

npx prisma generate        # regenerate client (also runs on postinstall)
```

**Tests**: Vitest + Testing Library, with Playwright for e2e. Route integration tests run
against the real dockerized Postgres and truncate between cases
(`src/lib/__tests__/test-db.ts` — **add any new table to its `TABLES` list** or rows leak
between tests, silently). `vitest.config.ts` sets `fileParallelism: false` for that reason.
Before running the suite the first time: `npm run db:test:up && npm run db:test:push`, and
copy `.env.test.example` to `.env.test`.

### Schema changes: pick one mechanism per database

- **`npx prisma db push`** — local and test databases only. Applies the schema directly and
  records **nothing** in `_prisma_migrations`.
- **`npx prisma migrate deploy`** — deployed databases, applying the hand-written SQL in
  `prisma/migrations/`.

Do not mix them on the same database. Pushing to a database that is under `migrate deploy`
control creates columns Prisma has no migration record for, and the next deploy then fails
with `P3018 / 42701 duplicate column` — which also blocks every later migration until
someone runs `prisma migrate resolve`. For that reason **migrations here are hand-written
and must be idempotent**: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
`DROP ... IF EXISTS`. There is no `migration_lock.toml` and timestamps are round numbers;
follow `20260727010000_add_stage` for the house style, including the mandatory two-line RLS
block on any new table.

Pre-commit (husky) runs `npm run typecheck` then `lint-staged` (eslint --fix + prettier on staged files). Commit messages are linted via commitlint (conventional commits) on `commit-msg`.

## Architecture

**Route groups**: `app/(auth)` (Clerk sign-in/sign-up) and `app/(dashboard)` (main app: home, discover, pipeline, analytics, profile) are parallel top-level layouts. `app/onboarding` sits outside both — first-run flow before a `User` row exists.

**Auth flow**: `middleware.ts` guards every route except `/sign-in`, `/sign-up`, and webhook/push-subscribe endpoints via Clerk's `clerkMiddleware`. Every API route independently re-derives the app-level `User` from the Clerk `clerkId` (`prisma.user.findUnique({ where: { clerkId } })`) — Clerk's `userId` is never used directly as a DB foreign key. Routes that run before onboarding completes return a 400 ("Complete onboarding first") rather than erroring.

**Data layer**: Prisma 7 with the `@prisma/adapter-pg` driver adapter (raw `pg.Pool`), not Prisma's built-in connection handling — see `lib/prisma.ts`. `DATABASE_URL` (pooled/transaction mode) is used at runtime; `DIRECT_URL` (session mode) is used by `prisma.config.ts` for migrations/introspection — both point at Supabase Postgres. Row-Level Security is enabled on every table with `USING (false)` policies (see `prisma/migrations/20260604000000_enable_rls/`), meaning **all access must go through the service-role Postgres credentials in the app layer** — there is no anon/browser Postgres access path, RLS is a defense-in-depth backstop, not the authorization mechanism.

**AI layer** (`lib/ai.ts`): operator models come from `AI_PROVIDER` + `AI_API_KEY` via `buildModelsForProvider` / `buildOperatorModels`. Users pick flash (scoring, parsing) and pro (cover letters) models in Profile; prefs live on `User.aiFlashModel` / `User.aiProModel`. Structured output uses `generateObject` with Zod schemas (`lib/resume-parser.ts`, `lib/job-scorer.ts`); cover letters use `streamText` + `toTextStreamResponse()` for SSE streaming, with DB persistence done in a fire-and-forget `.then()` after `result.text` resolves (the response is returned to the client before persistence completes).

**Job discovery — ingestion and scoring are separate.** They used to run in one request, which could not finish inside the function timeout (see issue #35).

_Ingest_ (`lib/job-sources.ts` + `lib/job-ingest.ts`, driven by `api/jobs/discover` for a manual scan and `api/cron/ingest` nightly): fetches the three free sources in parallel (Remotive, Arbeitnow, HN "Who's Hiring" via Algolia), collapses duplicates, and bulk-inserts with `createManyAndReturn({ skipDuplicates: true })` — one query per user, returning exactly the new rows. Dedupe happens on both `[sourceUrl, userId]` and a normalized `dedupeKey` (`company|title`) that catches the same role appearing on two sources; within a batch, `SOURCE_PRECEDENCE` prefers Remotive > Arbeitnow > HN, because HN titles are heuristically parsed from free-text comments and are the least trustworthy.

_Score_ (`lib/score-queue.ts`): the queue is **derived state, not a table** — an unscored job is a `Job` with no `JobEvaluation` row. Drained in bounded chunks by `api/jobs/score-batch` (client-driven, during a scan) and `api/internal/score-drain` (cron-driven, self-chaining because Hobby has no frequent-cron option). Failures are classified: 429/5xx are transient and retried for free, 4xx and schema violations burn one of `MAX_SCORE_ATTEMPTS`. Everything is resumable — a killed chunk just leaves its jobs queued.

_Filter_ (`lib/job-match.ts`): jobs are prefiltered against the user's `targetRoles` before any model call, recorded as `Job.prefMatch`. Matching is deliberately lenient and **must stay profession-agnostic** — unknown words are treated as meaningful subject terms, so it works for fields nobody enumerated. Don't reintroduce per-word special cases for software; that previously meant "Engineer" matched "Engineering Manager" while "Accountant" missed "Accounting Manager" (see issue #37 for the remaining source-side bias). Jobs scoring below `LOW_SCORE_THRESHOLD` are archived and their description blanked — never deleted, because the row is its own tombstone and a deleted one would be re-ingested and re-scored nightly forever. Never archive or delete a job with an attached `Application`.

**Sanitization**: all externally-sourced job description HTML must go through `lib/sanitize.ts` (`sanitizeJobDescription` for sources with real HTML, `stripToPlainText` for already-plain sources) before being stored — this is the only line of defense against XSS from third-party job feeds rendered later in the UI.

**File storage**: resumes upload to Cloudflare R2 via `lib/r2.ts` (S3-compatible client, `region: "auto"`); only the resulting public URL is stored in Postgres (`Resume.fileUrl`), not the file itself.

**Cron jobs**: scheduled in `vercel.json` — ingest at 07:00 UTC (`app/api/cron/ingest`), follow-up reminders at 08:00 (`app/api/cron/reminders`), daily digest at 09:00 (`app/api/cron/daily-digest`). All are gated by `requireCronSecret` (`lib/cron-auth.ts`), which fails closed when `CRON_SECRET` is unset — these paths are public as far as Clerk middleware is concerned. Hobby only permits **daily** crons, which is why the work is split across three of them rather than run on a frequent worker.

**Notifications**: primary delivery is **email via Brevo** (`lib/email.ts`) plus **in-app** `Notification` rows (bell UI). Optional **web-push** (VAPID / `PushSubscription`) is best-effort. `notifyUser` in `lib/notifications.ts` gates on preference toggles; quiet hours skip push only. Allowlisted users use `BREVO_API_KEY` + `BREVO_FROM_EMAIL`; BYOC users supply Brevo API key + verified sender (encrypted on `UserCredentials`). Legacy `User.pushSubscription` Json field is unused by the send path.

**PWA**: `next-pwa` (Workbox) is configured in `next.config.mjs` and disabled in development. The generic `NetworkFirst` API cache deliberately excludes `/api/push/`, `/api/internal/`, and `/api/jobs/score-batch` — stale responses on those would break subscription state and stall the client's scoring loop, and the rule's 10s network timeout would fire mid-chunk. Don't add caching to them without re-reading why. The generated `public/sw.js` and `public/workbox-*.js` are build output and are gitignored; they're rebuilt on every `npm run build`.

**Data model shape worth knowing** (`prisma/schema.prisma`): `Application` can reference a `Job` OR carry `inlineJobData` (Json) for manually-added applications with no scraped `Job` row — always check both when reading job info off an `Application` (see the `jobTitle`/`company` fallback pattern in the cover-letter route). `JobEvaluation` stores scoring results in loosely-typed `blockA`–`blockG` Json columns rather than dedicated columns — expect this to evolve as scoring criteria change. `Application.stage` is a free-text string, not an enum in the DB; valid values are the user's own `Stage` rows (customizable — see `lib/stages.ts`) plus the fixed terminal outcomes in `lib/stage-constants.ts`. Don't hardcode stage names: a user who renames a column would silently drop out of any query that does.

**Shared types**: `src/types/preferences.ts` and `src/types/forms.ts` are dependency-free leaf modules shared by the profile UI, onboarding, and the server — import shapes from there rather than redeclaring them locally. `src/types/client.ts` holds the wire format (what routes actually return, `Date` already serialized to `string`); keep it in step with `JOB_CLIENT_SELECT` in `lib/job-select.ts`, which decides what the server sends.

**Path alias**: `@/*` maps to the repo root (see `tsconfig.json`), e.g. `@/lib/ai`, `@/lib/prisma`.

## Environment

See `.env.example` for the full list. Notable non-obvious ones: `DIRECT_URL` vs `DATABASE_URL` (session vs transaction pooling mode — both required), `CRON_SECRET` (must match between Vercel env and the deployed value, arbitrary string), `AI_PROVIDER` + `AI_API_KEY` (operator AI — `google` or `anthropic`), `BREVO_API_KEY` + `BREVO_FROM_EMAIL` (email notifications for allowlisted users).
