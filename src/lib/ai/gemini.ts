import type { AiGradeResult } from '../markdown/types';
import { buildGradingPrompt } from './prompts';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function checkWithGemini(
  apiKey: string,
  question: string,
  referenceAnswer: string,
  studentAnswer: string,
  questionType: 'short' | 'long'
): Promise<AiGradeResult> {
  const prompt = buildGradingPrompt(question, referenceAnswer, studentAnswer, questionType);

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
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  const parsed = JSON.parse(text);
  return {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    feedback: String(parsed.feedback || 'No feedback provided'),
    keyMissing: Array.isArray(parsed.keyMissing) ? parsed.keyMissing : [],
  };
}
