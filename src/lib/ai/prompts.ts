export function buildConvertToQuizPrompt(rawText: string): string {
  return `Convert the following text into a properly formatted markdown quiz file.

## Output Format Rules

1. Add YAML frontmatter with title, description, and tags inferred from the content:
\`\`\`
---
title: "<inferred title>"
description: "<brief description>"
tags: [<relevant tags>]
---
\`\`\`

2. Each question must be a level-2 heading (##). Never use h1 (#) for questions.

3. MCQ questions — follow the heading with a GFM checkbox list, mark correct answers with [x]:
## Question text?

- [ ] Wrong option
- [x] Correct option
- [ ] Wrong option
- [ ] Wrong option

4. Short answer questions (1–2 sentence answer) — follow the heading with a blockquote:
## Question text?

> The concise reference answer goes here.

5. Long answer questions (multi-sentence explanation) — add [LONG] tag:
## [LONG] Question text?

> Detailed reference answer covering all key points a student must mention.

## Conversion Instructions

- Generate a mix of MCQ, short, and long answer questions.
- For MCQ: 4 options, exactly one correct unless the question says "select all".
- For short/long: write a reference answer capturing key points a teacher would look for.
- Aim for 10–20 questions per page of content.
- Do not invent facts not present in or clearly implied by the source text.
- Order from basic recall to higher-order thinking.
- Separate questions with a blank line.

## Source Text

${rawText}

Output ONLY the markdown file content. No explanations, no code fences wrapping the entire output.`;
}

export function buildGradingPrompt(
  question: string,
  referenceAnswer: string,
  studentAnswer: string,
  questionType: 'short' | 'long'
): string {
  return `You are a teacher grading a student's answer.

Question: ${question}
Reference answer: ${referenceAnswer}
Student's answer: ${studentAnswer}
Question type: ${questionType}

Grade the student's answer on a scale of 0-100. Consider:
- Accuracy of key concepts
- Completeness relative to the reference answer
${questionType === 'short' ? '- For short answers: exact or near-exact match expected' : '- For long answers: coverage of main points, reasoning quality'}

Respond in this exact JSON format only, with no additional text:
{"score": <number 0-100>, "feedback": "<brief explanation of the grade>", "keyMissing": ["<missed concept 1>", "<missed concept 2>"]}`;
}
