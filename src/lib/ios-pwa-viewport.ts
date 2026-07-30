/**
 * iOS installed-PWA viewport compensation.
 *
 * WebKit standalone (Add to Home Screen) with viewport-fit=cover often reports
 * 100dvh / fixed-inset heights as "screen minus the home-indicator zone", while
 * env(safe-area-inset-bottom) returns 0. Result: a black strip under the tab bar
 * until a gesture forces a reflow.
 *
 * Fix: use 100vh for the shell in standalone, and set --app-bottom-inset from
 * env() when truthful, otherwise from the measured screen−viewport gap.
 *
 * @see https://stackoverflow.com/questions/79902310
 * @see https://bugs.webkit.org/show_bug.cgi?id=254868
 */

const MAX_GAP_RATIO = 0.2;
const MAX_GAP_PX = 120;
/** Typical home-indicator inset when env() lies but the device has a top inset. */
const FALLBACK_HOME_INDICATOR_PX = 34;

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function measureSafeAreaInset(edge: "top" | "bottom"): number {
  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:fixed",
    "visibility:hidden",
    "pointer-events:none",
    "width:0",
    "height:0",
    "padding:0",
    "border:0",
    edge === "top"
      ? "top:0;left:0;padding-top:env(safe-area-inset-top,0px)"
      : "left:0;bottom:0;padding-bottom:env(safe-area-inset-bottom,0px)",
  ].join(";");
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const raw = edge === "top" ? style.paddingTop : style.paddingBottom;
  probe.remove();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function readPortraitScreenHeight(): number {
  const w = Number(window.screen.width) || 0;
  const h = Number(window.screen.height) || 0;
  if (w <= 0 || h <= 0) return 0;
  const landscape = window.innerWidth > window.innerHeight;
  return Math.round(landscape ? Math.min(w, h) : Math.max(w, h));
}

function readLyingViewportGap(): number {
  const screenHeight = readPortraitScreenHeight();
  if (!screenHeight) return 0;
  const viewportHeight = Number(window.visualViewport?.height || window.innerHeight || 0);
  if (!viewportHeight) return 0;
  const gap = Math.round(screenHeight - viewportHeight);
  const maxGap = Math.max(MAX_GAP_PX, Math.round(screenHeight * MAX_GAP_RATIO));
  if (gap <= 0 || gap > maxGap) return 0;
  return gap;
}

function syncIosPwaViewport(): void {
  const root = document.documentElement;

  if (!isStandalonePwa()) {
    root.style.setProperty("--app-height", "100dvh");
    root.style.setProperty("--app-bottom-inset", "env(safe-area-inset-bottom, 0px)");
    return;
  }

  const envBottom = measureSafeAreaInset("bottom");
  const lyingGap = readLyingViewportGap();
  const inset =
    envBottom > 0
      ? envBottom
      : lyingGap > 0
        ? lyingGap
        : measureSafeAreaInset("top") > 0
          ? FALLBACK_HOME_INDICATOR_PX
          : 0;

  root.style.setProperty(
    "--app-bottom-inset",
    inset > 0 ? `${inset}px` : "env(safe-area-inset-bottom, 0px)"
  );

  // When env() is truthful, 100dvh is short by exactly that inset (SO / WebKit
  // bug). When env() lied, 100vh is the stable standalone unit and we still
  // extend by the measured gap if the unit itself is short.
  if (envBottom > 0) {
    root.style.setProperty("--app-height", `calc(100dvh + ${envBottom}px)`);
  } else if (lyingGap > 0) {
    root.style.setProperty("--app-height", `calc(100vh + ${lyingGap}px)`);
  } else {
    root.style.setProperty("--app-height", "100vh");
  }
}

/** Install listeners; returns cleanup. Safe to call once from a client provider. */
export function installIosPwaViewportFix(): () => void {
  if (typeof window === "undefined") return () => {};

  const timers: number[] = [];
  let raf = 0;

  const run = () => {
    raf = 0;
    syncIosPwaViewport();
  };

  const schedule = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(run);
  };

  const scheduleSettled = () => {
    schedule();
    for (const delay of [80, 220, 500, 1000]) {
      timers.push(window.setTimeout(schedule, delay));
    }
  };

  scheduleSettled();
  window.addEventListener("resize", scheduleSettled);
  window.addEventListener("orientationchange", scheduleSettled);
  window.addEventListener("pageshow", scheduleSettled);
  document.addEventListener("visibilitychange", scheduleSettled);
  window.visualViewport?.addEventListener("resize", scheduleSettled);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    for (const id of timers) clearTimeout(id);
    window.removeEventListener("resize", scheduleSettled);
    window.removeEventListener("orientationchange", scheduleSettled);
    window.removeEventListener("pageshow", scheduleSettled);
    document.removeEventListener("visibilitychange", scheduleSettled);
    window.visualViewport?.removeEventListener("resize", scheduleSettled);
  };
}
