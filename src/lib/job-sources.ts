import { sanitizeJobDescription, stripToPlainText, decodeHtmlEntities } from "@/lib/sanitize";
import { parseHNListing, HN_LOW_CONFIDENCE_NOTICE } from "@/lib/hn-job-parser";

/**
 * The three free job sources, normalized into a common shape.
 *
 * Previously duplicated verbatim between /api/jobs/discover and
 * /api/cron/daily-digest; the two copies had already drifted (only discover
 * set `next: { revalidate: 3600 }`). Caching is kept here for both callers —
 * the nightly cron re-using an hour-old response is desirable, not a bug.
 */

/** Source provenance, ordered by how trustworthy the parsed title/company is. */
export type JobSource = "remotive" | "arbeitnow" | "hn";

export interface NormalizedJob {
  sourceUrl: string;
  sourceId: string;
  source: JobSource;
  title: string;
  company: string;
  location: string | null;
  description: string;
  remote: boolean;
  postedAt: Date | null;
}

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location: string;
  description: string;
  salary: string;
  publication_date: string;
}

interface ArbeitnowJob {
  slug: string;
  url: string;
  title: string;
  company_name: string;
  location: string;
  description: string;
  remote: boolean;
  published_at: string;
}

interface HNStory {
  hits: Array<{ objectID: string }>;
}

interface HNItem {
  children: Array<{ text: string; objectID: string }>;
}

function validDate(raw: string | number | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export async function fetchRemotive(): Promise<NormalizedJob[]> {
  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?limit=100", {
      next: { revalidate: 3600 },
    });
    const data = (await res.json()) as { jobs: RemotiveJob[] };
    return (data.jobs ?? []).map((j) => ({
      sourceUrl: j.url,
      sourceId: `remotive-${j.id}`,
      source: "remotive" as const,
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || "Remote",
      description: sanitizeJobDescription(j.description),
      remote: true,
      postedAt: validDate(j.publication_date),
    }));
  } catch {
    return [];
  }
}

// Arbeitnow's API is genuinely paginated (`links.next` points at the next
// page). Follow it instead of slicing a single page, capped so a scan
// doesn't balloon into hundreds of jobs needing per-job AI scoring.
const ARBEITNOW_CAP = 60;
const ARBEITNOW_MAX_PAGES = 3;

export async function fetchArbeitnow(): Promise<NormalizedJob[]> {
  const jobs: ArbeitnowJob[] = [];
  let url: string | null = "https://www.arbeitnow.com/api/job-board-api";

  for (let page = 0; url && page < ARBEITNOW_MAX_PAGES && jobs.length < ARBEITNOW_CAP; page++) {
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      const data = (await res.json()) as {
        data: ArbeitnowJob[];
        links?: { next?: string | null };
      };
      jobs.push(...(data.data ?? []));
      url = data.links?.next ?? null;
    } catch {
      break; // keep whatever pages were already fetched
    }
  }

  return jobs.slice(0, ARBEITNOW_CAP).map((j) => ({
    sourceUrl: j.url,
    sourceId: `arbeitnow-${j.slug}`,
    source: "arbeitnow" as const,
    title: j.title,
    company: j.company_name,
    location: j.location,
    description: sanitizeJobDescription(decodeHtmlEntities(j.description)),
    remote: j.remote ?? false,
    postedAt: validDate(String(j.published_at)),
  }));
}

const HN_CAP = 20;

export async function fetchHNHiring(): Promise<NormalizedJob[]> {
  try {
    // Find latest "Ask HN: Who's Hiring" thread
    const searchRes = await fetch(
      "https://hn.algolia.com/api/v1/search?query=Ask+HN+Who+is+hiring&tags=story,ask_hn&hitsPerPage=1"
    );
    const searchData = (await searchRes.json()) as HNStory;
    const storyId = searchData.hits?.[0]?.objectID;
    if (!storyId) return [];

    const storyRes = await fetch(`https://hn.algolia.com/api/v1/items/${storyId}`);
    const story = (await storyRes.json()) as HNItem;

    return (story.children ?? []).slice(0, HN_CAP).map((comment) => {
      const text = stripToPlainText(comment.text ?? "");
      const parsed = parseHNListing(text);
      const description = parsed.lowConfidence
        ? `${HN_LOW_CONFIDENCE_NOTICE}\n\n${text}`.slice(0, 2000)
        : text.slice(0, 2000);

      return {
        sourceUrl: `https://news.ycombinator.com/item?id=${comment.objectID}`,
        sourceId: `hn-${comment.objectID}`,
        source: "hn" as const,
        title: parsed.title,
        company: parsed.company,
        location: parsed.location,
        description,
        remote: text.toLowerCase().includes("remote"),
        postedAt: new Date(),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetches all three sources in parallel. Individual sources swallow their own
 * errors and return `[]`, so a single dead upstream degrades the batch rather
 * than failing it.
 */
export async function fetchAllSources(): Promise<NormalizedJob[]> {
  const [
    remotive,
    arbeitnow,
    // hn
  ] = await Promise.all([
    fetchRemotive(),
    fetchArbeitnow(),
    // fetchHNHiring(),
  ]);
  return [...remotive, ...arbeitnow];
}
