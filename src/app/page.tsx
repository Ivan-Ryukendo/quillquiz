"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseQuiz } from "@/lib/markdown/parser";
import { saveQuizFile } from "@/lib/storage/quiz-store";
import { runOcrPipeline, type OcrStage } from "@/lib/ocr/pipeline";
import {
  UploadCloud,
  ArrowRight,
  BookOpen,
} from "lucide-react";

type ProcessingStage =
  | { type: "idle" }
  | { type: "parsing" }
  | { type: "ocr"; stage: OcrStage; page?: number; total?: number };

function stageLabel(stage: ProcessingStage): string {
  if (stage.type === "idle") return "";
  if (stage.type === "parsing") return "Parsing document...";
  const labels: Record<OcrStage, string> = {
    cache: "Checking cache...",
    pdfjs: "Extracting text...",
    tesseract: stage.page
      ? `OCR page ${stage.page}/${stage.total}...`
      : "Running OCR...",
    gemini: stage.page
      ? `AI Vision page ${stage.page}/${stage.total}...`
      : "AI Vision OCR...",
    converting: "Converting to quiz...",
  };
  return labels[stage.stage];
}

const ACCEPTED = ".md,.markdown,.pdf,.png,.jpg,.jpeg,.webp,.gif";

export default function HomePage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<ProcessingStage>({ type: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");

  const busy = stage.type !== "idle";

  const handleFiles = useCallback(
    async (files: FileList) => {
      setError(null);

      const all = Array.from(files);
      if (all.length === 0) return;

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

        for (const file of ocrFiles) {
          const result = await runOcrPipeline(file, (event) => {
            setStage({ type: "ocr", ...event });
          });

          const quizFile = parseQuiz(result.markdown, file.name);

          if (quizFile.questions.length === 0 && !result.converted) {
            setError(
              `No quiz structure detected in ${file.name}. Add an API key in Settings to auto-convert.`
            );
            await saveQuizFile(parseQuiz(`# ${file.name}\n\n${result.markdown}`, file.name));
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
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-12 animate-in fade-in duration-700">
      <div className="text-center space-y-8 max-w-2xl mb-16">
        <h1 className="text-5xl sm:text-7xl font-serif font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
          Write once. <br />
          <span className="italic font-light text-slate-600 dark:text-slate-300">Quiz forever.</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 font-light max-w-xl mx-auto leading-relaxed">
          Transform your documents, PDFs, and notes into interactive assessments instantly. Designed for clarity, focused on learning.
        </p>
      </div>

      <div className="w-full max-w-xl mb-12">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative w-full border p-12 text-center transition-all duration-300 ease-in-out cursor-pointer flex flex-col items-center justify-center gap-6 bg-transparent ${
            isDragging
              ? "border-slate-900 dark:border-slate-100 scale-[1.01]"
              : "border-slate-300 dark:border-slate-700 hover:border-slate-500 dark:hover:border-slate-400"
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
            <div className="flex flex-col items-center gap-4 text-slate-900 dark:text-slate-100">
              <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <p className="font-serif tracking-wide animate-pulse">{stageLabel(stage)}</p>
            </div>
          ) : (
            <>
              <UploadCloud className="w-8 h-8 text-slate-900 dark:text-slate-100" strokeWidth={1.5} />
              <div className="space-y-2">
                <p className="text-xl font-serif font-medium text-slate-900 dark:text-slate-100">
                  Select or drop files
                </p>
                <p className="text-sm font-light text-slate-500 dark:text-slate-400">
                  Supported formats: MD, PDF, PNG, JPG
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="mb-12 px-6 py-4 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 text-sm max-w-lg text-center animate-in slide-in-from-top-2">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <button
          onClick={handleDemoLoad}
          disabled={busy}
          className="flex items-center gap-2 px-8 py-3 bg-transparent border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors disabled:opacity-50"
        >
          <BookOpen className="w-4 h-4" />
          Try Demo
        </button>
        <button
          onClick={() => router.push("/library")}
          className="flex items-center gap-2 px-8 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
        >
          View Library
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 mt-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Have a share code?
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            className="w-32 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center tracking-widest uppercase"
            onKeyDown={(e) => {
              if (e.key === "Enter" && joinCode.length > 0) {
                router.push(`/join/${joinCode}`);
              }
            }}
          />
          <button
            onClick={() => {
              if (joinCode.length > 0) router.push(`/join/${joinCode}`);
            }}
            disabled={joinCode.length === 0}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}