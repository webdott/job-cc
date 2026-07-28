"use client";

import { cn } from "@/lib/utils";
import { X, ChevronRight, Loader2 } from "lucide-react";
import { usePreferencesStep } from "./use-preferences-step";
import type { WorkType } from "../types";

export function StepPreferences({ onComplete }: { onComplete: () => void }) {
  const {
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
  } = usePreferencesStep(onComplete);

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-1">Job preferences</h2>
      <p className="text-muted-foreground text-sm mb-6">Tell us what you&apos;re looking for.</p>

      <div className="space-y-5">
        {/* Target roles */}
        <div>
          <label className="block text-xs font-medium text-foreground/80 mb-1.5">
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
            placeholder="e.g. Senior Frontend Engineer — press Enter"
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag("targetRoles", roleInput)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Locations */}
        <div>
          <label className="block text-xs font-medium text-foreground/80 mb-1.5">Locations</label>
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
            placeholder='e.g. "Remote" or "London" — press Enter'
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag("locations", locationInput)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Salary */}
        <div>
          <label className="block text-xs font-medium text-foreground/80 mb-1.5">
            Salary range (USD / year)
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Min"
              value={prefs.salaryMin}
              onChange={(e) => setPrefs((p) => ({ ...p, salaryMin: e.target.value }))}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="Max"
              value={prefs.salaryMax}
              onChange={(e) => setPrefs((p) => ({ ...p, salaryMax: e.target.value }))}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Work type */}
        <div>
          <label className="block text-xs font-medium text-foreground/80 mb-1.5">Work type</label>
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
      </div>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Saving…" : "Continue"}
        {!loading && <ChevronRight className="h-4 w-4" />}
      </button>
    </div>
  );
}
