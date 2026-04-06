"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseQuiz } from "@/lib/markdown/parser";
import { saveQuizFile } from "@/lib/storage/quiz-store";
import { runOcrPipeline, type OcrProgressEvent } from "@/lib/ocr/pipeline";
import {
  UploadCloud,
  FileText,
  ArrowRight,
  Sparkles,
  BookOpen,
  ScanText,
} from "lucide-react";

type ProcessingStage =
  | { type: "idle" }
  | { type: "parsing" }
  | { type: "ocr"; stage: OcrProgressEvent["stage"]; page?: number; total?: number };

function stageLabel(stage: ProcessingStage): string {
  if (stage.type === "idle") return "";
  if (stage.type === "parsing") return "Parsing markdown…";
  const labels: Record<OcrProgressEvent["stage"], string> = {
    cache: "Checking cache…",
    pdfjs: "Extracting text…",
    tesseract: stage.page
      ? `OCR page ${stage.page}/${stage.total}…`
      : "Running OCR…",
    gemini: stage.page
      ? `Gemini Vision page ${stage.page}/${stage.total}…`
      : "Gemini Vision OCR…",
  };
  return labels[stage.stage];
}

const ACCEPTED = ".md,.markdown,.pdf,.png,.jpg,.jpeg,.webp,.gif";

export default function HomePage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<ProcessingStage>({ type: "idle" });
  const [error, setError] = useState<string | null>(null);

  const busy = stage.type !== "idle";

  const handleFiles = useCallback(
    async (files: FileList) => {
      setError(null);

      const all = Array.from(files);
      if (all.length === 0) return;

      // Separate markdown from OCR-able files
      const mdFiles = all.filter(
        (f) => f.name.endsWith(".md") || f.name.endsWith(".markdown")
      );
      const ocrFiles = all.filter((f) => {
        const name = f.name.toLowerCase();
        return (
          name.endsWith(".pdf") ||
          name.endsWith(".png") ||
          name.endsWith(".jpg") ||
          name.endsWith(".jpeg") ||
          name.endsWith(".webp") ||
          name.endsWith(".gif")
        );
      });

      if (mdFiles.length === 0 && ocrFiles.length === 0) {
        setError("Please upload .md, .markdown, .pdf, or image files.");
        return;
      }

      try {
        // ── Process markdown files directly ──────────────────────────────────
        for (const file of mdFiles) {
          setStage({ type: "parsing" });
          const text = await file.text();
          const quizFile = parseQuiz(text, file.name);
          if (quizFile.questions.length === 0) {
            setError(
              `No questions detected in ${file.name}. Make sure questions use ## headings.`
            );
            setStage({ type: "idle" });
            return;
          }
          await saveQuizFile(quizFile);
        }

        // ── Process PDF / image files via OCR pipeline ────────────────────
        for (const file of ocrFiles) {
          const result = await runOcrPipeline(file, (event) => {
            setStage({ type: "ocr", ...event });
          });

          // Save the OCR'd markdown as a quiz file
          const quizFile = parseQuiz(result.markdown, file.name);

          if (quizFile.questions.length === 0) {
            // No quiz structure detected — save as a raw markdown note so the
            // user can still see / copy the extracted text from the library.
            const rawQuizFile = parseQuiz(
              `# ${file.name}\n\n${result.markdown}`,
              file.name
            );
            await saveQuizFile(rawQuizFile);
          } else {
            await saveQuizFile(quizFile);
          }
        }

        router.push("/library");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process files.");
        setStage({ type: "idle" });
      }
    },
    [router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDemoLoad = async () => {
    setStage({ type: "parsing" });
    setError(null);
    try {
      const res = await fetch("/demo-quiz.md");
      if (!res.ok) throw new Error("Demo file not found");
      const text = await res.text();
      const quizFile = parseQuiz(text, "demo-quiz.md");
      await saveQuizFile(quizFile);
      router.push("/library");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load demo.");
      setStage({ type: "idle" });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12 animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="text-center space-y-6 max-w-2xl mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          <span>Interactive Learning Environment</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 dark:text-white">
          Write once,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
            quiz forever
          </span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
          Transform your markdown files, PDFs, and images into interactive
          quizzes instantly. Support for multiple choice and free-text answers
          with smart AI grading.
        </p>
      </div>

      {/* Upload Area */}
      <div className="w-full max-w-xl relative group">
        <div
          className={`absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 ${
            isDragging ? "opacity-50 blur-md" : ""
          }`}
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative w-full rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ease-in-out cursor-pointer flex flex-col items-center justify-center gap-4 bg-white dark:bg-slate-950 ${
            isDragging
              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 scale-[1.02]"
              : "border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700"
          }`}
          onClick={() => {
            if (busy) return;
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ACCEPTED;
            input.multiple = true;
            input.onchange = (e) => {
              const target = e.target as HTMLInputElement;
              if (target.files) handleFiles(target.files);
            };
            input.click();
          }}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-4 text-emerald-600 dark:text-emerald-400">
              <div className="w-10 h-10 border-4 border-current border-t-transparent rounded-full animate-spin" />
              <p className="font-medium animate-pulse">{stageLabel(stage)}</p>
            </div>
          ) : (
            <>
              <div
                className={`p-4 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 transition-transform duration-300 ${
                  isDragging
                    ? "scale-110 text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50"
                    : "group-hover:scale-110"
                }`}
              >
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Drop files here
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  or click to browse from your computer
                </p>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
                <span className="flex items-center gap-1.5 text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-md">
                  <FileText className="w-3.5 h-3.5" />
                  .md / .markdown
                </span>
                <span className="flex items-center gap-1.5 text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-md">
                  <ScanText className="w-3.5 h-3.5" />
                  .pdf / images
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* OCR note */}
      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 max-w-md text-center">
        PDFs &amp; images are processed locally in your browser. Add a Gemini
        API key in{" "}
        <button
          onClick={() => router.push("/settings")}
          className="underline hover:text-slate-600 dark:hover:text-slate-300"
        >
          Settings
        </button>{" "}
        for higher-quality OCR.
      </p>

      {/* Error Message */}
      {error && (
        <div className="mt-6 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm max-w-lg text-center flex items-center gap-2 animate-in slide-in-from-top-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400 shrink-0" />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
        <button
          onClick={handleDemoLoad}
          disabled={busy}
          className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
        >
          <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          Try Demo Quiz
        </button>
        <button
          onClick={() => router.push("/library")}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-all cursor-pointer shadow-sm hover:shadow group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
        >
          Go to Library
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
