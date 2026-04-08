import type { AiGradeResult } from '../markdown/types';
import { buildGradingPrompt, buildBatchGradingPrompt } from './prompts';
import type { BatchGradeItem } from './prompts';
import { withRetry, friendlyApiError } from './retry';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function checkWithGemini(
  apiKey: string,
  question: string,
  referenceAnswer: string,
  studentAnswer: string,
  questionType: 'short' | 'long'
): Promise<AiGradeResult> {
  const prompt = buildGradingPrompt(question, referenceAnswer, studentAnswer, questionType);

  return withRetry(async () => {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(friendlyApiError(response.status, 'Gemini', body));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');

    const parsed = JSON.parse(text);
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      feedback: String(parsed.feedback || 'No feedback provided'),
      keyMissing: Array.isArray(parsed.keyMissing) ? parsed.keyMissing : [],
    };
  });
}

export async function checkBatchWithGemini(
  apiKey: string,
  items: BatchGradeItem[]
): Promise<Record<string, AiGradeResult>> {
  const prompt = buildBatchGradingPrompt(items);

  return withRetry(async () => {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(friendlyApiError(response.status, 'Gemini', body));
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');

    const parsed: Array<{ id: string; score: number; feedback: string; keyMissing: string[] }> = JSON.parse(text);
    const results: Record<string, AiGradeResult> = {};

    for (const entry of parsed) {
      const index = parseInt(entry.id, 10) - 1;
      if (index >= 0 && index < items.length) {
        results[items[index].questionId] = {
          score: Math.max(0, Math.min(100, Number(entry.score) || 0)),
          feedback: String(entry.feedback || 'No feedback provided'),
          keyMissing: Array.isArray(entry.keyMissing) ? entry.keyMissing : [],
        };
      }
    }

    return results;
  });
}
