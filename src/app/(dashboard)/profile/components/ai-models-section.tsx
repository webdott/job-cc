"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2 } from "lucide-react";
import { getProviderLabel, type AiProviderId } from "@/lib/ai-providers";
import { getDefaultModels } from "@/lib/ai-models";
import { AiModelSelects } from "@/components/ai-model-selects";
import { Section } from "./section";

interface AiModelsStatus {
  aiProvider: AiProviderId;
  aiFlashModel: string;
  aiProModel: string;
  canSave: boolean;
}

export function AiModelsSection() {
  const queryClient = useQueryClient();
  const defaults = getDefaultModels("GOOGLE");

  const { data: meData, isLoading: isLoadingMe } = useQuery<{ isAllowlisted: boolean }>({
    queryKey: ["user-me"],
    queryFn: async () => {
      const res = await fetch("/api/user/me");
      return res.json() as Promise<{ isAllowlisted: boolean }>;
    },
  });

  const isAllowlisted = meData?.isAllowlisted ?? false;

  const { data, isLoading } = useQuery<AiModelsStatus>({
    queryKey: ["ai-models"],
    queryFn: async () => {
      const res = await fetch("/api/user/ai-models");
      if (!res.ok) throw new Error("Failed to load AI models");
      return res.json() as Promise<AiModelsStatus>;
    },
    enabled: !isLoadingMe && isAllowlisted,
  });

  const [flashModel, setFlashModel] = useState(defaults.flash);
  const [proModel, setProModel] = useState(defaults.pro);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setFlashModel(data.aiFlashModel);
    setProModel(data.aiProModel);
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiFlashModel: flashModel, aiProModel: proModel }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to save models");
    },
    onSuccess: () => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["ai-models"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (isLoadingMe || !isAllowlisted) return null;

  if (isLoading || !data) {
    return (
      <Section title="AI models">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </Section>
    );
  }

  const dirty = flashModel !== data.aiFlashModel || proModel !== data.aiProModel;

  return (
    <Section title="AI models">
      <p className="text-sm text-muted-foreground mb-4">
        Using the operator {getProviderLabel(data.aiProvider)} key. Pick which models to use for
        scoring versus cover letters.
      </p>
      <AiModelSelects
        provider={data.aiProvider}
        flashModel={flashModel}
        proModel={proModel}
        onFlashChange={setFlashModel}
        onProChange={setProModel}
        error={!!error}
      />
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <button
        type="button"
        disabled={!dirty || mutation.isPending || !data.canSave}
        onClick={() => mutation.mutate()}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {saved ? (
          <>
            <CheckCircle className="h-4 w-4" /> Saved
          </>
        ) : (
          "Save models"
        )}
      </button>
    </Section>
  );
}
