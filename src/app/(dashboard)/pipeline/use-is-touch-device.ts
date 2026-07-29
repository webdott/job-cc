import { useEffect, useState } from "react";

// Coarse pointer (touch) detection — gates swipe-to-move so mouse users on
// desktop keep the existing drag-handle-only interaction untouched.
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(
      typeof window !== "undefined" &&
        (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0)
    );
  }, []);
  return isTouch;
}
