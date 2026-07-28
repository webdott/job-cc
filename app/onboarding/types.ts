import type { AiProviderId } from "@/lib/ai-providers";

export type WorkType = "Remote" | "Hybrid" | "On-site";

export interface Preferences {
  targetRoles: string[];
  locations: string[];
  salaryMin: string;
  salaryMax: string;
  workType: WorkType[];
}

export const EMPTY_PREFERENCES: Preferences = {
  targetRoles: [],
  locations: [],
  salaryMin: "",
  salaryMax: "",
  workType: [],
};

export interface ParsedSkill {
  skills?: string[];
  strengthScore?: number;
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
