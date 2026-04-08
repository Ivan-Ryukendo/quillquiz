import type { AiGradeResult } from '../markdown/types';
import { buildGradingPrompt, buildBatchGradingPrompt } from './prompts';
import type { BatchGradeItem } from './prompts';
import { withRetry, friendlyApiError } from './retry';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function checkWithOpenRouter(
  apiKey: string,
  question: string,
  referenceAnswer: string,
  studentAnswer: string,
  questionType: 'short' | 'long'
): Promise<AiGradeResult> {
  const prompt = buildGradingPrompt(question, referenceAnswer, studentAnswer, questionType);

  return withRetry(async () => {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(friendlyApiError(response.status, 'OpenRouter'));
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenRouter');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse JSON from OpenRouter response');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      feedback: String(parsed.feedback || 'No feedback provided'),
      keyMissing: Array.isArray(parsed.keyMissing) ? parsed.keyMissing : [],
    };
  });
}

export async function checkBatchWithOpenRouter(
  apiKey: string,
  items: BatchGradeItem[]
): Promise<Record<string, AiGradeResult>> {
  const prompt = buildBatchGradingPrompt(items);

  return withRetry(async () => {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(friendlyApiError(response.status, 'OpenRouter'));
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenRouter');

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Could not parse JSON array from OpenRouter response');

    const parsed: Array<{ id: string; score: number; feedback: string; keyMissing: string[] }> = JSON.parse(jsonMatch[0]);
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
