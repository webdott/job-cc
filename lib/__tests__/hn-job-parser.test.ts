import { describe, expect, it } from "vitest";
import { parseHNListing } from "@/lib/hn-job-parser";

describe("parseHNListing", () => {
  it("parses a pipe-delimited Company | Role | Location header", () => {
    const result = parseHNListing(
      "Acme Corp | Senior Backend Engineer | Remote (US)\nWe're building things."
    );
    expect(result.company).toBe("Acme Corp");
    expect(result.title).toBe("Senior Backend Engineer");
    expect(result.location).toBe("Remote (US)");
    expect(result.lowConfidence).toBe(false);
  });

  it("classifies parts by content when order is Company | Location | Role", () => {
    const result = parseHNListing("Acme Corp | Berlin, DE | Senior Backend Engineer");
    expect(result.company).toBe("Acme Corp");
    expect(result.title).toBe("Senior Backend Engineer");
    expect(result.location).toBe("Berlin, DE");
  });

  it("parses a dash-delimited header when no pipe is present", () => {
    const result = parseHNListing("Acme Corp - Senior Backend Engineer - Remote");
    expect(result.company).toBe("Acme Corp");
    expect(result.title).toBe("Senior Backend Engineer");
    expect(result.location).toBe("Remote");
  });

  it("prefers labeled fields over the header line when both are present", () => {
    const result = parseHNListing(
      "Some free text header\nCompany: Labeled Co\nRole: Staff Engineer\nLocation: Hybrid"
    );
    expect(result.company).toBe("Labeled Co");
    expect(result.title).toBe("Staff Engineer");
    expect(result.location).toBe("Hybrid");
    expect(result.lowConfidence).toBe(false);
  });

  it("falls back to placeholders and flags low confidence when nothing is recognizable", () => {
    const result = parseHNListing("Just some rambling text with no structure at all.");
    expect(result.company).toBe("Unknown Company");
    expect(result.title).toBe("Software Engineer");
    expect(result.location).toBe("Remote");
    expect(result.lowConfidence).toBe(true);
  });

  it("flags low confidence when only a title keyword is found, no company", () => {
    const result = parseHNListing("Looking for a great engineer to join us, no name given");
    expect(result.lowConfidence).toBe(true);
  });

  it("handles empty input without throwing", () => {
    const result = parseHNListing("");
    expect(result.lowConfidence).toBe(true);
    expect(result.company).toBe("Unknown Company");
  });
});
