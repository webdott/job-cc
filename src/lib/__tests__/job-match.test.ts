import { describe, expect, it } from "vitest";
import {
  dedupeKeyFor,
  matchesPreferences,
  normalizeCompany,
  normalizeTitle,
  readJobPreferences,
  EMPTY_PREFERENCES,
  type JobPreferences,
  type MatchableJob,
} from "@/lib/job-match";

function prefs(overrides: Partial<JobPreferences> = {}): JobPreferences {
  return { ...EMPTY_PREFERENCES, ...overrides };
}

function job(overrides: Partial<MatchableJob> = {}): MatchableJob {
  return { title: "Frontend Engineer", remote: true, salaryMax: null, ...overrides };
}

describe("normalizeCompany", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeCompany("Acme, Inc.")).toBe("acme");
    expect(normalizeCompany("  ACME  ")).toBe("acme");
  });

  it("strips legal-entity suffixes so the same company matches across sources", () => {
    expect(normalizeCompany("Acme GmbH")).toBe("acme");
    expect(normalizeCompany("Acme Technologies Ltd")).toBe("acme");
    expect(normalizeCompany("Acme Holdings LLC")).toBe("acme");
  });

  it("never strips away the entire name", () => {
    // "Group" is a suffix, but it's all there is.
    expect(normalizeCompany("Group")).toBe("group");
    expect(normalizeCompany("Labs")).toBe("labs");
  });

  it("strips accents so Zürich-style names collapse consistently", () => {
    expect(normalizeCompany("Zürich Technologies")).toBe("zurich");
    expect(normalizeCompany("Peña Labs")).toBe("pena");
  });
});

describe("normalizeTitle", () => {
  it("collapses hyphen and space variants", () => {
    expect(normalizeTitle("Front-End Engineer")).toBe("frontend engineer");
    expect(normalizeTitle("Front End Engineer")).toBe("frontend engineer");
    expect(normalizeTitle("Full-Stack Developer")).toBe("fullstack developer");
  });

  it("keeps characters that are part of technology names", () => {
    expect(normalizeTitle("C++ Engineer")).toBe("c++ engineer");
    expect(normalizeTitle("C# / .NET Developer")).toBe("c# .net developer");
  });
});

describe("dedupeKeyFor", () => {
  it("produces the same key for the same role across sources", () => {
    const remotive = dedupeKeyFor({ company: "Acme, Inc.", title: "Senior Front-End Engineer" });
    const arbeitnow = dedupeKeyFor({ company: "ACME Inc", title: "Senior Front End Engineer" });

    expect(remotive).not.toBeNull();
    expect(remotive).toBe(arbeitnow);
  });

  it("distinguishes different roles at the same company", () => {
    expect(dedupeKeyFor({ company: "Acme", title: "Frontend Engineer" })).not.toBe(
      dedupeKeyFor({ company: "Acme", title: "Backend Engineer" })
    );
  });

  it("returns null when either side is unusable, rather than a colliding blank key", () => {
    // HN listings are parsed heuristically and often yield empty fields; a
    // "|title" key would merge unrelated jobs.
    expect(dedupeKeyFor({ company: "", title: "Engineer" })).toBeNull();
    expect(dedupeKeyFor({ company: "Acme", title: "" })).toBeNull();
    expect(dedupeKeyFor({ company: "---", title: "Engineer" })).toBeNull();
  });
});

describe("readJobPreferences", () => {
  it("returns empty preferences for junk input", () => {
    expect(readJobPreferences(null)).toEqual(EMPTY_PREFERENCES);
    expect(readJobPreferences("nope")).toEqual(EMPTY_PREFERENCES);
    expect(readJobPreferences({})).toEqual(EMPTY_PREFERENCES);
  });

  it("reads the flat job-preference keys and ignores the notifications subtree", () => {
    const parsed = readJobPreferences({
      targetRoles: ["Frontend Engineer"],
      locations: ["Berlin"],
      salaryMin: "80000",
      salaryMax: "120000",
      workType: ["Remote", "Hybrid"],
      notifications: { jobMatches: false },
    });

    expect(parsed.targetRoles).toEqual(["Frontend Engineer"]);
    expect(parsed.locations).toEqual(["Berlin"]);
    expect(parsed.salaryMin).toBe("80000");
    expect(parsed.workType).toEqual(["Remote", "Hybrid"]);
  });

  it("drops values of the wrong type instead of throwing", () => {
    const parsed = readJobPreferences({
      targetRoles: ["ok", 42, null],
      workType: ["Remote", "Telepathic"],
      salaryMin: 80000, // number, not the string the UI writes
    });

    expect(parsed.targetRoles).toEqual(["ok"]);
    expect(parsed.workType).toEqual(["Remote"]);
    expect(parsed.salaryMin).toBe("");
  });
});

