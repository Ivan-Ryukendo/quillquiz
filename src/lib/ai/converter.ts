import { buildConvertToQuizPrompt } from './prompts';
import { getSettings } from '../storage/settings-store';
import { withRetry, friendlyApiError } from './retry';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function convertWithGemini(apiKey: string, rawText: string): Promise<string> {
  const prompt = buildConvertToQuizPrompt(rawText);

  return withRetry(async () => {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });

    if (!response.ok) throw new Error(friendlyApiError(response.status, 'Gemini'));

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini converter');
    return stripCodeFence(text);
  });
}

async function convertWithOpenRouter(apiKey: string, rawText: string): Promise<string> {
  const prompt = buildConvertToQuizPrompt(rawText);

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
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error(friendlyApiError(response.status, 'OpenRouter'));

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenRouter converter');
    return stripCodeFence(text);
  });
}

/** Remove wrapping ```markdown ... ``` fences if the model adds them. */
function stripCodeFence(text: string): string {
  return text.replace(/^```(?:markdown)?\n?/i, '').replace(/\n?```\s*$/, '').trim();
}

/**
 * Convert raw OCR text into properly formatted quiz markdown.
 * Tries Gemini key first, falls back to OpenRouter key.
 * Returns null if no AI provider is configured.
 */
export async function convertRawTextToQuizMarkdown(
  rawText: string
): Promise<string | null> {
  const settings = await getSettings();

  if (settings.geminiApiKey) {
    try {
      return await convertWithGemini(settings.geminiApiKey, rawText);
    } catch (err) {
      console.warn('Gemini converter failed, trying OpenRouter:', err);
    }
  }

  if (settings.openrouterApiKey) {
    try {
      return await convertWithOpenRouter(settings.openrouterApiKey, rawText);
    } catch (err) {
      console.warn('OpenRouter converter failed:', err);
    }
  }

  return null;
}
