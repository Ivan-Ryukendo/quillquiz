import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { QuizFile, TestSession, AppSettings } from '../markdown/types';

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
}

const DB_NAME = 'markdown-quiz-test';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<QuizTestDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<QuizTestDB>> {
  if (!dbPromise) {
    dbPromise = openDB<QuizTestDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const quizStore = db.createObjectStore('quizFiles', { keyPath: 'id' });
        quizStore.createIndex('by-uploadedAt', 'uploadedAt');
        quizStore.createIndex('by-filename', 'filename');

        const sessionStore = db.createObjectStore('testSessions', { keyPath: 'id' });
        sessionStore.createIndex('by-startedAt', 'startedAt');

        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}
