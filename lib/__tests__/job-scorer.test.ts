import { describe, expect, it, vi } from "vitest";
import type { ParsedResume } from "@/lib/resume-parser";

const { generateObjectMock } = vi.hoisted(() => ({ generateObjectMock: vi.fn() }));
vi.mock("ai", () => ({ generateObject: generateObjectMock }));
vi.mock("@/lib/ai", () => ({ flashModel: "mock-flash-model" }));

import { scoreJob } from "@/lib/job-scorer";

const resume: ParsedResume = {
  name: "Ada Lovelace",
  skills: ["TypeScript", "React"],
  experience: [
    { title: "Engineer", company: "Acme", duration: "2020-2024", bullets: ["Shipped things"] },
  ],
  education: [{ degree: "BSc CS", institution: "Uni" }],
  strengthScore: 82,
  strengthFeedback: "Solid.",
};

const validScore = {
  overallScore: 78,
  recommendation: "APPLY" as const,
  reason: "Strong skills match.",
  archetype: "SA" as const,
};

describe("scoreJob", () => {
  it("builds a prompt including the resume skills, job title, and truncated description", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: validScore });

    const longDescription = "x".repeat(4000);
    const result = await scoreJob(longDescription, "Solutions Architect", resume);

    expect(result).toEqual(validScore);
    const call = generateObjectMock.mock.calls[0][0];
    expect(call.model).toBe("mock-flash-model");
    expect(call.prompt).toContain("TypeScript, React");
    expect(call.prompt).toContain("Solutions Architect");
    // description is sliced to 3000 chars before being embedded
    const embeddedDescription = call.prompt.split("Job Description:\n")[1];
    expect(embeddedDescription).toHaveLength(3000);
  });

  it("propagates errors from generateObject", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("rate limited"));
    await expect(scoreJob("desc", "Engineer", resume)).rejects.toThrow("rate limited");
  });
});
