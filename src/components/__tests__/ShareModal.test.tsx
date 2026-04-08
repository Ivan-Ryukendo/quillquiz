import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShareModal from "../ShareModal";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn().mockResolvedValue({ id: "id1", shareCode: "ABC123" }),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/lib/qr", () => ({
  generateQRDataURL: vi.fn().mockResolvedValue("data:image/png;base64,fake"),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { sharedQuizzes: { create: "sharedQuizzes:create" } },
}));

const baseFile = {
  id: "file1",
  filename: "quiz.md",
  rawMarkdown: "## Q1\nWhat is 2+2?\n",
  questions: [],
  metadata: { title: "My Quiz" },
  uploadedAt: Date.now(),
};

describe("ShareModal", () => {
  it("renders setup phase with PIN input and Share button", () => {
    render(<ShareModal file={baseFile} onClose={() => {}} />);
    expect(screen.getByText("Share Quiz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^share$/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/blank for no pin/i)).toBeInTheDocument();
  });

  it("transitions to result phase after sharing", async () => {
    render(<ShareModal file={baseFile} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^share$/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/abc123/i).length).toBeGreaterThan(0);
    });
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<ShareModal file={baseFile} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
