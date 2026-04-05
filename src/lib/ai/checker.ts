import type { AiGradeResult } from '../markdown/types';
import { getSettings } from '../storage/settings-store';
import { checkWithGemini } from './gemini';
import { checkWithOpenRouter } from './openrouter';

export async function checkAnswer(
  question: string,
  referenceAnswer: string,
  studentAnswer: string,
  questionType: 'short' | 'long'
): Promise<AiGradeResult> {
  const settings = await getSettings();

  // Try Gemini first (user's own key)
  if (settings.geminiApiKey) {
    try {
      return await checkWithGemini(
        settings.geminiApiKey,
        question,
        referenceAnswer,
        studentAnswer,
        questionType
      );
    } catch (err) {
      console.warn('Gemini check failed, trying fallback:', err);
    }
  }

  // Try OpenRouter (user's own key)
  if (settings.openrouterApiKey) {
    try {
      return await checkWithOpenRouter(
        settings.openrouterApiKey,
        question,
        referenceAnswer,
        studentAnswer,
        questionType
      );
    } catch (err) {
      console.warn('OpenRouter check failed, trying demo mode:', err);
    }
  }

  // Fall back to demo mode (serverless proxy)
  if (settings.useDemoMode) {
    const response = await fetch('/api/ai-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, referenceAnswer, studentAnswer, questionType }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Demo mode error: ${response.status} ${error}`);
    }

    return response.json();
  }

  throw new Error(
    'No AI provider configured. Please add a Gemini or OpenRouter API key in Settings, or enable Demo Mode.'
  );
}
