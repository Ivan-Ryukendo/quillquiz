import type { OnFlagCallback, DetectorCleanup } from "./types";

export function startVisibilityDetector(onFlag: OnFlagCallback): DetectorCleanup {
  let hiddenAt: number | null = null;

  const handleVisibilityChange = () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      onFlag({
        type: "tab_switch",
        timestamp: Date.now(),
        details: "Tab switched away",
        severity: "medium",
      });
    } else if (hiddenAt !== null) {
      const durationMs = Date.now() - hiddenAt;
      hiddenAt = null;
      onFlag({
        type: "tab_switch",
        timestamp: Date.now(),
        details: `Tab returned after ${Math.round(durationMs / 1000)}s`,
        severity: "low",
        durationMs,
      });
    }
  };

  const handleBlur = () => {
    onFlag({
      type: "window_blur",
      timestamp: Date.now(),
      details: "Window lost focus",
      severity: "low",
    });
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleBlur);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleBlur);
  };
}
