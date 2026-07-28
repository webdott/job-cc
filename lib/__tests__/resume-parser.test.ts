import { describe, expect, it, vi } from "vitest";

const { generateObjectMock } = vi.hoisted(() => ({ generateObjectMock: vi.fn() }));
vi.mock("ai", () => ({ generateObject: generateObjectMock }));

import { parseResume } from "@/lib/resume-parser";

const mockModel = "mock-model" as unknown as Parameters<typeof parseResume>[1];

const validResume = {
  name: "Ada Lovelace",
  skills: ["TypeScript", "React"],
  experience: [
    { title: "Engineer", company: "Acme", duration: "2020-2024", bullets: ["Shipped things"] },
  ],
  education: [{ degree: "BSc CS", institution: "Uni" }],
  strengthScore: 82,
  strengthFeedback: "Quantify your impact more.",
};

describe("parseResume", () => {
  it("passes the resume text, model, and schema through to generateObject and returns its object", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: validResume });

    const result = await parseResume("John Doe\nSoftware Engineer\n...", mockModel);

    expect(result).toEqual(validResume);
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const call = generateObjectMock.mock.calls[0][0];
    expect(call.model).toBe(mockModel);
    expect(call.prompt).toContain("John Doe");
    expect(call.schema).toBeDefined();
  });

  it("propagates errors from generateObject", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("model unavailable"));
    await expect(parseResume("some resume text", mockModel)).rejects.toThrow("model unavailable");
  });
});
