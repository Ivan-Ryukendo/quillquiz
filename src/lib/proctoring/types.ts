export type FlagSeverity = "low" | "medium" | "high";

export type FlagType =
  | "tab_switch"
  | "window_blur"
  | "copy_attempt"
  | "paste_attempt"
  | "cut_attempt"
  | "keyboard_shortcut"
  | "right_click"
  | "fullscreen_exit"
  | "devtools_open"
  | "automation_detected"
  | "dom_tamper";

export interface ProctorFlag {
  type: FlagType;
  timestamp: number;
  details: string;
  severity: FlagSeverity;
  durationMs?: number; // for time-away tracking
}

export type OnFlagCallback = (flag: ProctorFlag) => void;

export interface DetectorCleanup {
  (): void;
}
