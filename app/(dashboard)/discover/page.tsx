"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Search,
  RefreshCw,
  MapPin,
  DollarSign,
  Wifi,
  Plus,
  Clock,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { JobDetailSheet } from "@/components/job-detail-sheet";

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
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  sourceUrl: string;
  fetchedAt: string;
  evaluation: JobEvaluation | null;
}

interface JobsResponse {
  jobs: Job[];
  hasMore: boolean;
  total: number;
  page: number;
}

interface DiscoverResponse {
  discovered: number;
  scored: number;
  total: number;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground/60">Unscored</span>;
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
          <div className="h-4 bg-muted rounded w-48 mb-2" />
          <div className="h-3 bg-muted rounded w-32" />
        </div>
        <div className="h-6 bg-muted rounded-full w-12" />
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
  const [sortBy, setSortBy] = useState<"newest" | "score">("newest");
  const [page, setPage] = useState(1);
  const [manualUrl, setManualUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const queryKey = ["jobs", minScore, remoteOnly, sortBy, page];

  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (minScore > 0) params.set("minScore", String(minScore));
      if (remoteOnly) params.set("remote", "true");
      params.set("sortBy", sortBy);
      params.set("page", String(page));
      const res = await fetch(`/api/jobs?${params}`);
      return res.json() as Promise<JobsResponse>;
    },
  });

  const scanMutation = useMutation<DiscoverResponse>({
    mutationFn: async () => {
      const res = await fetch("/api/jobs/discover", { method: "POST" });
      return res.json() as Promise<DiscoverResponse>;
    },
    onSuccess: () => {
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
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
      setPage(1);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch("/api/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    onSuccess: (_data, id) => {
      if (selectedJob?.id === id) setSelectedJob(null);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) =>
          fetch("/api/jobs", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          })
        )
      );
    },
    onSuccess: () => {
      if (selectedJob && checkedIds.has(selectedJob.id)) setSelectedJob(null);
      setCheckedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const toggleCheck = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === jobs.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(jobs.map((j) => j.id)));
    }
  };

  const handleFilterChange = useCallback((fn: () => void) => {
    fn();
    setPage(1);
  }, []);

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Job list */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Discover</h1>
                <p className="text-muted-foreground text-sm">
                  {total > 0 ? `${total} job${total !== 1 ? "s" : ""} found` : "No jobs yet"}
                </p>
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

            {/* Scan result */}
            {scanMutation.isSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5 mb-4 text-sm text-green-400">
                Found {scanMutation.data.discovered} new jobs, scored {scanMutation.data.scored}{" "}
                against your resume.
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <Search className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0 w-24">
                  Min score: {minScore}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={10}
                  value={minScore}
                  onChange={(e) => handleFilterChange(() => setMinScore(Number(e.target.value)))}
                  className="flex-1 accent-blue-500"
                />
              </div>

              {/* Sort toggle */}
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => handleFilterChange(() => setSortBy("newest"))}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    sortBy === "newest"
                      ? "bg-blue-500 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Clock className="h-3 w-3" />
                  Newest
                </button>
                <button
                  onClick={() => handleFilterChange(() => setSortBy("score"))}
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
                onClick={() => handleFilterChange(() => setRemoteOnly((v) => !v))}
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
                onClick={() => setShowManual((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted border border-border text-muted-foreground transition-colors"
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
                    placeholder="https://company.com/jobs/…"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-blue-500"
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

            {/* Bulk action bar */}
            {jobs.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {checkedIds.size === jobs.length && jobs.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-blue-400" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {checkedIds.size === 0 ? "Select all" : `${checkedIds.size} selected`}
                </button>
                {checkedIds.size > 0 && (
                  <button
                    onClick={() => bulkDeleteMutation.mutate(Array.from(checkedIds))}
                    disabled={bulkDeleteMutation.isPending}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {bulkDeleteMutation.isPending ? "Deleting…" : `Delete ${checkedIds.size}`}
                  </button>
                )}
                {checkedIds.size > 0 && (
                  <button
                    onClick={() => setCheckedIds(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {/* Job list */}
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <JobCardSkeleton key={i} />)
              ) : jobs.length === 0 ? (
                <div className="text-center py-16">
                  <Search className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No jobs yet — click &quot;Scan for jobs&quot; to get started.
                  </p>
                </div>
              ) : (
                jobs.map((job) => {
                  const isSaved = savedJobIds.has(job.id);
                  const isSelected = selectedJob?.id === job.id;
                  return (
                    <div
                      key={job.id}
                      onClick={() =>
                        checkedIds.size === 0 &&
                        setSelectedJob((prev) => (prev?.id === job.id ? null : job))
                      }
                      className={cn(
                        "bg-card border rounded-xl p-4 cursor-pointer transition-colors",
                        checkedIds.has(job.id)
                          ? "border-blue-500/40 bg-blue-500/5"
                          : isSelected
                            ? "border-blue-500/40 ring-1 ring-blue-500/10"
                            : "border-border hover:border-blue-500/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <button
                            onClick={(e) => toggleCheck(e, job.id)}
                            className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-blue-400 transition-colors"
                          >
                            {checkedIds.has(job.id) ? (
                              <CheckSquare className="h-4 w-4 text-blue-400" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <h3 className="font-medium text-foreground text-sm truncate">
                              {job.title}
                            </h3>
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
                              deleteMutation.mutate(job.id);
                            }}
                            disabled={deleteMutation.isPending}
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
                })
              )}
            </div>

            {/* Pagination */}
            {total > 20 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} · {total} jobs total
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
                          p === page
                            ? "bg-blue-500 text-white"
                            : "bg-muted border border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Job detail panel */}
      {selectedJob && (
        <JobDetailSheet
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          savedJobIds={savedJobIds}
          onSave={(id) =>
            setSavedJobIds((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            })
          }
        />
      )}
    </div>
  );
}
