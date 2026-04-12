"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAllQuizFiles } from "@/lib/storage/quiz-store";
import { getSettings } from "@/lib/storage/settings-store";
import type { QuizFile, Question } from "@/lib/markdown/types";

type ProctoringLevel = "standard" | "aggressive" | "visibility";

const PROCTORING_DESCRIPTIONS: Record<ProctoringLevel, string> = {
  standard:
    "Fullscreen requested, tab switching and copy/paste logged, keyboard shortcuts blocked.",
  aggressive:
    "Everything in Standard + enforced fullscreen (exam pauses on exit), dev tools detection.",
  visibility:
    "Deterrent model — every violation loudly visible to teacher with timestamps and durations.",
};

function ExamCreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  const createSharedQuiz = useMutation(api.sharedQuizzes.create);
  const createExamSession = useMutation(api.examSessions.create);

  const [quizFiles, setQuizFiles] = useState<QuizFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings form state
  const [timeLimit, setTimeLimit] = useState("");
  const [allowLateJoins, setAllowLateJoins] = useState(false);
  const [lateJoinFullTime, setLateJoinFullTime] = useState(true);
  const [proctoringLevel, setProctoringLevel] =
    useState<ProctoringLevel>("standard");
  const [enforceLogin, setEnforceLogin] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    const ids = searchParams.get("files")?.split(",").filter(Boolean) ?? [];
    getAllQuizFiles().then((all) => {
      setQuizFiles(all.filter((f) => ids.includes(f.id)));
      setLoadingFiles(false);
    });
  }, [searchParams]);

  const handleCreate = async () => {
    if (quizFiles.length === 0) return;
    setError(null);
    setCreating(true);

    try {
      const combinedMarkdown = quizFiles
        .map((f) => f.rawMarkdown)
        .join("\n\n---\n\n");

      const title =
        quizFiles.length === 1
          ? (quizFiles[0].metadata.title ?? quizFiles[0].filename)
          : `Combined Exam (${quizFiles.length} files)`;

      if (new TextEncoder().encode(combinedMarkdown).length > 5 * 1024 * 1024) {
        throw new Error("Combined quiz exceeds 5MB limit");
      }

      const settings = await getSettings();
      const apiKey =
        settings.geminiApiKey || settings.openrouterApiKey || undefined;

      const allQuestions: Question[] = quizFiles.flatMap((f) => f.questions);
      const questions = allQuestions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        body: q.body,
        options: q.options?.map((o) => ({ text: o.text })),
      }));

      const correctAnswers = allQuestions
        .filter((q) => q.type === "mcq" && q.options)
        .map((q) => ({
          questionId: q.id,
          correctOptions: q
            .options!.map((o, i) => (o.isCorrect ? i : -1))
            .filter((i) => i >= 0),
        }));

      const referenceAnswers = allQuestions
        .filter(
          (q) =>
            (q.type === "short" || q.type === "long") && q.referenceAnswer
        )
        .map((q) => ({
          questionId: q.id,
          referenceAnswer: q.referenceAnswer!,
        }));

      const { id: quizId } = await createSharedQuiz({
        markdown: combinedMarkdown,
        metadata: {
          title,
          description: `Live exam — ${new Date().toLocaleDateString()}`,
        },
      });

      const { id: examId } = await createExamSession({
        quizId,
        settings: {
          timeLimit: timeLimit ? parseInt(timeLimit) * 60 * 1000 : undefined,
          allowLateJoins,
          lateJoinFullTime,
          proctoringLevel,
          enforceLogin,
          teacherPin: pin.trim() || undefined,
        },
        apiKey,
        questions,
        correctAnswers,
        referenceAnswers,
      });

      router.push(`/exam/host/${examId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create exam"
      );
      setCreating(false);
    }
  };

  if (authLoading || loadingFiles) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Sign in required to host live exams.</p>
        <a href="/settings" className="text-blue-500 underline text-sm">
          Go to Settings
        </a>
      </div>
    );
  }

  if (quizFiles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No quiz files selected.</p>
        <button
          onClick={() => router.push("/library")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
        >
          Back to Library
        </button>
      </div>
    );
  }

  const totalQuestions = quizFiles.reduce(
    (sum, f) => sum + f.questions.length,
    0
  );

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2">Create Live Exam</h1>
      <p className="text-gray-500 text-sm mb-8">
        {quizFiles.length === 1
          ? (quizFiles[0].metadata.title ?? quizFiles[0].filename)
          : `${quizFiles.length} quiz files`}{" "}
        · {totalQuestions} questions
      </p>

      <div className="space-y-6">
        {/* Time limit */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Time limit (minutes)
          </label>
          <input
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            placeholder="No limit"
            min="1"
            max="300"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Late joins */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Allow late joins</p>
            <p className="text-xs text-gray-400">
              Students can join after exam starts
            </p>
          </div>
          <button
            onClick={() => setAllowLateJoins((v) => !v)}
            className={`w-10 h-5 rounded-full transition-colors ${
              allowLateJoins ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`block w-4 h-4 mx-0.5 bg-white rounded-full shadow transition-transform ${
                allowLateJoins ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {allowLateJoins ? (
          <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium mb-2">Latecomers get</p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={lateJoinFullTime}
                  onChange={() => setLateJoinFullTime(true)}
                  className="accent-blue-500"
                />
                Full time
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={!lateJoinFullTime}
                  onChange={() => setLateJoinFullTime(false)}
                  className="accent-blue-500"
                />
                Reduced (global timer)
              </label>
            </div>
          </div>
        ) : null}

        {/* Proctoring level */}
        <div>
          <p className="text-sm font-medium mb-2">Proctoring level</p>
          <div className="space-y-2">
            {(["standard", "aggressive", "visibility"] as ProctoringLevel[]).map(
              (level) => (
                <label
                  key={level}
                  className={`block border rounded-lg p-3 cursor-pointer transition-colors ${
                    proctoringLevel === level
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="proctoring"
                      value={level}
                      checked={proctoringLevel === level}
                      onChange={() => setProctoringLevel(level)}
                      className="accent-blue-500"
                    />
                    <span className="text-sm font-medium capitalize">
                      {level === "visibility" ? "Visibility-focused" : level}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 pl-5">
                    {PROCTORING_DESCRIPTIONS[level]}
                  </p>
                </label>
              )
            )}
          </div>
        </div>

        {/* Enforce login */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enforce student login</p>
            <p className="text-xs text-gray-400">
              Students must sign in (prevents link sharing)
            </p>
          </div>
          <button
            onClick={() => setEnforceLogin((v) => !v)}
            className={`w-10 h-5 rounded-full transition-colors ${
              enforceLogin ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`block w-4 h-4 mx-0.5 bg-white rounded-full shadow transition-transform ${
                enforceLogin ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* PIN */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Exam PIN (optional)
          </label>
          <input
            type="text"
            value={pin}
            onChange={(e) => setPin(e.target.value.slice(0, 8))}
            placeholder="Leave blank for no PIN"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : null}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? "Creating Exam..." : "Create Exam"}
        </button>
      </div>
    </div>
  );
}

export default function ExamCreatePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ExamCreatePageInner />
    </Suspense>
  );
}
