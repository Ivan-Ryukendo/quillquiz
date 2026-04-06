import { NextRequest, NextResponse } from 'next/server';
import { buildGradingPrompt } from '@/lib/ai/prompts';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Simple in-memory rate limiter (resets on cold start)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
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
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please add your own API key in Settings.' },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { question, referenceAnswer, studentAnswer, questionType } = body;

  if (!question || !referenceAnswer || !studentAnswer || !questionType) {
    return NextResponse.json(
      { error: 'Missing required fields.' },
      { status: 400 }
    );
  }

  const prompt = buildGradingPrompt(question, referenceAnswer, studentAnswer, questionType);

  try {
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
      return NextResponse.json(
        { error: `AI provider error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json(
        { error: 'Empty response from AI provider.' },
        { status: 502 }
      );
    }

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
