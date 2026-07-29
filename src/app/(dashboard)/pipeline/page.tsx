"use client";

import { DndContext, DragOverlay } from "@dnd-kit/core";
import {
  Plus,
  Archive,
  ChevronDown,
  ChevronUp,
  Square,
  CheckSquare,
  Download,
  Trash2,
  X,
  Settings2,
} from "lucide-react";
import { ApplicationDetail } from "@/components/application-detail";
import { StageManager } from "@/components/stage-manager";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { AppCard } from "./components/app-card";
import { KanbanColumn } from "./components/kanban-column";
import { useIsTouchDevice } from "./use-is-touch-device";
import { usePipelineBoard } from "./use-pipeline-board";
import { downloadCsv } from "./csv-export";

export default function PipelinePage() {
  const isTouch = useIsTouchDevice();
  const {
    apps,
    stages,
    isLoading,
    stagesLoading,
    restoreStageKey,
    activeApp,
    selectedAppId,
    setSelectedAppId,
    showInactive,
    setShowInactive,
    checkedIds,
    setCheckedIds,
    managingStages,
    setManagingStages,
    sensors,
    stageMutation,
    deleteMutation,
    bulkDeleteMutation,
    getAppsForStage,
    toggleCheck,
    toggleAll,
    handleDragStart,
    handleDragEnd,
    handlePullRefresh,
    totalActive,
    inactiveApps,
    responseRate,
  } = usePipelineBoard();

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Kanban */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-end justify-between shrink-0 flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Pipeline</h1>
            <p className="text-muted-foreground text-sm">
              {totalActive} active · {responseRate}% response rate
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {inactiveApps.length > 0 && (
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="whitespace-nowrap flex items-center gap-1.5 text-sm bg-muted border border-border hover:border-blue-500/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
              >
                <Archive className="h-4 w-4" />
                Inactive ({inactiveApps.length})
                {showInactive ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {apps.length > 0 && (
              <button
                onClick={() =>
                  downloadCsv(checkedIds.size > 0 ? apps.filter((a) => checkedIds.has(a.id)) : apps)
                }
                className="whitespace-nowrap flex items-center gap-1.5 text-sm bg-muted border border-border hover:border-blue-500/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Export CSV{checkedIds.size > 0 ? ` (${checkedIds.size})` : ""}
              </button>
            )}
            <button
              onClick={() => setManagingStages(true)}
              className="whitespace-nowrap flex items-center gap-1.5 text-sm bg-muted border border-border hover:border-blue-500/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
            >
              <Settings2 className="h-4 w-4" />
              Manage stages
            </button>
            <a
              href="/discover"
              className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add job
            </a>
          </div>
        </div>

        {/* Bulk action bar */}
        {apps.length > 0 && (
          <div className="px-6 py-2 border-b border-border shrink-0 flex items-center justify-between">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {checkedIds.size === apps.length && apps.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-blue-400" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {checkedIds.size === 0 ? "Select all" : `${checkedIds.size} selected`}
            </button>
            {checkedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulkDeleteMutation.mutate(Array.from(checkedIds))}
                  disabled={bulkDeleteMutation.isPending}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {bulkDeleteMutation.isPending ? "Deleting…" : `Delete ${checkedIds.size}`}
                </button>
                <button
                  onClick={() => setCheckedIds(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inactive apps (Ghosted / Withdrawn / Archived) */}
        {showInactive && inactiveApps.length > 0 && (
          <div className="px-6 py-4 border-b border-border shrink-0 bg-card/30">
            <div className="flex gap-3 overflow-x-auto">
              {inactiveApps.map((app) => (
                <div key={app.id} className="min-w-[260px] max-w-[260px]">
                  <AppCard
                    app={app}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onSelect={(id) =>
                      checkedIds.size === 0 && setSelectedAppId((prev) => (prev === id ? null : id))
                    }
                    onStageChange={(id, stage) => stageMutation.mutate({ id, stage })}
                    isChecked={checkedIds.has(app.id)}
                    onToggleCheck={toggleCheck}
                    restoreStageKey={restoreStageKey}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kanban board */}
        {isLoading || stagesLoading ? (
          <div className="flex gap-4 p-6 overflow-x-auto">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="min-w-[260px] space-y-2">
                <div className="h-5 bg-muted rounded w-20 mb-3 animate-pulse" />
                {[1, 2].map((j) => (
                  <div key={j} className="h-20 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <PullToRefresh className="flex-1" onRefresh={handlePullRefresh}>
              <div className="flex gap-4 p-6 pb-[calc(3rem+theme(spacing.safe-bottom))] md:pb-6 overflow-x-auto">
                {stages.map((stage) => (
                  <KanbanColumn
                    key={stage.id}
                    stage={stage}
                    apps={getAppsForStage(stage.key)}
                    allStages={stages}
                    isTouch={isTouch}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onSelect={(id) =>
                      checkedIds.size === 0 && setSelectedAppId((prev) => (prev === id ? null : id))
                    }
                    onStageChange={(id, s) => stageMutation.mutate({ id, stage: s })}
                    checkedIds={checkedIds}
                    onToggleCheck={toggleCheck}
                    restoreStageKey={restoreStageKey}
                  />
                ))}
              </div>
            </PullToRefresh>

            <DragOverlay>
              {activeApp && (
                <div className="rotate-2 opacity-90 w-[260px]">
                  <AppCard app={activeApp} onDelete={() => {}} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Empty state */}
        {!isLoading && apps.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground/70 text-sm mb-2">Your pipeline is empty</p>
              <p className="text-muted-foreground/50 text-xs">
                Go to Discover and save jobs to add them here
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Detail panel — desktop only inline, mobile is a bottom sheet in the component */}
      {selectedAppId && (
        <ApplicationDetail applicationId={selectedAppId} onClose={() => setSelectedAppId(null)} />
      )}

      {managingStages && <StageManager onClose={() => setManagingStages(false)} />}
    </div>
  );
}
