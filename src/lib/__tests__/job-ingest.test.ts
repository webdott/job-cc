import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { ingestJobsForUser, recomputePrefMatch } from "@/lib/job-ingest";
import { EMPTY_PREFERENCES, type JobPreferences } from "@/lib/job-match";
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

function prefs(overrides: Partial<JobPreferences> = {}): JobPreferences {
  return { ...EMPTY_PREFERENCES, ...overrides };
}

beforeEach(async () => {
  await resetTestDb();
});

describe("ingestJobsForUser", () => {
  it("inserts new jobs and reports how many landed", async () => {
    const user = await createTestUser();

    const result = await ingestJobsForUser(
      user.id,
      [job(), job({ sourceUrl: "https://example.com/job/2", title: "Data Engineer" })],
      prefs()
    );

    expect(result.discovered).toBe(2);
    expect(await prisma.job.count()).toBe(2);
  });

  it("drops the `source` marker rather than trying to persist it", async () => {
    const user = await createTestUser();
    await ingestJobsForUser(user.id, [job()], prefs());

    const stored = await prisma.job.findFirstOrThrow();
    expect(stored.sourceId).toBe("remotive-1");
    expect(stored).not.toHaveProperty("source");
  });

  it("collapses duplicate URLs inside a single batch", async () => {
    const user = await createTestUser();

    const result = await ingestJobsForUser(user.id, [job(), job()], prefs());

    expect(result.discovered).toBe(1);
    expect(await prisma.job.count()).toBe(1);
  });

  it("skips jobs the user already has and reports zero discovered", async () => {
    const user = await createTestUser();
    await ingestJobsForUser(user.id, [job()], prefs());

    const second = await ingestJobsForUser(user.id, [job()], prefs());

    expect(second.discovered).toBe(0);
    expect(await prisma.job.count()).toBe(1);
  });

  it("does not re-insert an archived job — the row is its own tombstone", async () => {
    const user = await createTestUser();
    await ingestJobsForUser(user.id, [job()], prefs());
    await prisma.job.updateMany({
      data: { status: "ARCHIVED", archivedReason: "low_score", description: "" },
    });

    const second = await ingestJobsForUser(user.id, [job()], prefs());

    expect(second.discovered).toBe(0);
    expect(await prisma.job.count()).toBe(1);
    const stored = await prisma.job.findFirstOrThrow();
    expect(stored.status).toBe("ARCHIVED");
  });

  it("keeps each user's copy separate", async () => {
    const a = await createTestUser();
    const b = await createTestUser();

    expect((await ingestJobsForUser(a.id, [job()], prefs())).discovered).toBe(1);
    expect((await ingestJobsForUser(b.id, [job()], prefs())).discovered).toBe(1);

    expect(await prisma.job.count()).toBe(2);
  });

  it("is a no-op on an empty feed", async () => {
    const user = await createTestUser();
    const result = await ingestJobsForUser(user.id, [], prefs());
    expect(result).toEqual({ discovered: 0, queued: 0, filtered: 0 });
    expect(await prisma.job.count()).toBe(0);
  });

  describe("cross-source dedupe", () => {
    const sameRoleOnRemotive = job({
      sourceUrl: "https://remotive.com/job/9",
      sourceId: "remotive-9",
      source: "remotive",
      company: "Acme, Inc.",
      title: "Senior Front-End Engineer",
    });

    const sameRoleOnArbeitnow = job({
      sourceUrl: "https://arbeitnow.com/job/xyz",
      sourceId: "arbeitnow-xyz",
      source: "arbeitnow",
      company: "ACME Inc",
      title: "Senior Front End Engineer",
    });

    it("stores one row when the same role appears on two sources", async () => {
      const user = await createTestUser();

      const result = await ingestJobsForUser(
        user.id,
        [sameRoleOnArbeitnow, sameRoleOnRemotive],
        prefs()
      );

      expect(result.discovered).toBe(1);
      expect(await prisma.job.count()).toBe(1);
    });

    it("prefers the higher-quality source regardless of feed order", async () => {
      const user = await createTestUser();
      // Arbeitnow first, so precedence has to win over ordering.
      await ingestJobsForUser(user.id, [sameRoleOnArbeitnow, sameRoleOnRemotive], prefs());

      const stored = await prisma.job.findFirstOrThrow();
      expect(stored.sourceId).toBe("remotive-9");
    });

    it("prefers a structured source over a heuristically-parsed HN listing", async () => {
      const user = await createTestUser();
      const hn = job({
        sourceUrl: "https://news.ycombinator.com/item?id=1",
        sourceId: "hn-1",
        source: "hn",
        company: "Acme",
        title: "Senior Frontend Engineer",
      });

      await ingestJobsForUser(user.id, [hn, sameRoleOnArbeitnow], prefs());

      const stored = await prisma.job.findFirstOrThrow();
      expect(stored.sourceId).toBe("arbeitnow-xyz");
    });

    it("skips a role already stored under a different URL", async () => {
      const user = await createTestUser();
      await ingestJobsForUser(user.id, [sameRoleOnRemotive], prefs());

      const second = await ingestJobsForUser(user.id, [sameRoleOnArbeitnow], prefs());

      expect(second.discovered).toBe(0);
      expect(await prisma.job.count()).toBe(1);
    });

    it("keeps listings whose company/title can't be normalized", async () => {
      const user = await createTestUser();
      // A bad HN parse must not collapse unrelated jobs into one row.
      const result = await ingestJobsForUser(
        user.id,
        [
          job({ sourceUrl: "https://news.ycombinator.com/item?id=1", company: "", title: "---" }),
          job({ sourceUrl: "https://news.ycombinator.com/item?id=2", company: "", title: "???" }),
        ],
        prefs()
      );

      expect(result.discovered).toBe(2);
      const stored = await prisma.job.findMany();
      expect(stored.every((j) => j.dedupeKey === null)).toBe(true);
    });
  });

  describe("preference prefilter", () => {
    it("queues everything when no target roles are set", async () => {
      const user = await createTestUser();

      const result = await ingestJobsForUser(
        user.id,
        [job({ title: "Veterinary Nurse" }), job({ sourceUrl: "u2", title: "Backend Engineer" })],
        prefs()
      );

      expect(result.discovered).toBe(2);
      expect(result.queued).toBe(2);
      expect(result.filtered).toBe(0);
      const stored = await prisma.job.findMany();
      expect(stored.every((j) => j.prefMatch === true)).toBe(true);
    });

    it("marks non-matching jobs so they are never scored", async () => {
      const user = await createTestUser();

      const result = await ingestJobsForUser(
        user.id,
        [
          job({ sourceUrl: "u1", title: "Senior Frontend Engineer", company: "A" }),
          job({ sourceUrl: "u2", title: "Data Engineer", company: "B" }),
          job({ sourceUrl: "u3", title: "Warehouse Operative", company: "C" }),
        ],
        prefs({ targetRoles: ["Frontend Engineer"] })
      );

      expect(result.discovered).toBe(3);
      expect(result.queued).toBe(1);
      expect(result.filtered).toBe(2);

      const matched = await prisma.job.findMany({ where: { prefMatch: true } });
      expect(matched.map((j) => j.title)).toEqual(["Senior Frontend Engineer"]);
    });

    it("still stores filtered jobs, so widening preferences can recover them", async () => {
      const user = await createTestUser();

      await ingestJobsForUser(
        user.id,
        [job({ title: "Data Engineer" })],
        prefs({ targetRoles: ["Frontend Engineer"] })
      );

      const stored = await prisma.job.findFirstOrThrow();
      expect(stored.prefMatch).toBe(false);
      // Description intact — no re-fetch needed to score it later.
      expect(stored.description).toBe("desc");
    });
  });
});

