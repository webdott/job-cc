# Job Command Center

> An AI-powered job application tracker and PWA — built to eliminate the spreadsheet and put your entire job search in one place.

![Next.js](https://img.shields.io/badge/Next.js_14-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel)
![Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?style=flat&logo=google&logoColor=white)

---

## What it does

- **Upload once** — AI parses your resume into skills, experience, and a strength score
- **Daily job discovery** — aggregates listings from Remotive, Arbeitnow, and HN Who's Hiring; scores each one 0–100 against your resume
- **Kanban pipeline** — drag-and-drop board tracks every application from Saved → Offer / Rejected
- **AI cover letters** — streams a tailored letter word-by-word; three tone options; version history
- **Interview prep** — generates likely questions by category with hints, key themes, and gap analysis
- **Email + in-app notifications** — daily digest at 9am UTC and follow-up reminders; email via Brevo, history in the notification bell; optional web push
- **Works offline** — installable PWA with service worker caching

---

## Tech Stack

| Layer         | Technology                                                     |
| ------------- | -------------------------------------------------------------- |
| Framework     | Next.js 14 App Router + TypeScript                             |
| Styling       | Tailwind CSS + shadcn/ui (dark-first)                          |
| Auth          | Clerk v6 (Google OAuth + magic link)                           |
| Database      | PostgreSQL via Supabase + Prisma 7                             |
| AI            | Vercel AI SDK + Google Gemini 2.5 Pro/Flash / Anthropic models |
| File Storage  | Cloudflare R2 (S3-compatible)                                  |
| State         | TanStack Query v5 (server state)                               |
| Drag-and-drop | dnd-kit                                                        |
| Charts        | Recharts                                                       |
| Animations    | Framer Motion                                                  |
| Email         | Brevo transactional API                                        |
| Push          | web-push (VAPID) — optional device alerts                      |
| PWA           | next-pwa (Workbox)                                             |
| Hosting       | Vercel (cron jobs + edge)                                      |

---

## Features

- **Discover** — scan 3 free job sources, filter by score / remote, paginated with sort
- **AI Scoring** — Gemini Flash scores each job vs your active resume, flags strengths & gaps
- **Pipeline Kanban** — 6 default stages, drag-and-drop, click-to-open detail panel
- **Cover Letter Generator** — streaming SSE output, tone selector, 5-version history
- **Interview Prep** — AI questions by category (Behavioural / Technical / Situational / Culture)
- **Follow-up Reminders** — set a date on any application, get an email + in-app alert (optional web push)
- **Analytics** — response rate, funnel chart, weekly trend, average score
- **Dark / Light / System** theme toggle
- **PWA** — installable on iOS and Android, offline read access

---

## Local Setup

```bash
# 1. Clone and install
git clone <repo>
cd job-command-center
npm install

# 2. Copy env template
cp .env.example .env.local
# Fill in all values (see table below)

# 3. Push the DB schema
npx prisma db push

# 4. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test app

```bash
pnpm run db:test:up
pnpm run db:test:push   # once, or after schema changes
pnpm run test
```

---

## Environment Variables

| Variable                            | Where to get it                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | Supabase → Settings → Database → Connection string (Transaction mode)                                                      |
| `DIRECT_URL`                        | Supabase → Settings → Database → Connection string (Session mode)                                                          |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [clerk.com](https://clerk.com) → API Keys                                                                                  |
| `CLERK_SECRET_KEY`                  | Clerk → API Keys                                                                                                           |
| `GOOGLE_GENERATIVE_AI_API_KEY`      | [aistudio.google.com](https://aistudio.google.com) → Get API key                                                           |
| `CLOUDFLARE_R2_ACCOUNT_ID`          | Cloudflare → R2 → Overview                                                                                                 |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`       | Cloudflare → R2 → Manage API tokens                                                                                        |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY`   | Same as above                                                                                                              |
| `CLOUDFLARE_R2_BUCKET_NAME`         | Your R2 bucket name                                                                                                        |
| `CLOUDFLARE_R2_PUBLIC_URL`          | Cloudflare → R2 → Bucket → Settings → Public Development URL                                                               |
| `BREVO_API_KEY`                     | Brevo → SMTP & API → API keys ([help](https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys)) |
| `BREVO_FROM_EMAIL`                  | Verified sender in Brevo ([Senders](https://app.brevo.com/senders/domain/ips))                                             |
| `UPSTASH_REDIS_REST_URL`            | [upstash.com](https://upstash.com) → Redis → REST API                                                                      |
| `UPSTASH_REDIS_REST_TOKEN`          | Same as above                                                                                                              |
| `VAPID_PUBLIC_KEY`                  | Generate: `npx web-push generate-vapid-keys`                                                                               |
| `VAPID_PRIVATE_KEY`                 | Same command                                                                                                               |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`      | Same as `VAPID_PUBLIC_KEY`                                                                                                 |
| `VAPID_CONTACT_EMAIL`               | Contact email for VAPID (any you control)                                                                                  |
| `NEXT_PUBLIC_APP_URL`               | `http://localhost:3000` locally, your Vercel URL in prod                                                                   |
| `CRON_SECRET`                       | Any random string — set same value in Vercel env                                                                           |
| `ALLOWED_USER_EMAILS`               | Optional allowlist; others BYOC (AI + R2 + Brevo)                                                                          |
| `CREDENTIALS_ENCRYPTION_KEY`        | `openssl rand -hex 32` — required when allowlist is set                                                                    |

---

## Architecture

- **API Routes** — all server logic lives in `app/api/`. Auth via Clerk middleware (`middleware.ts`)
- **AI layer** — `lib/ai.ts` exports `proModel` (Gemini 2.5 Pro) and `flashModel` (Flash). Swap to Anthropic Claude by changing two lines
- **DB** — Prisma 7 with pg adapter. Schema in `prisma/schema.prisma`, datasource URL in `prisma.config.ts`
- **File uploads** — resumes go to Cloudflare R2, URL stored in DB
- **Crons** — `vercel.json` schedules daily digest (09:00 UTC) and reminder check (08:00 UTC)
- **Notifications** — `lib/notifications.notifyUser`: in-app history always (when type toggle on) → Brevo email (`lib/email.ts`) → optional web push. Operator uses `BREVO_API_KEY` + `BREVO_FROM_EMAIL`; BYOC users store encrypted Brevo key + verified sender on `UserCredentials`. Quiet hours skip push only.

---

## What this demonstrates

- Full-stack ownership — DB schema → serverless API → animated PWA UI, shipped solo
- AI product thinking — streaming UX, structured output, prompt caching strategy, model swap path
- PWA expertise — service workers, background sync, web push, offline-first
- Realtime patterns — SSE streaming for cover letters, optimistic Kanban updates
- Infrastructure — Vercel cron jobs, R2 object storage, Supabase RLS, edge deployment
