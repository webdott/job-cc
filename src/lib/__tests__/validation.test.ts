import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { dateStringSchema, LabelSchema, parseBody } from "@/lib/validation";

function makeRequest(body: unknown, opts: { invalidJson?: boolean } = {}) {
  if (opts.invalidJson) {
    return new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: "{not valid json",
      headers: { "content-type": "application/json" },
    });
  }
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("parseBody", () => {
  const schema = z.object({ name: z.string().min(1) });

  it("returns data on a valid body", async () => {
    const result = await parseBody(makeRequest({ name: "Ada" }), schema);
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ name: "Ada" });
  });

  it("returns a 400 response for malformed JSON", async () => {
    const result = await parseBody(makeRequest(null, { invalidJson: true }), schema);
    expect(result.data).toBeUndefined();
    expect(result.error?.status).toBe(400);
    const payload = await result.error?.json();
    expect(payload.error).toBe("Invalid JSON body");
  });

  it("returns a 400 response with details when schema validation fails", async () => {
    const result = await parseBody(makeRequest({ name: "" }), schema);
    expect(result.data).toBeUndefined();
    expect(result.error?.status).toBe(400);
    const payload = await result.error?.json();
    expect(payload.error).toBe("Validation failed");
    expect(payload.details).toBeDefined();
  });
});

describe("dateStringSchema", () => {
  it("accepts a parseable date string", () => {
    expect(dateStringSchema.safeParse("2026-07-28").success).toBe(true);
  });

  it("rejects a non-date string", () => {
    expect(dateStringSchema.safeParse("not-a-date").success).toBe(false);
  });
});

describe("LabelSchema", () => {
  it("trims and accepts a non-empty label within length", () => {
    const result = LabelSchema.safeParse("  My Label  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("My Label");
  });

  it("rejects an empty label", () => {
    expect(LabelSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a label over 100 characters", () => {
    expect(LabelSchema.safeParse("a".repeat(101)).success).toBe(false);
  });
});
