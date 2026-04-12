import { describe, it, expect, vi, afterEach } from "vitest";

// Mock individual detectors
vi.mock("../visibility", () => ({
  startVisibilityDetector: vi.fn(() => vi.fn()),
}));
vi.mock("../clipboard", () => ({
  startClipboardDetector: vi.fn(() => vi.fn()),
}));
vi.mock("../fullscreen", () => ({
  startFullscreenDetector: vi.fn(() => vi.fn()),
}));
vi.mock("../devtools", () => ({
  startDevToolsDetector: vi.fn(() => vi.fn()),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("orchestrator", () => {
  it("standard level starts visibility, clipboard, fullscreen — NOT devtools", async () => {
    const { startVisibilityDetector } = await import("../visibility");
    const { startClipboardDetector } = await import("../clipboard");
    const { startFullscreenDetector } = await import("../fullscreen");
    const { startDevToolsDetector } = await import("../devtools");
    const { startProctoring } = await import("../orchestrator");

    startProctoring({ level: "standard", onFlag: vi.fn(), onPause: vi.fn() });

    expect(startVisibilityDetector).toHaveBeenCalled();
    expect(startClipboardDetector).toHaveBeenCalled();
    expect(startFullscreenDetector).toHaveBeenCalled();
    expect(startDevToolsDetector).not.toHaveBeenCalled();
  });

  it("aggressive level starts ALL detectors", async () => {
    const { startVisibilityDetector } = await import("../visibility");
    const { startClipboardDetector } = await import("../clipboard");
    const { startFullscreenDetector } = await import("../fullscreen");
    const { startDevToolsDetector } = await import("../devtools");
    const { startProctoring } = await import("../orchestrator");

    startProctoring({ level: "aggressive", onFlag: vi.fn(), onPause: vi.fn() });

    expect(startVisibilityDetector).toHaveBeenCalled();
    expect(startClipboardDetector).toHaveBeenCalled();
    expect(startFullscreenDetector).toHaveBeenCalled();
    expect(startDevToolsDetector).toHaveBeenCalled();
  });

  it("visibility level starts ALL detectors", async () => {
    const { startDevToolsDetector } = await import("../devtools");
    const { startProctoring } = await import("../orchestrator");

    startProctoring({ level: "visibility", onFlag: vi.fn(), onPause: vi.fn() });

    expect(startDevToolsDetector).toHaveBeenCalled();
  });

  it("stopProctoring calls all cleanup functions", async () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    const { startVisibilityDetector } = await import("../visibility");
    const { startClipboardDetector } = await import("../clipboard");
    vi.mocked(startVisibilityDetector).mockReturnValue(cleanup1);
    vi.mocked(startClipboardDetector).mockReturnValue(cleanup2);
    const { startProctoring, stopProctoring } = await import("../orchestrator");

    startProctoring({ level: "standard", onFlag: vi.fn(), onPause: vi.fn() });
    stopProctoring();

    expect(cleanup1).toHaveBeenCalled();
    expect(cleanup2).toHaveBeenCalled();
  });
});
