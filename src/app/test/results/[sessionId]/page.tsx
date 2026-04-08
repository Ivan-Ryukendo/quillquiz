"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSession, saveSession } from "@/lib/storage/session-store";
import { checkAnswersBatch } from "@/lib/ai/checker";
import { computeScore, type ScoreBreakdown } from "@/lib/test-engine/scoring";
import type { TestSession, UserAnswer } from "@/lib/markdown/types";
import type { BatchGradeItem } from "@/lib/ai/prompts";

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<TestSession | null>(null);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [expandedQ, setExpandedQ] = useState<Set<string>>(new Set());
  const [grading, setGrading] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);

  const getUngradedItems = useCallback((s: TestSession): BatchGradeItem[] => {
    const items: BatchGradeItem[] = [];
    for (const q of s.questions) {
      const answer = s.answers[q.id];
      if (
        answer?.textAnswer &&
        answer.aiScore === undefined &&
        q.referenceAnswer &&
        (q.type === "short" || q.type === "long")
      ) {
        items.push({
          questionId: q.id,
          question: q.text,
          referenceAnswer: q.referenceAnswer,
          studentAnswer: answer.textAnswer,
          type: q.type,
        });
      }
    }
    return items;
  }, []);

  const runGrading = useCallback(async (s: TestSession) => {
    const ungradedItems = getUngradedItems(s);
    if (ungradedItems.length === 0) return;

    setGrading(true);
    setGradingError(null);

    try {
      const results = await checkAnswersBatch(ungradedItems);
      const updated = { ...s };
      updated.answers = { ...updated.answers };

      for (const [questionId, grade] of Object.entries(results)) {
        const existing = updated.answers[questionId];
        if (existing) {
          updated.answers[questionId] = {
            ...existing,
            aiScore: grade.score,
            aiFeedback: grade.feedback,
            keyMissing: grade.keyMissing,
            isCorrect: grade.score >= 70,
          };
        }
      }

      await saveSession(updated);
      setSession(updated);
      setScore(computeScore(updated.questions, updated.answers));
    } catch (err) {
      setGradingError(err instanceof Error ? err.message : "AI grading failed");
    } finally {
      setGrading(false);
    }
  }, [getUngradedItems]);

  useEffect(() => {
    getSession(sessionId).then((s) => {
      if (!s) {
        router.push("/library");
        return;
      }
      setSession(s);
      setScore(computeScore(s.questions, s.answers));
      runGrading(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, router]);

  if (!session || !score) {
    return <p className="text-gray-500">Loading results...</p>;
  }

  const toggleExpand = (id: string) => {
    setExpandedQ((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasUngraded = getUngradedItems(session).length > 0;
  const duration = session.finishedAt
    ? Math.round((session.finishedAt - session.startedAt) / 1000 / 60)
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Results</h1>

      {/* Score card */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8">
        <div className="text-center mb-4">
          {grading || hasUngraded ? (
            <>
              <div className="text-5xl font-bold text-gray-400">{score.percentage}%</div>
              <p className="text-amber-500 text-sm mt-1">
                Grading in progress... (MCQ scores shown)
              </p>
            </>
          ) : (
            <>
              <div
                className={`text-5xl font-bold ${
                  score.percentage >= 70
                    ? "text-green-500"
                    : score.percentage >= 40
                    ? "text-yellow-500"
                    : "text-red-500"
                }`}
              >
                {score.percentage}%
              </div>
              <p className="text-gray-500 text-sm mt-1">
                {score.correct} / {score.total} questions
                {duration !== null ? ` in ${duration} min` : ""}
              </p>
            </>
          )}
        </div>

        {gradingError ? (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{gradingError}</p>
            <button
              onClick={() => runGrading(session)}
              className="mt-2 px-3 py-1.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs hover:bg-red-200 dark:hover:bg-red-800"
            >
              Retry Grading
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          {score.byType.mcq.total > 0 ? (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="font-medium">MCQ</div>
              <div className="text-gray-500">
                {score.byType.mcq.correct}/{score.byType.mcq.total} correct
              </div>
              <div className="text-xs text-gray-400">{score.byType.mcq.percentage}%</div>
            </div>
          ) : null}
          {score.byType.short.total > 0 || (grading && session.questions.some((q) => q.type === "short")) ? (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="font-medium">Short</div>
              <div className="text-gray-500">
                {grading && score.byType.short.total === 0
                  ? "Grading..."
                  : `Avg: ${score.byType.short.avgScore}/100`}
              </div>
              <div className="text-xs text-gray-400">
                {session.questions.filter((q) => q.type === "short").length} questions
              </div>
            </div>
          ) : null}
          {score.byType.long.total > 0 || (grading && session.questions.some((q) => q.type === "long")) ? (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="font-medium">Long</div>
              <div className="text-gray-500">
                {grading && score.byType.long.total === 0
                  ? "Grading..."
                  : `Avg: ${score.byType.long.avgScore}/100`}
              </div>
              <div className="text-xs text-gray-400">
                {session.questions.filter((q) => q.type === "long").length} questions
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Question review */}
      <h2 className="text-lg font-medium mb-4">Question Review</h2>
      <div className="space-y-3">
        {session.questions.map((question, index) => {
          const answer: UserAnswer | undefined = session.answers[question.id];
          const isExpanded = expandedQ.has(question.id);
          const isCorrect = answer?.isCorrect === true;
          const isPendingGrade = answer?.textAnswer && answer.aiScore === undefined;

          return (
            <div
              key={question.id}
              className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(question.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isPendingGrade
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      : answer
                      ? isCorrect
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="text-sm flex-1 truncate">{question.text}</span>
                <span className="text-xs text-gray-400 uppercase">{question.type}</span>
                {isPendingGrade ? (
                  <span className="text-xs text-amber-500">Grading...</span>
                ) : answer?.aiScore !== undefined ? (
                  <span className="text-xs text-gray-500">{answer.aiScore}/100</span>
                ) : null}
                <span className="text-gray-400">{isExpanded ? "−" : "+"}</span>
              </button>

              {isExpanded ? (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                  <div className="prose dark:prose-invert text-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {question.text}
                    </ReactMarkdown>
                  </div>

                  {question.type === "mcq" && question.options ? (
                    <div className="space-y-1">
                      {question.options.map((opt, i) => {
                        const wasSelected = answer?.selectedOptions?.includes(i);
                        return (
                          <div
                            key={i}
                            className={`text-sm px-3 py-1.5 rounded ${
                              opt.isCorrect
                                ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                                : wasSelected
                                ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                                : "text-gray-500"
                            }`}
                          >
                            {wasSelected ? (opt.isCorrect ? "V " : "X ") : "  "}
                            {opt.text}
                            {opt.isCorrect ? " (correct)" : ""}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {question.type === "short" || question.type === "long" ? (
                    <>
                      {answer?.textAnswer ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Your answer:</p>
                          <p className="text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded">
                            {answer.textAnswer}
                          </p>
                        </div>
                      ) : null}
                      {question.referenceAnswer ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Reference answer:</p>
                          <p className="text-sm bg-blue-50 dark:bg-blue-950 p-3 rounded">
                            {question.referenceAnswer}
                          </p>
                        </div>
                      ) : null}
                      {isPendingGrade ? (
                        <p className="text-sm text-amber-500 italic">Grading in progress...</p>
                      ) : null}
                      {answer?.aiFeedback ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">AI Feedback:</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {answer.aiFeedback}
                          </p>
                        </div>
                      ) : null}
                      {answer?.keyMissing && answer.keyMissing.length > 0 ? (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Missed concepts:</p>
                          <ul className="text-sm text-gray-500 list-disc ml-4">
                            {answer.keyMissing.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={() => router.push("/library")}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Back to Library
        </button>
        <button
          onClick={() => {
            const ids = session.config.quizFileIds.join(",");
            router.push(`/test/configure?files=${ids}`);
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
        >
          Retake Test
        </button>
      </div>
    </div>
  );
}
