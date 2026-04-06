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
  // Single pass: collect all per-type totals and scores
  let mcqTotal = 0, mcqCorrect = 0;
  const shortScores: number[] = [];
  const longScores: number[] = [];

  for (const q of questions) {
    const ans = answers[q.id];
    if (q.type === 'mcq') {
      mcqTotal++;
      if (ans?.isCorrect === true) mcqCorrect++;
    } else if (q.type === 'short') {
      if (ans?.aiScore !== undefined) shortScores.push(ans.aiScore);
    } else {
      if (ans?.aiScore !== undefined) longScores.push(ans.aiScore);
    }
  }

  const sumShort = shortScores.reduce((a, b) => a + b, 0);
  const sumLong = longScores.reduce((a, b) => a + b, 0);
  const avgShort = shortScores.length > 0 ? sumShort / shortScores.length : 0;
  const avgLong = longScores.length > 0 ? sumLong / longScores.length : 0;

  const totalQuestions = questions.length;
  const totalCorrect =
    mcqCorrect +
    shortScores.reduce((a, b) => a + b / 100, 0) +
    longScores.reduce((a, b) => a + b / 100, 0);

  const percentage = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  return {
    total: totalQuestions,
    correct: Math.round(totalCorrect * 100) / 100,
    percentage,
    byType: {
      mcq: {
        total: mcqTotal,
        correct: mcqCorrect,
        percentage: mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 0,
      },
      short: {
        total: shortScores.length,
        avgScore: Math.round(avgShort),
      },
      long: {
        total: longScores.length,
        avgScore: Math.round(avgLong),
      },
    },
  };
}
