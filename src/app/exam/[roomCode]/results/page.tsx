"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type ExamQuestion = {
  id: string;
  text: string;
  type: "mcq" | "short" | "long";
  options?: { text: string }[];
};

export default function ExamResultsPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const participantId = searchParams.get("pid") as Id<"examParticipants"> | null;

  const exam = useQuery(api.examSessions.getByRoomCode, {
    roomCode: roomCode.toUpperCase(),
  });

  const examDetail = useQuery(
    api.examSessions.getForStudent,
    exam ? { examId: exam._id } : "skip"
  );

  const grades = useQuery(
    api.examAnswers.getGradesForParticipant,
    exam && participantId
      ? { examId: exam._id, participantId }
      : "skip"
  );

  if (!participantId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No participant ID.</p>
        <button
          onClick={() => router.push(`/exam/${roomCode}`)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  if (!exam || !examDetail || grades === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const questions: ExamQuestion[] = examDetail.questions ?? [];
  const gradesByQuestion: Record<string, (typeof grades)[0]> = {};
  for (const g of grades ?? []) {
    gradesByQuestion[g.questionId] = g;
  }

  let mcqCorrect = 0;
  let mcqTotal = 0;
  let aiTotal = 0;
  let aiSum = 0;
  let textUngraded = 0;

  for (const q of questions) {
    const g = gradesByQuestion[q.id];
    if (!g) continue;
    if (q.type === "mcq") {
      mcqTotal++;
      if (g.isCorrect) mcqCorrect++;
    } else if (g.textAnswer) {
      if (g.aiScore !== undefined) {
        aiTotal++;
        aiSum += g.aiScore;
      } else {
        textUngraded++;
      }
    }
  }

  const hasUngraded = textUngraded > 0;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">Your Results</h1>
      <p className="text-gray-500 text-sm mb-6">
        Room: <span className="font-mono">{roomCode.toUpperCase()}</span>
      </p>

      {/* Score summary */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {mcqTotal > 0 ? (
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">
              {mcqCorrect}/{mcqTotal}
            </p>
            <p className="text-xs text-gray-400 mt-1">MCQ correct</p>
          </div>
        ) : null}

        {aiTotal > 0 ? (
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-500">
              {Math.round(aiSum / aiTotal)}%
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Avg AI score ({aiTotal} graded)
            </p>
          </div>
        ) : null}
      </div>

      {hasUngraded ? (
        <div className="mb-6 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          AI grading in progress for {textUngraded} answer
          {textUngraded !== 1 ? "s" : ""}... Scores will appear automatically.
        </div>
      ) : null}

      {/* Per-question breakdown */}
      <div className="space-y-4">
        {questions.map((q, index) => {
          const g = gradesByQuestion[q.id];
          if (!g) return null;

          const isGraded =
            q.type === "mcq"
              ? g.isCorrect !== undefined
              : g.aiScore !== undefined;

          return (
            <div
              key={q.id}
              className={`border rounded-xl p-4 ${
                q.type === "mcq"
                  ? g.isCorrect
                    ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20"
                    : "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-gray-500">
                  {index + 1}. {q.text.slice(0, 100)}
                  {q.text.length > 100 ? "..." : ""}
                </p>
                <span className="ml-3 flex-shrink-0 text-sm font-medium">
                  {q.type === "mcq" ? (
                    g.isCorrect ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-red-500">✗</span>
                    )
                  ) : isGraded ? (
                    <span className="text-blue-600">{g.aiScore}%</span>
                  ) : (
                    <span className="text-gray-400 text-xs">grading...</span>
                  )}
                </span>
              </div>

              {q.type === "mcq" && g.selectedOptions && q.options ? (
                <p className="text-xs text-gray-400">
                  Your answer:{" "}
                  {g.selectedOptions
                    .map((i) => q.options![i]?.text)
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ) : null}

              {q.type !== "mcq" && g.textAnswer ? (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 mb-1">Your answer:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded px-3 py-2">
                    {g.textAnswer.slice(0, 200)}
                    {g.textAnswer.length > 200 ? "..." : ""}
                  </p>
                  {g.aiFeedback ? (
                    <p className="text-xs text-gray-500 mt-2">{g.aiFeedback}</p>
                  ) : null}
                  {g.keyMissing && g.keyMissing.length > 0 ? (
                    <p className="text-xs text-amber-500 mt-1">
                      Missing: {g.keyMissing.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
