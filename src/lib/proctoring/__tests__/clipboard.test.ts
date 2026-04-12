import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("clipboard detector", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(document, "addEventListener");
    vi.spyOn(document, "removeEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers copy, cut, paste, keydown, contextmenu listeners", async () => {
    const { startClipboardDetector } = await import("../clipboard");
    const cleanup = startClipboardDetector(vi.fn());
    const events = addEventListenerSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("copy");
    expect(events).toContain("cut");
    expect(events).toContain("paste");
    expect(events).toContain("keydown");
    expect(events).toContain("contextmenu");
    cleanup();
  });

  it("flags copy events", async () => {
    const { startClipboardDetector } = await import("../clipboard");
    const onFlag = vi.fn();
    const cleanup = startClipboardDetector(onFlag);

    document.dispatchEvent(new ClipboardEvent("copy"));
    expect(onFlag).toHaveBeenCalledWith(
      expect.objectContaining({ type: "copy_attempt" })
    );
    cleanup();
  });

  it("flags Ctrl+C keydown", async () => {
    const { startClipboardDetector } = await import("../clipboard");
    const onFlag = vi.fn();
    const cleanup = startClipboardDetector(onFlag);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true })
    );
    expect(onFlag).toHaveBeenCalledWith(
      expect.objectContaining({ type: "keyboard_shortcut" })
    );
    cleanup();
  });
});
