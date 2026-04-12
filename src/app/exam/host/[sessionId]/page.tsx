"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { generateQRDataURL } from "@/lib/qr";
import Image from "next/image";
import {
  Users,
  Play,
  Pause,
  StopCircle,
  MessageSquare,
  Clock,
  Copy,
  Check,
  Eye,
  Clipboard,
  Monitor,
  Code,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

type Phase = "lobby" | "in_progress" | "paused" | "completed";

function getFlagIcon(type: string): "eye" | "clipboard" | "monitor" | "code" {
  if (type === "tab_switch" || type === "window_blur") return "eye";
  if (
    type === "copy_attempt" ||
    type === "paste_attempt" ||
    type === "cut_attempt" ||
    type === "keyboard_shortcut" ||
    type === "right_click"
  )
    return "clipboard";
  if (type === "fullscreen_exit") return "monitor";
  return "code";
}

export default function HostDashboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const exam = useQuery(
    api.examSessions.getForTeacher,
    { examId: sessionId as Id<"examSessions"> }
  );
  const participants = useQuery(
    api.examParticipants.listByExam,
    exam ? { examId: exam._id } : "skip"
  );
  const allAnswers = useQuery(
    api.examAnswers.listAllForExam,
    exam ? { examId: exam._id } : "skip"
  );
  const messages = useQuery(
    api.examMessages.listByExam,
    exam ? { examId: exam._id } : "skip"
  );

  const startExam = useMutation(api.examSessions.start);
  const pauseExam = useMutation(api.examSessions.pause);
  const resumeExam = useMutation(api.examSessions.resume);
  const endExam = useMutation(api.examSessions.end);
  const addExtraTime = useMutation(api.examSessions.addExtraTime);
  const kickParticipant = useMutation(api.examParticipants.kick);
  const sendMessage = useMutation(api.examMessages.send);

  const [messageText, setMessageText] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("5");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [kickReason, setKickReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const shareUrl =
    typeof window !== "undefined" && exam
      ? `${window.location.origin}/exam/${exam.roomCode}`
      : "";

  useEffect(() => {
    if (shareUrl) {
      generateQRDataURL(shareUrl).then(setQrDataUrl);
    }
  }, [shareUrl]);

  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!exam?.startedAt || !exam.settings.timeLimit) {
      // defer to avoid synchronous setState in effect body
      const id = setTimeout(() => setTimeLeft(null), 0);
      return () => clearTimeout(id);
    }
    const total = exam.settings.timeLimit + (exam.extraTimeMs ?? 0);
    const update = () => {
      const remaining = Math.max(
        0,
        exam.startedAt! + total - Date.now()
      );
      setTimeLeft(Math.round(remaining / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [exam?.startedAt, exam?.settings.timeLimit, exam?.extraTimeMs]);

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !exam) return;
    try {
      await sendMessage({ examId: exam._id, message: messageText.trim() });
      setMessageText("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send");
    }
  };

  const handleKick = async () => {
    if (!kickingId || !exam) return;
    try {
      await kickParticipant({
        examId: exam._id,
        participantId: kickingId as Id<"examParticipants">,
        reason: kickReason || "Removed by teacher",
      });
      setKickingId(null);
      setKickReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to kick");
    }
  };

  const handleAddTime = async () => {
    if (!exam) return;
    const mins = parseInt(extraMinutes);
    if (!mins || mins <= 0) return;
    try {
      await addExtraTime({ examId: exam._id, extraMinutes: mins });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add time");
    }
  };

  if (exam === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (exam === null) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Exam not found.</p>
      </div>
    );
  }

  const phase = exam.status as Phase;
  const readyCount =
    participants?.filter(
      (p) =>
        p.status === "ready" ||
        p.status === "in_progress" ||
        p.status === "completed"
    ).length ?? 0;
  const activeParticipants = [...(participants?.filter((p) => p.status !== "kicked") ?? [])].sort(
    (a, b) =>
      (phase === "in_progress" || phase === "paused")
        ? (b.flags?.length ?? 0) - (a.flags?.length ?? 0)
        : 0
  );

  const answerCountByParticipant: Record<string, number> = {};
  if (allAnswers) {
    for (const a of allAnswers) {
      const pid = a.participantId as string;
      answerCountByParticipant[pid] = (answerCountByParticipant[pid] ?? 0) + 1;
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Room code:{" "}
            <span className="font-mono font-bold text-lg">
              {exam.roomCode}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {phase === "lobby" ? (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
              Lobby
            </span>
          ) : phase === "in_progress" ? (
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-xs font-medium">
              In Progress
            </span>
          ) : phase === "paused" ? (
            <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
              Paused
            </span>
          ) : (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs font-medium">
              Completed
            </span>
          )}
        </div>
      </div>

      {actionError ? (
        <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {actionError}
          <button
            onClick={() => setActionError(null)}
            className="ml-3 underline text-xs"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
              Join Link
            </p>
            <p className="text-xs font-mono break-all text-gray-600 dark:text-gray-300 mb-3">
              {shareUrl}
            </p>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied!" : "Copy link"}
            </button>
            {qrDataUrl ? (
              <div className="mt-3 flex justify-center">
                <Image
                  src={qrDataUrl}
                  alt="Join QR code"
                  width={160}
                  height={160}
                  unoptimized
                  className="rounded"
                />
              </div>
            ) : null}
          </div>

          {(phase === "in_progress" || phase === "paused") && timeLeft !== null ? (
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Time Remaining</p>
              <p
                className={`text-3xl font-mono font-bold ${
                  timeLeft < 60 ? "text-red-500" : ""
                }`}
              >
                {Math.floor(timeLeft / 60)}:
                {String(timeLeft % 60).padStart(2, "0")}
              </p>
            </div>
          ) : null}

          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
              Controls
            </p>

            {phase === "lobby" ? (
              <button
                onClick={() => startExam({ examId: exam._id })}
                disabled={readyCount === 0}
                className="w-full flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                Start Exam ({readyCount} ready)
              </button>
            ) : null}

            {phase === "in_progress" ? (
              <button
                onClick={() => pauseExam({ examId: exam._id })}
                className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
              >
                <Pause className="w-4 h-4" />
                Pause Exam
              </button>
            ) : null}

            {phase === "paused" ? (
              <button
                onClick={() => resumeExam({ examId: exam._id })}
                className="w-full flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
              >
                <Play className="w-4 h-4" />
                Resume Exam
              </button>
            ) : null}

            {phase === "in_progress" || phase === "paused" ? (
              <>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={extraMinutes}
                    onChange={(e) => setExtraMinutes(e.target.value)}
                    min="1"
                    max="120"
                    className="w-16 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-sm bg-transparent"
                  />
                  <button
                    onClick={handleAddTime}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    +{extraMinutes}m
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (confirm("End exam for all students?")) {
                      endExam({ examId: exam._id });
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                >
                  <StopCircle className="w-4 h-4" />
                  End Exam
                </button>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-400 mb-1.5">
                    Message to all students
                  </p>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) =>
                        setMessageText(e.target.value.slice(0, 200))
                      }
                      placeholder="Type message..."
                      className="flex-1 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendMessage();
                      }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageText.trim()}
                      className="px-2.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-40"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {phase === "completed" ? (
              <button
                onClick={() => router.push("/library")}
                className="w-full py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Back to Library
              </button>
            ) : null}
          </div>
        </div>

        {/* Right column — participants */}
        <div className="md:col-span-2">
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-gray-400" />
              <p className="text-sm font-medium">
                Participants ({activeParticipants.length})
              </p>
            </div>

            {activeParticipants.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Waiting for students to join...
              </p>
            ) : (
              <div className="space-y-2">
                {activeParticipants.map((p) => {
                  const answerCount = answerCountByParticipant[p._id] ?? 0;
                  const flagCount = p.flags?.length ?? 0;

                  return (
                    <div
                      key={p._id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">
                          {p.name}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                            p.status === "ready"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : p.status === "completed"
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              : p.status === "waiting"
                              ? "bg-gray-100 dark:bg-gray-700 text-gray-500"
                              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {phase === "in_progress" || phase === "paused" ? (
                          <span className="text-xs text-gray-400">
                            {answerCount} ans
                          </span>
                        ) : null}
                        {flagCount > 0 ? (
                          <div className="flex items-center gap-1">
                            {(() => {
                              const eyeCount = p.flags.filter((f: { type: string }) => getFlagIcon(f.type) === "eye").length;
                              const clipCount = p.flags.filter((f: { type: string }) => getFlagIcon(f.type) === "clipboard").length;
                              const monCount = p.flags.filter((f: { type: string }) => getFlagIcon(f.type) === "monitor").length;
                              const codeCount = p.flags.filter((f: { type: string }) => getFlagIcon(f.type) === "code").length;
                              return (
                                <>
                                  {eyeCount > 0 ? (
                                    <span className="flex items-center gap-0.5 text-xs text-amber-500" title={`${eyeCount} visibility`}>
                                      <Eye className="w-3 h-3" />{eyeCount}
                                    </span>
                                  ) : null}
                                  {clipCount > 0 ? (
                                    <span className="flex items-center gap-0.5 text-xs text-orange-500" title={`${clipCount} clipboard`}>
                                      <Clipboard className="w-3 h-3" />{clipCount}
                                    </span>
                                  ) : null}
                                  {monCount > 0 ? (
                                    <span className="flex items-center gap-0.5 text-xs text-blue-500" title={`${monCount} fullscreen`}>
                                      <Monitor className="w-3 h-3" />{monCount}
                                    </span>
                                  ) : null}
                                  {codeCount > 0 ? (
                                    <span className="flex items-center gap-0.5 text-xs text-red-500" title={`${codeCount} devtools`}>
                                      <Code className="w-3 h-3" />{codeCount}
                                    </span>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>
                        ) : null}
                        {p.status !== "completed" &&
                        p.status !== "kicked" &&
                        (phase === "lobby" ||
                          phase === "in_progress" ||
                          phase === "paused") ? (
                          <button
                            onClick={() => setKickingId(p._id)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Kick
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {messages && messages.length > 0 ? (
            <div className="mt-4 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                Sent Messages
              </p>
              <div className="space-y-1">
                {messages.slice(-5).map((m) => (
                  <div key={m._id} className="flex items-start gap-2 text-xs">
                    <span className="text-gray-400 flex-shrink-0">
                      {new Date(m.sentAt).toLocaleTimeString()}
                    </span>
                    <span className="text-gray-600 dark:text-gray-300">
                      {m.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Kick confirmation modal */}
      {kickingId ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold mb-3">Remove Student</h3>
            <input
              type="text"
              value={kickReason}
              onChange={(e) => setKickReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent mb-4 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setKickingId(null);
                  setKickReason("");
                }}
                className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleKick}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
