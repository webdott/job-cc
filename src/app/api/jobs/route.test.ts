import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { jsonRequest } from "@/lib/__tests__/http";
import { GET, DELETE } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function listRequest(query = "") {
  return new NextRequest(`http://localhost/api/jobs${query}`);
}

function createJob(userId: string, slug: string, overrides: Record<string, unknown> = {}) {
  return prisma.job.create({
    data: {
      userId,
      sourceUrl: `https://example.com/job/${slug}`,
      title: `Job ${slug}`,
      company: "Acme",
      description: "desc",
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
});

describe("GET /api/jobs", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    expect((await GET(listRequest())).status).toBe(401);
  });

  it("hides archived and non-matching jobs by default", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    await createJob(user.id, "visible", { prefMatch: true });
    await createJob(user.id, "archived", { prefMatch: true, status: "ARCHIVED" });
    await createJob(user.id, "filtered", { prefMatch: false });

    const body = await (await GET(listRequest())).json();

    expect(body.jobs.map((j: { title: string }) => j.title)).toEqual(["Job visible"]);
    expect(body.total).toBe(1);
  });

  it("keeps jobs whose prefMatch was never evaluated visible", async () => {
    // Same NULL trap as the scoring queue: these predate preference filtering
    // and must not silently vanish from the list.
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    await createJob(user.id, "legacy", { prefMatch: null });

    const body = await (await GET(listRequest())).json();
    expect(body.total).toBe(1);
  });

  it("reveals everything with showArchived=true", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    await createJob(user.id, "visible", { prefMatch: true });
    await createJob(user.id, "archived", { prefMatch: true, status: "ARCHIVED" });
    await createJob(user.id, "filtered", { prefMatch: false });

    const body = await (await GET(listRequest("?showArchived=true"))).json();
    expect(body.total).toBe(3);
  });

  describe("minScore", () => {
    async function seedScored(userId: string) {
      for (const [slug, score] of [
        ["high", 90],
        ["low", 20],
      ] as const) {
        const j = await createJob(userId, slug, { prefMatch: true });
        await prisma.jobEvaluation.create({
          data: { jobId: j.id, userId, overallScore: score },
        });
      }
      await createJob(userId, "unscored", { prefMatch: true });
    }

    it("filters out jobs below the threshold", async () => {
      const user = await createTestUser();
      mockAuth.mockResolvedValue({ userId: user.clerkId });
      await seedScored(user.id);

      const body = await (await GET(listRequest("?minScore=50"))).json();
      const titles = body.jobs.map((j: { title: string }) => j.title).sort();

      expect(titles).not.toContain("Job low");
      expect(titles).toContain("Job high");
    });

    it("keeps unscored jobs visible — they're pending, not zero", async () => {
      // The old `(overallScore ?? 0) >= minScore` made everything still in the
      // scoring queue vanish the moment the slider left 0, which now happens
      // constantly because scoring is asynchronous.
      const user = await createTestUser();
      mockAuth.mockResolvedValue({ userId: user.clerkId });
      await seedScored(user.id);

      const body = await (await GET(listRequest("?minScore=50"))).json();
      const titles = body.jobs.map((j: { title: string }) => j.title);

      expect(titles).toContain("Job unscored");
      expect(body.total).toBe(2);
    });
  });

  it("sorts by score with unscored jobs last", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const unscored = await createJob(user.id, "unscored", { prefMatch: true });
    const mid = await createJob(user.id, "mid", { prefMatch: true });
    const top = await createJob(user.id, "top", { prefMatch: true });
    await prisma.jobEvaluation.create({
      data: { jobId: mid.id, userId: user.id, overallScore: 55 },
    });
    await prisma.jobEvaluation.create({
      data: { jobId: top.id, userId: user.id, overallScore: 95 },
    });

    const body = await (await GET(listRequest("?sortBy=score"))).json();

    expect(body.jobs.map((j: { id: string }) => j.id)).toEqual([top.id, mid.id, unscored.id]);
  });

  it("paginates in SQL rather than slicing the whole table", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    for (let i = 0; i < 25; i++) await createJob(user.id, `j${i}`, { prefMatch: true });

    const first = await (await GET(listRequest("?page=1"))).json();
    expect(first.jobs).toHaveLength(20);
    expect(first.total).toBe(25);
    expect(first.hasMore).toBe(true);

    const second = await (await GET(listRequest("?page=2"))).json();
    expect(second.jobs).toHaveLength(5);
    expect(second.hasMore).toBe(false);

    const firstIds = new Set(first.jobs.map((j: { id: string }) => j.id));
    expect(second.jobs.some((j: { id: string }) => firstIds.has(j.id))).toBe(false);
  });

  it("does not ship internal columns to the client", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    await createJob(user.id, "1", { prefMatch: true, dedupeKey: "acme|job", scoreAttempts: 2 });

    const body = await (await GET(listRequest())).json();

    expect(body.jobs[0]).not.toHaveProperty("userId");
    expect(body.jobs[0]).not.toHaveProperty("dedupeKey");
    expect(body.jobs[0]).not.toHaveProperty("scoreAttempts");
    expect(body.jobs[0]).not.toHaveProperty("sourceId");
  });

  it("never returns another user's jobs", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    await createJob(other.id, "theirs", { prefMatch: true });

    const body = await (await GET(listRequest())).json();
    expect(body.total).toBe(0);
  });
});

describe("DELETE /api/jobs", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(jsonRequest("http://localhost/api/jobs", "DELETE", { id: "x" }));
    expect(res.status).toBe(401);
  });

  it("deletes a job with no application attached", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const job = await createJob(user.id, "1");

    const res = await DELETE(jsonRequest("http://localhost/api/jobs", "DELETE", { id: job.id }));

    expect(res.status).toBe(200);
    expect(await prisma.job.count()).toBe(0);
  });

  it("refuses to delete another user's job", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const job = await createJob(other.id, "1");

    const res = await DELETE(jsonRequest("http://localhost/api/jobs", "DELETE", { id: job.id }));

    expect(res.status).toBe(404);
    expect(await prisma.job.count()).toBe(1);
  });

  it("preserves the pipeline card when deleting a job that was applied to", async () => {
    // Application.jobId is optional, so Prisma's default is onDelete: SetNull —
    // without the backfill the card survives with no title or company at all.
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const job = await createJob(user.id, "1", {
      title: "Staff Engineer",
      company: "Globex",
      location: "Lisbon",
      remote: true,
    });
    const application = await prisma.application.create({
      data: { userId: user.id, jobId: job.id, stage: "Applied" },
    });

    const res = await DELETE(jsonRequest("http://localhost/api/jobs", "DELETE", { id: job.id }));
    expect(res.status).toBe(200);

    expect(await prisma.job.count()).toBe(0);

    const after = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(after.jobId).toBeNull();
    expect(after.inlineJobData).toMatchObject({
      title: "Staff Engineer",
      company: "Globex",
      location: "Lisbon",
      remote: true,
    });
  });
});
