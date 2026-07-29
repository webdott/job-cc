"use client";

import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { RefreshCw, Search } from "lucide-react";
import { JobDetailSheet } from "@/components/job-detail-sheet";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useDiscoverJobs } from "./use-discover-jobs";
import { JobCardSkeleton } from "./components/job-card-skeleton";
import { JobCard } from "./components/job-card";
import { FiltersBar } from "./components/filters-bar";
import { ManualAdd } from "./components/manual-add";
import { BulkActionBar } from "./components/bulk-action-bar";
import { Pagination } from "./components/pagination";

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      }
    >
      <DiscoverPageContent />
    </Suspense>
  );
}

function DiscoverPageContent() {
  const {
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
  } = useDiscoverJobs();

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Job list */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <PullToRefresh
          className="flex-1"
          onRefresh={async () => {
            await scanMutation.mutateAsync().catch(() => {});
          }}
        >
          <div className="p-4 pb-[calc(3rem+theme(spacing.safe-bottom))] md:p-6 md:pb-6 max-w-3xl mx-auto">
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

            <FiltersBar
              minScore={minScore}
              onMinScoreChange={(v) => handleFilterChange(() => setMinScore(v))}
              sortBy={sortBy}
              onSortByChange={(v) => handleFilterChange(() => setSortBy(v))}
              remoteOnly={remoteOnly}
              onToggleRemoteOnly={() => handleFilterChange(() => setRemoteOnly((v) => !v))}
              onToggleManual={() => setShowManual((v) => !v)}
            />

            {showManual && (
              <ManualAdd
                url={manualUrl}
                onUrlChange={setManualUrl}
                onSubmit={() => manualMutation.mutate(manualUrl)}
                pending={manualMutation.isPending}
              />
            )}

            {jobs.length > 0 && (
              <BulkActionBar
                total={jobs.length}
                checkedCount={checkedIds.size}
                onToggleAll={toggleAll}
                onDelete={() => bulkDeleteMutation.mutate(Array.from(checkedIds))}
                onClear={() => setCheckedIds(new Set())}
                deletePending={bulkDeleteMutation.isPending}
              />
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
                jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isSaved={savedJobIds.has(job.id)}
                    isSelected={selectedJob?.id === job.id}
                    isChecked={checkedIds.has(job.id)}
                    deleteDisabled={deleteMutation.isPending}
                    onSelect={() =>
                      checkedIds.size === 0 &&
                      setSelectedJob((prev) => (prev?.id === job.id ? null : job))
                    }
                    onToggleCheck={(e) => toggleCheck(e, job.id)}
                    onDelete={() => deleteMutation.mutate(job.id)}
                  />
                ))
              )}
            </div>

            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </div>
        </PullToRefresh>
      </div>

      {/* Right: Job detail panel */}
      {selectedJob && (
        <JobDetailSheet
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          savedJobIds={savedJobIds}
          onSave={markSaved}
        />
      )}
    </div>
  );
}
