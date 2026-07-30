import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { GET } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

async function application(userId: string, stage: string) {
  return prisma.application.create({
    data: { userId, stage, inlineJobData: { title: "T", company: "C" } },
  });
}

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
});

describe("GET /api/analytics", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    expect((await GET()).status).toBe(401);
  });

  it("builds the funnel from the default stages when none are customized", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    await application(user.id, "Saved");
    await application(user.id, "Applied");

    const body = await (await GET()).json();
    const labels = body.stats.funnel.map((f: { stage: string }) => f.stage);

    expect(labels).toEqual(["Saved", "Applied", "Screening", "Interview", "Offer", "Rejected"]);
  });

  it("follows the user's own renamed and reordered stages", async () => {
    // The funnel used to filter against six hardcoded strings, so anyone who
    // renamed a column silently dropped out of their own analytics.
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    await prisma.stage.createMany({
      data: [
        { userId: user.id, key: "Saved", label: "Shortlist", color: "bg-slate-500", position: 0 },
        { userId: user.id, key: "Applied", label: "Applied", color: "bg-blue-500", position: 1 },
        {
          userId: user.id,
          key: "PhoneScreen",
          label: "Phone Screen",
          color: "bg-yellow-500",
          position: 2,
        },
      ],
    });

    await application(user.id, "PhoneScreen");
    await application(user.id, "PhoneScreen");
    await application(user.id, "Saved");

    const body = await (await GET()).json();
    const funnel = body.stats.funnel as Array<{ stage: string; count: number }>;

    expect(funnel.map((f) => f.stage)).toEqual(["Shortlist", "Applied", "Phone Screen"]);
    expect(funnel.find((f) => f.stage === "Phone Screen")?.count).toBe(2);
    // A custom stage after "Applied" still counts as a response.
    expect(body.stats.responded).toBe(2);
  });

  it("includes terminal outcomes only when they have applications", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    await application(user.id, "Ghosted");

    const body = await (await GET()).json();
    const labels = body.stats.funnel.map((f: { stage: string }) => f.stage);

    expect(labels).toContain("Ghosted");
    expect(labels).not.toContain("Withdrawn");
  });
});
