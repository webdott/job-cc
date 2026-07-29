import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { jsonRequest } from "@/lib/__tests__/http";
import { getOrSeedStages } from "@/lib/stages";
import { POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
});

describe("POST /api/stages/reorder", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(jsonRequest("http://localhost/api/stages/reorder", "POST", { ids: [] }));
    expect(res.status).toBe(401);
  });

  it("rejects ids that don't all belong to the caller", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const mine = await getOrSeedStages(user.id);
    const theirs = await getOrSeedStages(other.id);

    const res = await POST(
      jsonRequest("http://localhost/api/stages/reorder", "POST", {
        ids: [mine[0].id, theirs[0].id],
      })
    );
    expect(res.status).toBe(400);
  });

  it("persists the new position order", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const stages = await getOrSeedStages(user.id);
    const reversedIds = [...stages].reverse().map((s) => s.id);

    const res = await POST(
      jsonRequest("http://localhost/api/stages/reorder", "POST", { ids: reversedIds })
    );
    expect(res.status).toBe(200);

    const reordered = await prisma.stage.findMany({
      where: { userId: user.id },
      orderBy: { position: "asc" },
    });
    expect(reordered.map((s) => s.id)).toEqual(reversedIds);
  });
});
