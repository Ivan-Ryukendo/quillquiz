import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAnswersBatch } from '../checker';
import type { BatchGradeItem } from '../prompts';

vi.mock('../gemini', () => ({ checkBatchWithGemini: vi.fn() }));
vi.mock('../openrouter', () => ({ checkBatchWithOpenRouter: vi.fn() }));
vi.mock('../../storage/settings-store', () => ({ getSettings: vi.fn() }));

import { checkBatchWithGemini } from '../gemini';
import { checkBatchWithOpenRouter } from '../openrouter';
import { getSettings } from '../../storage/settings-store';

const mockGetSettings = vi.mocked(getSettings);
const mockGemini = vi.mocked(checkBatchWithGemini);
const mockOpenRouter = vi.mocked(checkBatchWithOpenRouter);

const testItems: BatchGradeItem[] = [
  { questionId: 'q1', question: 'What is 2+2?', referenceAnswer: '4', studentAnswer: 'Four', type: 'short' },
  { questionId: 'q2', question: 'Explain X', referenceAnswer: 'X is Y', studentAnswer: 'X means Y', type: 'long' },
];

const mockResults = {
  q1: { score: 90, feedback: 'Good', keyMissing: [] as string[] },
  q2: { score: 75, feedback: 'Decent', keyMissing: ['detail'] },
};

beforeEach(() => { vi.clearAllMocks(); });

describe('checkAnswersBatch', () => {
  it('returns empty object for empty array', async () => {
    mockGetSettings.mockResolvedValue({ useDemoMode: false });
    expect(await checkAnswersBatch([])).toEqual({});
  });

  it('uses Gemini when API key is set', async () => {
    mockGetSettings.mockResolvedValue({ geminiApiKey: 'test-key', useDemoMode: false });
    mockGemini.mockResolvedValue(mockResults);
    const result = await checkAnswersBatch(testItems);
    expect(mockGemini).toHaveBeenCalledWith('test-key', testItems);
    expect(result).toEqual(mockResults);
  });

  it('falls back to OpenRouter when Gemini fails', async () => {
    mockGetSettings.mockResolvedValue({ geminiApiKey: 'key', openrouterApiKey: 'or-key', useDemoMode: false });
    mockGemini.mockRejectedValue(new Error('Gemini down'));
    mockOpenRouter.mockResolvedValue(mockResults);
    const result = await checkAnswersBatch(testItems);
    expect(mockOpenRouter).toHaveBeenCalledWith('or-key', testItems);
    expect(result).toEqual(mockResults);
  });

  it('falls back to demo mode when both providers fail', async () => {
    mockGetSettings.mockResolvedValue({ geminiApiKey: 'key', openrouterApiKey: 'or-key', useDemoMode: true });
    mockGemini.mockRejectedValue(new Error('Gemini down'));
    mockOpenRouter.mockRejectedValue(new Error('OR down'));
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResults) });
    const result = await checkAnswersBatch(testItems);
    expect(global.fetch).toHaveBeenCalledWith('/api/ai-check', expect.objectContaining({ method: 'POST' }));
    expect(result).toEqual(mockResults);
  });

  it('throws when no provider is available', async () => {
    mockGetSettings.mockResolvedValue({ useDemoMode: false });
    await expect(checkAnswersBatch(testItems)).rejects.toThrow('No AI provider configured');
  });
});
