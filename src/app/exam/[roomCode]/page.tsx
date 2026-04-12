"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { nanoid } from "nanoid";

type LobbyPhase = "loading" | "join_form" | "pin_required" | "waiting" | "not_found" | "ended";

function getBrowserFingerprint(): string {
  return [
    navigator.userAgent,
    screen.width,
    screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");
}

export default function StudentLobbyPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const router = useRouter();

  const exam = useQuery(api.examSessions.getByRoomCode, {
    roomCode: roomCode.toUpperCase(),
  });

  const participants = useQuery(
    api.examParticipants.listByExam,
    exam ? { examId: exam._id } : "skip"
  );

  const joinMutation = useMutation(api.examParticipants.join);
  const setReadyMutation = useMutation(api.examParticipants.setReady);

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [examId, setExamId] = useState<string | null>(null);
  const [phase, setPhase] = useState<LobbyPhase>("loading");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Restore from sessionStorage on refresh
  useEffect(() => {
    const stored = sessionStorage.getItem(`exam_${roomCode}`);
    if (stored) {
      const { pid, eid } = JSON.parse(stored);
      setParticipantId(pid);
      setExamId(eid);
    }
  }, [roomCode]);

  // React to exam state changes
  useEffect(() => {
    if (exam === undefined) return;
    if (exam === null) {
      setPhase("not_found");
      return;
    }
    if (exam.status === "completed") {
      setPhase("ended");
      return;
    }
    if (exam.status === "in_progress" && participantId) {
      router.push(`/exam/${roomCode}/test?pid=${participantId}`);
      return;
    }
    if (participantId) {
      setPhase("waiting");
    } else {
      setPhase("join_form");
    }
  }, [exam, participantId, roomCode, router]);

  const handleJoin = async () => {
    if (!name.trim() || !exam) return;
    setError(null);
    setJoining(true);

    try {
      const connectionId = nanoid(16);
      const fingerprint = getBrowserFingerprint();

      const result = await joinMutation({
        roomCode: roomCode.toUpperCase(),
        name: name.trim(),
        connectionId,
        browserFingerprint: fingerprint,
        ip: "client",
        pin: pin.trim() || undefined,
      });

      setParticipantId(result.participantId);
      setExamId(result.examId);
      sessionStorage.setItem(
        `exam_${roomCode}`,
        JSON.stringify({ pid: result.participantId, eid: result.examId })
      );
      setPhase("waiting");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to join";
      if (msg.toLowerCase().includes("pin")) {
        setPhase("pin_required");
      }
      setError(msg);
    } finally {
      setJoining(false);
    }
  };

  const handleReady = async () => {
    if (!participantId) return;
    try {
      await setReadyMutation({ participantId: participantId as import("@/convex/_generated/dataModel").Id<"examParticipants"> });
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set ready");
    }
  };

  if (phase === "loading" || exam === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === "not_found") {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Exam not found.</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">This exam has ended.</p>
      </div>
    );
  }

  if (phase === "join_form" || phase === "pin_required") {
    return (
      <div className="max-w-sm mx-auto py-12 px-4">
        <h1 className="text-2xl font-bold mb-2">Join Exam</h1>
        <p className="text-gray-500 text-sm mb-6">
          Room code: <span className="font-mono font-bold">{roomCode.toUpperCase()}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              placeholder="Enter your name"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
            />
          </div>

          {phase === "pin_required" ? (
            <div>
              <label className="block text-sm font-medium mb-1">
                Exam PIN
              </label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.slice(0, 8))}
                placeholder="Enter PIN"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : null}

          {error ? (
            <p className="text-red-500 text-sm">{error}</p>
          ) : null}

          <button
            onClick={handleJoin}
            disabled={!name.trim() || joining}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {joining ? "Joining..." : "Join Exam"}
          </button>
        </div>
      </div>
    );
  }

  // Waiting phase
  const activeParticipants =
    participants?.filter((p) => p.status !== "kicked") ?? [];

  return (
    <div className="max-w-sm mx-auto py-12 px-4 text-center">
      <h1 className="text-2xl font-bold mb-1">Waiting Room</h1>
      <p className="text-gray-500 text-sm mb-6">
        Waiting for teacher to start the exam
      </p>

      {!ready ? (
        <button
          onClick={handleReady}
          className="mb-6 px-8 py-3 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600"
        >
          I&apos;m Ready
        </button>
      ) : (
        <div className="mb-6 px-8 py-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl text-sm font-medium">
          ✓ Ready
        </div>
      )}

      {error ? (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      ) : null}

      <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 mb-3">
          {activeParticipants.length} participant
          {activeParticipants.length !== 1 ? "s" : ""} in room
        </p>
        <div className="space-y-1">
          {activeParticipants.map((p) => (
            <div
              key={p._id}
              className="flex items-center justify-between text-sm"
            >
              <span>{p.name}</span>
              <span
                className={`text-xs ${
                  p.status === "ready" ? "text-green-500" : "text-gray-400"
                }`}
              >
                {p.status === "ready" ? "✓ ready" : "waiting"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
