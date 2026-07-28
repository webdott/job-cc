import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { PATCH } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function fakeRequest() {
  return new Request("http://localhost/api/notifications/x", { method: "PATCH" });
}

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
});

describe("PATCH /api/notifications/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH(fakeRequest(), { params: { id: "x" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 for a notification owned by a different user", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    mockAuth.mockResolvedValue({ userId: other.clerkId });

    const notification = await prisma.notification.create({
      data: { userId: owner.id, type: "job_match", title: "t", body: "b" },
    });

    const res = await PATCH(fakeRequest(), { params: { id: notification.id } });
    expect(res.status).toBe(404);
  });

  it("marks an unread notification as read", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const notification = await prisma.notification.create({
      data: { userId: user.id, type: "job_match", title: "t", body: "b" },
    });

    const res = await PATCH(fakeRequest(), { params: { id: notification.id } });
    const body = await res.json();
    expect(body.notification.readAt).not.toBeNull();
  });

  it("is idempotent — doesn't change an already-read timestamp", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const readAt = new Date("2026-01-01T00:00:00.000Z");
    const notification = await prisma.notification.create({
      data: { userId: user.id, type: "job_match", title: "t", body: "b", readAt },
    });

    const res = await PATCH(fakeRequest(), { params: { id: notification.id } });
    const body = await res.json();
    expect(new Date(body.notification.readAt).toISOString()).toBe(readAt.toISOString());
  });
});
