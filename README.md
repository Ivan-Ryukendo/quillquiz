# QuillQuiz

**Turn your notes into interactive quizzes — instantly.**

Write your study material in markdown. Drop it in. QuillQuiz parses it into a full quiz with multiple choice, short answer, and long answer questions — all graded by AI.

**Live:** [quillquiz.vercel.app](https://quillquiz.vercel.app)

---

## What it does

- Upload `.md` files, PDFs, or images — they become interactive quizzes automatically
- MCQ answers checked instantly; written answers graded by AI with score + feedback
- **Share quizzes** via a 6-character code or QR code — anyone can add them to their library
- **Host live exams** — real-time teacher dashboard, student lobby, synchronized timer, server-side MCQ grading, AI grading with your stored API key
- **Anti-cheat proctoring** — three levels (standard / aggressive / visibility): fullscreen enforcement, tab-switch detection, clipboard blocking, devtools detection, real-time flag reporting to teacher
- Everything stored in your browser — no account needed for solo use (live exams require Convex auth)

---

## Markdown Quiz Format

Write your quiz as a markdown file. Questions are `##` headings. H1 headings (`#`) are treated as section titles and ignored.

### Multiple Choice

Use a GFM checkbox list under the heading. Mark correct answers with `[x]`:

```markdown
## What is the capital of France?

- [ ] London
- [x] Paris
- [ ] Berlin
- [ ] Madrid
```

Multiple correct answers work too — just mark them all with `[x]`.

### Short Answer

Put the reference answer in a blockquote (under ~50 words):

```markdown
## Define osmosis.

> The movement of water molecules through a semipermeable membrane from an area of high water concentration to low water concentration.
```

### Long Answer

Add a `[LONG]` tag and use a blockquote for the reference answer:

```markdown
## [LONG] Explain the process of photosynthesis.

> Photosynthesis is the process by which plants use sunlight, water, and CO₂
> to produce glucose and oxygen. It occurs in chloroplasts via the light
> reactions (producing ATP and NADPH) and the Calvin cycle (fixing CO₂).
```

### Force a Question Type

Prefix any heading with `[MCQ]`, `[SHORT]`, or `[LONG]` to override auto-detection:

```markdown
## [SHORT] Explain quantum entanglement in detail.

> Two particles become linked such that measuring one instantly determines the state of the other.
```

### Frontmatter (optional)

Add YAML frontmatter for metadata:

```markdown
---
title: "Biology Midterm"
description: "Cell biology and genetics"
tags: ["biology", "cells"]
time_limit: 30
---

## What organelle produces energy?

- [x] Mitochondria
- [ ] Nucleus
```

`time_limit` is in minutes. Section titles using `#` and horizontal rules (`---`) between questions are both fine and ignored by the parser.

---

## PDF & Image Upload

Drop in a PDF or image — QuillQuiz will extract the text and automatically convert it into quiz format using AI.

**How it works (3-tier pipeline):**

1. **PDF.js** — extracts text from digital PDFs instantly, no API needed
2. **Tesseract.js** — in-browser OCR for scanned PDFs and images (no API key required, slower)
3. **Gemini Vision** — high-quality OCR when you have a Gemini API key configured (skips Tesseract)

After extraction, the raw text is sent to Gemini (or OpenRouter) to be converted into proper quiz markdown with `##` headings, checkboxes, and blockquotes. The result is cached by file content hash — re-uploading the same file skips all processing instantly.

---

## AI Grading

Short and long answer questions are graded by AI. The grader returns:
- A score from 0–100
- Written feedback
- A list of key concepts that were missed

**AI provider priority:**

| Priority | Provider | How to set up |
|---|---|---|
| 1 | Your Gemini key | Settings → Gemini API Key |
| 2 | Your OpenRouter key | Settings → OpenRouter API Key |
| 3 | Demo mode | Shared server key (rate-limited, may be unavailable) |

Get a free Gemini key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). The free tier gives 15 requests/minute and 1,500/day — enough for regular use. If you hit the rate limit, QuillQuiz retries automatically with exponential backoff.

---

## Running Locally

```bash
git clone https://github.com/Ivan-Ryukendo/quillquiz
cd quillquiz
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000).

For AI grading in demo mode locally, create `.env.local`:

```
GEMINI_API_KEY=your_key_here
```

---

## Tech Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Storage | IndexedDB via `idb` |
| Markdown parsing | `unified` + `remark-parse` + `remark-gfm` |
| OCR | `pdfjs-dist` + `tesseract.js` |
| AI | Google Gemini 2.5 Flash / OpenRouter |
| Tests | Vitest + happy-dom |
| Deploy | Vercel |

---

## Convert Notes with Claude Code

A Claude Code skill is included at [`skills/convert-to-quiz/SKILL.md`](skills/convert-to-quiz/SKILL.md). If you use Claude Code, it will automatically convert raw text (lecture notes, textbook excerpts, plain questions) into properly formatted QuillQuiz markdown.

---

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run test         # Run tests
npm run test:watch   # Watch mode
npm run lint         # ESLint
```
