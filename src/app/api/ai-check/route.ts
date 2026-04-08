import { NextRequest, NextResponse } from 'next/server';
import { buildGradingPrompt, buildBatchGradingPrompt } from '@/lib/ai/prompts';
import type { BatchGradeItem } from '@/lib/ai/prompts';
import type { AiGradeResult } from '@/lib/markdown/types';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Simple in-memory rate limiter (resets on cold start)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string, count: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count + count > RATE_LIMIT) {
    return false;
  }

  entry.count += count;
  return true;
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
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
    throw new Error(`AI provider error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from AI provider.');
  return text;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Demo mode is not configured on this server.' },
      { status: 503 }
    );
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const body = await request.json();

  // Batch request
  if (Array.isArray(body.batch)) {
    const items: BatchGradeItem[] = body.batch;

    if (items.length === 0) {
      return NextResponse.json({});
    }

    if (!checkRateLimit(ip, items.length)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please add your own API key in Settings.' },
        { status: 429 }
      );
    }

    const prompt = buildBatchGradingPrompt(items);

    try {
      const text = await callGemini(apiKey, prompt);
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

      return NextResponse.json(results);
    } catch (err) {
      console.error('Demo mode batch AI check failed:', err);
      return NextResponse.json(
        { error: 'Failed to check answers.' },
        { status: 500 }
      );
    }
  }

  // Single request (backward compatible)
  const { question, referenceAnswer, studentAnswer, questionType } = body;

  if (!question || !referenceAnswer || !studentAnswer || !questionType) {
    return NextResponse.json(
      { error: 'Missing required fields.' },
      { status: 400 }
    );
  }

  if (!checkRateLimit(ip, 1)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please add your own API key in Settings.' },
      { status: 429 }
    );
  }

  const prompt = buildGradingPrompt(question, referenceAnswer, studentAnswer, questionType);

  try {
    const text = await callGemini(apiKey, prompt);
    const parsed = JSON.parse(text);
    return NextResponse.json({
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      feedback: String(parsed.feedback || 'No feedback provided'),
      keyMissing: Array.isArray(parsed.keyMissing) ? parsed.keyMissing : [],
    });
  } catch (err) {
    console.error('Demo mode AI check failed:', err);
    return NextResponse.json(
      { error: 'Failed to check answer.' },
      { status: 500 }
    );
  }
}
