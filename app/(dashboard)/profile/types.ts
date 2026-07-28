import type { AiProviderId } from "@/lib/ai-providers";

export type WorkType = "Remote" | "Hybrid" | "On-site";

export interface Preferences {
  targetRoles: string[];
  locations: string[];
  salaryMin: string;
  salaryMax: string;
  workType: WorkType[];
}

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

export interface ByocForm {
  aiProvider: AiProviderId;
  aiApiKey: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
}

export const EMPTY_BYOC_FORM: ByocForm = {
  aiProvider: "GOOGLE",
  aiApiKey: "",
  r2AccountId: "",
  r2AccessKeyId: "",
  r2SecretAccessKey: "",
  r2BucketName: "",
  r2PublicUrl: "",
};
