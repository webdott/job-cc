import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { GET } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
});

describe("GET /api/notifications", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns recent notifications and the unread count, scoped to the caller", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "job_match",
        title: "Read one",
        body: "b",
        readAt: new Date(),
      },
    });
    await prisma.notification.create({
      data: { userId: user.id, type: "job_match", title: "Unread one", body: "b" },
    });
    await prisma.notification.create({
      data: { userId: other.id, type: "job_match", title: "Not mine", body: "b" },
    });

    const res = await GET();
    const body = await res.json();
    expect(body.notifications).toHaveLength(2);
    expect(body.unreadCount).toBe(1);
  });
});
