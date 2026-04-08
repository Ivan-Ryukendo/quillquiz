"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAllQuizFiles, deleteQuizFile } from "@/lib/storage/quiz-store";
import type { QuizFile } from "@/lib/markdown/types";

// Single pass over questions — extracted outside component so it's not recreated on every render
function countByType(file: QuizFile) {
  let mcq = 0, short = 0, long = 0;
  for (const q of file.questions) {
    if (q.type === "mcq") mcq++;
    else if (q.type === "short") short++;
    else long++;
  }
  return { mcq, short, long };
}

export default function LibraryPage() {
  const router = useRouter();
  const [files, setFiles] = useState<QuizFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllQuizFiles().then((f) => {
      setFiles(f);
      setLoading(false);
    });
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    await deleteQuizFile(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleStartTest = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected).join(",");
    router.push(`/test/configure?files=${ids}`);
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  if (files.length === 0) {
    return (
      <div className="text-center pt-12">
        <h1 className="text-2xl font-bold mb-3">Your Library</h1>
        <p className="text-gray-500 mb-6">No quiz files yet.</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
        >
          Upload Files
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Library</h1>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Upload More
          </button>
          <button
            onClick={handleStartTest}
            disabled={selected.size === 0}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Test ({selected.size} selected)
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {files.map((file) => {
          const counts = countByType(file);
          const isSelected = selected.has(file.id);

          return (
            <div
              key={file.id}
              onClick={() => toggleSelect(file.id)}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                isSelected
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">
                    {file.metadata.title ?? file.filename}
                  </h3>
                  {file.metadata.description ? (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {file.metadata.description}
                    </p>
                  ) : null}
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    <span>{file.questions.length} questions</span>
                    {counts.mcq > 0 ? <span>{counts.mcq} MCQ</span> : null}
                    {counts.short > 0 ? <span>{counts.short} Short</span> : null}
                    {counts.long > 0 ? <span>{counts.long} Long</span> : null}
                  </div>
                  {file.metadata.tags && file.metadata.tags.length > 0 ? (
                    <div className="flex gap-1.5 mt-2">
                      {file.metadata.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(file.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/editor/${file.id}`);
                    }}
                    className="text-blue-400 hover:text-blue-600 text-xs ml-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(file.id);
                    }}
                    className="text-red-400 hover:text-red-600 text-xs ml-2"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
