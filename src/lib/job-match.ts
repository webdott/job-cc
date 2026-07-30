/**
 * Deterministic job filtering — no AI, no network.
 *
 * Two jobs here:
 *
 * 1. **Dedupe keys.** The same role posted to Remotive and Arbeitnow has two
 *    different URLs, so `@@unique([sourceUrl, userId])` never catches it. A
 *    normalized company+title key does.
 *
 * 2. **Preference matching.** `targetRoles`, `locations`, `salaryMin/Max`, and
 *    `workType` have been collected since onboarding shipped and read by
 *    nothing. Using them to decide what's worth scoring is what takes a scan
 *    from ~180 model calls down to ~25.
 *
 * Matching is deliberately **lenient**: a false positive costs one model call,
 * while a false negative silently hides a job the user wanted and they can
 * never know it happened. When in doubt, match.
 */

// Shapes live in a dependency-free leaf module so client components can use
// them without pulling this file's lookup tables into the browser bundle.
import { EMPTY_PREFERENCES, type JobPreferences, type WorkType } from "@/types/preferences";

export { EMPTY_PREFERENCES };
export type { WorkType, JobPreferences };

/** Reads the loosely-typed `User.preferences` Json blob into a known shape. */
export function readJobPreferences(raw: unknown): JobPreferences {
  if (!raw || typeof raw !== "object") return EMPTY_PREFERENCES;
  const p = raw as Record<string, unknown>;

  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return {
    targetRoles: strings(p.targetRoles),
    locations: strings(p.locations),
    // Stored as raw <input type="number"> strings, not numbers.
    salaryMin: typeof p.salaryMin === "string" ? p.salaryMin : "",
    salaryMax: typeof p.salaryMax === "string" ? p.salaryMax : "",
    workType: strings(p.workType).filter((w): w is WorkType =>
      ["Remote", "Hybrid", "On-site"].includes(w)
    ),
  };
}

// ── Normalization ────────────────────────────────────────────────────────────

