/**
 * Best-effort parser for HN "Who's Hiring" comments.
 *
 * These are free-text and don't follow one strict format. Many use
 * "Company | Role | Location" but the field order varies, some use
 * labeled lines ("Company: Foo"), and plenty have no delimiters at all.
 * This tries a few cheap strategies before falling back to placeholders,
 * and reports whether it's confident in the result so callers can flag
 * low-confidence listings (e.g. in the description shown to the user)
 * instead of presenting a garbled parse as if it were clean structured
 * data.
 */

const LOCATION_HINTS =
  /remote|onsite|on-site|hybrid|\bUSA?\b|\bUK\b|\bEU\b|United States|Canada|Europe|APAC|UTC|GMT|PST|EST|CET|,\s*[A-Z]{2}\b/i;

const TITLE_HINTS =
  /engineer|developer|programmer|designer|manager|director|architect|scientist|analyst|founder|intern|recruiter|devops|\bsre\b|\bqa\b|researcher|marketing|sales|\blead\b/i;

export interface ParsedHNListing {
  title: string;
  company: string;
  location: string;
  /** True when the parser couldn't confidently identify a company and/or title. */
  lowConfidence: boolean;
}

/**
 * Given delimiter-split parts of a header line (order unknown — some posts
 * are "Company | Role | Location", others "Company | Location | Role"),
 * classify each part by content rather than assuming position.
 */
function classifyDelimitedParts(parts: string[]): {
  company: string;
  title: string;
  location: string;
} {
  let location = "";
  let title = "";
  const remaining: string[] = [];

  for (const part of parts) {
    if (!location && LOCATION_HINTS.test(part)) {
      location = part;
      continue;
    }
    if (!title && TITLE_HINTS.test(part)) {
      title = part;
      continue;
    }
    remaining.push(part);
  }

  // Whatever wasn't recognized as a location/title is assumed to be the
  // company (first leftover, in original order). If no part matched the
  // title keywords, fall back to the second leftover part.
  const company = remaining[0] ?? "";
  if (!title && remaining[1]) title = remaining[1];

  return { company, title, location };
}

/** Scans the first few lines for "Label: value" style fields. */
function extractLabeledFields(
  lines: string[]
): Partial<Pick<ParsedHNListing, "company" | "title" | "location">> {
  const result: Partial<Pick<ParsedHNListing, "company" | "title" | "location">> = {};

  for (const line of lines.slice(0, 8)) {
    const companyMatch = line.match(/^(?:company|employer)\s*:\s*(.+)$/i);
    if (companyMatch && !result.company) result.company = companyMatch[1].trim();

    const titleMatch = line.match(/^(?:role|title|position)\s*:\s*(.+)$/i);
    if (titleMatch && !result.title) result.title = titleMatch[1].trim();

    const locationMatch = line.match(/^(?:location|based in)\s*:\s*(.+)$/i);
    if (locationMatch && !result.location) result.location = locationMatch[1].trim();
  }

  return result;
}

export function parseHNListing(rawText: string): ParsedHNListing {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const headerLine = lines[0] ?? "";

  const labeled = extractLabeledFields(lines);
  let company = labeled.company ?? "";
  let title = labeled.title ?? "";
  let location = labeled.location ?? "";

  if (!company || !title || !location) {
    const delimiter = headerLine.includes("|")
      ? "|"
      : /\s[-–—]\s/.test(headerLine)
        ? /\s[-–—]\s/
        : null;

    if (delimiter) {
      const parts = headerLine
        .split(delimiter)
        .map((s) => s.trim())
        .filter(Boolean);

      if (parts.length >= 2) {
        const classified = classifyDelimitedParts(parts);
        company = company || classified.company;
        title = title || classified.title;
        location = location || classified.location;
      }
    }
  }

  const lowConfidence = !company || !title;

  return {
    company: company || "Unknown Company",
    title: title || "Software Engineer",
    location: location || "Remote",
    lowConfidence,
  };
}

export const HN_LOW_CONFIDENCE_NOTICE =
  '[Auto-parsed from an HN "Who\'s Hiring" comment — company/role details below may be inaccurate; verify against the source link.]';
