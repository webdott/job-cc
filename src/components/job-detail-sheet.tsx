"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  X,
  ExternalLink,
  MapPin,
  Wifi,
  DollarSign,
  Bookmark,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { useState } from "react";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { JobDescription } from "@/components/application-detail/shared";
import type { ClientJob as Job } from "@/types/client";

interface JobDetailSheetProps {
  job: Job | null;
  onClose: () => void;
  savedJobIds: Set<string>;
  onSave: (jobId: string) => void;
}

function ScoreBadge({
  score,
  recommendation,
}: {
  score: number | null;
  recommendation: string | null;
}) {
  if (score === null) return <span className="text-xs text-muted-foreground/60">Unscored</span>;
  const color =
    score >= 70
      ? "bg-green-600/15 text-green-700 border-green-600/20 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20"
      : score >= 40
        ? "bg-yellow-600/15 text-yellow-700 border-yellow-600/20 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20"
        : "bg-red-600/15 text-red-700 border-red-600/20 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20";
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-sm font-semibold border", color)}>
      {score}%{recommendation ? ` · ${recommendation}` : ""}
    </span>
  );
}

export function JobDetailSheet({ job, onClose, savedJobIds, onSave }: JobDetailSheetProps) {
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  // Reset saved state when job changes
  useEffect(() => {
    if (job) setSaved(savedJobIds.has(job.id));
  }, [job, savedJobIds]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const saveMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, stage: "Saved" }),
      });
      return res.json();
    },
    onSuccess: (_, jobId) => {
      setSaved(true);
      onSave(jobId);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const isMobile = useIsMobileViewport();

  if (!job) return null;

  const evaluation = job.evaluation;

  return (
    <>
      {/* Backdrop — mobile only */}
      <div
        className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — slides up from the bottom on mobile (bottom sheet), in from
          the right on desktop (side panel), matching each layout's own CSS positioning above. */}
      <motion.div
        initial={isMobile ? { opacity: 1, y: "100%" } : { opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={isMobile ? { opacity: 1, y: "100%" } : { opacity: 0, x: 40 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          // Mobile: bottom sheet — stop above the bottom tab bar (h-16 + inset)
          "fixed bottom-[calc(4rem+var(--app-bottom-inset,env(safe-area-inset-bottom,0px)))] left-0 right-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl border-t border-border bg-card",
          // Desktop: right side panel — full height, no offset needed
          "md:relative md:bottom-0 md:left-auto md:right-auto md:h-full md:max-h-none md:w-[420px] md:shrink-0 md:rounded-none md:border-l md:border-t-0"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="font-semibold text-sm text-foreground">{job.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>

            {/* Meta */}
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

            {/* Score */}
            <div className="mt-2">
              <ScoreBadge
                score={evaluation?.overallScore ?? null}
                recommendation={evaluation?.recommendation ?? null}
              />
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
              title="View original posting"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* AI Match Analysis */}
          {evaluation && (evaluation.overallScore !== null || evaluation.blockB) && (
            <div className="bg-muted/40 border border-border rounded-xl p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Match Analysis
              </p>

              {evaluation.blockA?.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {evaluation.blockA.summary}
                </p>
              )}
              {evaluation.blockA?.reason && !evaluation.blockA?.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {evaluation.blockA.reason}
                </p>
              )}

              {evaluation.blockB && (
                <div className="grid grid-cols-2 gap-3">
                  {(evaluation.blockB.strengths ?? []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-green-400 mb-1.5">Strengths</p>
                      <ul className="space-y-1">
                        {(evaluation.blockB.strengths ?? []).slice(0, 4).map((s, i) => (
                          <li key={i} className="text-xs text-muted-foreground">
                            ✓ {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(evaluation.blockB.gaps ?? []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-yellow-400 mb-1.5">Gaps</p>
                      <ul className="space-y-1">
                        {(evaluation.blockB.gaps ?? []).slice(0, 4).map((g, i) => (
                          <li key={i} className="text-xs text-muted-foreground">
                            △ {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Job Description */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Job Description
            </p>
            <div className="border border-border rounded-xl p-4 bg-transparent">
              <JobDescription text={job.description} />
            </div>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="p-4 border-t border-border shrink-0 flex gap-2">
          {/* Save to pipeline */}
          <button
            onClick={() => !saved && saveMutation.mutate(job.id)}
            disabled={saved || saveMutation.isPending}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors",
              saved
                ? "bg-green-500/15 text-green-400 border border-green-500/20 cursor-default"
                : "bg-muted border border-border hover:border-blue-500/40 text-foreground disabled:opacity-60"
            )}
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" />
                Saved
              </>
            ) : saveMutation.isPending ? (
              "Saving…"
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Save
              </>
            )}
          </button>

          {/* Apply — opens the original job posting */}
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            <ArrowUpRight className="h-4 w-4" />
            Apply
          </a>
        </div>
      </motion.div>
    </>
  );
}
