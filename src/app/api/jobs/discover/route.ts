import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireUserCredentials } from "@/lib/byoc";
import { fetchAllSources } from "@/lib/job-sources";
import { ingestJobsForUser } from "@/lib/job-ingest";
import { countQueued } from "@/lib/score-queue";

/**
 * Ingest-only. Fetches the three sources, bulk-inserts what's new, and reports
 * how much is now waiting to be scored.
 *
 * Scoring used to happen here, sequentially, one model call per job — up to 180
 * of them, which is roughly twelve minutes of work inside a request that gets
 * killed at five. The client now drains the queue in chunks via
 * /api/jobs/score-batch, so this returns in seconds and a scan survives being
 * interrupted.
 */

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });

  // No AI call happens here any more, but keep the gate: without credentials the
  // jobs we ingest could never be scored, so failing now is clearer than
  // silently filling the queue.
  const { error: credError } = await requireUserCredentials(user.email, user.id);
  if (credError) return credError;

  const sourceJobs = await fetchAllSources();
  const { discovered } = await ingestJobsForUser(user.id, sourceJobs);
  const remainingToScore = await countQueued(user.id);

  return NextResponse.json({ discovered, remainingToScore, total: sourceJobs.length });
}
