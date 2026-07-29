// Tiny wrapper around the Vibration API for subtle mobile tactile feedback.
// Support is inconsistent (no iOS Safari, no desktop browsers), so every call
// must be a no-op there rather than throwing.

/** Fires a single short vibration. Safe to call on any platform/browser. */
export function vibrate(durationMs = 15) {
  if (typeof navigator === "undefined") return;
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(durationMs);
  } catch {
    // Some browsers throw when vibration is disallowed (e.g. no user
    // gesture, permissions policy) — feedback is a nice-to-have, never fatal.
  }
}
