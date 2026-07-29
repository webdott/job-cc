"use client";

import { cn } from "@/lib/utils";
import { Search, Clock, TrendingUp, Wifi, Plus } from "lucide-react";

export function FiltersBar({
  minScore,
  onMinScoreChange,
  sortBy,
  onSortByChange,
  remoteOnly,
  onToggleRemoteOnly,
  onToggleManual,
}: {
  minScore: number;
  onMinScoreChange: (value: number) => void;
  sortBy: "newest" | "score";
  onSortByChange: (value: "newest" | "score") => void;
  remoteOnly: boolean;
  onToggleRemoteOnly: () => void;
  onToggleManual: () => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
        <Search className="h-4 w-4 text-muted-foreground/70 shrink-0" />
        <span className="text-xs text-muted-foreground shrink-0 w-24">Min score: {minScore}%</span>
        <input
          type="range"
          min={0}
          max={90}
          step={10}
          value={minScore}
          onChange={(e) => onMinScoreChange(Number(e.target.value))}
          className="flex-1 accent-blue-500"
        />
      </div>

      {/* Sort toggle */}
      <div className="flex rounded-lg overflow-hidden border border-border">
        <button
          onClick={() => onSortByChange("newest")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
            sortBy === "newest" ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          <Clock className="h-3 w-3" />
          Newest
        </button>
        <button
          onClick={() => onSortByChange("score")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
            sortBy === "score" ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          <TrendingUp className="h-3 w-3" />
          Best match
        </button>
      </div>

      <button
        onClick={onToggleRemoteOnly}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
          remoteOnly
            ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
            : "bg-muted border-border text-muted-foreground"
        )}
      >
        <Wifi className="h-3.5 w-3.5" />
        Remote
      </button>

      <button
        onClick={onToggleManual}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted border border-border text-muted-foreground transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add manually
      </button>
    </div>
  );
}
