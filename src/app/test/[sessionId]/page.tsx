"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSession, saveSession } from "@/lib/storage/session-store";
import { checkMcqAnswer } from "@/lib/test-engine/engine";
import { checkAnswer } from "@/lib/ai/checker";
import type { TestSession, Question, UserAnswer } from "@/lib/markdown/types";

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<TestSession | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set());
  const [textAnswer, setTextAnswer] = useState("");
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    aiScore?: number;
    aiFeedback?: string;
    keyMissing?: string[];
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

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
      finishTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const currentQuestion: Question | undefined =
    session?.questions[session.currentIndex];

  const saveAndUpdate = useCallback(
    async (updated: TestSession) => {
      await saveSession(updated);
      setSession(updated);
    },
    []
  );

  const resetState = () => {
    setSelectedOptions(new Set());
    setTextAnswer("");
    setFeedback(null);
    setChecking(false);
  };

  const handleMcqSelect = (index: number) => {
    if (feedback) return;
    const question = currentQuestion!;
    const hasMultipleCorrect =
      question.options!.filter((o) => o.isCorrect).length > 1;

    if (hasMultipleCorrect) {
      setSelectedOptions((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
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
      setSelectedOptions(new Set(selected));
      setFeedback({ isCorrect });
    }
  };

  const handleMultiMcqCheck = () => {
    if (!currentQuestion || feedback) return;
    const selected = Array.from(selectedOptions);
    const isCorrect = checkMcqAnswer(currentQuestion, selected);
    const answer: UserAnswer = {
      questionId: currentQuestion.id,
      selectedOptions: selected,
      isCorrect,
      answeredAt: Date.now(),
    };
    const updated = { ...session! };
    updated.answers = { ...updated.answers, [currentQuestion.id]: answer };
    saveAndUpdate(updated);
    setFeedback({ isCorrect });
  };

  const handleTextSubmit = async () => {
    if (!currentQuestion || !textAnswer.trim() || checking) return;
    setChecking(true);

    const answer: UserAnswer = {
      questionId: currentQuestion.id,
      textAnswer: textAnswer.trim(),
      answeredAt: Date.now(),
    };

    if (currentQuestion.referenceAnswer) {
      try {
        const result = await checkAnswer(
          currentQuestion.text,
          currentQuestion.referenceAnswer,
          textAnswer.trim(),
          currentQuestion.type as "short" | "long"
        );
        answer.aiScore = result.score;
        answer.aiFeedback = result.feedback;
        answer.keyMissing = result.keyMissing;
        answer.isCorrect = result.score >= 70;
      } catch (err) {
        answer.aiFeedback =
          err instanceof Error ? err.message : "AI grading failed";
      }
    }

    const updated = { ...session! };
    updated.answers = { ...updated.answers, [currentQuestion.id]: answer };
    await saveAndUpdate(updated);

    setChecking(false);
    setFeedback({
      isCorrect: answer.isCorrect ?? false,
      aiScore: answer.aiScore,
      aiFeedback: answer.aiFeedback,
      keyMissing: answer.keyMissing,
    });
  };

  const handleNext = () => {
    if (!session) return;
    resetState();
    if (session.currentIndex < session.questions.length - 1) {
      const updated = { ...session, currentIndex: session.currentIndex + 1 };
      saveAndUpdate(updated);
    } else {
      finishTest();
    }
  };

  const finishTest = async () => {
    if (!session) return;
    const updated = {
      ...session,
      status: "completed" as const,
      finishedAt: Date.now(),
    };
    await saveSession(updated);
    router.push(`/test/results/${session.id}`);
  };

  if (!session || !currentQuestion) {
    return <p className="text-gray-500">Loading...</p>;
  }

  const isLastQuestion = session.currentIndex === session.questions.length - 1;
  const hasMultipleCorrect =
    currentQuestion.type === "mcq" &&
    currentQuestion.options!.filter((o) => o.isCorrect).length > 1;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 text-sm text-gray-500">
        <span>
          Question {session.currentIndex + 1} of {session.questions.length}
        </span>
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs uppercase">
            {currentQuestion.type}
          </span>
          {timeLeft !== null ? (
            <span className={`font-mono ${timeLeft < 60 ? "text-red-500" : ""}`}>
              {Math.floor(timeLeft / 60)}:
              {String(timeLeft % 60).padStart(2, "0")}
            </span>
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-8">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{
            width: `${((session.currentIndex + 1) / session.questions.length) * 100}%`,
          }}
        />
      </div>

      {/* Question */}
      <div className="mb-6">
        <div className="prose dark:prose-invert max-w-none text-lg font-medium">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {currentQuestion.text}
          </ReactMarkdown>
        </div>
        {currentQuestion.body ? (
          <div className="prose dark:prose-invert max-w-none mt-2 text-gray-600 dark:text-gray-400">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {currentQuestion.body}
            </ReactMarkdown>
          </div>
        ) : null}
      </div>

      {/* MCQ Options */}
      {currentQuestion.type === "mcq" && currentQuestion.options ? (
        <div className="space-y-2 mb-6">
          {hasMultipleCorrect ? (
            <p className="text-xs text-gray-400 mb-2">Select all that apply</p>
          ) : null}
          {currentQuestion.options.map((option, i) => {
            const isSelected = selectedOptions.has(i);
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
                onClick={() => handleMcqSelect(i)}
                disabled={!!feedback}
                className={`w-full text-left px-4 py-3 border rounded-lg transition-colors ${bgClass}`}
              >
                <span className="text-sm">{option.text}</span>
              </button>
            );
          })}

          {hasMultipleCorrect && !feedback ? (
            <button
              onClick={handleMultiMcqCheck}
              disabled={selectedOptions.size === 0}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40"
            >
              Check Answer
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Text Answer */}
      {currentQuestion.type === "short" || currentQuestion.type === "long" ? (
        <div className="mb-6">
          <textarea
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            disabled={!!feedback}
            placeholder={
              currentQuestion.type === "short"
                ? "Type your answer..."
                : "Write your detailed answer..."
            }
            rows={currentQuestion.type === "short" ? 3 : 8}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-transparent resize-y disabled:opacity-60"
          />
          {!feedback ? (
            <button
              onClick={handleTextSubmit}
              disabled={!textAnswer.trim() || checking}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40"
            >
              {checking ? "Checking..." : "Submit Answer"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Feedback */}
      {feedback ? (
        <div
          className={`p-4 rounded-lg mb-6 ${
            feedback.isCorrect
              ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
          }`}
        >
          <p className="font-medium text-sm">
            {feedback.isCorrect ? "Correct!" : "Incorrect"}
            {feedback.aiScore !== undefined ? (
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                Score: {feedback.aiScore}/100
              </span>
            ) : null}
          </p>
          {feedback.aiFeedback ? (
            <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
              {feedback.aiFeedback}
            </p>
          ) : null}
          {feedback.keyMissing && feedback.keyMissing.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs text-gray-500">Key concepts missed:</p>
              <ul className="text-xs text-gray-500 list-disc ml-4 mt-0.5">
                {feedback.keyMissing.map((concept, i) => (
                  <li key={i}>{concept}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {currentQuestion.referenceAnswer && currentQuestion.type !== "mcq" ? (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Reference answer:</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentQuestion.referenceAnswer}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Navigation */}
      {feedback ? (
        <div className="flex justify-end">
          <button
            onClick={handleNext}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
          >
            {isLastQuestion ? "Finish Test" : "Next Question"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
