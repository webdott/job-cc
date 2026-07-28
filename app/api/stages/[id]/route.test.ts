import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { jsonRequest } from "@/lib/__tests__/http";
import { getOrSeedStages } from "@/lib/stages";
import { PATCH, DELETE } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
});

describe("PATCH /api/stages/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH(jsonRequest("http://localhost/api/stages/x", "PATCH", {}), {
      params: { id: "x" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for a stage owned by a different user", async () => {
    const owner = await createTestUser();
    const attacker = await createTestUser();
    mockAuth.mockResolvedValue({ userId: attacker.clerkId });

    const stages = await getOrSeedStages(owner.id);

    const res = await PATCH(
      jsonRequest("http://localhost/api/stages/x", "PATCH", { label: "Hacked" }),
      { params: { id: stages[0].id } }
    );
    expect(res.status).toBe(404);
  });

  it("renames a stage without changing its stable key", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const stages = await getOrSeedStages(user.id);

    const res = await PATCH(
      jsonRequest("http://localhost/api/stages/x", "PATCH", { label: "In Review" }),
      { params: { id: stages[0].id } }
    );
    const body = await res.json();
    expect(body.stage.label).toBe("In Review");
    expect(body.stage.key).toBe(stages[0].key);
  });
});

describe("DELETE /api/stages/:id", () => {
  it("refuses to delete the user's last remaining stage", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const stage = await prisma.stage.create({
      data: { userId: user.id, key: "Only", label: "Only", position: 0 },
    });

    const res = await DELETE(jsonRequest("http://localhost/api/stages/x", "DELETE"), {
      params: { id: stage.id },
    });
    expect(res.status).toBe(400);
  });

  it("refuses to delete a stage that still has applications in it", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const stages = await getOrSeedStages(user.id);
    await prisma.application.create({
      data: { userId: user.id, stage: stages[0].key, inlineJobData: { title: "x" } },
    });

    const res = await DELETE(jsonRequest("http://localhost/api/stages/x", "DELETE"), {
      params: { id: stages[0].id },
    });
    expect(res.status).toBe(409);
  });

  it("deletes an unused, non-last stage", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const stages = await getOrSeedStages(user.id);

    const res = await DELETE(jsonRequest("http://localhost/api/stages/x", "DELETE"), {
      params: { id: stages[0].id },
    });
    expect(res.status).toBe(200);
    const remaining = await prisma.stage.findMany({ where: { userId: user.id } });
    expect(remaining).toHaveLength(5);
  });
});
