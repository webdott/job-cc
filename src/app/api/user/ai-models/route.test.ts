import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { jsonRequest } from "@/lib/__tests__/http";
import { encrypt } from "@/lib/crypto";
import { GET, POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));
vi.mock("ai", () => ({ generateText: generateTextMock }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function modelsRequest(body: unknown) {
  return jsonRequest("http://localhost/api/user/ai-models", "POST", body);
}

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
  generateTextMock.mockReset();
  generateTextMock.mockResolvedValue({ text: "pong" });
  process.env.AI_PROVIDER = "google";
  process.env.AI_API_KEY = "test-operator-key";
  process.env.ALLOWED_USER_EMAILS = "";
});

describe("GET /api/user/ai-models", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    expect((await GET()).status).toBe(401);
  });

  it("returns operator defaults for an allowlisted user", async () => {
    process.env.ALLOWED_USER_EMAILS = "allow@example.com";
    const user = await createTestUser({ email: "allow@example.com" });
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      aiProvider: "GOOGLE",
      aiFlashModel: "gemini-3.6-flash",
      aiProModel: "gemini-3.6-flash",
      canSave: true,
    });
  });
});

describe("POST /api/user/ai-models", () => {
  it("saves model picks for an allowlisted user using the operator key", async () => {
    process.env.ALLOWED_USER_EMAILS = "allow@example.com";
    const user = await createTestUser({ email: "allow@example.com" });
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(
      modelsRequest({
        aiFlashModel: "gemini-3.5-flash-lite",
        aiProModel: "gemini-3.6-flash",
      })
    );
    expect(res.status).toBe(200);
    expect(generateTextMock).toHaveBeenCalledTimes(2);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.aiFlashModel).toBe("gemini-3.5-flash-lite");
    expect(updated.aiProModel).toBe("gemini-3.6-flash");
  });

  it("rejects BYOC users without credentials", async () => {
    process.env.ALLOWED_USER_EMAILS = "someone-else@example.com";
    const user = await createTestUser({ email: "byoc@example.com" });
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(
      modelsRequest({
        aiFlashModel: "gemini-3.6-flash",
        aiProModel: "gemini-3.6-flash",
      })
    );
    expect(res.status).toBe(403);
  });

  it("saves model picks for a BYOC user with stored credentials", async () => {
    process.env.ALLOWED_USER_EMAILS = "someone-else@example.com";
    const user = await createTestUser({ email: "byoc@example.com" });
    await prisma.userCredentials.create({
      data: {
        userId: user.id,
        aiProvider: "GOOGLE",
        aiApiKeyEnc: encrypt("AIzaFakeKeyForTesting1234567890"),
        r2AccountIdEnc: encrypt("acct"),
        r2AccessKeyIdEnc: encrypt("key"),
        r2SecretAccessKeyEnc: encrypt("secret"),
        r2BucketNameEnc: encrypt("bucket"),
        r2PublicUrlEnc: encrypt("https://pub.example.com"),
        brevoApiKeyEnc: encrypt("xkeysib-fake"),
        brevoFromEmailEnc: encrypt("sender@example.com"),
        verifiedAt: new Date(),
      },
    });
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(
      modelsRequest({
        aiFlashModel: "gemini-3.6-flash",
        aiProModel: "gemini-3.6-flash",
      })
    );
    expect(res.status).toBe(200);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown models", async () => {
    process.env.ALLOWED_USER_EMAILS = "allow@example.com";
    const user = await createTestUser({ email: "allow@example.com" });
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(
      modelsRequest({
        aiFlashModel: "not-a-real-model",
        aiProModel: "gemini-3.6-flash",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Unknown model/);
  });
});
