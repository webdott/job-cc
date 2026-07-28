"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Application } from "../types";
import { AppCard } from "./app-card";

export function SortableCard({
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
