import type { Question } from '../markdown/types';

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function shuffleAll(questions: Question[]): Question[] {
  return shuffleArray(questions);
}

export function groupByFile(questions: Question[]): Question[] {
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    const group = groups.get(q.sourceFile) ?? [];
    group.push(q);
    groups.set(q.sourceFile, group);
  }
  return Array.from(groups.values()).flat();
}
