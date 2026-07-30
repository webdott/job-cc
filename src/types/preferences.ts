/**
 * User preference shapes, shared by the profile UI, the onboarding flow, and
 * the server-side matcher.
 *
 * Deliberately dependency-free so importing it from a client component doesn't
 * drag `lib/job-match` (and its stemmer and lookup tables) into the browser
 * bundle. These existed as three separate declarations before — two identical
 * UI copies plus the server's own — which is how the stale `UserPreferences`
 * interface in the old `types/index.ts` managed to disagree with all of them.
 *
 * The authority on what the API accepts is the Zod schema in
 * `app/api/user/preferences/route.ts`; keep these in step with it.
 */

export type WorkType = "Remote" | "Hybrid" | "On-site";

export interface JobPreferences {
  targetRoles: string[];
  locations: string[];
  /** Raw <input type="number"> value, not a number. */
  salaryMin: string;
  salaryMax: string;
  workType: WorkType[];
}

export const EMPTY_PREFERENCES: JobPreferences = {
  targetRoles: [],
  locations: [],
  salaryMin: "",
  salaryMax: "",
  workType: [],
};

export interface NotificationPrefs {
  jobMatches: boolean;
  followUpReminders: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  jobMatches: true,
  followUpReminders: true,
  quietHoursStart: "",
  quietHoursEnd: "",
};
