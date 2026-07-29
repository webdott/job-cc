import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { jsonRequest } from "@/lib/__tests__/http";
import { GET, POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), currentUser: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockCurrentUser = currentUser as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
  mockCurrentUser.mockReset();
});

describe("GET /api/stages", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("seeds and returns the six default stages, in order, on first use", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await GET();
    const body = await res.json();
    expect(body.stages).toHaveLength(6);
    expect(body.stages.map((s: { key: string }) => s.key)).toEqual([
      "Saved",
      "Applied",
      "Screening",
      "Interview",
      "Offer",
      "Rejected",
    ]);
  });

  it("does not reseed on a second call", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    await GET();
    await GET();

    const stages = await prisma.stage.findMany({ where: { userId: user.id } });
    expect(stages).toHaveLength(6);
  });
});

describe("POST /api/stages", () => {
  it("creates the app-level User row on first request if it doesn't exist (upsert)", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_brand_new" });
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "new@example.com" }],
      fullName: "New User",
    });

    const res = await POST(
      jsonRequest("http://localhost/api/stages", "POST", { label: "Recruiter Screen" })
    );
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { clerkId: "clerk_brand_new" } });
    expect(user?.email).toBe("new@example.com");
  });

  it("appends a new custom stage after the seeded defaults with a slugified key", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    mockCurrentUser.mockResolvedValue({ emailAddresses: [], fullName: null });

    const res = await POST(
      jsonRequest("http://localhost/api/stages", "POST", { label: "Recruiter Screen" })
    );
    const body = await res.json();
    expect(body.stage.key).toBe("Recruiter-Screen");
    expect(body.stage.position).toBe(6);
  });

  it("disambiguates a key collision with a numeric suffix", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    mockCurrentUser.mockResolvedValue({ emailAddresses: [], fullName: null });

    await prisma.stage.create({
      data: { userId: user.id, key: "Custom", label: "Custom", position: 0 },
    });

    const res = await POST(jsonRequest("http://localhost/api/stages", "POST", { label: "Custom" }));
    const body = await res.json();
    expect(body.stage.key).toBe("Custom-2");
  });

  it("rejects an empty label", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    mockCurrentUser.mockResolvedValue({ emailAddresses: [], fullName: null });

    const res = await POST(jsonRequest("http://localhost/api/stages", "POST", { label: "" }));
    expect(res.status).toBe(400);
  });
});
