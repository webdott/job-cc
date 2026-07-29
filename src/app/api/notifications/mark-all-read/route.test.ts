import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
});

describe("POST /api/notifications/mark-all-read", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("marks only the caller's unread notifications as read", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    await prisma.notification.create({
      data: { userId: user.id, type: "job_match", title: "a", body: "b" },
    });
    await prisma.notification.create({
      data: { userId: user.id, type: "job_match", title: "b", body: "b" },
    });
    await prisma.notification.create({
      data: { userId: other.id, type: "job_match", title: "c", body: "b" },
    });

    const res = await POST();
    expect(res.status).toBe(200);

    expect(await prisma.notification.count({ where: { userId: user.id, readAt: null } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: other.id, readAt: null } })).toBe(1);
  });
});
