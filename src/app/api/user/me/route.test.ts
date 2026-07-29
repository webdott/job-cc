import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { GET } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), currentUser: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockCurrentUser = currentUser as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
  mockCurrentUser.mockReset();
  mockCurrentUser.mockResolvedValue({ emailAddresses: [], fullName: null });
});

afterEach(() => {
  delete process.env.ALLOWED_USER_EMAILS;
});

describe("GET /api/user/me", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("creates the app-level User row on first call and reports no resume yet", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_brand_new" });
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "new@example.com" }],
      fullName: "New User",
    });

    const res = await GET();
    const body = await res.json();
    expect(body.hasResume).toBe(false);
    expect(body.user.email).toBe("new@example.com");

    const user = await prisma.user.findUnique({ where: { clerkId: "clerk_brand_new" } });
    expect(user).not.toBeNull();
  });

  it("reports hasResume true once an active resume exists", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: user.email }],
      fullName: null,
    });
    await prisma.resume.create({
      data: { userId: user.id, label: "R", fileUrl: "https://x", isActive: true },
    });

    const res = await GET();
    expect((await res.json()).hasResume).toBe(true);
  });

  it("defaults to allowlisted with no BYOC setup needed when ALLOWED_USER_EMAILS is unset", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: user.email }],
      fullName: null,
    });

    const res = await GET();
    const body = await res.json();
    expect(body.isAllowlisted).toBe(true);
    expect(body.needsByocSetup).toBe(false);
  });

  it("flags needsByocSetup for a non-allowlisted user with no saved credentials", async () => {
    const user = await createTestUser();
    process.env.ALLOWED_USER_EMAILS = "someone-else@example.com";
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: user.email }],
      fullName: null,
    });

    const res = await GET();
    const body = await res.json();
    expect(body.isAllowlisted).toBe(false);
    expect(body.needsByocSetup).toBe(true);
  });

  it("does not need BYOC setup once a non-allowlisted user has saved credentials", async () => {
    const user = await createTestUser();
    process.env.ALLOWED_USER_EMAILS = "someone-else@example.com";
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: user.email }],
      fullName: null,
    });
    await prisma.userCredentials.create({
      data: {
        userId: user.id,
        aiProvider: "GOOGLE",
        aiApiKeyEnc: "enc",
        r2AccountIdEnc: "enc",
        r2AccessKeyIdEnc: "enc",
        r2SecretAccessKeyEnc: "enc",
        r2BucketNameEnc: "enc",
        r2PublicUrlEnc: "enc",
        verifiedAt: new Date(),
      },
    });

    const res = await GET();
    const body = await res.json();
    expect(body.isAllowlisted).toBe(false);
    expect(body.needsByocSetup).toBe(false);
  });
});
