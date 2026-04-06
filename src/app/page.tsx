"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseQuiz } from "@/lib/markdown/parser";
import { saveQuizFile } from "@/lib/storage/quiz-store";
import { UploadCloud, FileText, ArrowRight, Sparkles, BookOpen } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList) => {
      setError(null);
      setUploading(true);

      try {
        const mdFiles = Array.from(files).filter(
          (f) => f.name.endsWith(".md") || f.name.endsWith(".markdown")
        );

        if (mdFiles.length === 0) {
          setError("Please upload .md or .markdown files.");
          setUploading(false);
          return;
        }

        for (const file of mdFiles) {
          const text = await file.text();
          const quizFile = parseQuiz(text, file.name);

          if (quizFile.questions.length === 0) {
            setError(
              `No questions detected in ${file.name}. Make sure questions use ## headings.`
            );
            setUploading(false);
            return;
          }

          await saveQuizFile(quizFile);
        }

        router.push("/library");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process files.");
      } finally {
        setUploading(false);
      }
    },
    [router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDemoLoad = async () => {
    setUploading(true);
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
    } finally {
      setUploading(false);
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
          Write once, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">quiz forever</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
          Transform your markdown files into interactive quizzes instantly. 
          Support for multiple choice and free-text answers with smart AI grading.
        </p>
      </div>

      {/* Upload Area */}
      <div className="w-full max-w-xl relative group">
        <div className={`absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 ${isDragging ? 'opacity-50 blur-md' : ''}`} />
        
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
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".md,.markdown";
            input.multiple = true;
            input.onchange = (e) => {
              const target = e.target as HTMLInputElement;
              if (target.files) handleFiles(target.files);
            };
            input.click();
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-4 text-emerald-600 dark:text-emerald-400">
              <div className="w-10 h-10 border-4 border-current border-t-transparent rounded-full animate-spin" />
              <p className="font-medium animate-pulse">Parsing markdown...</p>
            </div>
          ) : (
            <>
              <div className={`p-4 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 transition-transform duration-300 ${isDragging ? 'scale-110 text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50' : 'group-hover:scale-110'}`}>
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Drop markdown files here
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  or click to browse from your computer
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4 text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-md">
                <FileText className="w-3.5 h-3.5" />
                <span>Supports .md and .markdown</span>
              </div>
            </>
          )}
        </div>
      </div>

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
          disabled={uploading}
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
