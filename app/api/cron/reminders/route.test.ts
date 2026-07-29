import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { notifyUser } from "@/lib/notifications";
import { GET } from "./route";

vi.mock("@/lib/notifications", () => ({ notifyUser: vi.fn() }));

const mockNotifyUser = notifyUser as unknown as ReturnType<typeof vi.fn>;

function cronRequest(bearer?: string) {
  return new NextRequest("http://localhost/api/cron/reminders", {
    headers: bearer !== undefined ? { authorization: `Bearer ${bearer}` } : {},
  });
}

beforeEach(async () => {
  await resetTestDb();
  mockNotifyUser.mockReset();
  mockNotifyUser.mockResolvedValue({ created: true, pushed: 1, emailed: true });
});

describe("GET /api/cron/reminders", () => {
  it("returns 401 without the correct bearer token", async () => {
    const res = await GET(cronRequest("wrong-secret"));
    expect(res.status).toBe(401);
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  it("returns 401 when no authorization header is sent at all", async () => {
    const res = await GET(cronRequest());
    expect(res.status).toBe(401);
  });

  it("notifies and clears followUpAt for a due, non-terminal application", async () => {
    const user = await createTestUser();
    const app = await prisma.application.create({
      data: {
        userId: user.id,
        stage: "Applied",
        followUpAt: new Date(Date.now() - 60_000),
        inlineJobData: { title: "Engineer", company: "Acme" },
      },
    });

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.processed).toBe(1);
    expect(body.sent).toBe(1);
    expect(mockNotifyUser).toHaveBeenCalledTimes(1);

    const updated = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(updated.followUpAt).toBeNull();
  });

  it("skips applications in a terminal stage even if a follow-up is due", async () => {
    const user = await createTestUser();
    await prisma.application.create({
      data: {
        userId: user.id,
        stage: "Rejected",
        followUpAt: new Date(Date.now() - 60_000),
        inlineJobData: { title: "Engineer", company: "Acme" },
      },
    });

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  it("skips applications whose follow-up isn't due yet", async () => {
    const user = await createTestUser();
    await prisma.application.create({
      data: {
        userId: user.id,
        stage: "Applied",
        followUpAt: new Date(Date.now() + 60 * 60 * 1000),
        inlineJobData: { title: "Engineer", company: "Acme" },
      },
    });

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();
    expect(body.processed).toBe(0);
  });
});
