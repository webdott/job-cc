// Shared with the onboarding flow and the server matcher; see
// src/types/preferences.ts and src/types/forms.ts.
import type { AiProviderId } from "@/lib/ai-providers";
import type { JobPreferences, NotificationPrefs } from "@/types/preferences";

export type { WorkType, NotificationPrefs } from "@/types/preferences";
export { DEFAULT_NOTIFICATION_PREFS } from "@/types/preferences";
export type { ByocForm } from "@/types/forms";
export { EMPTY_BYOC_FORM } from "@/types/forms";

export type Preferences = JobPreferences;

export interface PreferencesResponse {
  preferences?: Partial<Preferences> & { notifications?: Partial<NotificationPrefs> };
}

export interface ParsedExperience {
  title: string;
  company: string;
  duration: string;
  bullets: string[];
}

export interface ParsedEducation {
  degree: string;
  institution: string;
  year?: string;
}

export interface Resume {
  id: string;
  label: string;
  isActive: boolean;
  strengthScore: number | null;
  createdAt: string;
  parsedData: {
    skills?: string[];
    experience?: ParsedExperience[];
    education?: ParsedEducation[];
  };
}

export interface ResumesResponse {
  resumes: Resume[];
}

export const MAX_RESUMES = 3;

export interface CredentialsStatus {
  hasCredentials: boolean;
  aiProvider: AiProviderId | null;
  verifiedAt: string | null;
}
