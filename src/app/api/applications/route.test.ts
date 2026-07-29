import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { jsonRequest } from "@/lib/__tests__/http";
import { GET, POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
});

describe("GET /api/applications", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns an empty list when the clerk user has no app-level User row yet", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_no_user" });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applications: [] });
  });

  it("returns only the caller's applications, most recently active first", async () => {
    const user = await createTestUser();
    const otherUser = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    await prisma.application.create({
      data: {
        userId: user.id,
        inlineJobData: { title: "Older", company: "A" },
        lastActivityAt: new Date("2026-01-01"),
      },
    });
    const newer = await prisma.application.create({
      data: {
        userId: user.id,
        inlineJobData: { title: "Newer", company: "B" },
        lastActivityAt: new Date("2026-02-01"),
      },
    });
    await prisma.application.create({
      data: { userId: otherUser.id, inlineJobData: { title: "Not mine", company: "C" } },
    });

    const res = await GET();
    const body = await res.json();
    expect(body.applications).toHaveLength(2);
    expect(body.applications[0].id).toBe(newer.id);
  });
});

describe("POST /api/applications", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(jsonRequest("http://localhost/api/applications", "POST", {}));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the app-level User row doesn't exist", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_missing" });
    const res = await POST(
      jsonRequest("http://localhost/api/applications", "POST", {
        inlineJobData: { title: "Engineer" },
      })
    );
    expect(res.status).toBe(404);
  });

  it("rejects a body with neither jobId nor inlineJobData", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const res = await POST(jsonRequest("http://localhost/api/applications", "POST", {}));
    expect(res.status).toBe(400);
  });

  it("defaults to the user's first seeded stage when none is specified", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(
      jsonRequest("http://localhost/api/applications", "POST", {
        inlineJobData: { title: "Engineer", company: "Acme" },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.application.stage).toBe("Saved");

    const seededStages = await prisma.stage.findMany({ where: { userId: user.id } });
    expect(seededStages).toHaveLength(6);
  });

  it("rejects an invalid stage key", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(
      jsonRequest("http://localhost/api/applications", "POST", {
        inlineJobData: { title: "Engineer" },
        stage: "Not A Real Stage",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns the existing application instead of creating a duplicate for the same job", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const job = await prisma.job.create({
      data: {
        userId: user.id,
        sourceUrl: "https://example.com/job/1",
        title: "Engineer",
        company: "Acme",
        description: "desc",
      },
    });

    const first = await POST(
      jsonRequest("http://localhost/api/applications", "POST", { jobId: job.id })
    );
    expect(first.status).toBe(201);
    const firstBody = await first.json();

    const second = await POST(
      jsonRequest("http://localhost/api/applications", "POST", { jobId: job.id })
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.application.id).toBe(firstBody.application.id);

    const count = await prisma.application.count({ where: { userId: user.id, jobId: job.id } });
    expect(count).toBe(1);
  });
});
