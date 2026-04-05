import { getDB } from './db';
import type { TestSession } from '../markdown/types';

export async function saveSession(session: TestSession): Promise<void> {
  const db = await getDB();
  await db.put('testSessions', session);
}

export async function getSession(id: string): Promise<TestSession | undefined> {
  const db = await getDB();
  return db.get('testSessions', id);
}

export async function getAllSessions(): Promise<TestSession[]> {
  const db = await getDB();
  const sessions = await db.getAllFromIndex('testSessions', 'by-startedAt');
  return sessions.reverse();
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('testSessions', id);
}
