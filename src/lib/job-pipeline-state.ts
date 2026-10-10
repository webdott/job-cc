// Client-safe — no server/Prisma imports.
import { REJECTED_STAGE_KEY } from "@/lib/stage-constants";
import type { ClientJob } from "@/types/client";

/**
 * Where a Discover job stands in the user's pipeline, derived from the
 * application the server attaches to it (see `JOB_CLIENT_SELECT`).
 *
 * "saved" covers every stage except Rejected — Applied, Interview, even
 * Withdrawn — because what Discover needs to say is "this is already on your
 * board, don't save it again". Rejected is split out because those jobs are
 * hidden from the list by default and need their own tag when revealed.
 */
export type JobPipelineState = "none" | "saved" | "rejected";

export function getJobPipelineState(job: Pick<ClientJob, "applications">): JobPipelineState {
  const application = job.applications[0];
  if (!application) return "none";
  return application.stage === REJECTED_STAGE_KEY ? "rejected" : "saved";
}
