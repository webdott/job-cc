"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { X, ExternalLink, MapPin, Wifi, DollarSign, Bookmark, Check } from "lucide-react";
import { useState } from "react";

interface JobEvaluation {
  overallScore: number | null;
  recommendation: string | null;
  blockA?: { summary?: string; reason?: string } | null;
  blockB?: { strengths?: string[]; gaps?: string[] } | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  description: string;
  sourceUrl: string;
  salaryMin: number | null;
  salaryMax: number | null;
  fetchedAt: string;
  evaluation: JobEvaluation | null;
}

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
      ? "bg-green-500/15 text-green-400 border-green-500/20"
      : score >= 40
        ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
        : "bg-red-500/15 text-red-400 border-red-500/20";
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-sm font-semibold border", color)}>
      {score}%{recommendation ? ` · ${recommendation}` : ""}
    </span>
  );
}

/**
 * Renders a job description safely.
 * If the stored content contains HTML tags (from Remotive), it was already
 * server-sanitized via sanitize-html before being stored in the DB.
 * We render it with dangerouslySetInnerHTML and apply prose styles.
 * Plain-text sources (HN, Arbeitnow) are rendered as-is.
 */
function JobDescription({ text }: { text: string }) {
  const isHtml = /<[a-z][\s\S]*>/i.test(text);

  if (isHtml) {
    return (
      <div
        className="text-xs text-muted-foreground leading-relaxed job-description-prose"
        // Content was sanitized server-side by sanitize-html before DB storage.
        // Only safe tags (p, ul, ol, li, strong, em, h1-h4, a) are allowed.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }

  return (
    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
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

  if (!job) return null;

  const evaluation = job.evaluation;

  return (
    <>
      {/* Backdrop — mobile only */}
      <div
        className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          // Mobile: bottom sheet
          "fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl max-h-[90vh] flex flex-col",
          // Desktop: right side panel
          "md:relative md:bottom-auto md:left-auto md:right-auto md:rounded-none md:border-t-0 md:border-l md:max-h-none md:h-full md:w-[420px] md:shrink-0"
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
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <JobDescription text={job.description} />
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="p-4 border-t border-border shrink-0">
          <button
            onClick={() => !saved && saveMutation.mutate(job.id)}
            disabled={saved || saveMutation.isPending}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors",
              saved
                ? "bg-green-500/15 text-green-400 border border-green-500/20 cursor-default"
                : "bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white"
            )}
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" />
                Saved to Pipeline
              </>
            ) : saveMutation.isPending ? (
              "Saving…"
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Save to Pipeline
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
