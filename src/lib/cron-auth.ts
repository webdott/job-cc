import { NextResponse, type NextRequest } from "next/server";

/**
 * Shared bearer-token gate for cron endpoints and the self-invoked background
 * workers.
 *
 * Returns a ready-to-return 401 when the caller isn't Vercel's scheduler (or
 * ourselves), or null when the request may proceed. An unset CRON_SECRET fails
 * closed — these routes are public as far as Clerk middleware is concerned, so
 * a missing secret must never mean "open to everyone".
 */
export function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization");

  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Absolute base URL for this deployment, needed because a function chaining to
 * itself has to make a real HTTP request.
 *
 * `VERCEL_URL` is the per-deployment host and is always set on Vercel, but it
 * points at the immutable deployment rather than the production alias — good
 * for a self-call, since a chain should stay on the deployment that started it.
 */
export function selfBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return null;
}
