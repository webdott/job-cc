import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { notifyUser } from "@/lib/notifications";
import { GET } from "./route";

vi.mock("@/lib/notifications", () => ({ notifyUser: vi.fn() }));

const mockNotifyUser = notifyUser as unknown as ReturnType<typeof vi.fn>;

function cronRequest(bearer?: string) {
  return new NextRequest("http://localhost/api/cron/daily-digest", {
    headers: bearer !== undefined ? { authorization: `Bearer ${bearer}` } : {},
  });
}

async function userWithActiveResume() {
  const user = await createTestUser();
  await prisma.resume.create({
    data: {
      userId: user.id,
      label: "Active",
      fileUrl: "https://example.com/r.pdf",
      isActive: true,
      parsedData: { skills: ["TypeScript"], experience: [] },
    },
  });
  return user;
}

async function scoredJob(
  userId: string,
  opts: { title: string; company: string; score: number; fetchedAt?: Date }
) {
  const job = await prisma.job.create({
    data: {
      userId,
      sourceUrl: `https://example.com/job/${opts.title}-${opts.company}`,
      title: opts.title,
      company: opts.company,
      description: "desc",
      ...(opts.fetchedAt ? { fetchedAt: opts.fetchedAt } : {}),
    },
  });
  await prisma.jobEvaluation.create({
    data: {
      jobId: job.id,
      userId,
      overallScore: opts.score,
      recommendation: "APPLY",
    },
  });
  return job;
}

beforeEach(async () => {
  await resetTestDb();
  mockNotifyUser.mockReset();
  mockNotifyUser.mockResolvedValue({ created: true, pushed: 1, emailed: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/cron/daily-digest", () => {
  it("returns 401 without the correct bearer token", async () => {
    const res = await GET(cronRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("only processes users with an active resume", async () => {
    await createTestUser(); // no resume at all

    const withInactiveResume = await createTestUser();
    await prisma.resume.create({
      data: {
        userId: withInactiveResume.id,
        label: "Old",
        fileUrl: "https://example.com/r.pdf",
        isActive: false,
      },
    });

    await userWithActiveResume();

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.usersProcessed).toBe(1);
  });

  it("notifies with the highest-scoring job from the last 24h", async () => {
    const user = await userWithActiveResume();
    await scoredJob(user.id, { title: "Backend Engineer", company: "Acme", score: 61 });
    await scoredJob(user.id, { title: "Staff Engineer", company: "Globex", score: 92 });

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notificationsSent).toBe(1);
    expect(mockNotifyUser).toHaveBeenCalledTimes(1);

    const { body: message, type, url } = mockNotifyUser.mock.calls[0][0];
    expect(type).toBe("job_match");
    expect(url).toBe("/discover");
    expect(message).toContain("2 new job matches");
    // Best match named, not merely the most recent.
    expect(message).toContain("Staff Engineer at Globex (92%)");
  });

  it("ignores jobs fetched outside the digest window", async () => {
    const user = await userWithActiveResume();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await scoredJob(user.id, {
      title: "Stale Role",
      company: "Initech",
      score: 95,
      fetchedAt: threeDaysAgo,
    });

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.usersProcessed).toBe(1);
    expect(body.notificationsSent).toBe(0);
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  it("skips unscored jobs rather than emailing about them", async () => {
    const user = await userWithActiveResume();
    await prisma.job.create({
      data: {
        userId: user.id,
        sourceUrl: "https://example.com/job/unscored",
        title: "Unscored Role",
        company: "Acme",
        description: "desc",
      },
    });

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notificationsSent).toBe(0);
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  it("makes no outbound requests — ingestion and scoring moved out of the digest", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const user = await userWithActiveResume();
    await scoredJob(user.id, { title: "Backend Engineer", company: "Acme", score: 80 });

    const res = await GET(cronRequest(process.env.CRON_SECRET));

    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
