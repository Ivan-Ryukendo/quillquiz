"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { QuizFile } from "@/lib/markdown/types";
import { generateQRDataURL } from "@/lib/qr";
import { X, Copy, Check, Share2 } from "lucide-react";

interface ShareModalProps {
  file: QuizFile;
  onClose: () => void;
}

type Phase = "setup" | "sharing" | "result";

export default function ShareModal({ file, onClose }: ShareModalProps) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const createShare = useMutation(api.sharedQuizzes.create);

  const [phase, setPhase] = useState<Phase>("setup");
  const [pin, setPin] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareCode) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${shareCode}`
        : `/join/${shareCode}`;
    generateQRDataURL(url).then(setQrDataUrl);
  }, [shareCode]);

  const handleShare = async () => {
    setError(null);
    setPhase("sharing");
    try {
      const markdownBytes = new TextEncoder().encode(file.rawMarkdown).length;
      if (markdownBytes > 5 * 1024 * 1024) {
        throw new Error("Quiz file exceeds 5MB limit");
      }
      const result = await createShare({
        markdown: file.rawMarkdown,
        metadata: {
          title: file.metadata.title ?? file.filename,
          description: file.metadata.description,
          tags: file.metadata.tags,
        },
        pin: pin.trim() || undefined,
      });
      setShareCode(result.shareCode);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share quiz");
      setPhase("setup");
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${shareCode}`
        : `/join/${shareCode}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Quiz
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {authLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : !isAuthenticated ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Sign in required to share quizzes.
            </p>
            <p className="text-xs text-gray-400">
              Go to{" "}
              <a href="/settings" className="underline">
                Settings
              </a>{" "}
              to sign in.
            </p>
          </div>
        ) : phase === "setup" || phase === "sharing" ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                <span className="font-medium">{file.metadata.title ?? file.filename}</span>
                {" "}will be uploaded and a 6-character share code generated. The link expires in 24 hours.
              </p>
              <label className="block text-sm font-medium mb-1">
                PIN (optional)
              </label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.slice(0, 8))}
                placeholder="Leave blank for no PIN"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Students will need this PIN to access the quiz.
              </p>
            </div>

            {error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : null}

            <button
              onClick={handleShare}
              disabled={phase === "sharing"}
              className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {phase === "sharing" ? "Sharing..." : "Share"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide font-medium">
                Share Link
              </p>
              <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                <span className="text-sm flex-1 truncate font-mono">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/join/${shareCode}`
                    : `/join/${shareCode}`}
                </span>
                <button
                  onClick={handleCopy}
                  aria-label="Copy link"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Code: <span className="font-mono font-bold">{shareCode}</span>
                {pin ? " · PIN protected" : ""}
              </p>
            </div>

            {qrDataUrl ? (
              <div className="flex justify-center">
                <Image
                  src={qrDataUrl}
                  alt={`QR code for share link`}
                  width={200}
                  height={200}
                  className="rounded-lg"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-[200px] h-[200px] bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
