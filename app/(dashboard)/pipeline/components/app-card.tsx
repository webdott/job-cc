"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Wifi,
  ExternalLink,
  Trash2,
  MoreVertical,
  RotateCcw,
  Square,
  CheckSquare,
} from "lucide-react";
import { INACTIVE_STAGES } from "@/lib/stage-constants";
import { INACTIVE_STAGE_IDS, type Application } from "../types";
import { ScoreBadge } from "./score-badge";

export function AppCard({
  app,
  isDragging,
  onDelete,
  onSelect,
  onStageChange,
  isChecked,
  onToggleCheck,
  restoreStageKey = "Applied",
}: {
  app: Application;
  isDragging?: boolean;
  onDelete: (id: string) => void;
  onSelect?: (id: string) => void;
  onStageChange?: (id: string, stage: string) => void;
  isChecked?: boolean;
  onToggleCheck?: (id: string) => void;
  restoreStageKey?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const title = app.job?.title ?? app.inlineJobData?.title ?? "Untitled Role";
  const company = app.job?.company ?? app.inlineJobData?.company ?? "Unknown Company";
  const score = app.job?.evaluation?.overallScore ?? null;
  const isInactive = INACTIVE_STAGE_IDS.includes(app.stage);

  return (
    <div
      onClick={() => onSelect?.(app.id)}
      className={cn(
        "bg-muted border rounded-lg p-3 select-none cursor-pointer hover:border-blue-500/40 transition-colors",
        isChecked ? "border-blue-500/40 bg-blue-500/5" : "border-border",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-start gap-1.5 min-w-0">
          {onToggleCheck && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCheck(app.id);
              }}
              className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-blue-400 transition-colors"
            >
              {isChecked ? (
                <CheckSquare className="h-3.5 w-3.5 text-blue-400" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{company}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isInactive && (
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full text-foreground",
                INACTIVE_STAGES.find((s) => s.key === app.stage)?.color
              )}
            >
              {app.stage}
            </span>
          )}
          <ScoreBadge score={score} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-2">
        {app.job?.location && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <MapPin className="h-2.5 w-2.5 whitespace-nowrap" />
            {app.job.location}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {app.job?.remote && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400">
              <Wifi className="h-2.5 w-2.5" />
              Remote
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {app.job?.sourceUrl && (
            <a
              href={app.job.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {onStageChange && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="p-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <MoreVertical className="h-3 w-3" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                    {isInactive ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStageChange(app.id, restoreStageKey);
                          setMenuOpen(false);
                        }}
                        className="flex items-center gap-1.5 w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                    ) : (
                      INACTIVE_STAGES.map((s) => (
                        <button
                          key={s.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            onStageChange(app.id, s.key);
                            setMenuOpen(false);
                          }}
                          className="block w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                        >
                          Mark as {s.label}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(app.id);
            }}
            className="p-1 rounded text-muted-foreground/50 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
