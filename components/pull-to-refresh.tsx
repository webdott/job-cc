"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/haptics";

// Dependency-free pull-to-refresh: tracks raw touch deltas rather than
// pulling in a gesture library, since touch-only (no mouse) is exactly what
// the native browser Touch Events API already gives us for free. On
// desktop this is inert — touchstart never fires without a touchscreen.
const PULL_THRESHOLD = 70;
const MAX_PULL = 110;
const PULL_RESISTANCE = 0.5;

export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const isPulling = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  function reset() {
    isPulling.current = false;
    startY.current = null;
    setPullDistance(0);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const el = containerRef.current;
    if (!el || refreshing) return;
    // Only begin tracking a pull when the list is already scrolled to the
    // top — otherwise this is an ordinary scroll gesture.
    if (el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isPulling.current || startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(MAX_PULL, delta * PULL_RESISTANCE));
  }

  async function handleTouchEnd() {
    if (!isPulling.current) return;
    const shouldRefresh = pullDistance >= PULL_THRESHOLD && !refreshing;
    isPulling.current = false;
    startY.current = null;

    if (!shouldRefresh) {
      setPullDistance(0);
      return;
    }

    vibrate();
    setRefreshing(true);
    setPullDistance(PULL_THRESHOLD);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={reset}
      className={cn("overflow-y-auto", className)}
    >
      {/* Indicator only ever has height on touch devices — pullDistance stays 0 without touch events */}
      <div
        className="flex items-center justify-center overflow-hidden md:hidden"
        style={{
          height: pullDistance,
          transition: refreshing ? "height 0.15s ease-out" : undefined,
        }}
      >
        <RefreshCw
          className={cn(
            "h-4 w-4 text-blue-400 transition-opacity",
            refreshing && "animate-spin",
            pullDistance >= PULL_THRESHOLD ? "opacity-100" : "opacity-40"
          )}
          style={
            !refreshing
              ? { transform: `rotate(${(pullDistance / PULL_THRESHOLD) * 180}deg)` }
              : undefined
          }
        />
      </div>
      {children}
    </div>
  );
}
