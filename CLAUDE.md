# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run tests once (vitest)
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Run tests with Vitest UI
```

To run a single test file: `npx vitest run src/lib/markdown/__tests__/parser.test.ts`

## Architecture

**QuillQuiz** is a client-side quiz app that parses markdown files into interactive quizzes. All quiz data is stored in IndexedDB (via `idb`) — there is no backend database.

### Data Flow

1. User uploads `.md` / `.markdown` files on the home page
2. `parseQuiz()` → `parseQuestions()` → `detectQuestion()` builds a `QuizFile` with typed `Question[]`
3. `QuizFile` is persisted to IndexedDB via `src/lib/storage/quiz-store.ts`
4. User configures a test session (`TestConfig`) at `/test/configure`
5. `createTestSession()` in `src/lib/test-engine/engine.ts` builds a `TestSession` and saves it
6. The active test runs at `/test/[sessionId]`; results at `/test/results/[sessionId]`

### Question Detection (`src/lib/markdown/detect.ts`)

Questions are `##` (or deeper) headings. H1 headings are section titles and are ignored. Type is determined by:
- **MCQ**: heading has a GFM checkbox list (`- [x]` / `- [ ]`) below it
- **Short**: blockquote answer under 50 words
- **Long**: blockquote answer 50+ words
- **Override**: prefix heading with `[MCQ]`, `[SHORT]`, or `[LONG]` to force a type

Reference answers go in blockquotes (`> answer`). Thematic breaks (`---`) between questions are ignored.

### AI Grading (`src/lib/ai/`)

Free-text answers (short/long) are graded by AI. Priority:
1. User's Gemini API key (`gemini.ts`)
2. User's OpenRouter API key (`openrouter.ts`)
3. Demo mode: proxied through `/api/ai-check` (rate-limited at 20/hour per IP, requires `GEMINI_API_KEY` env var on server)

AI grading returns `{ score: 0–100, feedback: string, keyMissing: string[] }`.

### Storage (`src/lib/storage/`)

- `db.ts` — IndexedDB schema and singleton `getDB()`. Stores: `quizFiles`, `testSessions`, `settings`
- `quiz-store.ts` — CRUD for `QuizFile`
- `session-store.ts` — CRUD for `TestSession`
- `settings-store.ts` — Persists `AppSettings` (API keys, demo mode toggle)

### App Routes

| Route | Purpose |
|---|---|
| `/` | Upload / drag-drop markdown files |
| `/library` | Browse and manage uploaded quiz files |
| `/test/configure` | Select files, mode, question types, count |
| `/test/[sessionId]` | Active test |
| `/test/results/[sessionId]` | Score and per-question review |
| `/settings` | API key configuration |
| `/api/ai-check` | Server-side AI proxy for demo mode |

### Key Types (`src/lib/markdown/types.ts`)

`QuizFile` → contains `Question[]`. `TestSession` → contains `Question[]` + `Record<string, UserAnswer>`. `AppSettings` holds API keys.

### Testing

Tests use Vitest with `happy-dom`. The `@` alias resolves to `src/`. Tests live alongside source in `__tests__/` subdirectories.
