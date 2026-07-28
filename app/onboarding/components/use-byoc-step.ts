import { useState } from "react";
import { EMPTY_BYOC_FORM, type ByocForm } from "../types";

export function useByocStep(onComplete: () => void) {
  const [byoc, setByoc] = useState<ByocForm>(EMPTY_BYOC_FORM);
  const [byocFieldError, setByocFieldError] = useState<"ai" | "r2" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setByocFieldError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/user/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(byoc),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          field?: "ai" | "r2";
        };
        setByocFieldError(data.field ?? null);
        throw new Error(data.error ?? "Failed to save credentials");
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save credentials");
    } finally {
      setLoading(false);
    }
  }

  return { byoc, setByoc, byocFieldError, loading, error, submit };
}
