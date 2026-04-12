import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ProctorWarning } from "../ProctorWarning";
import type { ProctorFlag } from "@/lib/proctoring/types";

const makeFlag = (type: ProctorFlag["type"] = "tab_switch"): ProctorFlag => ({
  type,
  timestamp: Date.now(),
  details: "test",
  severity: "medium",
});

describe("ProctorWarning", () => {
  it("renders nothing with empty flags", () => {
    const { container } = render(<ProctorWarning flags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows warning when flags added", async () => {
    const { rerender } = render(<ProctorWarning flags={[]} />);
    rerender(<ProctorWarning flags={[makeFlag()]} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/tab switch detected/i)).toBeInTheDocument();
  });

  it("auto-dismisses after 5 seconds", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<ProctorWarning flags={[]} />);
    rerender(<ProctorWarning flags={[makeFlag()]} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5100); });
    expect(screen.queryByRole("alert")).toBeNull();
    vi.useRealTimers();
  });
});
