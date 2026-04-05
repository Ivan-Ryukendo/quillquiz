"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getQuizFile } from "@/lib/storage/quiz-store";
import { saveSession } from "@/lib/storage/session-store";
import { createTestSession } from "@/lib/test-engine/engine";
import type { QuizFile, QuestionType, TestConfig } from "@/lib/markdown/types";

function ConfigureForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [files, setFiles] = useState<QuizFile[]>([]);
  const [mode, setMode] = useState<"shuffle_all" | "group_by_file">("shuffle_all");
  const [includeTypes, setIncludeTypes] = useState<Set<QuestionType>>(
    new Set(["mcq", "short", "long"])
  );
  const [questionCount, setQuestionCount] = useState<number | "">("");
  const [timeLimit, setTimeLimit] = useState<number | "">("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = searchParams.get("files")?.split(",") ?? [];
    Promise.all(ids.map((id) => getQuizFile(id))).then((results) => {
      setFiles(results.filter((f): f is QuizFile => f !== undefined));
      setLoading(false);
    });
  }, [searchParams]);

  const toggleType = (type: QuestionType) => {
    setIncludeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const totalQuestions = files.reduce((sum, f) => sum + f.questions.length, 0);

  const handleStart = async () => {
    const config: TestConfig = {
      quizFileIds: files.map((f) => f.id),
      mode,
      includeTypes: Array.from(includeTypes),
      questionCount: questionCount ? Number(questionCount) : undefined,
      timeLimit: timeLimit ? Number(timeLimit) : undefined,
    };

    const session = createTestSession(config, files);
    await saveSession(session);
    router.push(`/test/${session.id}`);
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  if (files.length === 0) {
    return (
      <div className="text-center pt-12">
        <p className="text-gray-500 mb-4">No files selected.</p>
        <button
          onClick={() => router.push("/library")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          Go to Library
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configure Test</h1>

      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Selected Files</h2>
        <div className="space-y-1">
          {files.map((f) => (
            <div key={f.id} className="text-sm">
              {f.metadata.title || f.filename}{" "}
              <span className="text-gray-400">({f.questions.length} questions)</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">{totalQuestions} total questions</p>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Question Order</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setMode("shuffle_all")}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              mode === "shuffle_all"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            Shuffle All
          </button>
          <button
            onClick={() => setMode("group_by_file")}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              mode === "group_by_file"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            Group by File
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Question Types</h2>
        <div className="flex gap-3">
          {(["mcq", "short", "long"] as QuestionType[]).map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                includeTypes.has(type)
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600"
                  : "border-gray-200 dark:border-gray-700 text-gray-400"
              }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-500 block mb-1">
            Max Questions
          </label>
          <input
            type="number"
            min={1}
            max={totalQuestions}
            placeholder="All"
            value={questionCount}
            onChange={(e) =>
              setQuestionCount(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-transparent"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500 block mb-1">
            Time Limit (min)
          </label>
          <input
            type="number"
            min={1}
            placeholder="None"
            value={timeLimit}
            onChange={(e) =>
              setTimeLimit(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-transparent"
          />
        </div>
      </div>

      <button
        onClick={handleStart}
        className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
      >
        Start Test
      </button>
    </div>
  );
}

export default function ConfigurePage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
      <ConfigureForm />
    </Suspense>
  );
}
