import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { scoreQueuedForUser } from "@/lib/score-queue";

/**
 * Scores one small chunk of the caller's queued jobs and reports what's left.
 *
 * The discover page calls this in a loop after a scan until `remaining` hits 0,
 * which is what keeps a scan resumable: each request is short enough that it
 * can't time out, and if the tab closes mid-drain the unscored jobs simply stay
 * queued for the nightly cron.
 */

export const maxDuration = 60;

/** Small on purpose. The client shows progress between chunks, and short
 * requests keep this well clear of both the function timeout and the service
 * worker's 10s network timeout. */
const CHUNK_SIZE = 12;
const BUDGET_MS = 20_000;

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });

  const outcome = await scoreQueuedForUser(user.id, {
    take: CHUNK_SIZE,
    deadline: Date.now() + BUDGET_MS,
  });

  return NextResponse.json(outcome);
}
