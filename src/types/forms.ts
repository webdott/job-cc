import type { AiProviderId } from "@/lib/ai-providers";

/**
 * Bring-your-own-credentials form state, shared by the profile section and the
 * onboarding step (which previously each declared their own identical copy).
 */
export interface ByocForm {
  aiProvider: AiProviderId;
  aiApiKey: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  brevoApiKey: string;
  brevoFromEmail: string;
}

export const EMPTY_BYOC_FORM: ByocForm = {
  aiProvider: "GOOGLE",
  aiApiKey: "",
  r2AccountId: "",
  r2AccessKeyId: "",
  r2SecretAccessKey: "",
  r2BucketName: "",
  r2PublicUrl: "",
  brevoApiKey: "",
  brevoFromEmail: "",
};
