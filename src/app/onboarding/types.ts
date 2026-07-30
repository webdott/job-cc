// Shared with the profile section and the server matcher; see
// src/types/preferences.ts and src/types/forms.ts.
import type { JobPreferences } from "@/types/preferences";

export type { WorkType } from "@/types/preferences";
export { EMPTY_PREFERENCES } from "@/types/preferences";
export type { ByocForm } from "@/types/forms";
export { EMPTY_BYOC_FORM } from "@/types/forms";

export type Preferences = JobPreferences;

export interface ParsedSkill {
  skills?: string[];
  strengthScore?: number;
}
