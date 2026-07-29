import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
    setByoc((b) =>
      b.aiProvider === credStatus.aiProvider ? b : { ...b, aiProvider: credStatus.aiProvider! }
    );
  }, [credStatus?.aiProvider]);

  const hasCredentials = !!credStatus?.hasCredentials;
  const providerChanged =
    hasCredentials && !!credStatus?.aiProvider && byoc.aiProvider !== credStatus.aiProvider;
  const canSubmit = hasCredentials
    ? hasAnyCredentialInput(byoc) || providerChanged
    : isFullCredentialForm(byoc);

  const byocMutation = useMutation({
    mutationFn: async (form: ByocForm) => {
      const payload = hasCredentials
        ? {
            aiProvider: form.aiProvider,
            // Only send non-empty secrets/fields so the API treats blanks as "keep"
            ...(form.aiApiKey.trim() ? { aiApiKey: form.aiApiKey.trim() } : {}),
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
    byocFieldError,
    byocSaved,
    byocMutation,
    hasCredentials,
    canSubmit,
  };
}
