import { describe, it, expect } from "vitest";

// Test the MCQ grading logic in isolation (pure function extracted for testability)
function gradeMcq(
  selectedOptions: number[],
  correctOptions: number[]
): boolean {
  const correct = [...correctOptions].sort().join(",");
  const student = [...selectedOptions].sort().join(",");
  return correct === student;
}

describe("MCQ server-side grading", () => {
  it("grades single correct option", () => {
    expect(gradeMcq([1], [1])).toBe(true);
    expect(gradeMcq([0], [1])).toBe(false);
  });

  it("grades multi-correct options (order independent)", () => {
    expect(gradeMcq([2, 0], [0, 2])).toBe(true);
    expect(gradeMcq([0, 1], [0, 2])).toBe(false);
  });

  it("partial selection is wrong", () => {
    expect(gradeMcq([0], [0, 2])).toBe(false);
  });
});
