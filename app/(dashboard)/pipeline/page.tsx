"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { MapPin, Wifi, GripVertical, ExternalLink, Trash2, Plus } from "lucide-react";
import { ApplicationDetail } from "@/components/application-detail";

const DEFAULT_STAGES = [
  { id: "Saved", label: "Saved", color: "bg-slate-500" },
  { id: "Applied", label: "Applied", color: "bg-blue-500" },
  { id: "Screening", label: "Screening", color: "bg-yellow-500" },
  { id: "Interview", label: "Interview", color: "bg-purple-500" },
  { id: "Offer", label: "Offer", color: "bg-green-500" },
  { id: "Rejected", label: "Rejected", color: "bg-red-500" },
];

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
}: {
  app: Application;
  isDragging?: boolean;
  onDelete: (id: string) => void;
  onSelect?: (id: string) => void;
}) {
  const title = app.job?.title ?? app.inlineJobData?.title ?? "Untitled Role";
  const company = app.job?.company ?? app.inlineJobData?.company ?? "Unknown Company";
  const score = app.job?.evaluation?.overallScore ?? null;

  return (
    <div
      onClick={() => onSelect?.(app.id)}
      className={cn(
        "bg-muted border border-border rounded-lg p-3 select-none cursor-pointer hover:border-blue-500/40 transition-colors",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{company}</p>
        </div>
        <ScoreBadge score={score} />
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
}: {
  app: Application;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
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
        <AppCard app={app} isDragging={isDragging} onDelete={onDelete} onSelect={onSelect} />
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  apps,
  onDelete,
  onSelect,
}: {
  stage: (typeof DEFAULT_STAGES)[0];
  apps: Application[];
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

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
          {apps.map((app) => (
            <SortableCard key={app.id} app={app} onDelete={onDelete} onSelect={onSelect} />
          ))}
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data, isLoading } = useQuery<ApplicationsResponse>({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications");
      return res.json() as Promise<ApplicationsResponse>;
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

  const apps = data?.applications ?? [];

  function getAppsForStage(stageId: string) {
    return apps.filter((a) => a.stage === stageId);
  }

  function handleDragStart(event: DragStartEvent) {
    const app = apps.find((a) => a.id === event.active.id);
    setActiveApp(app ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveApp(null);
    const { active, over } = event;
    if (!over) return;

    const targetStage = DEFAULT_STAGES.find(
      (s) => s.id === over.id || getAppsForStage(s.id).some((a) => a.id === over.id)
    );
    if (!targetStage) return;

    const draggedApp = apps.find((a) => a.id === active.id);
    if (!draggedApp || draggedApp.stage === targetStage.id) return;

    stageMutation.mutate({ id: draggedApp.id, stage: targetStage.id });
  }

  const totalActive = apps.filter((a) => !["Offer", "Rejected"].includes(a.stage)).length;

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
          <a
            href="/discover"
            className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add job
          </a>
        </div>

        {/* Kanban board */}
        {isLoading ? (
          <div className="flex gap-4 p-6 overflow-x-auto">
            {DEFAULT_STAGES.map((s) => (
              <div key={s.id} className="min-w-[260px] space-y-2">
                <div className="h-5 bg-muted rounded w-20 mb-3 animate-pulse" />
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 p-6 overflow-x-auto flex-1">
              {DEFAULT_STAGES.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  apps={getAppsForStage(stage.id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onSelect={(id) => setSelectedAppId((prev) => (prev === id ? null : id))}
                />
              ))}
            </div>

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
    </div>
  );
}
