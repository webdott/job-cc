import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDefaultModels } from "@/lib/ai-models";
import type { AiProviderId } from "@/lib/ai-providers";
import { EMPTY_BYOC_FORM, type ByocForm, type CredentialsStatus } from "../types";

function hasAnyCredentialInput(form: ByocForm) {
  return !!(
    form.aiApiKey.trim() ||
    form.r2AccountId.trim() ||
    form.r2AccessKeyId.trim() ||
    form.r2SecretAccessKey.trim() ||
    form.r2BucketName.trim() ||
    form.r2PublicUrl.trim() ||
    form.brevoApiKey.trim() ||
    form.brevoFromEmail.trim()
  );
}

function isFullCredentialForm(form: ByocForm) {
  return !!(
    form.aiApiKey.trim() &&
    form.r2AccountId.trim() &&
    form.r2AccessKeyId.trim() &&
    form.r2SecretAccessKey.trim() &&
    form.r2BucketName.trim() &&
    form.r2PublicUrl.trim() &&
    form.brevoApiKey.trim() &&
    form.brevoFromEmail.trim()
  );
}

function withProviderDefaults(provider: AiProviderId, prev: ByocForm): ByocForm {
  const defaults = getDefaultModels(provider);
  return { ...prev, aiProvider: provider, aiFlashModel: defaults.flash, aiProModel: defaults.pro };
}

export function useCredentialsSection() {
  const queryClient = useQueryClient();

  const { data: meData, isLoading: isLoadingMeData } = useQuery<{ isAllowlisted: boolean }>({
    queryKey: ["user-me"],
    queryFn: async () => {
      const res = await fetch("/api/user/me");
      return res.json() as Promise<{ isAllowlisted: boolean }>;
    },
  });

  const isAllowlisted = meData?.isAllowlisted ?? false;

  const { data: credStatus } = useQuery<CredentialsStatus>({
    queryKey: ["byoc-credentials"],
    queryFn: async () => {
      const res = await fetch("/api/user/credentials");
      return res.json() as Promise<CredentialsStatus>;
    },
    enabled: !isLoadingMeData && !isAllowlisted,
  });

  const [byoc, setByoc] = useState<ByocForm>(EMPTY_BYOC_FORM);
  const [byocFieldError, setByocFieldError] = useState<"ai" | "r2" | "brevo" | null>(null);
  const [byocSaved, setByocSaved] = useState(false);

  useEffect(() => {
    if (!credStatus?.aiProvider) return;
    setByoc((b) => {
      const defaults = getDefaultModels(credStatus.aiProvider!);
      return {
        ...b,
        aiProvider: credStatus.aiProvider!,
        aiFlashModel: credStatus.aiFlashModel ?? defaults.flash,
        aiProModel: credStatus.aiProModel ?? defaults.pro,
      };
    });
  }, [credStatus?.aiProvider, credStatus?.aiFlashModel, credStatus?.aiProModel]);

  const hasCredentials = !!credStatus?.hasCredentials;
  const providerChanged =
    hasCredentials && !!credStatus?.aiProvider && byoc.aiProvider !== credStatus.aiProvider;
  const modelsChanged =
    hasCredentials &&
    (byoc.aiFlashModel !== (credStatus?.aiFlashModel ?? byoc.aiFlashModel) ||
      byoc.aiProModel !== (credStatus?.aiProModel ?? byoc.aiProModel));
  const canSubmit = hasCredentials
    ? hasAnyCredentialInput(byoc) || providerChanged || modelsChanged
    : isFullCredentialForm(byoc);

  const setProvider = (provider: AiProviderId) => {
    setByoc((b) => withProviderDefaults(provider, b));
  };

  const byocMutation = useMutation({
    mutationFn: async (form: ByocForm) => {
      const payload = hasCredentials
        ? {
            aiProvider: form.aiProvider,
            // Only send non-empty secrets/fields so the API treats blanks as "keep"
            ...(form.aiApiKey.trim() ? { aiApiKey: form.aiApiKey.trim() } : {}),
            ...(providerChanged || modelsChanged || form.aiApiKey.trim()
              ? { aiFlashModel: form.aiFlashModel, aiProModel: form.aiProModel }
              : {}),
            ...(form.r2AccountId.trim() ? { r2AccountId: form.r2AccountId.trim() } : {}),
            ...(form.r2AccessKeyId.trim() ? { r2AccessKeyId: form.r2AccessKeyId.trim() } : {}),
            ...(form.r2SecretAccessKey.trim()
              ? { r2SecretAccessKey: form.r2SecretAccessKey.trim() }
              : {}),
            ...(form.r2BucketName.trim() ? { r2BucketName: form.r2BucketName.trim() } : {}),
            ...(form.r2PublicUrl.trim() ? { r2PublicUrl: form.r2PublicUrl.trim() } : {}),
            ...(form.brevoApiKey.trim() ? { brevoApiKey: form.brevoApiKey.trim() } : {}),
            ...(form.brevoFromEmail.trim() ? { brevoFromEmail: form.brevoFromEmail.trim() } : {}),
          }
        : form;

      const res = await fetch("/api/user/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          field?: "ai" | "r2" | "brevo";
        };
        setByocFieldError(data.field ?? null);
        throw new Error(data.error ?? "Failed to save credentials");
      }
    },
    onSuccess: () => {
      setByocFieldError(null);
      setByoc((prev) => ({
        ...EMPTY_BYOC_FORM,
        aiProvider: prev.aiProvider,
        aiFlashModel: prev.aiFlashModel,
        aiProModel: prev.aiProModel,
      }));
      setByocSaved(true);
      setTimeout(() => setByocSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["byoc-credentials"] });
    },
  });

  return {
    isAllowlisted,
    credStatus,
    byoc,
    setByoc,
    setProvider,
    byocFieldError,
    byocSaved,
    byocMutation,
    hasCredentials,
    canSubmit,
  };
}