function stripAccents(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/**
 * Collapses the hyphen/space variants that would otherwise tokenize apart
 * ("front-end" / "front end" / "frontend") before any token work happens.
 */
function canonicalize(s: string): string {
  return (
    stripAccents(s.toLowerCase())
      .replace(/front[\s\-_]?end/g, "frontend")
      .replace(/back[\s\-_]?end/g, "backend")
      .replace(/full[\s\-_]?stack/g, "fullstack")
      .replace(/machine[\s\-_]?learning/g, "machinelearning")
      .replace(/dev[\s\-_]?ops/g, "devops")
      // Keep +, # and . so c++, c# and .net survive as tokens.
      .replace(/[^a-z0-9+#.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Legal-entity suffixes that shouldn't make two listings look like different companies. */
const COMPANY_SUFFIXES = new Set([
  "inc",
  "inc.",
  "llc",
  "ltd",
  "ltd.",
  "limited",
  "gmbh",
  "ag",
  "bv",
  "nv",
  "ab",
  "oy",
  "as",
  "sa",
  "srl",
  "spa",
  "plc",
  "co",
  "corp",
  "corporation",
  "company",
  "group",
  "holdings",
  "labs",
  "technologies",
  "technology",
]);

export function normalizeCompany(company: string): string {
  const tokens = canonicalize(company).split(" ").filter(Boolean);
  while (tokens.length > 1 && COMPANY_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

export function normalizeTitle(title: string): string {
  return canonicalize(title);
}

/**
 * Stable identity for "the same role at the same company", used to collapse the
 * same posting appearing on more than one source.
 *
 * Returns null when either side normalizes to nothing — HN listings are parsed
 * heuristically from free text and a blank key would collapse unrelated jobs
 * into one.
 */
export function dedupeKeyFor(job: { company: string; title: string }): string | null {
  const company = normalizeCompany(job.company);
  const title = normalizeTitle(job.title);
  if (!company || !title) return null;
  return `${company}|${title}`;
}

// ── Preference matching ──────────────────────────────────────────────────────

/** Level words. Present in almost every title and never discriminating. */
const SENIORITY = new Set([
  "junior",
  "jr",
  "mid",
  "middle",
  "senior",
  "snr",
  "sr",
  "staff",
  "principal",
  "lead",
  "head",
  "chief",
  "entry",
  "intern",
  "internship",
  "graduate",
  "trainee",
  "apprentice",
  "i",
  "ii",
  "iii",
  "iv",
]);

/**
 * Word endings stripped so that "accountant", "accounting" and "accounts" all
 * reduce to the same stem.
 *
 * This exists because the alternative — a hand-written synonym list — can only
 * ever cover the jobs whoever wrote it happened to think of. An earlier version
 * hardcoded `engineering -> engineer`, which quietly meant software titles got
 * morphology handling and nothing else did: "Engineer" matched "Engineering
 * Manager", but "Accountant" missed "Accounting Manager" and "Electrician"
 * missed "Electricians Mate". Stemming applies the same rule to every word in
 * every field.
 */
const MORPHOLOGICAL_SUFFIXES = [
  "ments",
  "ment",
  "ings",
  "ing",
  "ants",
  "ant",
  "ents",
  "ent",
  "ists",
  "ist",
  "ers",
  "er",
  "ors",
  "or",
  "ies",
  "ed",
  "es",
  "s",
];

/**
 * Crude but symmetric stemmer. Deliberately not a full Porter implementation —
 * it only has to make the *same* word in different forms collapse, and it is
 * applied identically to the user's target and the job title, so an imperfect
 * stem is still consistent on both sides.
 */
function stem(token: string): string {
  let current = token;

  // A few passes, because "engineering" needs -ing then -er.
  for (let pass = 0; pass < 3; pass++) {
    const before = current;
    if (current.length < 5) break;

    for (const suffix of MORPHOLOGICAL_SUFFIXES) {
      // Leave at least 4 characters, so short words aren't stemmed to nothing.
      if (current.endsWith(suffix) && current.length - suffix.length >= 4) {
        current = current.slice(0, -suffix.length);
        break;
      }
    }
    if (current.length > 4 && /[ey]$/.test(current)) current = current.slice(0, -1);

    if (current === before) break;
  }

  return current;
}

/** Filler, employment type, and the m/f/d gender tags common on EU boards. */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "and",
  "or",
  "for",
  "to",
  "in",
  "at",
  "with",
  "remote",
  "hybrid",
  "onsite",
  "full",
  "part",
  "time",
  "fulltime",
  "parttime",
  "contract",
  "freelance",
  "permanent",
  "m",
  "f",
  "d",
  "w",
  "x",
  "gn",
  "divers",
]);

/**
 * Cross-industry role nouns — *what* someone is rather than what they work on.
 *
 * These are discounted during matching because nearly every posting in every
 * field contains one: "Frontend Engineer" and "Data Engineer" share "engineer",
 * "Ward Nurse" and "Theatre Nurse" share "nurse", and neither pair is the same
 * job. Anything not listed here is treated as a meaningful subject term, which
 * is what lets the matcher work for professions nobody enumerated.
 */
const GENERIC_ROLES = [
  "engineer",
  "developer",
  "programmer",
  "manager",
  "designer",
  "analyst",
  "scientist",
  "architect",
  "specialist",
  "consultant",
  "administrator",
  "coordinator",
  "assistant",
  "associate",
  "technician",
  "officer",
  "supervisor",
  "representative",
  "advisor",
  "planner",
  "practitioner",
  "operative",
  "clerk",
  "agent",
];

const GENERIC_ROLE_STEMS = new Set(GENERIC_ROLES.map(stem));

/**
 * True synonyms — different words for the same role noun. Morphological
 * variants ("engineering", "developers") are handled by `stem`, so this only
 * needs genuine alternates.
 */
const ROLE_SYNONYMS: Record<string, string> = {
  dev: "developer",
  programmer: "developer",
  developer: "engineer",
};

/**
 * Optional enrichment: specific technologies mapped onto the domain they imply,
 * so "React Engineer" can match a "Frontend Engineer" target.
 *
 * This list is software-heavy simply because that's where naming a tool in the
 * title is common. It is *additive only* — nothing here is required for
 * matching to work, and roles in other fields match on their own subject terms
 * without needing an entry. Equivalent lists for other industries can be added
 * as they come up.
 *
 * Entries must be unambiguous. Deliberately excluded: "go" (as in
 * go-to-market), "server" (as in restaurant server), and "test" — all of which
 * previously caused ordinary non-technical titles to be mistaken for
 * engineering roles.
 */
const DOMAIN_ALIASES: Record<string, string> = {
  fe: "frontend",
  react: "frontend",
  reactjs: "frontend",
  vue: "frontend",
  vuejs: "frontend",
  angular: "frontend",
  svelte: "frontend",
  nextjs: "frontend",
  javascript: "frontend",
  typescript: "frontend",

  be: "backend",
  nodejs: "backend",
  django: "backend",
  rails: "backend",
  golang: "backend",

  sre: "devops",
  infrastructure: "devops",
  infra: "devops",
  kubernetes: "devops",

  ml: "machinelearning",
  mlops: "machinelearning",
  llm: "machinelearning",

  ios: "mobile",
  android: "mobile",
  flutter: "mobile",
  sdet: "quality",
  infosec: "security",
  appsec: "security",
};

interface TitleTokens {
  /** What the role is *about* — the discriminating part. */
  domain: Set<string>;
  /** What the role *is* — engineer, nurse's "practitioner", manager. */
  generic: Set<string>;
}

function tokenizeTitle(title: string): TitleTokens {
  const domain = new Set<string>();
  const generic = new Set<string>();

  for (const raw of canonicalize(title).split(" ")) {
    if (!raw || SENIORITY.has(raw) || STOPWORDS.has(raw)) continue;

    // Aliases resolve before stemming — "kubernetes" would otherwise stem to
    // something the alias table doesn't contain.
    const aliased = DOMAIN_ALIASES[raw];
    if (aliased) {
      domain.add(aliased);
      continue;
    }

    const token = stem(ROLE_SYNONYMS[raw] ?? raw);
    if (GENERIC_ROLE_STEMS.has(token)) {
      generic.add(token);
      continue;
    }
    domain.add(token);
  }

  return { domain, generic };
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  return Array.from(a).some((value) => b.has(value));
}

function titleMatchesTargets(jobTitle: string, targetRoles: string[]): boolean {
  const job = tokenizeTitle(jobTitle);

  // An unparseable title (common for heuristically-parsed HN listings) carries
  // no signal either way. Let it through and let the scorer judge.
  if (job.domain.size === 0 && job.generic.size === 0) return true;

  return targetRoles.some((role) => {
    const target = tokenizeTitle(role);

    // The target names a domain ("frontend engineer"), so the domain has to
    // line up. Matching on "engineer" alone would let everything through.
    if (target.domain.size > 0) return intersects(target.domain, job.domain);

    // The target is only a role noun ("engineer", "designer") — match on that.
    if (target.generic.size > 0) return intersects(target.generic, job.generic);

    // Target normalized to nothing; it can't exclude anything.
    return true;
  });
}

function parseSalary(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface MatchableJob {
  title: string;
  remote: boolean;
  salaryMax: number | null;
}

/**
 * Whether a job is worth spending a model call on.
 *
 * Salary and work type act only as *negative* signals, and only when the job
 * actually carries that data — the three feeds almost never populate salary, so
 * treating a null as a miss would filter out nearly everything.
 */
export function matchesPreferences(job: MatchableJob, prefs: JobPreferences): boolean {
  // No stated targets means no basis to exclude anything. This is the path for
  // every user who skipped that onboarding step, and getting it wrong would
  // show them an empty app.
  if (prefs.targetRoles.length === 0) return true;

  if (!titleMatchesTargets(job.title, prefs.targetRoles)) return false;

  // Wants remote only, and this job is explicitly not remote.
  const remoteOnly = prefs.workType.length > 0 && prefs.workType.every((w) => w === "Remote");
  if (remoteOnly && !job.remote) return false;

  // The job's ceiling is below the user's floor.
  const floor = parseSalary(prefs.salaryMin);
  if (floor !== null && job.salaryMax !== null && job.salaryMax < floor) return false;

  return true;
}
