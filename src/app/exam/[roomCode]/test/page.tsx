"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Flag } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { startProctoring, stopProctoring } from "@/lib/proctoring/orchestrator";
import { ProctorWarning } from "@/components/ProctorWarning";
import type { ProctorFlag } from "@/lib/proctoring/types";

const MAX_LENGTH = { short: 500, long: 5000 } as const;

type ExamQuestion = {
  id: string;
  text: string;
  type: "mcq" | "short" | "long";
  body?: string;
  options?: { text: string }[];
};

export default function ExamTestPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const participantId = searchParams.get("pid") as Id<"examParticipants"> | null;

  const exam = useQuery(
    api.examSessions.getByRoomCode,
    { roomCode: roomCode.toUpperCase() }
  );

  const participant = useQuery(
    api.examParticipants.getParticipant,
    participantId ? { participantId } : "skip"
  );

  const examDetail = useQuery(
    api.examSessions.getForStudent,
    exam ? { examId: exam._id } : "skip"
  );

  const messages = useQuery(
    api.examMessages.listByExam,
    exam ? { examId: exam._id } : "skip"
  );

  const submitBatch = useMutation(api.examAnswers.submitBatch);
  const addFlag = useMutation(api.examParticipants.addFlag);

  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [mcqSelections, setMcqSelections] = useState<Record<string, number[]>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dismissedMessageId, setDismissedMessageId] = useState<string | null>(null);
  const [localFlags, setLocalFlags] = useState<ProctorFlag[]>([]);
  const [forcePaused, setForcePaused] = useState(false);

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasAutoSubmitted = useRef(false);

  // Compute timer from server data
  useEffect(() => {
    if (!examDetail?.startedAt || !examDetail.settings.timeLimit) {
      const t = setTimeout(() => setTimeLeft(null), 0);
      return () => clearTimeout(t);
    }
    const total = examDetail.settings.timeLimit + (examDetail.extraTimeMs ?? 0);
    const update = () => {
      setTimeLeft(
        Math.max(0, Math.round((examDetail.startedAt! + total - Date.now()) / 1000))
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [examDetail?.startedAt, examDetail?.settings.timeLimit, examDetail?.extraTimeMs]);

  const handleSubmitAll = useCallback(async () => {
    if (!exam || !participantId || submitting || submitted) return;
    setSubmitError(null);
    setSubmitting(true);

    const questions: ExamQuestion[] = examDetail?.questions ?? [];
    const answers = questions.map((q) => {
      if (q.type === "mcq") {
        return {
          questionId: q.id,
          selectedOptions: mcqSelections[q.id] ?? [],
        };
      }
      return {
        questionId: q.id,
        textAnswer: textAnswers[q.id]?.trim() ?? "",
      };
    });

    try {
      await submitBatch({
        examId: exam._id,
        participantId,
        answers: answers.filter(
          (a) =>
            (a.selectedOptions !== undefined && a.selectedOptions.length > 0) ||
            (a.textAnswer !== undefined && a.textAnswer.length > 0)
        ),
      });
      setSubmitted(true);
      setTimeout(() => {
        router.push(`/exam/${roomCode}/results?pid=${participantId}`);
      }, 1000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit");
      setSubmitting(false);
    }
  }, [exam, participantId, submitting, submitted, examDetail, mcqSelections, textAnswers, submitBatch, router, roomCode]);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      const t = setTimeout(() => { handleSubmitAll(); }, 0);
      return () => clearTimeout(t);
    }
  }, [timeLeft, handleSubmitAll]);

  // Start/stop proctoring when exam is in_progress
  useEffect(() => {
    if (!examDetail || examDetail.status !== "in_progress" || !participantId) return;

    const level = examDetail.settings.proctoringLevel ?? "standard";

    const handleFullscreenReturn = () => {
      if (document.fullscreenElement) {
        setForcePaused(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenReturn);

    startProctoring({
      level,
      onFlag: (flag) => {
        setLocalFlags((prev) => [...prev, flag]);
        // Report to Convex (fire-and-forget)
        addFlag({
          participantId,
          type: flag.type,
          details: flag.details,
        }).catch(() => {/* ignore */});
      },
      onPause: () => setForcePaused(true),
    });

    return () => {
      stopProctoring();
      document.removeEventListener("fullscreenchange", handleFullscreenReturn);
    };
  // Intentionally omit addFlag/examDetail to avoid re-running on every query update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examDetail?.status, examDetail?.settings.proctoringLevel, participantId]);

  const toggleFlag = (id: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const jumpToNextFlagged = () => {
    if (flagged.size === 0) return;
    const questions: ExamQuestion[] = examDetail?.questions ?? [];
    const flaggedIds = questions.filter((q) => flagged.has(q.id)).map((q) => q.id);
    const scrollY = window.scrollY;
    let target = flaggedIds[0];
    for (const id of flaggedIds) {
      const el = questionRefs.current[id];
      if (el && el.offsetTop > scrollY + 100) {
        target = id;
        break;
      }
    }
    questionRefs.current[target]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!participantId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No participant ID. Please rejoin from the lobby.</p>
        <button
          onClick={() => router.push(`/exam/${roomCode}`)}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  if (!exam || !examDetail || !participant) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Kicked overlay
  if (participant.status === "kicked") {
    return (
      <div className="fixed inset-0 bg-red-950/95 flex flex-col items-center justify-center z-50 text-white text-center p-8">
        <h1 className="text-2xl font-bold mb-3">You Have Been Removed</h1>
        {participant.kickReason ? (
          <p className="text-red-200 text-sm">Reason: {participant.kickReason}</p>
        ) : null}
      </div>
    );
  }

  const isPaused = examDetail.status === "paused";

  const latestMessage =
    messages && messages.length > 0
      ? messages[messages.length - 1]
      : null;
  const showMessage =
    latestMessage !== null && latestMessage?._id !== dismissedMessageId;

  const questions: ExamQuestion[] = examDetail.questions ?? [];

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="text-4xl mb-4">✓</div>
        <h1 className="text-xl font-bold mb-2">Answers Submitted!</h1>
        <p className="text-gray-500 text-sm">Redirecting to results...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Pause overlay */}
      {isPaused || forcePaused ? (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-40 text-white text-center">
          <h1 className="text-2xl font-bold mb-2">
            {forcePaused ? "Return to fullscreen to continue" : "Exam Paused"}
          </h1>
          <p className="text-gray-300 text-sm">
            {forcePaused
              ? "Press F11 or click to re-enter fullscreen."
              : "Your teacher has paused the exam. Please wait."}
          </p>
        </div>
      ) : null}

      {/* Teacher message banner */}
      {showMessage ? (
        <div className="sticky top-0 z-20 bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between text-sm">
          <span>{latestMessage!.message}</span>
          <button
            onClick={() => setDismissedMessageId(latestMessage!._id)}
            className="ml-4 text-blue-200 hover:text-white text-xs underline flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 py-3 -mx-4 mb-6">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{questions.length} questions</span>
          <div className="flex items-center gap-4">
            {flagged.size > 0 ? (
              <button
                onClick={jumpToNextFlagged}
                className="flex items-center gap-1.5 text-amber-500 hover:text-amber-700 text-xs"
              >
                <Flag className="w-3.5 h-3.5" />
                {flagged.size} flagged
              </button>
            ) : null}
            {timeLeft !== null ? (
              <span
                className={`font-mono text-lg ${
                  timeLeft < 60 ? "text-red-500 animate-pulse" : ""
                }`}
              >
                {Math.floor(timeLeft / 60)}:
                {String(timeLeft % 60).padStart(2, "0")}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Question cards */}
      <div className="space-y-6 select-none">
        {questions.map((question, index) => {
          const isFlagged = flagged.has(question.id);
          const selections = mcqSelections[question.id] ?? [];

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
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-400">
                    {index + 1}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs uppercase text-gray-500">
                    {question.type}
                  </span>
                </div>
                <button
                  onClick={() => toggleFlag(question.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isFlagged
                      ? "text-amber-500 bg-amber-100 dark:bg-amber-900/40"
                      : "text-gray-300 hover:text-amber-400"
                  }`}
                  aria-label={isFlagged ? "Unflag question" : "Flag for review"}
                >
                  <Flag className="w-4 h-4" />
                </button>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {question.text}
                </ReactMarkdown>
              </div>

              {question.body ? (
                <div className="text-sm text-gray-500 mb-3 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {question.body}
                  </ReactMarkdown>
                </div>
              ) : null}

              {question.type === "mcq" ? (
                question.options ? (
                  <div className="space-y-2">
                    {question.options.map((option, i) => {
                      const isSelected = selections.includes(i);
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setMcqSelections((prev) => {
                              const current = prev[question.id] ?? [];
                              if (current.includes(i)) {
                                return {
                                  ...prev,
                                  [question.id]: current.filter((x) => x !== i),
                                };
                              }
                              return { ...prev, [question.id]: [...current, i] };
                            });
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                        >
                          {option.text}
                        </button>
                      );
                    })}
                  </div>
                ) : null
              ) : (
                <textarea
                  value={textAnswers[question.id] ?? ""}
                  onChange={(e) => {
                    const max = MAX_LENGTH[question.type as "short" | "long"];
                    setTextAnswers((prev) => ({
                      ...prev,
                      [question.id]: e.target.value.slice(0, max),
                    }));
                  }}
                  placeholder={`Your answer (${question.type === "short" ? "max 500" : "max 5000"} chars)`}
                  rows={question.type === "long" ? 6 : 3}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              )}
            </div>
          );
        })}
      </div>

      <ProctorWarning flags={localFlags} />

      {/* Submit section */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
        {submitError ? (
          <p className="text-red-500 text-xs text-center mb-2">{submitError}</p>
        ) : null}
        <button
          onClick={handleSubmitAll}
          disabled={submitting || submitted}
          className="w-full py-3 bg-blue-500 text-white rounded-xl text-sm font-medium shadow-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit All Answers"}
        </button>
      </div>
    </div>
  );
}
