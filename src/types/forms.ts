import type { AiProviderId } from "@/lib/ai-providers";
import { getDefaultModels } from "@/lib/ai-models";

/**
 * Bring-your-own-credentials form state, shared by the profile section and the
 * onboarding step (which previously each declared their own identical copy).
 */
export interface ByocForm {
  aiProvider: AiProviderId;
  aiApiKey: string;
  aiFlashModel: string;
  aiProModel: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  brevoApiKey: string;
  brevoFromEmail: string;
}

const googleDefaults = getDefaultModels("GOOGLE");

export const EMPTY_BYOC_FORM: ByocForm = {
  aiProvider: "GOOGLE",
  aiApiKey: "",
  aiFlashModel: googleDefaults.flash,
  aiProModel: googleDefaults.pro,
  r2AccountId: "",
  r2AccessKeyId: "",
  r2SecretAccessKey: "",
  r2BucketName: "",
  r2PublicUrl: "",
  brevoApiKey: "",
  brevoFromEmail: "",
};
