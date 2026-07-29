"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { X, ExternalLink, FileText, MessageSquare, Briefcase } from "lucide-react";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import type { Application } from "./types";
import { ScoreBadge } from "./shared";
import { OverviewTab } from "./overview-tab";
import { CoverLetterTab } from "./cover-letter-tab";
import { InterviewPrepTab } from "./interview-prep-tab";

interface ApplicationDetailProps {
  applicationId: string | null;
  onClose: () => void;
}

type Tab = "overview" | "cover-letter" | "interview-prep";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Briefcase },
  { id: "cover-letter", label: "Cover Letter", icon: FileText },
  { id: "interview-prep", label: "Interview Prep", icon: MessageSquare },
];

export function ApplicationDetail({ applicationId, onClose }: ApplicationDetailProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [appData, setAppData] = useState<Application | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["application", applicationId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}`);
      return res.json() as Promise<{ application: Application }>;
    },
    enabled: !!applicationId,
  });

  useEffect(() => {
    if (data?.application) setAppData(data.application);
  }, [data]);

  // Reset tab when switching applications
  useEffect(() => {
    setTab("overview");
  }, [applicationId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isMobile = useIsMobileViewport();

  if (!applicationId) return null;

  const app = appData ?? data?.application ?? null;
  const jobTitle = app?.job?.title ?? app?.inlineJobData?.title ?? "Untitled Role";
  const company = app?.job?.company ?? app?.inlineJobData?.company ?? "Unknown Company";

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
          // Mobile: bottom sheet — stop above the bottom tab bar (h-16)
          "fixed bottom-16 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl max-h-[80vh] flex flex-col",
          // Desktop: right side panel — full height, no offset needed
          "md:bottom-0 md:relative md:left-auto md:right-auto md:rounded-none md:border-t-0 md:border-l md:max-h-none md:h-full md:w-[420px] md:shrink-0"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
          <div className="min-w-0">
            {isLoading ? (
              <div className="space-y-1.5">
                <div className="h-4 bg-muted rounded w-40 animate-pulse" />
                <div className="h-3 bg-muted rounded w-24 animate-pulse" />
              </div>
            ) : (
              <>
                <h2 className="font-semibold text-sm text-foreground truncate">{jobTitle}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">{company}</p>
                  {app?.job?.sourceUrl && (
                    <a
                      href={app.job.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {app && (
                  <div className="mt-1.5">
                    <ScoreBadge
                      score={app.job?.evaluation?.overallScore ?? null}
                      recommendation={app.job?.evaluation?.recommendation ?? null}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2",
                tab === id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading || !app ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <OverviewTab
                  app={app}
                  onUpdate={(patch) => setAppData((prev) => (prev ? { ...prev, ...patch } : prev))}
                />
              )}
              {tab === "cover-letter" && (
                <CoverLetterTab
                  applicationId={app.id}
                  initial={app.coverLetter}
                  company={app.job?.company ?? app.inlineJobData?.company}
                />
              )}
              {tab === "interview-prep" && <InterviewPrepTab applicationId={app.id} />}
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
