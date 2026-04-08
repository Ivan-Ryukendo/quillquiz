// src/components/QuestionCard.tsx
'use client';

import type { Question } from '@/lib/markdown/types';

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  onChange: (updated: Question) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onDelete: (index: number) => void;
}

export default function QuestionCard({
  question,
  index,
  total,
  onChange,
  onMove,
  onDelete,
}: QuestionCardProps) {
  const update = (patch: Partial<Question>) => onChange({ ...question, ...patch });

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onMove(index, 'up')}
            disabled={index === 0}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            ↑
          </button>
          <button
            onClick={() => onMove(index, 'down')}
            disabled={index === total - 1}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            ↓
          </button>
          <span className="text-sm text-gray-500">Question {index + 1}</span>
        </div>
        <button
          onClick={() => onDelete(index)}
          className="text-red-400 hover:text-red-600 text-xs"
        >
          Delete
        </button>
      </div>

      {/* Question text */}
      <textarea
        value={question.text}
        onChange={(e) => update({ text: e.target.value })}
        placeholder="Question text"
        rows={2}
        className="w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm resize-none"
      />

      {/* Body / context */}
      <textarea
        value={question.body ?? ''}
        onChange={(e) => update({ body: e.target.value || undefined })}
        placeholder="Body / context (optional)"
        rows={2}
        className="w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm resize-none text-gray-500"
      />

      {/* Type selector */}
      <select
        value={question.type}
        onChange={(e) => {
          const t = e.target.value as Question['type'];
          update({ type: t, explicitTag: t });
        }}
        className="border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm"
      >
        <option value="mcq">MCQ</option>
        <option value="short">Short answer</option>
        <option value="long">Long answer</option>
      </select>

      {/* Type-specific inputs */}
      {question.type === 'mcq' ? (
        <div className="space-y-2">
          {(question.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={opt.isCorrect}
                onChange={(e) => {
                  const opts = [...(question.options ?? [])];
                  opts[i] = { ...opts[i], isCorrect: e.target.checked };
                  update({ options: opts });
                }}
                className="w-4 h-4 shrink-0"
              />
              <input
                type="text"
                value={opt.text}
                onChange={(e) => {
                  const opts = [...(question.options ?? [])];
                  opts[i] = { ...opts[i], text: e.target.value };
                  update({ options: opts });
                }}
                placeholder={`Option ${i + 1}`}
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm"
              />
              <button
                onClick={() => {
                  const opts = (question.options ?? []).filter((_, j) => j !== i);
                  update({ options: opts });
                }}
                className="text-red-400 hover:text-red-600 text-sm shrink-0"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const opts = [...(question.options ?? []), { text: '', isCorrect: false }];
              update({ options: opts });
            }}
            className="text-blue-500 hover:text-blue-700 text-xs"
          >
            + Add option
          </button>
        </div>
      ) : (
        <textarea
          value={question.referenceAnswer ?? ''}
          onChange={(e) => update({ referenceAnswer: e.target.value || undefined })}
          placeholder="Reference answer"
          rows={3}
          className="w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm resize-none"
        />
      )}
    </div>
  );
}
