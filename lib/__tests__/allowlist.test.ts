import { afterEach, describe, expect, it } from "vitest";
import { isAllowlisted } from "@/lib/allowlist";

afterEach(() => {
  delete process.env.ALLOWED_USER_EMAILS;
});

describe("isAllowlisted", () => {
  it("allows everyone when the env var is unset (default, single-operator behavior)", () => {
    delete process.env.ALLOWED_USER_EMAILS;
    expect(isAllowlisted("anyone@example.com")).toBe(true);
  });

  it("allows everyone when the env var is an empty string", () => {
    process.env.ALLOWED_USER_EMAILS = "   ";
    expect(isAllowlisted("anyone@example.com")).toBe(true);
  });

  it("allows an email present in the list", () => {
    process.env.ALLOWED_USER_EMAILS = "a@example.com, b@example.com";
    expect(isAllowlisted("b@example.com")).toBe(true);
  });

  it("rejects an email not present in the list", () => {
    process.env.ALLOWED_USER_EMAILS = "a@example.com, b@example.com";
    expect(isAllowlisted("c@example.com")).toBe(false);
  });

  it("is case-insensitive on both sides", () => {
    process.env.ALLOWED_USER_EMAILS = "Someone@Example.com";
    expect(isAllowlisted("someone@example.com")).toBe(true);
  });

  it("tolerates extra whitespace around entries", () => {
    process.env.ALLOWED_USER_EMAILS = "  a@example.com ,  b@example.com  ";
    expect(isAllowlisted("a@example.com")).toBe(true);
    expect(isAllowlisted("b@example.com")).toBe(true);
  });
});
