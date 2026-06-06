"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Search, RefreshCw, Bookmark, MapPin, DollarSign, Wifi, Plus } from "lucide-react";

interface JobEvaluation {
  overallScore: number | null;
  recommendation: string | null;
  blockA: { reason?: string } | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  fetchedAt: string;
  evaluation: JobEvaluation | null;
}

interface JobsResponse {
  jobs: Job[];
}

interface DiscoverResponse {
  discovered: number;
  scored: number;
  total: number;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground/70">Unscored</span>;
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-semibold",
        score >= 70
          ? "bg-green-500/15 text-green-400"
          : score >= 40
            ? "bg-yellow-500/15 text-yellow-400"
            : "bg-red-500/15 text-red-400"
      )}
    >
      {score}%
    </span>
  );
}

function JobCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="h-4 bg-slate-700 rounded w-48 mb-2" />
          <div className="h-3 bg-muted rounded w-32" />
        </div>
        <div className="h-6 bg-slate-700 rounded-full w-12" />
      </div>
      <div className="flex gap-2 mt-3">
        <div className="h-3 bg-muted rounded w-24" />
        <div className="h-3 bg-muted rounded w-16" />
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const queryClient = useQueryClient();
  const [minScore, setMinScore] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [showManual, setShowManual] = useState(false);

  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey: ["jobs", minScore, remoteOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (minScore > 0) params.set("minScore", String(minScore));
      const res = await fetch(`/api/jobs?${params}`);
      return res.json() as Promise<JobsResponse>;
    },
  });

  const scanMutation = useMutation<DiscoverResponse>({
    mutationFn: async () => {
      const res = await fetch("/api/jobs/discover", { method: "POST" });
      return res.json() as Promise<DiscoverResponse>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const saveMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, stage: "Saved" }),
      });
      return res.json();
    },
  });

  const manualMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch("/api/jobs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setManualUrl("");
      setShowManual(false);
    },
  });

  const jobs = data?.jobs ?? [];
  const filtered = jobs.filter((j) => {
    if (remoteOnly && !j.remote) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Discover</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} jobs found</p>
        </div>
        <button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4", scanMutation.isPending && "animate-spin")} />
          {scanMutation.isPending ? "Scanning…" : "Scan for jobs"}
        </button>
      </div>

      {/* Scan result toast */}
      {scanMutation.isSuccess && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5 mb-4 text-sm text-green-400">
          Found {scanMutation.data.discovered} new jobs, scored {scanMutation.data.scored} against
          your resume.
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground/70 shrink-0" />
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-muted-foreground shrink-0">Min score: {minScore}%</span>
            <input
              type="range"
              min={0}
              max={90}
              step={10}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
          </div>
        </div>
        <button
          onClick={() => setRemoteOnly((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            remoteOnly
              ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
              : "bg-muted border-border text-muted-foreground hover:border-border"
          )}
        >
          <Wifi className="h-3.5 w-3.5" />
          Remote
        </button>
        <button
          onClick={() => setShowManual((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted border border-border text-muted-foreground hover:border-border transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add manually
        </button>
      </div>

      {/* Manual add */}
      {showManual && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <p className="text-sm text-foreground/80 mb-3">Paste a job URL or description</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://company.com/jobs/..."
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => manualMutation.mutate(manualUrl)}
              disabled={!manualUrl || manualMutation.isPending}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {manualMutation.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* Job list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <JobCardSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              No jobs yet — click &quot;Scan for jobs&quot; to get started.
            </p>
          </div>
        ) : (
          filtered.map((job) => (
            <div
              key={job.id}
              className="bg-card border border-border rounded-xl p-4 hover:border-border transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium text-white text-sm truncate">{job.title}</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">{job.company}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ScoreBadge score={job.evaluation?.overallScore ?? null} />
                  <button
                    onClick={() => saveMutation.mutate(job.id)}
                    className="p-1.5 rounded-lg bg-muted hover:bg-blue-500/20 hover:text-blue-400 text-muted-foreground transition-colors"
                    title="Save to pipeline"
                  >
                    <Bookmark className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2.5 flex-wrap">
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

              {job.evaluation?.blockA?.reason && (
                <p className="mt-2 text-xs text-muted-foreground/70 line-clamp-2">
                  {job.evaluation.blockA.reason}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
