import type { OnFlagCallback, DetectorCleanup, FlagSeverity } from "./types";

export type ProctoringLevel = "standard" | "aggressive" | "visibility";

/**
 * @param level - proctoring level
 * @param onFlag - called with a ProctorFlag when fullscreen exit detected
 * @param onAggressiveExit - called (aggressive only) when student exits fullscreen — caller should show pause overlay
 */
export function startFullscreenDetector(
  level: ProctoringLevel,
  onFlag: OnFlagCallback,
  onAggressiveExit: () => void
): DetectorCleanup {
  // Request fullscreen on start
  if (document.documentElement?.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {
      // User may deny — not an error
    });
  }

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      const severity: FlagSeverity = level === "aggressive" ? "high" : "medium";
      onFlag({
        type: "fullscreen_exit",
        timestamp: Date.now(),
        details: "Student exited fullscreen",
        severity,
      });

      if (level === "aggressive") {
        onAggressiveExit();
      }
    }
  };

  document.addEventListener("fullscreenchange", handleFullscreenChange);

  return () => {
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
  };
}
