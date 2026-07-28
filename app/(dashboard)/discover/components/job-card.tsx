"use client";

import { cn } from "@/lib/utils";
import { MapPin, Wifi, DollarSign, Trash2, CheckSquare, Square } from "lucide-react";
import type { Job } from "../types";
import { ScoreBadge } from "./score-badge";

export function JobCard({
  job,
  isSaved,
  isSelected,
  isChecked,
  deleteDisabled,
  onSelect,
  onToggleCheck,
  onDelete,
}: {
  job: Job;
  isSaved: boolean;
  isSelected: boolean;
  isChecked: boolean;
  deleteDisabled: boolean;
  onSelect: () => void;
  onToggleCheck: (e: React.MouseEvent) => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "bg-card border rounded-xl p-4 cursor-pointer transition-colors",
        isChecked
          ? "border-blue-500/40 bg-blue-500/5"
          : isSelected
            ? "border-blue-500/40 ring-1 ring-blue-500/10"
            : "border-border hover:border-blue-500/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={onToggleCheck}
            className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-blue-400 transition-colors"
          >
            {isChecked ? (
              <CheckSquare className="h-4 w-4 text-blue-400" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
          <div className="min-w-0">
            <h3 className="font-medium text-foreground text-sm truncate">{job.title}</h3>
            <p className="text-muted-foreground text-xs mt-0.5">{job.company}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreBadge score={job.evaluation?.overallScore ?? null} />
          {isSaved && (
            <span className="text-[10px] text-green-400 font-medium px-1.5 py-0.5 bg-green-500/10 rounded-full">
              Saved
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={deleteDisabled}
            className="p-1 rounded text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete job"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {job.location && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
            <MapPin className="h-3 w-3" />
            {job.location}
          </span>
        )}
        {job.remote && (
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <Wifi className="h-3 w-3" />
            Remote
          </span>
        )}
        {(job.salaryMin || job.salaryMax) && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
            <DollarSign className="h-3 w-3" />
            {job.salaryMin && `$${(job.salaryMin / 1000).toFixed(0)}k`}
            {job.salaryMin && job.salaryMax && "–"}
            {job.salaryMax && `$${(job.salaryMax / 1000).toFixed(0)}k`}
          </span>
        )}
      </div>

      {/* AI snippet — hidden when panel is open */}
      {job.evaluation?.blockA?.reason && !isSelected && (
        <p className="mt-2 text-xs text-muted-foreground/60 line-clamp-1">
          {job.evaluation.blockA.reason}
        </p>
      )}
    </div>
  );
}
