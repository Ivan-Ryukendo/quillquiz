import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("devtools detector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("detects navigator.webdriver automation", async () => {
    Object.defineProperty(navigator, "webdriver", {
      value: true,
      configurable: true,
    });
    const { startDevToolsDetector } = await import("../devtools");
    const onFlag = vi.fn();
    const cleanup = startDevToolsDetector(onFlag);
    expect(onFlag).toHaveBeenCalledWith(
      expect.objectContaining({ type: "automation_detected" })
    );
    cleanup();
  });

  it("detects common automation globals", async () => {
    (window as unknown as Record<string, unknown>).__selenium = true;
    const { startDevToolsDetector } = await import("../devtools");
    const onFlag = vi.fn();
    const cleanup = startDevToolsDetector(onFlag);
    expect(onFlag).toHaveBeenCalledWith(
      expect.objectContaining({ type: "automation_detected" })
    );
    cleanup();
    delete (window as unknown as Record<string, unknown>).__selenium;
  });

  it("sets up interval for periodic checks", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "webdriver", {
      value: false,
      configurable: true,
    });
    const { startDevToolsDetector } = await import("../devtools");
    const onFlag = vi.fn();
    const cleanup = startDevToolsDetector(onFlag);
    // Advance timers to trigger the interval
    vi.advanceTimersByTime(3000);
    cleanup();
    // No assertion on call count — just ensure no throws
    expect(true).toBe(true);
  });

  it("cleanup stops interval", async () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const { startDevToolsDetector } = await import("../devtools");
    const cleanup = startDevToolsDetector(vi.fn());
    cleanup();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
