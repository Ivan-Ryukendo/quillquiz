import type { OnFlagCallback, DetectorCleanup } from "./types";

const AUTOMATION_GLOBALS = [
  "__selenium",
  "__puppeteer",
  "__playwright",
  "__webdriver",
  "callPhantom",
  "_phantom",
  "__nightmare",
];

function checkAutomation(onFlag: OnFlagCallback): void {
  if (navigator.webdriver) {
    onFlag({
      type: "automation_detected",
      timestamp: Date.now(),
      details: "navigator.webdriver detected",
      severity: "high",
    });
    return;
  }

  for (const key of AUTOMATION_GLOBALS) {
    if ((window as unknown as Record<string, unknown>)[key] !== undefined) {
      onFlag({
        type: "automation_detected",
        timestamp: Date.now(),
        details: `Automation global detected: ${key}`,
        severity: "high",
      });
      return;
    }
  }
}

function checkDevToolsSize(onFlag: OnFlagCallback): void {
  const threshold = 200;
  const heightDiff = window.outerHeight - window.innerHeight;
  const widthDiff = window.outerWidth - window.innerWidth;
  if (heightDiff > threshold || widthDiff > threshold) {
    onFlag({
      type: "devtools_open",
      timestamp: Date.now(),
      details: `Dev tools likely open (size diff: ${Math.max(heightDiff, widthDiff)}px)`,
      severity: "high",
    });
  }
}

export function startDevToolsDetector(onFlag: OnFlagCallback): DetectorCleanup {
  // Immediate checks on start
  checkAutomation(onFlag);

  // Periodic checks every 2 seconds
  const intervalId = setInterval(() => {
    checkDevToolsSize(onFlag);
    checkAutomation(onFlag);
  }, 2000);

  return () => {
    clearInterval(intervalId);
  };
}
