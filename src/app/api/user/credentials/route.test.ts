import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { jsonRequest } from "@/lib/__tests__/http";
import { GET, POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const { generateTextMock, uploadFileMock, deleteFileMock, verifyBrevoMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  uploadFileMock: vi.fn(),
  deleteFileMock: vi.fn(),
  verifyBrevoMock: vi.fn(),
}));
vi.mock("ai", () => ({ generateText: generateTextMock }));
vi.mock("@/lib/r2", () => ({
  createR2Client: () => ({
    publicUrl: "https://mock.example.com",
    uploadFile: uploadFileMock,
    deleteFile: deleteFileMock,
  }),
}));
vi.mock("@/lib/email", () => ({
  verifyBrevoCredentials: verifyBrevoMock,
}));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const validBody = {
  aiProvider: "GOOGLE",
  aiApiKey: "AIzaFakeKeyForTesting1234567890",
  r2AccountId: "acct",
  r2AccessKeyId: "key",
  r2SecretAccessKey: "secret",
  r2BucketName: "bucket",
  r2PublicUrl: "https://pub.example.com",
  brevoApiKey: "xkeysib-fake-brevo-key-for-testing",
  brevoFromEmail: "sender@example.com",
};

function credentialsRequest(body: unknown) {
  return jsonRequest("http://localhost/api/user/credentials", "POST", body);
}

beforeEach(async () => {
  await resetTestDb();
  mockAuth.mockReset();
  generateTextMock.mockReset();
  uploadFileMock.mockReset();
  deleteFileMock.mockReset();
  verifyBrevoMock.mockReset();
  generateTextMock.mockResolvedValue({ text: "pong" });
  uploadFileMock.mockResolvedValue("https://mock.example.com/key");
  deleteFileMock.mockResolvedValue(undefined);
  verifyBrevoMock.mockResolvedValue(undefined);
});

describe("GET /api/user/credentials", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("reports no credentials for a fresh user", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const res = await GET();
    expect(await res.json()).toEqual({
      hasCredentials: false,
      aiProvider: null,
      verifiedAt: null,
      aiFlashModel: null,
      aiProModel: null,
    });
  });

  it("reports hasCredentials without ever returning plaintext", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    await POST(credentialsRequest(validBody));

    const res = await GET();
    const body = await res.json();
    expect(body.hasCredentials).toBe(true);
    expect(body.aiProvider).toBe("GOOGLE");
    expect(body.verifiedAt).not.toBeNull();
    expect(JSON.stringify(body)).not.toContain(validBody.aiApiKey);
  });
});

describe("POST /api/user/credentials", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(credentialsRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("rejects a malformed body", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    const res = await POST(credentialsRequest({ aiProvider: "OPENAI" }));
    expect(res.status).toBe(400);
  });

  it("returns an ai-scoped 400 and skips R2 entirely when the AI key fails verification", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("invalid key"));
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(credentialsRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.field).toBe("ai");
    expect(body.error).toMatch(/Couldn't verify this API key/);
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it("returns a quota message when verification fails with 429", async () => {
    generateTextMock.mockRejectedValueOnce(Object.assign(new Error("quota"), { statusCode: 429 }));
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(credentialsRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.field).toBe("ai");
    expect(body.error).toMatch(/rate-limited or out of quota/);
  });

  it("trims the AI API key and uses a safer ping before storing", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    await POST(credentialsRequest({ ...validBody, aiApiKey: `  ${validBody.aiApiKey}  ` }));

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "ping",
        maxOutputTokens: 64,
        providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
      })
    );
  });

  it("returns an r2-scoped 400 when the R2 round trip fails", async () => {
    uploadFileMock.mockRejectedValueOnce(new Error("access denied"));
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(credentialsRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.field).toBe("r2");
    expect(verifyBrevoMock).not.toHaveBeenCalled();
  });

  it("returns a brevo-scoped 400 when Brevo verification fails", async () => {
    verifyBrevoMock.mockRejectedValueOnce(new Error("bad sender"));
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(credentialsRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.field).toBe("brevo");
  });

  it("verifies, encrypts, and stores credentials on success", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(credentialsRequest(validBody));
    expect(res.status).toBe(200);
    expect(uploadFileMock).toHaveBeenCalledTimes(1);
    expect(deleteFileMock).toHaveBeenCalledTimes(1);
    expect(verifyBrevoMock).toHaveBeenCalledWith(validBody.brevoApiKey, validBody.brevoFromEmail);

    const stored = await prisma.userCredentials.findUniqueOrThrow({ where: { userId: user.id } });
    expect(stored.aiApiKeyEnc).not.toBe(validBody.aiApiKey);
    expect(stored.aiApiKeyEnc.startsWith("v1.")).toBe(true);
    expect(stored.r2AccountIdEnc).not.toBe(validBody.r2AccountId);
    expect(stored.brevoApiKeyEnc).not.toBeNull();
    expect(stored.brevoFromEmailEnc).not.toBeNull();
  });

  it("upserts — resubmitting replaces stored credentials instead of erroring", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    await POST(credentialsRequest(validBody));
    const second = await POST(credentialsRequest({ ...validBody, aiProvider: "ANTHROPIC" }));
    expect(second.status).toBe(200);

    const stored = await prisma.userCredentials.findUniqueOrThrow({ where: { userId: user.id } });
    expect(stored.aiProvider).toBe("ANTHROPIC");
    expect(await prisma.userCredentials.count({ where: { userId: user.id } })).toBe(1);
  });

  it("allows updating only the AI key and skips re-verifying R2/Brevo", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    await POST(credentialsRequest(validBody));

    generateTextMock.mockClear();
    uploadFileMock.mockClear();
    deleteFileMock.mockClear();
    verifyBrevoMock.mockClear();

    const res = await POST(
      credentialsRequest({
        aiProvider: "GOOGLE",
        aiApiKey: "AIzaReplacementKeyForTesting999",
      })
    );
    expect(res.status).toBe(200);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(verifyBrevoMock).not.toHaveBeenCalled();
  });

  it("allows updating only Brevo and merges the stored sender when omitted", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    await POST(credentialsRequest(validBody));

    generateTextMock.mockClear();
    uploadFileMock.mockClear();
    verifyBrevoMock.mockClear();

    const res = await POST(
      credentialsRequest({
        brevoApiKey: "xkeysib-replacement-brevo-key-zzz",
      })
    );
    expect(res.status).toBe(200);
    expect(verifyBrevoMock).toHaveBeenCalledWith(
      "xkeysib-replacement-brevo-key-zzz",
      validBody.brevoFromEmail
    );
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it("rejects an empty update when credentials already exist", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });
    await POST(credentialsRequest(validBody));

    const res = await POST(credentialsRequest({ aiProvider: "GOOGLE" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least one new value/i);
  });

  it("persists model picks on User when provided with credentials", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(
      credentialsRequest({
        ...validBody,
        aiFlashModel: "gemini-3.5-flash-lite",
        aiProModel: "gemini-3.6-flash",
      })
    );
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.aiFlashModel).toBe("gemini-3.5-flash-lite");
    expect(updated.aiProModel).toBe("gemini-3.6-flash");
    // Same-model skip doesn't apply — two different models → two pings
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });
});
