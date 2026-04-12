import { describe, it, expect } from "vitest";

// Test the batch grading prompt builder in isolation
function buildBatchPrompt(
  items: Array<{
    idx: number;
    question: string;
    referenceAnswer: string;
    textAnswer: string;
    type: "short" | "long";
  }>
): string {
  const MAX = { short: 500, long: 5000 };
  const block = items
    .map((item) => {
      const truncated = item.textAnswer.slice(0, MAX[item.type]);
      return `Answer ${item.idx + 1}:\nQuestion: ${item.question}\nReference answer: ${item.referenceAnswer}\nType: ${item.type}\n<STUDENT_ANSWER>${truncated}</STUDENT_ANSWER>`;
    })
    .join("\n\n");
  return block;
}

describe("grading prompt builder", () => {
  it("wraps student answer in STUDENT_ANSWER delimiters", () => {
    const prompt = buildBatchPrompt([
      {
        idx: 0,
        question: "What is X?",
        referenceAnswer: "X is Y",
        textAnswer: "X is Y",
        type: "short",
      },
    ]);
    expect(prompt).toContain("<STUDENT_ANSWER>");
    expect(prompt).toContain("</STUDENT_ANSWER>");
  });

  it("truncates long answers to 5000 chars", () => {
    const longAnswer = "a".repeat(6000);
    const prompt = buildBatchPrompt([
      {
        idx: 0,
        question: "Q",
        referenceAnswer: "A",
        textAnswer: longAnswer,
        type: "long",
      },
    ]);
    const match = prompt.match(/<STUDENT_ANSWER>([\s\S]*?)<\/STUDENT_ANSWER>/);
    expect(match![1].length).toBe(5000);
  });

  it("truncates short answers to 500 chars", () => {
    const longAnswer = "b".repeat(1000);
    const prompt = buildBatchPrompt([
      {
        idx: 0,
        question: "Q",
        referenceAnswer: "A",
        textAnswer: longAnswer,
        type: "short",
      },
    ]);
    const match = prompt.match(/<STUDENT_ANSWER>([\s\S]*?)<\/STUDENT_ANSWER>/);
    expect(match![1].length).toBe(500);
  });
});
