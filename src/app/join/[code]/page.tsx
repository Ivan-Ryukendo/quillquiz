"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { parseQuiz } from "@/lib/markdown/parser";
import { saveQuizFile } from "@/lib/storage/quiz-store";
import { BookOpen, ArrowRight, Lock } from "lucide-react";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [submittedPin, setSubmittedPin] = useState<string | undefined>(undefined);
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const sharedQuiz = useQuery(api.sharedQuizzes.getByShareCode, {
    shareCode: code.toUpperCase(),
    pin: submittedPin,
  });

  const activeExam = useQuery(
    api.examSessions.getActiveByQuizId,
    sharedQuiz ? { quizId: sharedQuiz._id } : "skip"
  );

  // If still undefined after 1.5s, assume PIN is required (Convex threw)
  useEffect(() => {
    if (sharedQuiz !== undefined) return;
    const timer = setTimeout(() => setShowPinForm(true), 1500);
    return () => clearTimeout(timer);
  }, [sharedQuiz]);

  // Redirect to library when quiz is successfully added
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => router.push("/library"), 800);
    return () => clearTimeout(timer);
  }, [added, router]);

  const handlePinSubmit = () => {
    setPinError(null);
    if (!pin.trim()) {
      setPinError("PIN is required");
      return;
    }
    setSubmittedPin(pin.trim());
    setShowPinForm(false);
  };

  const handleAddToLibrary = async () => {
    if (!sharedQuiz) return;
    setAddError(null);
    setAdding(true);
    try {
      const quizFile = parseQuiz(sharedQuiz.markdown, `${code.toUpperCase()}.md`);
      await saveQuizFile(quizFile);
      setAdded(true);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add quiz");
      setAdding(false);
    }
  };

  // Spinner
  if (sharedQuiz === undefined && !showPinForm) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // PIN form
  if (showPinForm || (sharedQuiz === undefined && submittedPin !== undefined)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <Lock className="w-8 h-8 text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">PIN Required</h1>
        <p className="text-gray-500 text-sm mb-6">
          This shared quiz requires a PIN to access.
        </p>
        <div className="flex gap-2 w-full max-w-xs">
          <input
            type="text"
            value={pin}
            onChange={(e) => setPin(e.target.value.slice(0, 8))}
            placeholder="Enter PIN"
            className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePinSubmit();
            }}
          />
          <button
            onClick={handlePinSubmit}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
          >
            Join
          </button>
        </div>
        {pinError ? (
          <p className="text-red-500 text-sm mt-2">{pinError}</p>
        ) : null}
      </div>
    );
  }

  // Not found / expired
  if (sharedQuiz === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="text-4xl mb-4">🔗</div>
        <h1 className="text-2xl font-bold mb-2">Link expired or not found</h1>
        <p className="text-gray-500 text-sm mb-6">
          This share link may have expired or the code is incorrect.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
        >
          Go Home
        </button>
      </div>
    );
  }

  // Quiz preview
  const { metadata } = sharedQuiz;
  const expiresIn = Math.max(
    0,
    Math.round((sharedQuiz.expiresAt - Date.now()) / (1000 * 60 * 60))
  );

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <BookOpen className="w-8 h-8 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold">{metadata.title}</h1>
            {metadata.description ? (
              <p className="text-gray-500 text-sm mt-1">{metadata.description}</p>
            ) : null}
          </div>
        </div>

        {metadata.tags && metadata.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {metadata.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <p className="text-xs text-gray-400">
          Share code: <span className="font-mono font-bold">{code.toUpperCase()}</span>
          {" · "}Expires in ~{expiresIn}h
        </p>
      </div>

      {activeExam && activeExam.status !== "completed" ? (
        <div className="border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-3">
            A live exam is currently active for this quiz.
          </p>
          <button
            onClick={() => router.push(`/exam/${activeExam.roomCode}`)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"
          >
            Join Live Exam
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      <button
        onClick={handleAddToLibrary}
        disabled={adding || added}
        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {added ? (
          "Added! Redirecting..."
        ) : adding ? (
          "Adding..."
        ) : (
          <>
            Add to My Library
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {addError ? (
        <p className="text-red-500 text-xs text-center mt-2">{addError}</p>
      ) : null}

      <p className="text-xs text-gray-400 text-center mt-3">
        This will save the quiz to your local library.
      </p>
    </div>
  );
}
