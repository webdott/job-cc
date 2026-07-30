import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { resolveUserCredentials } from "@/lib/byoc";
import { requireCronSecret } from "@/lib/cron-auth";

/**
 * Read-only: no source fetching, no upserts, no AI. Ingestion moved to
 * /api/cron/ingest and scoring to the drain, which is what removed the
 * users x 180 nested loop that could never finish inside one invocation.
 *
 * This deliberately does **not** wait for the scoring queue to empty. It emails
 * the best-scored jobs that exist right now; if the drain is behind, the user
 * gets a shorter digest rather than no digest, and there's no fragile
 * chain-into-email dependency between the two crons.
 */

export const maxDuration = 300;

const DIGEST_WINDOW_HOURS = 24;
/** Only the best match is named in the body; the rest just contribute a count. */
const MAX_MATCHES = 20;

export async function GET(req: NextRequest) {
  const authError = requireCronSecret(req);
  if (authError) return authError;

  const since = new Date(Date.now() - DIGEST_WINDOW_HOURS * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: { resumes: { some: { isActive: true } } },
    include: { pushSubscriptions: true },
  });

  let usersProcessed = 0;
  let notificationsSent = 0;

  for (const user of users) {
    try {
      const matches = await prisma.job.findMany({
        where: {
          userId: user.id,
          fetchedAt: { gte: since },
          // Implies an evaluation exists. Checking the score rather than the
          // relation also keeps unscored-but-evaluated rows from sorting to the
          // top, since Postgres orders NULLs first on DESC.
          evaluation: { overallScore: { not: null } },
        },
        select: {
          title: true,
          company: true,
          evaluation: { select: { overallScore: true } },
        },
        orderBy: { evaluation: { overallScore: "desc" } },
        take: MAX_MATCHES,
      });

      if (matches.length > 0) {
        const credentials = await resolveUserCredentials(user.email, user.id);
        // Non-allowlisted user with no saved BYOC credentials — we can't send.
        // Not counted as processed.
        if (!credentials) continue;

        const best = matches[0];
        const plural = matches.length !== 1 ? "es" : "";
        const body = `${matches.length} new job match${plural} — best: ${best.title} at ${best.company} (${Math.round(best.evaluation?.overallScore ?? 0)}%)`;

        // Unguarded in the previous version, so a single throw here ended the
        // run for every remaining user.
        const { pushed, emailed } = await notifyUser({
          userId: user.id,
          type: "job_match",
          title: "Job Command Center",
          body,
          url: "/discover",
          preferences: user.preferences,
          subscriptions: user.pushSubscriptions,
          userEmail: user.email,
          emailCredentials: credentials.email,
        });
        notificationsSent += Math.max(pushed, emailed ? 1 : 0);
      }

      usersProcessed++;
    } catch (err) {
      console.error(`Daily digest failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, usersProcessed, notificationsSent });
}