describe("recomputePrefMatch", () => {
  async function seed(userId: string) {
    await ingestJobsForUser(
      userId,
      [
        job({ sourceUrl: "u1", title: "Frontend Engineer", company: "A" }),
        job({ sourceUrl: "u2", title: "Data Engineer", company: "B" }),
      ],
      prefs({ targetRoles: ["Frontend Engineer"] })
    );
  }

  it("recovers previously-skipped jobs when preferences widen", async () => {
    const user = await createTestUser();
    await seed(user.id);
    expect(await prisma.job.count({ where: { prefMatch: false } })).toBe(1);

    const result = await recomputePrefMatch(
      user.id,
      prefs({ targetRoles: ["Frontend Engineer", "Data Engineer"] })
    );

    expect(result.queued).toBe(2);
    expect(result.filtered).toBe(0);
    expect(await prisma.job.count({ where: { prefMatch: false } })).toBe(0);
  });

  it("removes jobs from the queue when preferences narrow", async () => {
    const user = await createTestUser();
    await seed(user.id);

    const result = await recomputePrefMatch(user.id, prefs({ targetRoles: ["Data Engineer"] }));

    expect(result.queued).toBe(1);
    expect(result.filtered).toBe(1);

    const frontend = await prisma.job.findFirstOrThrow({ where: { sourceUrl: "u1" } });
    expect(frontend.prefMatch).toBe(false);
  });

  it("queues everything again when target roles are cleared", async () => {
    const user = await createTestUser();
    await seed(user.id);

    const result = await recomputePrefMatch(user.id, prefs());

    expect(result.queued).toBe(2);
    expect(await prisma.job.count({ where: { prefMatch: true } })).toBe(2);
  });

  it("leaves already-scored jobs alone", async () => {
    const user = await createTestUser();
    await seed(user.id);
    const scored = await prisma.job.findFirstOrThrow({ where: { sourceUrl: "u2" } });
    await prisma.jobEvaluation.create({
      data: { jobId: scored.id, userId: user.id, overallScore: 55 },
    });

    await recomputePrefMatch(user.id, prefs({ targetRoles: ["Data Engineer"] }));

    // Its outcome was already decided; preferences don't retroactively change it.
    const after = await prisma.job.findFirstOrThrow({ where: { sourceUrl: "u2" } });
    expect(after.prefMatch).toBe(false);
  });

  it("leaves archived low scorers archived", async () => {
    const user = await createTestUser();
    await seed(user.id);
    await prisma.job.updateMany({
      where: { sourceUrl: "u2" },
      data: { status: "ARCHIVED", archivedReason: "low_score", description: "" },
    });

    await recomputePrefMatch(user.id, prefs({ targetRoles: ["Data Engineer"] }));

    const archived = await prisma.job.findFirstOrThrow({ where: { sourceUrl: "u2" } });
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.prefMatch).toBe(false);
  });

  it("does not touch another user's jobs", async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await seed(a.id);
    await seed(b.id);

    await recomputePrefMatch(a.id, prefs());

    expect(await prisma.job.count({ where: { userId: b.id, prefMatch: false } })).toBe(1);
  });
});
