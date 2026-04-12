import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("visibility detector", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(document, "addEventListener");
    removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
    vi.spyOn(window, "addEventListener");
    vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers visibilitychange and blur/focus listeners", async () => {
    const { startVisibilityDetector } = await import("../visibility");
    const cleanup = startVisibilityDetector(vi.fn());
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
    cleanup();
  });

  it("cleanup removes listeners", async () => {
    const { startVisibilityDetector } = await import("../visibility");
    const cleanup = startVisibilityDetector(vi.fn());
    cleanup();
    expect(removeEventListenerSpy).toHaveBeenCalled();
  });

  it("calls onFlag when visibilitychange fires hidden", async () => {
    const { startVisibilityDetector } = await import("../visibility");
    const onFlag = vi.fn();
    startVisibilityDetector(onFlag);

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(onFlag).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tab_switch" })
    );
  });
});
