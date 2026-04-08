'use client';

import { useState, useEffect, useRef } from 'react';
import type { QuizFile } from '@/lib/markdown/types';
import { downloadMarkdown, downloadJson, downloadPdf } from '@/lib/export';

interface DownloadMenuProps {
  file: QuizFile;
}

export default function DownloadMenu({ file }: DownloadMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  function handle(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        Download ▾
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-1 w-52 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-10">
          <button
            onClick={() => handle(() => downloadMarkdown(file))}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Markdown (.md){' '}
            <span className="text-xs text-gray-400">(Recommended)</span>
          </button>
          <button
            onClick={() => handle(() => downloadJson(file))}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            JSON (.json)
          </button>
          <button
            onClick={() => handle(() => downloadPdf(file, false))}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            PDF — Questions only
          </button>
          <button
            onClick={() => handle(() => downloadPdf(file, true))}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            PDF — Questions + Answers
          </button>
        </div>
      ) : null}
    </div>
  );
}
