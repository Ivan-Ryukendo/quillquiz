import { nanoid } from 'nanoid';
import type { Question, TestConfig, TestSession, QuizFile, QuestionType } from '../markdown/types';
import { shuffleAll, groupByFile } from './shuffle';

export function createTestSession(
  config: TestConfig,
  quizFiles: QuizFile[]
): TestSession {
  // Collect all questions from selected files
  let questions: Question[] = quizFiles.flatMap((f) => f.questions);

  // Filter by question type if specified
  if (config.includeTypes && config.includeTypes.length > 0) {
    const types = new Set<QuestionType>(config.includeTypes);
    questions = questions.filter((q) => types.has(q.type));
  }

  // Arrange questions based on mode
  questions = config.mode === 'shuffle_all'
    ? shuffleAll(questions)
    : groupByFile(questions);

  // Limit question count if specified
  if (config.questionCount && config.questionCount < questions.length) {
    questions = questions.slice(0, config.questionCount);
  }

  return {
    id: nanoid(12),
    config,
    questions,
    currentIndex: 0,
    answers: {},
    startedAt: Date.now(),
    status: 'in_progress',
  };
}

export function checkMcqAnswer(
  question: Question,
  selectedOptions: number[]
): boolean {
  if (!question.options) return false;

  const correctIndices = question.options
    .map((opt, i) => (opt.isCorrect ? i : -1))
    .filter((i) => i !== -1);

  if (selectedOptions.length !== correctIndices.length) return false;

  const sortedSelected = [...selectedOptions].sort();
  const sortedCorrect = [...correctIndices].sort();

  return sortedSelected.every((val, i) => val === sortedCorrect[i]);
}