describe("matchesPreferences", () => {
  it("matches everything when no target roles are set", () => {
    // The new-user path. Getting this wrong shows an empty app to anyone who
    // skipped the preferences step in onboarding.
    expect(matchesPreferences(job({ title: "Veterinary Nurse" }), prefs())).toBe(true);
    expect(matchesPreferences(job({ title: "Backend Engineer" }), prefs())).toBe(true);
  });

  it("matches a job in the same domain regardless of seniority", () => {
    const p = prefs({ targetRoles: ["Senior Frontend Engineer"] });

    expect(matchesPreferences(job({ title: "Frontend Engineer" }), p)).toBe(true);
    expect(matchesPreferences(job({ title: "Junior Frontend Developer" }), p)).toBe(true);
    expect(matchesPreferences(job({ title: "Staff Front-End Engineer" }), p)).toBe(true);
    expect(matchesPreferences(job({ title: "Lead Frontend Engineer (m/f/d)" }), p)).toBe(true);
  });

  it("treats developer, dev and engineer as the same role noun", () => {
    const p = prefs({ targetRoles: ["Frontend Developer"] });
    expect(matchesPreferences(job({ title: "Frontend Engineer" }), p)).toBe(true);
  });

  it("matches a technology onto the domain it implies", () => {
    const p = prefs({ targetRoles: ["Frontend Engineer"] });
    expect(matchesPreferences(job({ title: "React Engineer" }), p)).toBe(true);
    expect(matchesPreferences(job({ title: "Senior Vue Developer" }), p)).toBe(true);
  });

  it("rejects a different domain even though both are 'engineer'", () => {
    // The whole point: a shared generic role noun is not a match.
    const p = prefs({ targetRoles: ["Senior Frontend Engineer"] });

    expect(matchesPreferences(job({ title: "Backend Engineer" }), p)).toBe(false);
    expect(matchesPreferences(job({ title: "Data Engineer" }), p)).toBe(false);
    expect(matchesPreferences(job({ title: "Security Engineer" }), p)).toBe(false);
  });

  it("matches any of several target roles", () => {
    const p = prefs({ targetRoles: ["Frontend Engineer", "Product Manager"] });

    expect(matchesPreferences(job({ title: "Senior Product Manager" }), p)).toBe(true);
    expect(matchesPreferences(job({ title: "Frontend Developer" }), p)).toBe(true);
    expect(matchesPreferences(job({ title: "Backend Engineer" }), p)).toBe(false);
  });

  it("falls back to the role noun when the target names no domain", () => {
    const p = prefs({ targetRoles: ["Engineer"] });

    expect(matchesPreferences(job({ title: "Backend Engineer" }), p)).toBe(true);
    expect(matchesPreferences(job({ title: "Data Engineer" }), p)).toBe(true);
    expect(matchesPreferences(job({ title: "Product Manager" }), p)).toBe(false);
  });

  it("lets an unparseable title through rather than silently dropping it", () => {
    // HN listings frequently parse to noise; the scorer can judge them.
    const p = prefs({ targetRoles: ["Frontend Engineer"] });
    expect(matchesPreferences(job({ title: "" }), p)).toBe(true);
    expect(matchesPreferences(job({ title: "|||" }), p)).toBe(true);
  });

  // This app is not software-only. An earlier version hardcoded
  // `engineering -> engineer` as a synonym, which meant software titles got
  // morphology handling and no other field did — "Engineer" matched
  // "Engineering Manager" while "Accountant" missed "Accounting Manager".
  // These cases exist to keep that asymmetry from coming back.
  describe("professions other than software", () => {
    const matching: Array<[string, string]> = [
      ["Registered Nurse", "Staff Nurse"],
      ["Registered Nurse", "Nurse Practitioner"],
      ["Accountant", "Accounting Manager"],
      ["Accountant", "Senior Accountant"],
      ["Teacher", "Teaching Assistant"],
      ["Teacher", "Mathematics Teacher"],
      ["Electrician", "Electricians Mate"],
      ["Sales Associate", "Sales Assistant"],
      ["Graphic Designer", "Graphic Design Lead"],
      ["Chef", "Head Chef"],
      ["Paralegal", "Paralegal Assistant"],
      ["Physiotherapist", "Physiotherapy Assistant"],
      ["Care Worker", "Senior Care Worker"],
      ["Logistics Coordinator", "Logistics Coordination Lead"],
    ];

    it.each(matching)("matches %s against %s", (target, jobTitle) => {
      expect(matchesPreferences(job({ title: jobTitle }), prefs({ targetRoles: [target] }))).toBe(
        true
      );
    });

    const unrelated: Array<[string, string]> = [
      ["Registered Nurse", "Software Engineer"],
      ["Registered Nurse", "Warehouse Operative"],
      ["Accountant", "Registered Nurse"],
      ["Teacher", "Truck Driver"],
      ["Chef", "Financial Analyst"],
      ["Electrician", "Graphic Designer"],
      ["Frontend Engineer", "Registered Nurse"],
      ["Marketing Manager", "Sales Manager"],
    ];

    it.each(unrelated)("does not match %s against %s", (target, jobTitle) => {
      expect(matchesPreferences(job({ title: jobTitle }), prefs({ targetRoles: [target] }))).toBe(
        false
      );
    });

    it("handles plurals and -ing/-ant forms identically to -er forms", () => {
      // The software case that used to be special-cased, now just one instance
      // of the general rule.
      const pairs: Array<[string, string]> = [
        ["Engineer", "Engineering Manager"],
        ["Accountant", "Accounts Manager"],
        ["Consultant", "Consulting Lead"],
        ["Nurse", "Nursing Assistant"],
      ];
      for (const [target, jobTitle] of pairs) {
        expect(matchesPreferences(job({ title: jobTitle }), prefs({ targetRoles: [target] }))).toBe(
          true
        );
      }
    });
  });

  describe("technology aliases don't leak into ordinary titles", () => {
    // "go", "server" and "test" are ordinary English words before they are
    // technologies, and mapping them onto engineering domains made unrelated
    // jobs look like software roles.
    const shouldNotMatch: Array<[string, string]> = [
      ["Backend Engineer", "Go-To-Market Manager"],
      ["Backend Engineer", "Restaurant Server"],
      ["Frontend Engineer", "Front Desk Receptionist"],
      ["DevOps Engineer", "Platform Supervisor"],
      ["QA Engineer", "Laboratory Test Technician"],
    ];

    it.each(shouldNotMatch)("does not match %s against %s", (target, jobTitle) => {
      expect(matchesPreferences(job({ title: jobTitle }), prefs({ targetRoles: [target] }))).toBe(
        false
      );
    });

    it("still expands genuine technology names", () => {
      const p = prefs({ targetRoles: ["Frontend Engineer"] });
      expect(matchesPreferences(job({ title: "React Engineer" }), p)).toBe(true);
    });
  });

  describe("work type", () => {
    it("excludes non-remote jobs when the user wants remote only", () => {
      const p = prefs({ targetRoles: ["Frontend Engineer"], workType: ["Remote"] });

      expect(matchesPreferences(job({ remote: false }), p)).toBe(false);
      expect(matchesPreferences(job({ remote: true }), p)).toBe(true);
    });

    it("does not exclude anything when remote is one option among several", () => {
      const p = prefs({ targetRoles: ["Frontend Engineer"], workType: ["Remote", "Hybrid"] });
      expect(matchesPreferences(job({ remote: false }), p)).toBe(true);
    });

    it("does not exclude anything when no work type is set", () => {
      const p = prefs({ targetRoles: ["Frontend Engineer"] });
      expect(matchesPreferences(job({ remote: false }), p)).toBe(true);
    });
  });

  describe("salary", () => {
    it("excludes a job whose ceiling is below the user's floor", () => {
      const p = prefs({ targetRoles: ["Frontend Engineer"], salaryMin: "100000" });
      expect(matchesPreferences(job({ salaryMax: 60000 }), p)).toBe(false);
    });

    it("keeps a job whose ceiling clears the floor", () => {
      const p = prefs({ targetRoles: ["Frontend Engineer"], salaryMin: "100000" });
      expect(matchesPreferences(job({ salaryMax: 140000 }), p)).toBe(true);
    });

    it("treats missing salary data as no signal, not a miss", () => {
      // Almost every feed job has a null salary — treating null as a mismatch
      // would filter out nearly the whole feed.
      const p = prefs({ targetRoles: ["Frontend Engineer"], salaryMin: "100000" });
      expect(matchesPreferences(job({ salaryMax: null }), p)).toBe(true);
    });

    it("tolerates formatted salary input from the text field", () => {
      const p = prefs({ targetRoles: ["Frontend Engineer"], salaryMin: "$100,000" });
      expect(matchesPreferences(job({ salaryMax: 60000 }), p)).toBe(false);
      expect(matchesPreferences(job({ salaryMax: 120000 }), p)).toBe(true);
    });

    it("ignores an unparseable or zero floor", () => {
      const p = prefs({ targetRoles: ["Frontend Engineer"], salaryMin: "negotiable" });
      expect(matchesPreferences(job({ salaryMax: 1 }), p)).toBe(true);
    });
  });
});
