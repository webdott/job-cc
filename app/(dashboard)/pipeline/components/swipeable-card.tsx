"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { vibrate } from "@/lib/haptics";
import type { Application, Stage } from "../types";

// Swipe distance (px) needed to commit a stage move. Below this it springs
// back to center — a deliberate flick, not an accidental brush.
const SWIPE_THRESHOLD = 90;

// Touch-only alternative to the desktop grip-handle drag: swipe a card left
// or right to move it to the previous/next Kanban column. The grip handle
// relies on `group-hover` to reveal itself, which touch input never
// triggers, so without this, touch users have no way to change a card's
// stage except the "..." menu (only offered for the inactive statuses).
export function SwipeableCard({
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
