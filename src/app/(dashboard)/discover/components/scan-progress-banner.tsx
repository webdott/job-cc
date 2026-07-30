"use client";

import { AlertCircle, CheckCircle2, Loader2, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScanProgress } from "../types";

/**
 * Progress for the ingest + drain cycle.
 *
 * A scan no longer finishes in one request — ingestion returns immediately and
 * scoring is drained in chunks — so the UI has to show the queue emptying
 * rather than a single "done" message.
 */
export function ScanProgressBanner({ progress }: { progress: ScanProgress }) {
  const { status, discovered, scored, queuedAtStart, remaining } = progress;

  const tone =
    status === "error"
      ? "bg-destructive/10 border-destructive/20 text-destructive"
      : status === "done"
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
        : status === "paused"
          ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
          : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400";

  const percent = queuedAtStart > 0 ? Math.round((scored / queuedAtStart) * 100) : 0;

  return (
    <div className={cn("rounded-lg border px-4 py-2.5 mb-4 text-sm", tone)}>
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <span className="min-w-0">{describe(progress)}</span>
      </div>

      {status === "scoring" && queuedAtStart > 0 && (
        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-current/20"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={queuedAtStart}
          aria-valuenow={scored}
          aria-label={`Scored ${scored} of ${queuedAtStart} jobs`}
        >
          <div
            className="h-full rounded-full bg-current transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {status === "paused" && remaining > 0 && (
        <p className="mt-1 text-xs opacity-80">
          {remaining} job{remaining !== 1 ? "s" : ""} still queued. Nothing is lost — they&apos;ll
          be scored overnight or on your next scan.
        </p>
      )}

      {discovered === 0 && status === "done" && (
        <p className="mt-1 text-xs opacity-80">No new listings since your last scan.</p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: ScanProgress["status"] }) {
  switch (status) {
    case "ingesting":
    case "scoring":
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />;
    case "done":
      return <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />;
    case "paused":
      return <PauseCircle className="h-4 w-4 shrink-0" aria-hidden />;
    case "error":
      return <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />;
  }
}

function describe({ status, discovered, scored, queuedAtStart, message }: ScanProgress): string {
  const found = `Found ${discovered} new job${discovered !== 1 ? "s" : ""}`;

  switch (status) {
    case "ingesting":
      return "Checking job sources…";
    case "scoring":
      return `${found} · scoring ${scored}/${queuedAtStart} against your resume`;
    case "done":
      return scored > 0 ? `${found} · scored ${scored} against your resume` : found;
    case "paused":
      return message ?? `${found} · scoring paused`;
    case "error":
      return message ?? "Scan failed";
  }
}
