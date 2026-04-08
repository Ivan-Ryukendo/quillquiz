import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock all Convex and navigation hooks before any imports of the component
vi.mock("convex/react", () => ({
  useQuery: vi.fn().mockReturnValue(null),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "EXPIRED" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/convex/_generated/api", () => ({
  api: {
    sharedQuizzes: { getByShareCode: "sharedQuizzes:getByShareCode" },
    examSessions: { getActiveByQuizId: "examSessions:getActiveByQuizId" },
  },
}));

describe("JoinPage", () => {
  it("shows expired/not found message when quiz is null", async () => {
    const { default: JoinPage } = await import("../[code]/page");
    render(<JoinPage />);
    expect(screen.getByRole("heading", { name: /expired|not found/i })).toBeInTheDocument();
  });
});
