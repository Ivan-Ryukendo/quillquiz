import type { OnFlagCallback, DetectorCleanup } from "./types";
import { startVisibilityDetector } from "./visibility";
import { startClipboardDetector } from "./clipboard";
import { startFullscreenDetector } from "./fullscreen";
import { startDevToolsDetector } from "./devtools";

export type ProctoringLevel = "standard" | "aggressive" | "visibility";

export interface ProctoringOptions {
  level: ProctoringLevel;
  onFlag: OnFlagCallback;
  /** Called when aggressive fullscreen exit happens — caller should show pause overlay */
  onPause: () => void;
}

let cleanups: DetectorCleanup[] = [];

export function startProctoring(options: ProctoringOptions): void {
  stopProctoring(); // clean up any previous session

  const { level, onFlag, onPause } = options;

  cleanups.push(startVisibilityDetector(onFlag));
  cleanups.push(startClipboardDetector(onFlag));
  cleanups.push(
    startFullscreenDetector(
      level,
      onFlag,
      level === "aggressive" ? onPause : () => {}
    )
  );

  if (level === "aggressive" || level === "visibility") {
    cleanups.push(startDevToolsDetector(onFlag));
  }
}

export function stopProctoring(): void {
  for (const cleanup of cleanups) {
    cleanup();
  }
  cleanups = [];
}
