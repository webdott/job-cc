import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { ingestJobsForUser } from "@/lib/job-ingest";
import type { NormalizedJob } from "@/lib/job-sources";

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    sourceUrl: "https://example.com/job/1",
    sourceId: "remotive-1",
    source: "remotive",
    title: "Backend Engineer",
    company: "Acme",
    location: "Remote",
    description: "desc",
    remote: true,
    postedAt: null,
    ...overrides,
  };
}

beforeEach(async () => {
  await resetTestDb();
});

describe("ingestJobsForUser", () => {
  it("inserts new jobs and reports how many landed", async () => {
    const user = await createTestUser();

    const result = await ingestJobsForUser(user.id, [
      job(),
      job({ sourceUrl: "https://example.com/job/2", sourceId: "remotive-2" }),
    ]);

    expect(result.discovered).toBe(2);
    expect(await prisma.job.count()).toBe(2);
  });

  it("drops the `source` marker rather than trying to persist it", async () => {
    const user = await createTestUser();
    await ingestJobsForUser(user.id, [job()]);

    const stored = await prisma.job.findFirstOrThrow();
    expect(stored.sourceId).toBe("remotive-1");
    expect(stored).not.toHaveProperty("source");
  });

  it("collapses duplicate URLs inside a single batch", async () => {
    const user = await createTestUser();

    // The same posting surfacing twice in one fetch.
    const result = await ingestJobsForUser(user.id, [job(), job()]);

    expect(result.discovered).toBe(1);
    expect(await prisma.job.count()).toBe(1);
  });

  it("skips jobs the user already has and reports zero discovered", async () => {
    const user = await createTestUser();
    await ingestJobsForUser(user.id, [job()]);

    const second = await ingestJobsForUser(user.id, [job()]);

    expect(second.discovered).toBe(0);
    expect(await prisma.job.count()).toBe(1);
  });

  it("does not re-insert an archived job — the row is its own tombstone", async () => {
    const user = await createTestUser();
    await ingestJobsForUser(user.id, [job()]);
    await prisma.job.updateMany({ data: { status: "ARCHIVED", description: "" } });

    const second = await ingestJobsForUser(user.id, [job()]);

    expect(second.discovered).toBe(0);
    expect(await prisma.job.count()).toBe(1);
    const stored = await prisma.job.findFirstOrThrow();
    expect(stored.status).toBe("ARCHIVED");
  });

  it("keeps each user's copy separate", async () => {
    const a = await createTestUser();
    const b = await createTestUser();

    expect((await ingestJobsForUser(a.id, [job()])).discovered).toBe(1);
    expect((await ingestJobsForUser(b.id, [job()])).discovered).toBe(1);

    expect(await prisma.job.count()).toBe(2);
  });

  it("is a no-op on an empty feed", async () => {
    const user = await createTestUser();
    expect((await ingestJobsForUser(user.id, [])).discovered).toBe(0);
    expect(await prisma.job.count()).toBe(0);
  });
});
