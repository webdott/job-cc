"use client";

import { useEffect, useState } from "react";

// Mirrors the `md:` breakpoint (768px) so slide-direction/layout logic can
// stay in sync with whichever CSS layout (bottom sheet vs. side panel) is active.
export function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}
