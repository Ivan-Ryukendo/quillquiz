import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("fullscreen detector", () => {
  beforeEach(() => {
    vi.spyOn(document, "addEventListener");
    vi.spyOn(document, "removeEventListener");
    // Mock requestFullscreen
    Object.defineProperty(document, "documentElement", {
      value: { requestFullscreen: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers fullscreenchange listener", async () => {
    const { startFullscreenDetector } = await import("../fullscreen");
    const cleanup = startFullscreenDetector("standard", vi.fn(), vi.fn());
    expect(document.addEventListener).toHaveBeenCalledWith(
      "fullscreenchange",
      expect.any(Function)
    );
    cleanup();
  });

  it("calls onFlag when exiting fullscreen", async () => {
    const { startFullscreenDetector } = await import("../fullscreen");
    const onFlag = vi.fn();
    const cleanup = startFullscreenDetector("standard", onFlag, vi.fn());

    // Simulate fullscreen exit: fullscreenElement = null
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(onFlag).toHaveBeenCalledWith(
      expect.objectContaining({ type: "fullscreen_exit" })
    );
    cleanup();
  });
});
