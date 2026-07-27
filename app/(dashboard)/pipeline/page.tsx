"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/haptics";
import {
  MapPin,
  Wifi,
  GripVertical,
  ExternalLink,
  Trash2,
  Plus,
  MoreVertical,
  Archive,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Square,
  CheckSquare,
  Download,
  X,
  Settings2,
} from "lucide-react";
import { ApplicationDetail } from "@/components/application-detail";
import { StageManager } from "@/components/stage-manager";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { INACTIVE_STAGES, INACTIVE_STAGE_KEYS } from "@/lib/stage-constants";

// Coarse pointer (touch) detection — gates swipe-to-move so mouse users on
// desktop keep the existing drag-handle-only interaction untouched.
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(
      typeof window !== "undefined" &&
        (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0)
    );
  }, []);
  return isTouch;
}

function csvField(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function applicationsToCsv(apps: Application[]) {
  const header = [
    "Title",
    "Company",
    "Stage",
    "Location",
    "Remote",
    "Score",
    "Applied Date",
    "Last Activity",
    "Source URL",
  ];
  const rows = apps.map((a) => {
    const title = a.job?.title ?? a.inlineJobData?.title ?? "";
    const company = a.job?.company ?? a.inlineJobData?.company ?? "";
    const score = a.job?.evaluation?.overallScore;
    return [
      title,
      company,
      a.stage,
      a.job?.location ?? "",
      a.job?.remote ? "Yes" : "No",
      score != null ? String(score) : "",
      new Date(a.createdAt).toISOString().slice(0, 10),
      new Date(a.lastActivityAt).toISOString().slice(0, 10),
      a.job?.sourceUrl ?? "",
    ].map(csvField);
  });
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function downloadCsv(apps: Application[]) {
  const blob = new Blob([applicationsToCsv(apps)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pipeline-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Stage {
  id: string;
  key: string;
  label: string;
  color: string;
  position: number;
}

interface StagesResponse {
  stages: Stage[];
}

const INACTIVE_STAGE_IDS: readonly string[] = INACTIVE_STAGE_KEYS;

interface Evaluation {
  overallScore: number | null;
  recommendation: string | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  sourceUrl: string;
  evaluation: Evaluation | null;
}

interface Application {
  id: string;
  stage: string;
  createdAt: string;
  lastActivityAt: string;
  job: Job | null;
  inlineJobData: { title?: string; company?: string } | null;
}

interface ApplicationsResponse {
  applications: Application[];
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  return (
    <span
      className={cn(
        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
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

function AppCard({
  app,
  isDragging,
  onDelete,
  onSelect,
  onStageChange,
  isChecked,
  onToggleCheck,
  restoreStageKey = "Applied",
}: {
  app: Application;
  isDragging?: boolean;
  onDelete: (id: string) => void;
  onSelect?: (id: string) => void;
  onStageChange?: (id: string, stage: string) => void;
  isChecked?: boolean;
  onToggleCheck?: (id: string) => void;
  restoreStageKey?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const title = app.job?.title ?? app.inlineJobData?.title ?? "Untitled Role";
  const company = app.job?.company ?? app.inlineJobData?.company ?? "Unknown Company";
  const score = app.job?.evaluation?.overallScore ?? null;
  const isInactive = INACTIVE_STAGE_IDS.includes(app.stage);

  return (
    <div
      onClick={() => onSelect?.(app.id)}
      className={cn(
        "bg-muted border rounded-lg p-3 select-none cursor-pointer hover:border-blue-500/40 transition-colors",
        isChecked ? "border-blue-500/40 bg-blue-500/5" : "border-border",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-start gap-1.5 min-w-0">
          {onToggleCheck && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCheck(app.id);
              }}
              className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-blue-400 transition-colors"
            >
              {isChecked ? (
                <CheckSquare className="h-3.5 w-3.5 text-blue-400" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{company}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isInactive && (
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white",
                INACTIVE_STAGES.find((s) => s.key === app.stage)?.color
              )}
            >
              {app.stage}
            </span>
          )}
          <ScoreBadge score={score} />
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {app.job?.location && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
              <MapPin className="h-2.5 w-2.5" />
              {app.job.location}
            </span>
          )}
          {app.job?.remote && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400">
              <Wifi className="h-2.5 w-2.5" />
              Remote
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {app.job?.sourceUrl && (
            <a
              href={app.job.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {onStageChange && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="p-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <MoreVertical className="h-3 w-3" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                    {isInactive ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStageChange(app.id, restoreStageKey);
                          setMenuOpen(false);
                        }}
                        className="flex items-center gap-1.5 w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                    ) : (
                      INACTIVE_STAGES.map((s) => (
                        <button
                          key={s.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            onStageChange(app.id, s.key);
                            setMenuOpen(false);
                          }}
                          className="block w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                        >
                          Mark as {s.label}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(app.id);
            }}
            className="p-1 rounded text-muted-foreground/50 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableCard({
  app,
  onDelete,
  onSelect,
  onStageChange,
  isChecked,
  onToggleCheck,
  restoreStageKey,
}: {
  app: Application;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: string) => void;
  isChecked: boolean;
  onToggleCheck: (id: string) => void;
  restoreStageKey: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
      <div className="pl-1">
        <AppCard
          app={app}
          isDragging={isDragging}
          onDelete={onDelete}
          onSelect={onSelect}
          onStageChange={onStageChange}
          isChecked={isChecked}
          onToggleCheck={onToggleCheck}
          restoreStageKey={restoreStageKey}
        />
      </div>
    </div>
  );
}

// Swipe distance (px) needed to commit a stage move. Below this it springs
// back to center — a deliberate flick, not an accidental brush.
const SWIPE_THRESHOLD = 90;

// Touch-only alternative to the desktop grip-handle drag: swipe a card left
// or right to move it to the previous/next Kanban column. The grip handle
// relies on `group-hover` to reveal itself, which touch input never
// triggers, so without this, touch users have no way to change a card's
// stage except the "..." menu (only offered for the inactive statuses).
function SwipeableCard({
  app,
  prevStage,
  nextStage,
  onSwipe,
  children,
}: {
  app: Application;
  prevStage: Stage | null;
  nextStage: Stage | null;
  onSwipe: (id: string, stage: string) => void;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const nextOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const prevOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);

  if (!prevStage && !nextStage) return <>{children}</>;

  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.x >= SWIPE_THRESHOLD && nextStage) {
      vibrate();
      onSwipe(app.id, nextStage.key);
    } else if (info.offset.x <= -SWIPE_THRESHOLD && prevStage) {
      vibrate();
      onSwipe(app.id, prevStage.key);
    }
  }

  return (
    <div className="relative">
      {nextStage && (
        <motion.div
          style={{ opacity: nextOpacity }}
          className="absolute inset-0 flex items-center justify-end pr-4 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-medium"
        >
          {nextStage.label} →
        </motion.div>
      )}
      {prevStage && (
        <motion.div
          style={{ opacity: prevOpacity }}
          className="absolute inset-0 flex items-center justify-start pl-4 rounded-lg bg-muted text-muted-foreground text-xs font-medium"
        >
          ← {prevStage.label}
        </motion.div>
      )}
      <motion.div
        drag="x"
        style={{ x, touchAction: "pan-y" }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={handleDragEnd}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
}

function KanbanColumn({
  stage,
  apps,
  allStages,
  isTouch,
  onDelete,
  onSelect,
  onStageChange,
  checkedIds,
  onToggleCheck,
  restoreStageKey,
}: {
  stage: Stage;
  apps: Application[];
  allStages: Stage[];
  isTouch: boolean;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: string) => void;
  checkedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  restoreStageKey: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });

  const stageIndex = allStages.findIndex((s) => s.key === stage.key);
  const prevStage = stageIndex > 0 ? allStages[stageIndex - 1] : null;
  const nextStage =
    stageIndex >= 0 && stageIndex < allStages.length - 1 ? allStages[stageIndex + 1] : null;

  return (
    <div className="flex flex-col min-w-[260px] max-w-[260px]">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full shrink-0", stage.color)} />
          <span className="text-sm font-medium text-foreground/80">{stage.label}</span>
        </div>
        <span className="text-xs text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded-full">
          {apps.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[400px] rounded-xl p-2 space-y-2 transition-colors",
          isOver ? "bg-muted/80 ring-1 ring-blue-500/30" : "bg-card/50"
        )}
      >
        <SortableContext items={apps.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          {apps.map((app) => {
            const card = (
              <SortableCard
                key={app.id}
                app={app}
                onDelete={onDelete}
                onSelect={onSelect}
                onStageChange={onStageChange}
                isChecked={checkedIds.has(app.id)}
                onToggleCheck={onToggleCheck}
                restoreStageKey={restoreStageKey}
              />
            );
            if (!isTouch) return card;
            return (
              <SwipeableCard
                key={app.id}
                app={app}
                prevStage={prevStage}
                nextStage={nextStage}
                onSwipe={onStageChange}
              >
                {card}
              </SwipeableCard>
            );
          })}
        </SortableContext>

        {apps.length === 0 && (
          <div className="flex items-center justify-center h-20 text-slate-700 text-xs">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [managingStages, setManagingStages] = useState(false);
  const isTouch = useIsTouchDevice();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data, isLoading } = useQuery<ApplicationsResponse>({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications");
      return res.json() as Promise<ApplicationsResponse>;
    },
  });

  async function handlePullRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["applications"] }),
      queryClient.invalidateQueries({ queryKey: ["stages"] }),
    ]);
  }

  const { data: stagesData, isLoading: stagesLoading } = useQuery<StagesResponse>({
    queryKey: ["stages"],
    queryFn: async () => {
      const res = await fetch("/api/stages");
      return res.json() as Promise<StagesResponse>;
    },
  });

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      return res.json();
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["applications"] });
      const prev = queryClient.getQueryData<ApplicationsResponse>(["applications"]);
      queryClient.setQueryData<ApplicationsResponse>(["applications"], (old) => {
        if (!old) return old;
        return {
          applications: old.applications.map((a) => (a.id === id ? { ...a, stage } : a)),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["applications"], context.prev);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/applications/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => fetch(`/api/applications/${id}`, { method: "DELETE" })));
    },
    onSuccess: () => {
      if (selectedAppId && checkedIds.has(selectedAppId)) setSelectedAppId(null);
      setCheckedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const apps = data?.applications ?? [];
  const stages = stagesData?.stages ?? [];
  const restoreStageKey = stages[0]?.key ?? "Applied";

  function getAppsForStage(stageId: string) {
    return apps.filter((a) => a.stage === stageId);
  }

  function toggleCheck(id: string) {
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
    setCheckedIds((prev) =>
      prev.size === apps.length ? new Set() : new Set(apps.map((a) => a.id))
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const app = apps.find((a) => a.id === event.active.id);
    setActiveApp(app ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveApp(null);
    const { active, over } = event;
    if (!over) return;

    const targetStage = stages.find(
      (s) => s.key === over.id || getAppsForStage(s.key).some((a) => a.id === over.id)
    );
    if (!targetStage) return;

    const draggedApp = apps.find((a) => a.id === active.id);
    if (!draggedApp || draggedApp.stage === targetStage.key) return;

    stageMutation.mutate({ id: draggedApp.id, stage: targetStage.key });
  }

  const totalActive = apps.filter(
    (a) => !["Offer", "Rejected", ...INACTIVE_STAGE_IDS].includes(a.stage)
  ).length;
  const inactiveApps = apps.filter((a) => INACTIVE_STAGE_IDS.includes(a.stage));

  const responseRate =
    apps.length > 0
      ? Math.round(
          (apps.filter((a) => ["Screening", "Interview", "Offer"].includes(a.stage)).length /
            apps.filter((a) => a.stage !== "Saved").length || 0) * 100
        )
      : 0;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Kanban */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Pipeline</h1>
            <p className="text-muted-foreground text-sm">
              {totalActive} active · {responseRate}% response rate
            </p>
          </div>
          <div className="flex items-center gap-2">
            {inactiveApps.length > 0 && (
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="flex items-center gap-1.5 text-sm bg-muted border border-border hover:border-blue-500/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
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
                className="flex items-center gap-1.5 text-sm bg-muted border border-border hover:border-blue-500/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Export CSV{checkedIds.size > 0 ? ` (${checkedIds.size})` : ""}
              </button>
            )}
            <button
              onClick={() => setManagingStages(true)}
              className="flex items-center gap-1.5 text-sm bg-muted border border-border hover:border-blue-500/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
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
              <div className="flex gap-4 p-6 overflow-x-auto">
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
