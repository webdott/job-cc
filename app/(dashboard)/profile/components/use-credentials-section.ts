import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EMPTY_BYOC_FORM, type ByocForm, type CredentialsStatus } from "../types";

export function useCredentialsSection() {
  const queryClient = useQueryClient();

  const { data: meData } = useQuery<{ isAllowlisted: boolean }>({
    queryKey: ["user-me"],
    queryFn: async () => {
      const res = await fetch("/api/user/me");
      return res.json() as Promise<{ isAllowlisted: boolean }>;
    },
  });
  const isAllowlisted = meData?.isAllowlisted ?? true;

  const { data: credStatus } = useQuery<CredentialsStatus>({
    queryKey: ["byoc-credentials"],
    queryFn: async () => {
      const res = await fetch("/api/user/credentials");
      return res.json() as Promise<CredentialsStatus>;
    },
    enabled: !isAllowlisted,
  });

  const [byoc, setByoc] = useState<ByocForm>(EMPTY_BYOC_FORM);
  const [byocFieldError, setByocFieldError] = useState<"ai" | "r2" | null>(null);
  const [byocSaved, setByocSaved] = useState(false);

  const byocMutation = useMutation({
    mutationFn: async (form: ByocForm) => {
      const res = await fetch("/api/user/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          field?: "ai" | "r2";
        };
        setByocFieldError(data.field ?? null);
        throw new Error(data.error ?? "Failed to save credentials");
      }
    },
    onSuccess: () => {
      setByocFieldError(null);
      setByoc(EMPTY_BYOC_FORM);
      setByocSaved(true);
      setTimeout(() => setByocSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["byoc-credentials"] });
    },
  });

  return { isAllowlisted, credStatus, byoc, setByoc, byocFieldError, byocSaved, byocMutation };
}
