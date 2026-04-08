// src/app/editor/[quizId]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { getQuizFile, saveQuizFile } from '@/lib/storage/quiz-store';
import { parseQuestions } from '@/lib/markdown/parser';
import { extractFrontmatter } from '@/lib/markdown/frontmatter';
import { serializeQuiz } from '@/lib/markdown/serializer';
import QuestionCard from '@/components/QuestionCard';
import type { QuizFile, Question, QuizMetadata } from '@/lib/markdown/types';

export default function EditorPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const router = useRouter();

  const [quiz, setQuiz] = useState<QuizFile | null>(null);
  const [metadata, setMetadata] = useState<QuizMetadata>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mode, setMode] = useState<'structured' | 'source'>('structured');
  const [sourceText, setSourceText] = useState('');
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Load on mount
  useEffect(() => {
    getQuizFile(quizId).then((file) => {
      if (!file) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setQuiz(file);
      setMetadata(file.metadata);
      setQuestions(file.questions);
      setSourceText(serializeQuiz(file));
      setLoading(false);
    });
  }, [quizId]);

  // Auto-save (structured mode only, skips when quiz not yet loaded)
  useEffect(() => {
    if (!quiz || mode !== 'structured') return;
    const timer = setTimeout(async () => {
      setSaving(true);
      const markdown = serializeQuiz({ ...quiz, metadata, questions });
      await saveQuizFile({ ...quiz, metadata, questions, rawMarkdown: markdown });
      setSaving(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [metadata, questions, quiz, mode]);

  const switchToSource = () => {
    if (!quiz) return;
    setSourceText(serializeQuiz({ ...quiz, metadata, questions }));
    setSourceError(null);
    setMode('source');
  };

  const switchToStructured = () => {
    if (!quiz) return;
    try {
      const { metadata: parsedMeta, content } = extractFrontmatter(sourceText);
      const parsedQuestions = parseQuestions(content, quiz.filename);
      setMetadata(parsedMeta);
      setQuestions(parsedQuestions);
      setSourceError(null);
      setMode('structured');
      // Save immediately after switching back from source
      saveQuizFile({ ...quiz, metadata: parsedMeta, questions: parsedQuestions, rawMarkdown: sourceText });
    } catch (e) {
      setSourceError(e instanceof Error ? e.message : 'Failed to parse markdown');
    }
  };

  const handleAddQuestion = useCallback(() => {
    if (!quiz) return;
    const newQ: Question = {
      id: nanoid(10),
      type: 'short',
      text: '',
      sourceFile: quiz.filename,
    };
    setQuestions((prev) => [...prev, newQ]);
  }, [quiz]);

  const handleQuestionChange = useCallback((updated: Question) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
  }, []);

  const handleMove = useCallback((index: number, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const next = [...prev];
      const swap = direction === 'up' ? index - 1 : index + 1;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  }, []);

  const handleDelete = useCallback((index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;

  if (notFound) {
    return (
      <div className="text-center pt-12">
        <p className="text-gray-500 mb-4">Quiz not found.</p>
        <button
          onClick={() => router.push('/library')}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/library')}
          className="text-sm text-blue-500 hover:underline"
        >
          ← Back to Library
        </button>
        <span className="text-xs text-gray-400">{saving ? 'Saving…' : 'Saved'}</span>
      </div>

      {/* Metadata fields */}
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={metadata.title ?? ''}
          onChange={(e) => setMetadata((m) => ({ ...m, title: e.target.value || undefined }))}
          placeholder="Quiz title"
          className="col-span-2 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={metadata.description ?? ''}
          onChange={(e) => setMetadata((m) => ({ ...m, description: e.target.value || undefined }))}
          placeholder="Description"
          className="col-span-2 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={metadata.author ?? ''}
          onChange={(e) => setMetadata((m) => ({ ...m, author: e.target.value || undefined }))}
          placeholder="Author"
          className="border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={metadata.timeLimit ?? ''}
          onChange={(e) =>
            setMetadata((m) => ({ ...m, timeLimit: e.target.value ? Number(e.target.value) : undefined }))
          }
          placeholder="Time limit (minutes)"
          className="border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={metadata.tags?.join(', ') ?? ''}
          onChange={(e) => {
            const tags = e.target.value
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            setMetadata((m) => ({ ...m, tags: tags.length > 0 ? tags : undefined }));
          }}
          placeholder="Tags (comma-separated)"
          className="col-span-2 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm"
        />
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => (mode === 'source' ? switchToStructured() : undefined)}
          className={`px-3 py-1.5 rounded text-sm ${
            mode === 'structured'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Structured
        </button>
        <button
          onClick={() => (mode === 'structured' ? switchToSource() : undefined)}
          className={`px-3 py-1.5 rounded text-sm ${
            mode === 'source'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Source
        </button>
      </div>

      {/* Editor area */}
      {mode === 'structured' ? (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              total={questions.length}
              onChange={handleQuestionChange}
              onMove={handleMove}
              onDelete={handleDelete}
            />
          ))}
          <button
            onClick={handleAddQuestion}
            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            + Add Question
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={30}
            className="w-full font-mono text-sm border border-gray-200 dark:border-gray-700 rounded px-3 py-2 resize-y"
          />
          {sourceError ? <p className="text-red-500 text-sm">{sourceError}</p> : null}
        </div>
      )}
    </div>
  );
}
