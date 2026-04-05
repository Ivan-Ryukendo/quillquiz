import type { Question, UserAnswer } from '../markdown/types';

export interface ScoreBreakdown {
  total: number;
  correct: number;
  percentage: number;
  byType: {
    mcq: { total: number; correct: number; percentage: number };
    short: { total: number; avgScore: number };
    long: { total: number; avgScore: number };
  };
}

export function computeScore(
  questions: Question[],
  answers: Record<string, UserAnswer>
): ScoreBreakdown {
  const mcqQuestions = questions.filter((q) => q.type === 'mcq');
  const shortQuestions = questions.filter((q) => q.type === 'short');
  const longQuestions = questions.filter((q) => q.type === 'long');

  const mcqCorrect = mcqQuestions.filter(
    (q) => answers[q.id]?.isCorrect === true
  ).length;

  const shortScores = shortQuestions
    .map((q) => answers[q.id]?.aiScore)
    .filter((s): s is number => s !== undefined);

  const longScores = longQuestions
    .map((q) => answers[q.id]?.aiScore)
    .filter((s): s is number => s !== undefined);

  const avgShort = shortScores.length > 0
    ? shortScores.reduce((a, b) => a + b, 0) / shortScores.length
    : 0;

  const avgLong = longScores.length > 0
    ? longScores.reduce((a, b) => a + b, 0) / longScores.length
    : 0;

  // Overall: MCQ as percentage points + written answer avg scores
  const totalQuestions = questions.length;
  const mcqPoints = mcqCorrect;
  const shortPoints = shortScores.reduce((a, b) => a + b / 100, 0);
  const longPoints = longScores.reduce((a, b) => a + b / 100, 0);
  const totalCorrect = mcqPoints + shortPoints + longPoints;
  const percentage = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  return {
    total: totalQuestions,
    correct: Math.round(totalCorrect * 100) / 100,
    percentage,
    byType: {
      mcq: {
        total: mcqQuestions.length,
        correct: mcqCorrect,
        percentage: mcqQuestions.length > 0
          ? Math.round((mcqCorrect / mcqQuestions.length) * 100)
          : 0,
      },
      short: {
        total: shortQuestions.length,
        avgScore: Math.round(avgShort),
      },
      long: {
        total: longQuestions.length,
        avgScore: Math.round(avgLong),
      },
    },
  };
}
