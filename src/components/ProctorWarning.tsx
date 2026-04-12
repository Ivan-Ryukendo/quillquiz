"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProctorFlag, FlagType } from "@/lib/proctoring/types";

const FLAG_MESSAGES: Record<FlagType, string> = {
  tab_switch: "Tab switch detected — this has been reported to your teacher.",
  window_blur: "Window focus lost — this has been reported to your teacher.",
  copy_attempt: "Copy attempt blocked.",
  paste_attempt: "Paste detected — this has been reported.",
  cut_attempt: "Cut attempt blocked.",
  keyboard_shortcut: "Keyboard shortcut blocked.",
  right_click: "Right-click disabled during exam.",
  fullscreen_exit: "Please return to fullscreen mode.",
  devtools_open: "Developer tools detected — this has been reported.",
  automation_detected: "Automated browser detected — this has been reported.",
  dom_tamper: "DOM modification detected — this has been reported.",
};

interface Toast {
  id: number;
  flag: ProctorFlag;
}

let toastIdCounter = 0;

interface ProctorWarningProps {
  flags: ProctorFlag[];
}

export function ProctorWarning({ flags }: ProctorWarningProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // When new flags arrive, add them as toasts
  useEffect(() => {
    if (flags.length === 0) return;
    const latestFlag = flags[flags.length - 1];
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev.slice(-2), { id, flag: latestFlag }]);
  }, [flags]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-dismiss each toast after 5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const timer = setTimeout(() => dismiss(latest.id), 5000);
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 rounded-lg shadow-lg text-sm"
          role="alert"
        >
          <span className="text-amber-500 text-base flex-shrink-0">⚠</span>
          <span className="flex-1 text-amber-800 dark:text-amber-200">
            {FLAG_MESSAGES[toast.flag.type] ?? "Suspicious activity detected."}
          </span>
          <button
            onClick={() => dismiss(toast.id)}
            className="text-amber-400 hover:text-amber-600 flex-shrink-0 text-xs ml-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
