import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  DiscoverResponse,
  Job,
  JobsResponse,
  ScanProgress,
  ScoreBatchResponse,
} from "./types";

/** Backstop against an unproductive drain loop; the server also caps chunk size. */
const MAX_DRAIN_BATCHES = 200;

const IDLE_PROGRESS: Omit<ScanProgress, "status"> = {
  discovered: 0,
  filtered: 0,
  scored: 0,
  archived: 0,
  queuedAtStart: 0,
  remaining: 0,
};

/** All data fetching, filters, selection, and mutation logic for the Discover job list. */
export function useDiscoverJobs() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [minScore, setMinScore] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "score">("newest");
  const [page, setPage] = useState(1);
  const [manualUrl, setManualUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey: ["jobs", minScore, remoteOnly, showArchived, sortBy, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (minScore > 0) params.set("minScore", String(minScore));
      if (remoteOnly) params.set("remote", "true");
      if (showArchived) params.set("showArchived", "true");
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

  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  /** Set on unmount so an in-flight drain stops issuing requests. */
  const drainCancelled = useRef(false);
  useEffect(() => {
    drainCancelled.current = false;
    return () => {
      drainCancelled.current = true;
    };
  }, []);

  /**
   * Walks the scoring queue in chunks after a scan.
   *
   * The server scores a bounded slice per request so nothing can time out;
   * driving the loop from here is what lets results stream into the list as
   * they land. Abandoning it costs nothing — unscored jobs stay queued and the
   * nightly cron picks them up.
   */
  const runDrain = useCallback(
    async (start: { discovered: number; filtered: number; queuedAtStart: number }) => {
      const { queuedAtStart } = start;
      let scored = 0;
      let archived = 0;
      let remaining = queuedAtStart;

      const progress = (status: ScanProgress["status"], message?: string): ScanProgress => ({
        ...start,
        status,
        scored,
        archived,
        remaining,
        message,
      });

      for (let batch = 0; remaining > 0 && batch < MAX_DRAIN_BATCHES; batch++) {
        if (drainCancelled.current) return;

        let result: ScoreBatchResponse;
        try {
          const res = await fetch("/api/jobs/score-batch", { method: "POST" });
          if (!res.ok) throw new Error(`Scoring failed (${res.status})`);
          result = (await res.json()) as ScoreBatchResponse;
        } catch (err) {
          if (drainCancelled.current) return;
          setScanProgress(progress("error", err instanceof Error ? err.message : "Scoring failed"));
          return;
        }

        if (drainCancelled.current) return;

        scored += result.scored;
        archived += result.archived;
        remaining = result.remaining;

        // Show each chunk's results as soon as they land.
        queryClient.invalidateQueries({ queryKey: ["jobs"] });

        // Nothing moved — the provider is rate-limiting us. Backing off here
        // rather than retrying keeps us from hammering it; the rest of the
        // queue is drained by the nightly cron or the next scan.
        if (result.scored === 0 && result.failed === 0) {
          setScanProgress(
            progress("paused", "Rate limited — the rest will be scored in the background.")
          );
          return;
        }

        setScanProgress(progress("scoring"));
      }

      if (!drainCancelled.current) setScanProgress(progress("done"));
    },
    [queryClient]
  );

  const scanMutation = useMutation<DiscoverResponse>({
    mutationFn: async () => {
      const res = await fetch("/api/jobs/discover", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Scan failed (${res.status})`);
      }
      return res.json() as Promise<DiscoverResponse>;
    },
    onMutate: () => {
      setScanProgress({ ...IDLE_PROGRESS, status: "ingesting" });
    },
    onSuccess: (data) => {
      setPage(1);
      // The rows exist now, just unscored — worth showing immediately.
      queryClient.invalidateQueries({ queryKey: ["jobs"] });

      const start = {
        discovered: data.discovered,
        filtered: data.filtered,
        queuedAtStart: data.remainingToScore,
      };

      if (data.remainingToScore === 0) {
        setScanProgress({ ...IDLE_PROGRESS, ...start, status: "done" });
        return;
      }

      setScanProgress({
        ...IDLE_PROGRESS,
        ...start,
        status: "scoring",
        remaining: data.remainingToScore,
      });
      void runDrain(start);
    },
    onError: (err) => {
      setScanProgress({
        ...IDLE_PROGRESS,
        status: "error",
        message: err instanceof Error ? err.message : "Scan failed",
      });
    },
  });

  /** True for the whole ingest + drain cycle, not just the initial request. */
  const isScanning =
    scanMutation.isPending ||
    scanProgress?.status === "ingesting" ||
    scanProgress?.status === "scoring";

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
    showArchived,
    setShowArchived,
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
    scanProgress,
    isScanning,
    manualMutation,
    deleteMutation,
    bulkDeleteMutation,
    toggleCheck,
    toggleAll,
    handleFilterChange,
  };
}
