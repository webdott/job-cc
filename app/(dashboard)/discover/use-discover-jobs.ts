import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DiscoverResponse, Job, JobsResponse } from "./types";

/** All data fetching, filters, selection, and mutation logic for the Discover job list. */
export function useDiscoverJobs() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [minScore, setMinScore] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "score">("newest");
  const [page, setPage] = useState(1);
  const [manualUrl, setManualUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey: ["jobs", minScore, remoteOnly, sortBy, page],
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

  // Deep-link support: ?jobId=... opens the detail panel directly (e.g. from the home dashboard)
  const linkedJobId = searchParams.get("jobId");

  const { data: linkedJobData } = useQuery<{ job: Job }>({
    queryKey: ["job", linkedJobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${linkedJobId}`);
      return res.json() as Promise<{ job: Job }>;
    },
    enabled: !!linkedJobId,
  });

  useEffect(() => {
    if (!linkedJobId) return;
    const fromList = data?.jobs.find((j) => j.id === linkedJobId);
    if (fromList) {
      setSelectedJob(fromList);
    } else if (linkedJobData?.job) {
      setSelectedJob(linkedJobData.job);
    }
  }, [linkedJobId, data, linkedJobData]);

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

  const jobs = data?.jobs ?? [];

  function toggleCheck(e: React.MouseEvent, id: string) {
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
  }

  function toggleAll() {
    setCheckedIds(checkedIds.size === jobs.length ? new Set() : new Set(jobs.map((j) => j.id)));
  }

  const handleFilterChange = useCallback((fn: () => void) => {
    fn();
    setPage(1);
  }, []);

  function markSaved(id: string) {
    setSavedJobIds((prev) => new Set(prev).add(id));
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return {
    jobs,
    total,
    totalPages,
    isLoading,
    minScore,
    setMinScore,
    remoteOnly,
    setRemoteOnly,
    sortBy,
    setSortBy,
    page,
    setPage,
    manualUrl,
    setManualUrl,
    showManual,
    setShowManual,
    selectedJob,
    setSelectedJob,
    savedJobIds,
    markSaved,
    checkedIds,
    setCheckedIds,
    scanMutation,
    manualMutation,
    deleteMutation,
    bulkDeleteMutation,
    toggleCheck,
    toggleAll,
    handleFilterChange,
  };
}
