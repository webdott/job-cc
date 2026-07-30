import { describe, expect, it, vi } from "vitest";
import type { ParsedResume } from "@/lib/resume-parser";
import { EMPTY_PREFERENCES, type JobPreferences } from "@/lib/job-match";

const { generateObjectMock } = vi.hoisted(() => ({ generateObjectMock: vi.fn() }));
vi.mock("ai", () => ({ generateObject: generateObjectMock }));

import { scoreJob, type ScorableJob } from "@/lib/job-scorer";

const mockModel = "mock-model" as unknown as Parameters<typeof scoreJob>[3];

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

function job(overrides: Partial<ScorableJob> = {}): ScorableJob {
  return {
    title: "Solutions Architect",
    description: "Build things",
    location: null,
    remote: false,
    salaryMin: null,
    salaryMax: null,
    ...overrides,
  };
}

function prefs(overrides: Partial<JobPreferences> = {}): JobPreferences {
  return { ...EMPTY_PREFERENCES, ...overrides };
}

function promptFromLastCall(): string {
  return generateObjectMock.mock.calls[generateObjectMock.mock.calls.length - 1][0].prompt;
}

describe("scoreJob", () => {
  it("builds a prompt including the resume skills, job title, and truncated description", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: validScore });

    const result = await scoreJob(
      job({ description: "x".repeat(4000) }),
      resume,
      prefs(),
      mockModel
    );

    expect(result).toEqual(validScore);
    const call = generateObjectMock.mock.calls[0][0];
    expect(call.model).toBe(mockModel);
    expect(call.prompt).toContain("TypeScript, React");
    expect(call.prompt).toContain("Solutions Architect");
    // description is sliced to 3000 chars before being embedded
    const embeddedDescription = call.prompt.split("Job Description:\n")[1];
    expect(embeddedDescription).toHaveLength(3000);
  });

  it("includes the candidate's stated preferences", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: validScore });

    await scoreJob(
      job(),
      resume,
      prefs({
        targetRoles: ["Solutions Architect", "Platform Engineer"],
        locations: ["Berlin", "Remote EU"],
        workType: ["Remote"],
        salaryMin: "120000",
      }),
      mockModel
    );

    const prompt = promptFromLastCall();
    expect(prompt).toContain("Solutions Architect, Platform Engineer");
    expect(prompt).toContain("Berlin, Remote EU");
    expect(prompt).toContain("Remote");
    expect(prompt).toContain("$120000");
  });

  it("includes the job's structured salary, location and remote fields", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: validScore });

    await scoreJob(
      job({ location: "Lisbon", remote: true, salaryMin: 90000, salaryMax: 130000 }),
      resume,
      prefs(),
      mockModel
    );

    const prompt = promptFromLastCall();
    expect(prompt).toContain("Lisbon");
    expect(prompt).toContain("Remote: yes");
    expect(prompt).toContain("$90,000");
    expect(prompt).toContain("$130,000");
  });

  it("omits absent fields rather than showing the model nulls", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: validScore });

    await scoreJob(job(), resume, prefs(), mockModel);

    const prompt = promptFromLastCall();
    expect(prompt).not.toContain("null");
    expect(prompt).not.toContain("undefined");
    // Nothing was specified, so the whole preferences block is dropped.
    expect(prompt).not.toContain("What the candidate is looking for");
    expect(prompt).not.toContain("Salary:");
  });

  it("tells the model to treat missing information as neutral", async () => {
    // Otherwise the compensation/location criterion silently penalises the many
    // feed jobs that carry no salary at all.
    generateObjectMock.mockResolvedValueOnce({ object: validScore });

    await scoreJob(job(), resume, prefs(), mockModel);

    expect(promptFromLastCall()).toContain("treat that criterion as neutral");
  });

  it("propagates errors from generateObject", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("rate limited"));
    await expect(scoreJob(job(), resume, prefs(), mockModel)).rejects.toThrow("rate limited");
  });
});
