import type { OnFlagCallback, DetectorCleanup } from "./types";

const BLOCKED_KEYS = new Set(["c", "v", "a", "s", "p", "u"]);

export function startClipboardDetector(onFlag: OnFlagCallback): DetectorCleanup {
  const handleCopy = (e: Event) => {
    e.preventDefault();
    onFlag({
      type: "copy_attempt",
      timestamp: Date.now(),
      details: "Copy attempt blocked",
      severity: "medium",
    });
  };

  const handleCut = (e: Event) => {
    e.preventDefault();
    onFlag({
      type: "cut_attempt",
      timestamp: Date.now(),
      details: "Cut attempt blocked",
      severity: "medium",
    });
  };

  const handlePaste = (e: Event) => {
    // Allow paste but log it
    const len = (e as ClipboardEvent).clipboardData?.getData("text")?.length ?? 0;
    onFlag({
      type: "paste_attempt",
      timestamp: Date.now(),
      details: `Paste detected (${len} chars)`,
      severity: "low",
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && BLOCKED_KEYS.has(key)) {
      e.preventDefault();
      onFlag({
        type: "keyboard_shortcut",
        timestamp: Date.now(),
        details: `Blocked: ${e.ctrlKey ? "Ctrl" : "Cmd"}+${e.key.toUpperCase()}`,
        severity: "medium",
      });
    }
  };

  const handleContextMenu = (e: Event) => {
    e.preventDefault();
    onFlag({
      type: "right_click",
      timestamp: Date.now(),
      details: "Right-click blocked",
      severity: "low",
    });
  };

  document.addEventListener("copy", handleCopy);
  document.addEventListener("cut", handleCut);
  document.addEventListener("paste", handlePaste);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("contextmenu", handleContextMenu);

  return () => {
    document.removeEventListener("copy", handleCopy);
    document.removeEventListener("cut", handleCut);
    document.removeEventListener("paste", handlePaste);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("contextmenu", handleContextMenu);
  };
}
