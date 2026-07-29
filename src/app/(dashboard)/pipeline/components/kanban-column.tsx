"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import type { Application, Stage } from "../types";
import { SortableCard } from "./sortable-card";
import { SwipeableCard } from "./swipeable-card";

export function KanbanColumn({
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
          isOver ? "bg-muted/50 ring-1 ring-blue-500/30" : "bg-muted/15 dark:bg-card/30"
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
