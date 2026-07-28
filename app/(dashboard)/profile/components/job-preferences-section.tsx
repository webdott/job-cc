"use client";

import { cn } from "@/lib/utils";
import { X, CheckCircle, Loader2 } from "lucide-react";
import { Section } from "./section";
import { useJobPreferences } from "./use-job-preferences";
import type { WorkType } from "../types";

export function JobPreferencesSection() {
  const {
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
  } = useJobPreferences();

  return (
    <Section title="Job Preferences">
      <div className="space-y-4">
        {/* Target roles */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Target job titles
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {prefs.targetRoles.map((r) => (
              <span
                key={r}
                className="flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground/80 text-xs rounded-full"
              >
                {r}
                <button onClick={() => removeTag("targetRoles", r)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add a role — press Enter"
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag("targetRoles", roleInput)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Locations */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Locations
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {prefs.locations.map((l) => (
              <span
                key={l}
                className="flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground/80 text-xs rounded-full"
              >
                {l}
                <button onClick={() => removeTag("locations", l)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add a location — press Enter"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag("locations", locationInput)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Salary */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Salary range (USD / year)
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Min"
              value={prefs.salaryMin}
              onChange={(e) => setPrefs((p) => ({ ...p, salaryMin: e.target.value }))}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="Max"
              value={prefs.salaryMax}
              onChange={(e) => setPrefs((p) => ({ ...p, salaryMax: e.target.value }))}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Work type */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Work type
          </label>
          <div className="flex gap-2">
            {(["Remote", "Hybrid", "On-site"] as WorkType[]).map((type) => (
              <button
                key={type}
                onClick={() => toggleWorkType(type)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                  prefs.workType.includes(type)
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                    : "bg-muted border-border text-muted-foreground hover:border-border"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => mutation.mutate(prefs)}
          disabled={mutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="h-4 w-4 text-green-300" />
          ) : null}
          {saved ? "Saved!" : mutation.isPending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </Section>
  );
}
