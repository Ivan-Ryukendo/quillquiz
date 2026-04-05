import { getDB } from './db';
import type { QuizFile } from '../markdown/types';

export async function saveQuizFile(file: QuizFile): Promise<void> {
  const db = await getDB();
  await db.put('quizFiles', file);
}

export async function getAllQuizFiles(): Promise<QuizFile[]> {
  const db = await getDB();
  const files = await db.getAllFromIndex('quizFiles', 'by-uploadedAt');
  return files.reverse(); // newest first
}

export async function getQuizFile(id: string): Promise<QuizFile | undefined> {
  const db = await getDB();
  return db.get('quizFiles', id);
}

export async function deleteQuizFile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('quizFiles', id);
}
