import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { jsonRequest } from "@/lib/__tests__/http";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const { generateObjectMock } = vi.hoisted(() => ({ generateObjectMock: vi.fn() }));
vi.mock("ai", () => ({ generateObject: generateObjectMock }));

import { POST } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const EXISTING_URL = "https://example.com/job/already-known";

function addRequest(body: unknown) {
  return jsonRequest("http://localhost/api/jobs/manual", "POST", body);
}

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
  generateObjectMock.mockReset();
  vi.unstubAllGlobals();
});

describe("POST /api/jobs/manual", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    expect((await POST(addRequest({ url: EXISTING_URL }))).status).toBe(401);
  });

  it("returns the existing job instead of throwing on a duplicate URL", async () => {
    // A bare `create` against @@unique([sourceUrl, userId]) used to surface as
    // an unhandled Prisma P2002 and a 500.
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const existing = await prisma.job.create({
      data: {
        userId: user.id,
        sourceUrl: EXISTING_URL,
        title: "Backend Engineer",
        company: "Acme",
        description: "desc",
      },
    });

    const res = await POST(addRequest({ url: EXISTING_URL }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alreadyExists).toBe(true);
    expect(body.job.id).toBe(existing.id);
    expect(await prisma.job.count()).toBe(1);
  });

  it("short-circuits before fetching the page or calling the model", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    await prisma.job.create({
      data: {
        userId: user.id,
        sourceUrl: EXISTING_URL,
        title: "Backend Engineer",
        company: "Acme",
        description: "desc",
      },
    });

    await POST(addRequest({ url: EXISTING_URL }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("another user having the same URL does not block the add", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    await prisma.job.create({
      data: {
        userId: other.id,
        sourceUrl: EXISTING_URL,
        title: "Backend Engineer",
        company: "Acme",
        description: "desc",
      },
    });

    mockAuth.mockResolvedValue({ userId: owner.clerkId });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ text: async () => "<html><body>Job text</body></html>" })
    );
    generateObjectMock.mockResolvedValue({
      object: {
        title: "Backend Engineer",
        company: "Acme",
        location: "Remote",
        description: "Build things",
        remote: true,
      },
    });

    const res = await POST(addRequest({ url: EXISTING_URL }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alreadyExists).toBeUndefined();
    expect(await prisma.job.count()).toBe(2);
  });

  it("marks a hand-added job as always worth scoring", async () => {
    // Adding a job by hand is an explicit request for it — the target-role
    // prefilter must not exclude it.
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    await prisma.user.update({
      where: { id: user.id },
      data: { preferences: { targetRoles: ["Registered Nurse"] } },
    });

    generateObjectMock.mockResolvedValue({
      object: {
        title: "Backend Engineer",
        company: "Acme",
        location: "Remote",
        description: "Build things",
        remote: true,
      },
    });

    const res = await POST(addRequest({ rawText: "Backend Engineer at Acme, remote" }));
    expect(res.status).toBe(200);

    const job = await prisma.job.findFirstOrThrow();
    expect(job.prefMatch).toBe(true);
    expect(job.dedupeKey).toBe("acme|backend engineer");
  });
});
