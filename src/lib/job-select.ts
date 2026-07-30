import type { Prisma } from "@prisma/client";

/**
 * The Job fields that cross the wire.
 *
 * Routes previously returned raw Prisma rows with no `select`, so `userId`,
 * `sourceId`, and the internal scoring bookkeeping shipped to the browser even
 * though no client interface declared them. Listing the fields explicitly keeps
 * the response shape and the client `Job` type honest about each other.
 *
 * `status`, `prefMatch` and `archivedReason` are included deliberately: with the
 * "Show skipped" toggle the list can contain hidden jobs, and the UI needs to
 * say *why* each one was hidden.
 */
export const JOB_CLIENT_SELECT = {
  id: true,
  title: true,
  company: true,
  location: true,
  remote: true,
  salaryMin: true,
  salaryMax: true,
  description: true,
  sourceUrl: true,
  fetchedAt: true,
  status: true,
  prefMatch: true,
  archivedReason: true,
  evaluation: {
    select: {
      overallScore: true,
      recommendation: true,
      blockA: true,
      blockB: true,
    },
  },
} satisfies Prisma.JobSelect;
