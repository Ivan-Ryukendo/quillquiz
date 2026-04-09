import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: (key: string) => key === "files" ? "test-id" : null }),
}));
vi.mock("@/lib/storage/quiz-store", () => ({
  getAllQuizFiles: () =>
    Promise.resolve([
      {
        id: "test-id",
        filename: "test.md",
        rawMarkdown: "## Q1\n\n- [x] A\n- [ ] B",
        questions: [
          {
            id: "q1",
            text: "Q1",
            type: "mcq",
            options: [
              { text: "A", isCorrect: true },
              { text: "B", isCorrect: false },
            ],
          },
        ],
        metadata: { title: "Test Quiz" },
        createdAt: Date.now(),
      },
    ]),
}));
vi.mock("@/lib/storage/settings-store", () => ({
  getSettings: () => Promise.resolve({}),
}));
vi.mock("@/convex/_generated/api", () => ({
  api: {
    sharedQuizzes: { create: "sharedQuizzes:create" },
    examSessions: { create: "examSessions:create" },
  },
}));

describe("ExamCreatePage", () => {
  it("renders settings form", async () => {
    const { default: ExamCreatePage } = await import("../create/page");
    render(<ExamCreatePage />);
    await waitFor(() =>
      expect(screen.getByText(/create live exam/i)).toBeInTheDocument()
    );
  });
});
