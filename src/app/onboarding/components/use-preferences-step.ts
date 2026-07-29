import { useState } from "react";
import { EMPTY_PREFERENCES, type Preferences, type WorkType } from "../types";

export function usePreferencesStep(onComplete: () => void) {
  const [prefs, setPrefs] = useState<Preferences>(EMPTY_PREFERENCES);
  const [roleInput, setRoleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addTag(field: "targetRoles" | "locations", value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPrefs((p) => ({ ...p, [field]: [...p[field], trimmed] }));
    if (field === "targetRoles") setRoleInput("");
    else setLocationInput("");
  }

  function removeTag(field: "targetRoles" | "locations", val: string) {
    setPrefs((p) => ({ ...p, [field]: p[field].filter((t) => t !== val) }));
  }

  function toggleWorkType(type: WorkType) {
    setPrefs((p) => ({
      ...p,
      workType: p.workType.includes(type)
        ? p.workType.filter((t) => t !== type)
        : [...p.workType, type],
    }));
  }

  async function submit() {
    setLoading(true);
    try {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      onComplete();
    } catch {
      setError("Failed to save preferences");
    } finally {
      setLoading(false);
    }
  }

  return {
    prefs,
    setPrefs,
    roleInput,
    setRoleInput,
    locationInput,
    setLocationInput,
    loading,
    error,
    addTag,
    removeTag,
    toggleWorkType,
    submit,
  };
}
