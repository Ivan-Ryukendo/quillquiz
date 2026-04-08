# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Next.js 16 note:** This project uses Next.js 16.2.2 (Turbopack). APIs, conventions, and file structure may differ from older versions. Read `node_modules/next/dist/docs/` before writing any Next.js-specific code.

## Commands

```bash
npm run dev          # Dev server at localhost:3000
npm run build        # Production build (also runs TypeScript check)
npm run lint         # ESLint
npm run test         # Run tests once (vitest)
npm run test:watch   # Watch mode
npm run test:ui      # Vitest UI
```

Run a single test file: `npx vitest run src/lib/markdown/__tests__/parser.test.ts`

Deploy: `vercel --prod --yes` (project already linked via `.vercel/`)

## Architecture

**QuillQuiz** — upload markdown/PDF/images → parse into interactive quizzes → take tests with AI grading. Entirely client-side except one server route. All persistence is IndexedDB (no backend database).

### Full Upload Flow

```
Upload (.md / .pdf / image)
        │
        ├─ .md/.markdown ──→ parseQuiz() ──→ saveQuizFile() ──→ /library
        │
        └─ PDF / image ──→ runOcrPipeline()
                                │
                                ├─ 1. Check ocrCache (IndexedDB by SHA-256 hash)
                                ├─ 2. PDF.js  — digital PDFs (free, in-browser)
                                ├─ 3. Tesseract.js — scanned/images, no Gemini key
                                ├─ 4. Gemini Vision — if Gemini key set (skips Tesseract)
                                │
                                └─ convertRawTextToQuizMarkdown() ← Gemini / OpenRouter
                                        │
                                        └─ parseQuiz() ──→ saveQuizFile() ──→ /library
```

OCR results (post-conversion) are cached in IndexedDB by file hash — re-uploading the same file skips OCR and AI conversion entirely.

### Quiz Test Flow

1. `/library` — select quiz files → `/test/configure`
2. `createTestSession()` builds a `TestSession` with shuffled/filtered `Question[]`
3. `/test/[sessionId]` — MCQ auto-grades client-side; short/long answers call `checkAnswer()` → AI grading
4. `/test/results/[sessionId]` — `computeScore()` aggregates results

### Question Detection (`src/lib/markdown/detect.ts`)

Questions are `##`+ headings. H1 = section title (ignored). Type detection:
- **MCQ**: GFM checkbox list (`- [x]` / `- [ ]`) below heading
- **Short**: blockquote answer < 50 words
- **Long**: blockquote answer ≥ 50 words
- **Override**: prefix with `[MCQ]`, `[SHORT]`, or `[LONG]`

Thematic breaks (`---`) between questions are ignored.

### AI Layer (`src/lib/ai/`)

All Gemini/OpenRouter calls are wrapped with `withRetry()` from `retry.ts` — retries up to 4× on 429 with exponential backoff (2s → 4s → 8s). `friendlyApiError()` maps HTTP status codes to readable messages including the first 120 chars of the response body.

**Grading priority** (short/long answers):
1. User's Gemini key → `gemini.ts`
2. User's OpenRouter key → `openrouter.ts`
3. Demo mode → `/api/ai-check` server proxy (requires `GEMINI_API_KEY` env var, rate-limited 20 req/hour/IP)

**OCR-to-quiz conversion** (`converter.ts`): same Gemini → OpenRouter priority. Converts raw extracted text into `##` headings + checkboxes + blockquotes that `parseQuiz()` understands.

Current model: **`gemini-2.5-flash`** across all Gemini calls.

### Storage (`src/lib/storage/`)

IndexedDB schema in `db.ts` — **DB version 2**. Four stores:

| Store | Key | Purpose |
|---|---|---|
| `quizFiles` | `id` | Parsed quiz files |
| `testSessions` | `id` | Active and completed sessions |
| `settings` | `key` | API keys, demo mode flag |
| `ocrCache` | `hash` (SHA-256) | OCR+converted markdown, cached by file content |

When adding a new store, bump `DB_VERSION` and add an `if (oldVersion < N)` branch in the `upgrade()` callback.

### Key Types (`src/lib/markdown/types.ts`)

`QuizFile` → `Question[]` + `QuizMetadata` (title, description, author, tags, timeLimit). `TestSession` → `Question[]` + `Record<string, UserAnswer>`. `OcrCacheEntry` → `{ hash, markdown, method, converted }`. `AppSettings` → API keys + demo mode flag.

### App Routes

| Route | Purpose |
|---|---|
| `/` | Upload — markdown, PDF, images |
| `/library` | Browse, select, delete, export quiz files |
| `/editor/[quizId]` | Edit quiz — structured card view or raw markdown source |
| `/test/configure` | Mode, type filter, count, time limit |
| `/test/[sessionId]` | Active test |
| `/test/results/[sessionId]` | Score + per-question review |
| `/settings` | API key config + key tester |
| `/api/ai-check` | Server proxy for demo mode grading |

### Editor (`src/app/editor/[quizId]/page.tsx`)

Two modes toggled per-quiz:
- **Structured**: renders `QuestionCard` components (edit question text, options, answer inline)
- **Source**: raw markdown textarea — parsed live with `parseQuestions()`, error shown if invalid

Saves via `saveQuizFile()` with a re-serialized `rawMarkdown` via `serializeQuiz()` (`src/lib/markdown/serializer.ts`). The serializer round-trips `QuizMetadata` as YAML frontmatter and reconstructs `##` headings + checkboxes + blockquotes.

### Export (`src/lib/export.ts`)

`downloadMarkdown()`, `downloadJson()`, `downloadPdf()` — all trigger browser download via `URL.createObjectURL`. PDF export builds a print-styled HTML blob. `DownloadMenu` component (`src/components/DownloadMenu.tsx`) wraps these in a dropdown on library cards.

### Theme

`ThemeProvider` + `ThemeToggle` components (`src/components/`) — dark/light mode via `next-themes`. Provider wraps the root layout.

### Conventions

- All JSX conditionals use ternary `? … : null` — never `&&` (avoids rendering `0`/`NaN` as text)
- No barrel files — import directly from source files
- `'use client'` goes only on the boundary component, not on utility modules it imports
- OCR utility files (`pdf-extract.ts`, `tesseract-ocr.ts`, `gemini-vision.ts`) are plain modules — `'use client'` is only on `pipeline.ts`
- Heavy OCR libs (`pdfjs-dist`, `tesseract.js`) are dynamic-imported inside functions to keep the initial bundle small

### Testing

Vitest + `happy-dom`. `@` alias → `src/`. Tests in `__tests__/` next to source.
