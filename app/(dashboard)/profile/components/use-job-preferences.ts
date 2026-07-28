import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Preferences, PreferencesResponse, WorkType } from "../types";

const EMPTY_PREFERENCES: Preferences = {
  targetRoles: [],
  locations: [],
  salaryMin: "",
  salaryMax: "",
  workType: [],
};

/** Shares the `["user-preferences"]` query cache with useNotificationPreferences — one fetch, two consumers. */
export function useJobPreferences() {
  const [prefs, setPrefs] = useState<Preferences>(EMPTY_PREFERENCES);
  const [roleInput, setRoleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [saved, setSaved] = useState(false);

  const { data } = useQuery<PreferencesResponse>({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/user/preferences");
      return res.json() as Promise<PreferencesResponse>;
    },
  });

  useEffect(() => {
    if (!data?.preferences) return;
    setPrefs({
      targetRoles: data.preferences.targetRoles ?? [],
      locations: data.preferences.locations ?? [],
      salaryMin: data.preferences.salaryMin ?? "",
      salaryMax: data.preferences.salaryMax ?? "",
      workType: data.preferences.workType ?? [],
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (p: Preferences) => {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

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

  return {
    prefs,
    setPrefs,
    roleInput,
    setRoleInput,
    locationInput,
    setLocationInput,
    saved,
    mutation,
    addTag,
    removeTag,
    toggleWorkType,
  };
}
