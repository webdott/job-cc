import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { resetTestDb, createTestUser } from "@/lib/__tests__/test-db";
import { jsonRequest } from "@/lib/__tests__/http";
import { GET, POST } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

const { generateTextMock, uploadFileMock, deleteFileMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  uploadFileMock: vi.fn(),
  deleteFileMock: vi.fn(),
}));
vi.mock("ai", () => ({ generateText: generateTextMock }));
vi.mock("@/lib/r2", () => ({
  createR2Client: () => ({
    publicUrl: "https://mock.example.com",
    uploadFile: uploadFileMock,
    deleteFile: deleteFileMock,
  }),
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
  generateTextMock.mockResolvedValue({ text: "pong" });
  uploadFileMock.mockResolvedValue("https://mock.example.com/key");
  deleteFileMock.mockResolvedValue(undefined);
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
    expect(await res.json()).toEqual({ hasCredentials: false, aiProvider: null, verifiedAt: null });
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
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it("returns an r2-scoped 400 when the R2 round trip fails", async () => {
    uploadFileMock.mockRejectedValueOnce(new Error("access denied"));
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(credentialsRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.field).toBe("r2");
  });

  it("verifies, encrypts, and stores credentials on success", async () => {
    const user = await createTestUser();
    mockAuth.mockResolvedValue({ userId: user.clerkId });

    const res = await POST(credentialsRequest(validBody));
    expect(res.status).toBe(200);
    expect(uploadFileMock).toHaveBeenCalledTimes(1);
    expect(deleteFileMock).toHaveBeenCalledTimes(1);

    const stored = await prisma.userCredentials.findUniqueOrThrow({ where: { userId: user.id } });
    expect(stored.aiApiKeyEnc).not.toBe(validBody.aiApiKey);
    expect(stored.aiApiKeyEnc.startsWith("v1.")).toBe(true);
    expect(stored.r2AccountIdEnc).not.toBe(validBody.r2AccountId);
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
});
