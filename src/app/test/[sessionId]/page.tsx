"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSession, saveSession } from "@/lib/storage/session-store";
import { checkMcqAnswer } from "@/lib/test-engine/engine";
import type { TestSession, Question, UserAnswer } from "@/lib/markdown/types";

const MAX_LENGTH = { short: 500, long: 5000 } as const;

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<TestSession | null>(null);
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [mcqSelections, setMcqSelections] = useState<Record<string, Set<number>>>({});
  const [mcqFeedback, setMcqFeedback] = useState<Record<string, { isCorrect: boolean }>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    getSession(sessionId).then((s) => {
      if (!s || s.status !== "in_progress") {
        router.push("/library");
        return;
      }
      setSession(s);
      if (s.config.timeLimit) {
        const elapsed = (Date.now() - s.startedAt) / 1000 / 60;
        const remaining = Math.max(0, s.config.timeLimit - elapsed);
        setTimeLeft(Math.round(remaining * 60));
      }
    });
  }, [sessionId, router]);

  // Timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Auto-finish when time runs out
  useEffect(() => {
    if (timeLeft === 0 && session) {
      handleSubmitAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const saveAndUpdate = useCallback(async (updated: TestSession) => {
    await saveSession(updated);
    setSession(updated);
  }, []);

  const handleMcqSelect = (question: Question, index: number) => {
    if (mcqFeedback[question.id]) return;

    const hasMultipleCorrect =
      question.options!.filter((o) => o.isCorrect).length > 1;

    if (hasMultipleCorrect) {
      setMcqSelections((prev) => {
        const current = prev[question.id] ?? new Set<number>();
        const next = new Set(current);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return { ...prev, [question.id]: next };
      });
    } else {
      const selected = [index];
      const isCorrect = checkMcqAnswer(question, selected);
      const answer: UserAnswer = {
        questionId: question.id,
        selectedOptions: selected,
        isCorrect,
        answeredAt: Date.now(),
      };
      const updated = { ...session! };
      updated.answers = { ...updated.answers, [question.id]: answer };
      saveAndUpdate(updated);
      setMcqSelections((prev) => ({ ...prev, [question.id]: new Set(selected) }));
      setMcqFeedback((prev) => ({ ...prev, [question.id]: { isCorrect } }));
    }
  };

  const handleMultiMcqCheck = (question: Question) => {
    const selections = mcqSelections[question.id];
    if (!selections || selections.size === 0 || mcqFeedback[question.id]) return;

    const selected = Array.from(selections);
    const isCorrect = checkMcqAnswer(question, selected);
    const answer: UserAnswer = {
      questionId: question.id,
      selectedOptions: selected,
      isCorrect,
      answeredAt: Date.now(),
    };
    const updated = { ...session! };
    updated.answers = { ...updated.answers, [question.id]: answer };
    saveAndUpdate(updated);
    setMcqFeedback((prev) => ({ ...prev, [question.id]: { isCorrect } }));
  };

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const jumpToNextFlagged = () => {
    if (flagged.size === 0 || !session) return;
    const flaggedIds = session.questions
      .filter((q) => flagged.has(q.id))
      .map((q) => q.id);
    if (flaggedIds.length === 0) return;

    const scrollY = window.scrollY;
    let targetId = flaggedIds[0]; // default: wrap to first
    for (const id of flaggedIds) {
      const el = questionRefs.current[id];
      if (el && el.offsetTop > scrollY + 100) {
        targetId = id;
        break;
      }
    }
    questionRefs.current[targetId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmitAll = async () => {
    if (!session) return;

    const updated = { ...session };
    updated.answers = { ...updated.answers };

    for (const q of session.questions) {
      if ((q.type === "short" || q.type === "long") && textAnswers[q.id]?.trim()) {
        updated.answers[q.id] = {
          questionId: q.id,
          textAnswer: textAnswers[q.id].trim(),
          answeredAt: Date.now(),
        };
      }
    }

    updated.status = "completed";
    updated.finishedAt = Date.now();
    await saveSession(updated);
    router.push(`/test/results/${session.id}`);
  };

  if (!session) {
    return <p className="text-gray-500">Loading...</p>;
  }

  const answeredCount = session.questions.filter((q) => {
    if (q.type === "mcq") return !!session.answers[q.id];
    return !!textAnswers[q.id]?.trim();
  }).length;

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 py-3 -mx-4 mb-6">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{session.questions.length} questions</span>
          {timeLeft !== null ? (
            <span
              className={`font-mono text-lg ${timeLeft < 60 ? "text-red-500 animate-pulse" : ""}`}
            >
              {Math.floor(timeLeft / 60)}:
              {String(timeLeft % 60).padStart(2, "0")}
            </span>
          ) : null}
        </div>
      </div>

      {/* Question cards */}
      <div className="space-y-6">
        {session.questions.map((question, index) => {
          const isFlagged = flagged.has(question.id);
          const feedback = mcqFeedback[question.id];
          const selections = mcqSelections[question.id] ?? new Set<number>();
          const hasMultipleCorrect =
            question.type === "mcq" &&
            question.options!.filter((o) => o.isCorrect).length > 1;

          return (
            <div
              key={question.id}
              ref={(el) => { questionRefs.current[question.id] = el; }}
              className={`border rounded-xl p-5 transition-colors ${
                isFlagged
                  ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-400">{index + 1}</span>
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs uppercase text-gray-500">
                    {question.type}
                  </span>
                </div>
                <button
                  onClick={() => toggleFlag(question.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isFlagged
                      ? "text-amber-500 bg-amber-100 dark:bg-amber-900/40"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  title={isFlagged ? "Unflag question" : "Flag for review"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M3.75 2a.75.75 0 0 1 .75.75V19.25a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 3.75 2ZM5 2.75a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 .53 1.28L11.56 7l3.72 3.72a.75.75 0 0 1-.53 1.28h-9a.75.75 0 0 1-.75-.75v-8.5Z" />
                  </svg>
                </button>
              </div>

              {/* Question text */}
              <div className="prose dark:prose-invert max-w-none text-lg font-medium mb-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {question.text}
                </ReactMarkdown>
              </div>
              {question.body ? (
                <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 mb-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {question.body}
                  </ReactMarkdown>
                </div>
              ) : null}

              {/* MCQ Options */}
              {question.type === "mcq" && question.options ? (
                <div className="space-y-2">
                  {hasMultipleCorrect && !feedback ? (
                    <p className="text-xs text-gray-400 mb-2">Select all that apply</p>
                  ) : null}
                  {question.options.map((option, i) => {
                    const isSelected = selections.has(i);
                    let bgClass = "border-gray-200 dark:border-gray-700 hover:border-gray-300";

                    if (feedback) {
                      if (option.isCorrect) {
                        bgClass = "border-green-500 bg-green-50 dark:bg-green-950";
                      } else if (isSelected && !option.isCorrect) {
                        bgClass = "border-red-500 bg-red-50 dark:bg-red-950";
                      } else {
                        bgClass = "border-gray-200 dark:border-gray-700 opacity-50";
                      }
                    } else if (isSelected) {
                      bgClass = "border-blue-500 bg-blue-50 dark:bg-blue-950";
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleMcqSelect(question, i)}
                        disabled={!!feedback}
                        className={`w-full text-left px-4 py-3 border rounded-lg transition-colors ${bgClass}`}
                      >
                        <span className="text-sm">{option.text}</span>
                      </button>
                    );
                  })}

                  {hasMultipleCorrect && !feedback ? (
                    <button
                      onClick={() => handleMultiMcqCheck(question)}
                      disabled={selections.size === 0}
                      className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40"
                    >
                      Check Answer
                    </button>
                  ) : null}

                  {feedback ? (
                    <div
                      className={`mt-3 p-3 rounded-lg text-sm ${
                        feedback.isCorrect
                          ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                          : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {feedback.isCorrect ? "Correct!" : "Incorrect"}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Text answer */}
              {question.type === "short" || question.type === "long" ? (
                <div>
                  <textarea
                    value={textAnswers[question.id] ?? ""}
                    onChange={(e) =>
                      setTextAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                    }
                    maxLength={MAX_LENGTH[question.type]}
                    placeholder={
                      question.type === "short"
                        ? "Type your answer..."
                        : "Write your detailed answer..."
                    }
                    rows={question.type === "short" ? 3 : 8}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-transparent resize-y"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {(textAnswers[question.id] ?? "").length} / {MAX_LENGTH[question.type]}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Jump to flagged — floating button */}
      {flagged.size > 0 ? (
        <button
          onClick={jumpToNextFlagged}
          className="fixed bottom-24 right-6 z-20 flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-full shadow-lg hover:bg-amber-600 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M3.75 2a.75.75 0 0 1 .75.75V19.25a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 3.75 2ZM5 2.75a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 .53 1.28L11.56 7l3.72 3.72a.75.75 0 0 1-.53 1.28h-9a.75.75 0 0 1-.75-.75v-8.5Z" />
          </svg>
          {flagged.size} flagged
        </button>
      ) : null}

      {/* Submit bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {answeredCount} of {session.questions.length} answered
          </span>
          <button
            onClick={handleSubmitAll}
            disabled={answeredCount === 0}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            Submit All
          </button>
        </div>
      </div>
    </div>
  );
}
