import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

const TEST_KEY = "0".repeat(64); // 32 bytes hex, deterministic for tests

describe("encrypt/decrypt", () => {
  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  });

  it("round-trips a plaintext string", () => {
    const payload = encrypt("sk-ant-super-secret-key");
    expect(decrypt(payload)).toBe("sk-ant-super-secret-key");
  });

  it("round-trips an empty string", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encrypt("same plaintext");
    const b = encrypt("same plaintext");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same plaintext");
    expect(decrypt(b)).toBe("same plaintext");
  });

  it("is versioned with a v1 prefix", () => {
    expect(encrypt("x").startsWith("v1.")).toBe(true);
  });

  it("throws on a tampered ciphertext (auth tag check fails)", () => {
    const payload = encrypt("secret");
    const parts = payload.split(".");
    const firstChar = parts[3][0];
    parts[3] = (firstChar === "0" ? "f" : "0") + parts[3].slice(1);
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("throws on an unrecognized payload format", () => {
    expect(() => decrypt("not-a-valid-payload")).toThrow(/format/i);
    expect(() => decrypt("v2.a.b.c")).toThrow(/format/i);
  });

  it("throws a clear error when the encryption key is missing", () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
  });

  it("throws a clear error when the encryption key is the wrong length", () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = "tooshort";
    expect(() => encrypt("x")).toThrow(/64 hex characters/);
  });

  it("fails to decrypt with a different key than it was encrypted with", () => {
    const payload = encrypt("secret");
    process.env.CREDENTIALS_ENCRYPTION_KEY = "1".repeat(64);
    expect(() => decrypt(payload)).toThrow();
  });
});
