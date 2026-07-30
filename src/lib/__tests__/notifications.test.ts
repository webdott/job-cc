import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { create: vi.fn().mockResolvedValue({}) },
    pushSubscription: { delete: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/email", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import webpush from "web-push";
import { sendTransactionalEmail } from "@/lib/email";
import { notifyUser } from "@/lib/notifications";

const subscription = {
  id: "sub-1",
  endpoint: "https://push.example/1",
  p256dh: "key",
  auth: "auth",
};

const emailCredentials = {
  apiKey: "brevo-key",
  fromEmail: "from@example.com",
};

function baseInput(overrides: Partial<Parameters<typeof notifyUser>[0]> = {}) {
  return {
    userId: "user-1",
    type: "job_match" as const,
    title: "New match",
    body: "A job matched your resume",
    preferences: {},
    subscriptions: [subscription],
    userEmail: "user@example.com",
    emailCredentials,
    ...overrides,
  };
}

describe("notifyUser", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("skips entirely when the per-type toggle is disabled", async () => {
    const result = await notifyUser(
      baseInput({ preferences: { notifications: { jobMatches: false } } })
    );
    expect(result).toEqual({ created: false, pushed: 0, emailed: false });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("defaults the toggle to enabled when preferences don't specify it", async () => {
    const result = await notifyUser(baseInput({ preferences: {} }));
    expect(result.created).toBe(true);
    expect(result.emailed).toBe(true);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "New match",
        textContent: expect.stringContaining("A job matched your resume"),
        htmlContent: expect.stringContaining("View matches"),
      })
    );
  });

  it("records the notification and emails but skips push when inside quiet hours", async () => {
    vi.setSystemTime(new Date("2026-07-28T23:30:00Z"));
    const result = await notifyUser(
      baseInput({
        preferences: { notifications: { quietHoursStart: "22:00", quietHoursEnd: "23:59" } },
      })
    );
    expect(result).toEqual({ created: true, pushed: 0, emailed: true });
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("treats a wrap-past-midnight quiet window correctly outside the window", async () => {
    vi.setSystemTime(new Date("2026-07-28T12:00:00Z"));
    const result = await notifyUser(
      baseInput({
        preferences: { notifications: { quietHoursStart: "22:00", quietHoursEnd: "07:00" } },
      })
    );
    expect(result.pushed).toBe(1);
  });

  it("treats a wrap-past-midnight quiet window correctly inside the window", async () => {
    vi.setSystemTime(new Date("2026-07-28T03:00:00Z"));
    const result = await notifyUser(
      baseInput({
        preferences: { notifications: { quietHoursStart: "22:00", quietHoursEnd: "07:00" } },
      })
    );
    expect(result.pushed).toBe(0);
    expect(result.emailed).toBe(true);
  });

  it("pushes to all subscriptions outside quiet hours", async () => {
    vi.setSystemTime(new Date("2026-07-28T12:00:00Z"));
    const result = await notifyUser(baseInput());
    expect(result).toEqual({ created: true, pushed: 1, emailed: true });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("removes a subscription only when push fails with 410/404", async () => {
    vi.setSystemTime(new Date("2026-07-28T12:00:00Z"));
    (webpush.sendNotification as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("Gone"), { statusCode: 410 })
    );
    const result = await notifyUser(baseInput());
    expect(result.pushed).toBe(0);
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: "sub-1" } });
  });

  it("keeps the subscription on transient push failures", async () => {
    vi.setSystemTime(new Date("2026-07-28T12:00:00Z"));
    (webpush.sendNotification as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("timeout"), { statusCode: 503 })
    );
    const result = await notifyUser(baseInput());
    expect(result.pushed).toBe(0);
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it("skips email when credentials are missing", async () => {
    vi.setSystemTime(new Date("2026-07-28T12:00:00Z"));
    const result = await notifyUser(baseInput({ emailCredentials: null }));
    expect(result.emailed).toBe(false);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(result.created).toBe(true);
  });
});
