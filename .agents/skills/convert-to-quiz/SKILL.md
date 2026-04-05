---
name: convert-to-quiz
description: Convert messy text (textbook excerpts, lecture notes, plain questions) into properly formatted markdown quiz files for the QuizMD website. Use when user wants to create quiz questions from raw text, convert notes to a test, or generate a quiz markdown file.
---

Convert the provided text into a properly formatted markdown quiz file following this exact specification.

## Output Format

The output must be a valid `.md` file with this structure:

### Frontmatter
Add YAML frontmatter with title, description, and tags inferred from the content:
```
---
title: "<inferred title>"
description: "<brief description>"
tags: [<relevant tags>]
---
```

### Question Formatting Rules

1. **Each question** is a level-2 heading (`##`)
2. **MCQ questions**: Follow the heading with a checkbox list. Mark correct answer(s) with `[x]`:
   ```
   ## Question text here?

   - [ ] Wrong option
   - [x] Correct option
   - [ ] Wrong option
   - [ ] Wrong option
   ```

3. **Short answer questions** (answer is 1-2 sentences): Follow the heading with a blockquote:
   ```
   ## Question text here?

   > The concise answer goes here.
   ```

4. **Long answer questions** (answer requires detailed explanation): Add `[LONG]` tag and use a blockquote:
   ```
   ## [LONG] Question text here?

   > Detailed answer spanning multiple sentences. Include all key
   > concepts that a student should mention to receive full marks.
   ```

## Conversion Instructions

1. Read the input text carefully. Identify factual claims, definitions, processes, and key concepts.
2. Generate a mix of question types:
   - MCQ for factual recall, definitions, and identification
   - Short answer for single-concept explanations
   - Long answer for processes, comparisons, and analysis
3. For MCQ: create 4 options. Make distractors plausible but clearly wrong. Ensure exactly one correct answer unless the question says "select all."
4. For short/long answer: write a reference answer that captures the key points a teacher would look for.
5. Aim for 10-20 questions per page of input text unless the user specifies otherwise.
6. Maintain academic accuracy. Do not invent facts not present in or clearly implied by the source text.
7. Order questions from basic recall to higher-order thinking.

## Important

- Output ONLY the markdown file content, no explanations before or after
- Ensure all markdown syntax is valid
- Separate questions with a blank line
- Do not use h1 (`#`) for questions - only h2 (`##`) or deeper
