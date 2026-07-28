import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { scoreJob } from "@/lib/job-scorer";
import { notifyUser } from "@/lib/notifications";
import { GET } from "./route";

vi.mock("@/lib/job-scorer", () => ({ scoreJob: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyUser: vi.fn() }));

const mockScoreJob = scoreJob as unknown as ReturnType<typeof vi.fn>;
const mockNotifyUser = notifyUser as unknown as ReturnType<typeof vi.fn>;

function cronRequest(bearer?: string) {
  return new NextRequest("http://localhost/api/cron/daily-digest", {
    headers: bearer !== undefined ? { authorization: `Bearer ${bearer}` } : {},
  });
}

/** No jobs from any of the three sources — keeps the Prisma-focused tests from needing real network shapes. */
function stubEmptySources() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("remotive.com"))
        return Promise.resolve({ json: async () => ({ jobs: [] }) });
      if (url.includes("arbeitnow.com"))
        return Promise.resolve({ json: async () => ({ data: [], links: {} }) });
      if (url.includes("algolia.com/api/v1/search"))
        return Promise.resolve({ json: async () => ({ hits: [] }) });
      return Promise.resolve({ json: async () => ({}) });
    })
  );
}

beforeEach(async () => {
  await resetTestDb();
  mockScoreJob.mockReset();
  mockNotifyUser.mockReset();
  mockNotifyUser.mockResolvedValue({ created: true, pushed: 1 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/cron/daily-digest", () => {
  it("returns 401 without the correct bearer token", async () => {
    stubEmptySources();
    const res = await GET(cronRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("only processes users with an active resume", async () => {
    stubEmptySources();
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
    const withActiveResume = await createTestUser();
    await prisma.resume.create({
      data: {
        userId: withActiveResume.id,
        label: "Active",
        fileUrl: "https://example.com/r.pdf",
        isActive: true,
        parsedData: { skills: [], experience: [] },
      },
    });

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.usersProcessed).toBe(1);
  });

  it("upserts, scores a new job, and notifies the user with an active resume", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("remotive.com")) {
          return Promise.resolve({
            json: async () => ({
              jobs: [
                {
                  id: 1,
                  url: "https://remotive.com/job/1",
                  title: "Backend Engineer",
                  company_name: "Acme",
                  candidate_required_location: "Remote",
                  description: "<p>Build things</p>",
                  salary: "",
                  publication_date: "2026-01-01",
                },
              ],
            }),
          });
        }
        if (url.includes("arbeitnow.com"))
          return Promise.resolve({ json: async () => ({ data: [], links: {} }) });
        if (url.includes("algolia.com/api/v1/search"))
          return Promise.resolve({ json: async () => ({ hits: [] }) });
        return Promise.resolve({ json: async () => ({}) });
      })
    );

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

    mockScoreJob.mockResolvedValue({
      overallScore: 88,
      recommendation: "APPLY",
      reason: "Great fit",
    });

    const res = await GET(cronRequest(process.env.CRON_SECRET));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.notificationsSent).toBe(1);

    const job = await prisma.job.findFirst({ where: { userId: user.id } });
    expect(job?.title).toBe("Backend Engineer");
    // sanitizeJobDescription runs on Remotive's HTML description
    expect(job?.description).toBe("<p>Build things</p>");

    const evaluation = await prisma.jobEvaluation.findFirst({ where: { userId: user.id } });
    expect(evaluation?.overallScore).toBe(88);
    expect(mockNotifyUser).toHaveBeenCalledTimes(1);
  });
});
