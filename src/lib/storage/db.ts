import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { QuizFile, TestSession, AppSettings } from '../markdown/types';

export interface OcrCacheEntry {
  hash: string;         // SHA-256 hex of file bytes — primary key
  filename: string;
  markdown: string;     // final markdown (quiz-formatted if converted, raw text otherwise)
  method: 'pdfjs' | 'tesseract' | 'gemini';
  converted: boolean;   // true if AI converted raw text to quiz markdown
  cachedAt: number;
}

interface QuizTestDB extends DBSchema {
  quizFiles: {
    key: string;
    value: QuizFile;
    indexes: {
      'by-uploadedAt': number;
      'by-filename': string;
    };
  };
  testSessions: {
    key: string;
    value: TestSession;
    indexes: {
      'by-startedAt': number;
    };
  };
  settings: {
    key: string;
    value: { key: string; data: AppSettings };
  };
  ocrCache: {
    key: string;        // hash
    value: OcrCacheEntry;
    indexes: {
      'by-cachedAt': number;
    };
  };
}

const DB_NAME = 'markdown-quiz-test';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<QuizTestDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<QuizTestDB>> {
  if (!dbPromise) {
    dbPromise = openDB<QuizTestDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const quizStore = db.createObjectStore('quizFiles', { keyPath: 'id' });
          quizStore.createIndex('by-uploadedAt', 'uploadedAt');
          quizStore.createIndex('by-filename', 'filename');

          const sessionStore = db.createObjectStore('testSessions', { keyPath: 'id' });
          sessionStore.createIndex('by-startedAt', 'startedAt');

          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (oldVersion < 2) {
          const ocrStore = db.createObjectStore('ocrCache', { keyPath: 'hash' });
          ocrStore.createIndex('by-cachedAt', 'cachedAt');
        }
      },
    });
  }
  return dbPromise;
}
