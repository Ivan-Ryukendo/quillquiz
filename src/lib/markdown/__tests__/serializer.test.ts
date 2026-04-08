// src/lib/markdown/__tests__/serializer.test.ts
import { describe, it, expect } from 'vitest';
import { serializeQuiz } from '../serializer';
import { parseQuiz } from '../parser';
import type { QuizFile, Question } from '../types';

function makeFile(overrides: Partial<QuizFile> = {}): QuizFile {
  return {
    id: 'test-id',
    filename: 'test.md',
    metadata: {},
    questions: [],
    rawMarkdown: '',
    uploadedAt: 0,
    ...overrides,
  };
}

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'short',
    text: 'What is 2+2?',
    sourceFile: 'test.md',
    ...overrides,
  };
}

describe('serializeQuiz', () => {
  it('round-trips MCQ question', () => {
    const file = makeFile({
      questions: [makeQuestion({
        type: 'mcq',
        text: 'What color is the sky?',
        options: [
          { text: 'Blue', isCorrect: true },
          { text: 'Green', isCorrect: false },
          { text: 'Red', isCorrect: false },
        ],
      })],
    });
    const parsed = parseQuiz(serializeQuiz(file), 'test.md');
    const q = parsed.questions[0];
    expect(q.type).toBe('mcq');
    expect(q.text).toBe('What color is the sky?');
    expect(q.options).toHaveLength(3);
    expect(q.options![0]).toEqual({ text: 'Blue', isCorrect: true });
    expect(q.options![1]).toEqual({ text: 'Green', isCorrect: false });
    expect(q.options![2]).toEqual({ text: 'Red', isCorrect: false });
  });

  it('round-trips short answer question', () => {
    const file = makeFile({
      questions: [makeQuestion({
        type: 'short',
        text: 'What is the capital of France?',
        referenceAnswer: 'Paris',
      })],
    });
    const parsed = parseQuiz(serializeQuiz(file), 'test.md');
    const q = parsed.questions[0];
    expect(q.type).toBe('short');
    expect(q.text).toBe('What is the capital of France?');
    expect(q.referenceAnswer).toBe('Paris');
  });

  it('round-trips long answer question', () => {
    const longAnswer =
      'This is a very long reference answer that has more than fifty words in it ' +
      'to ensure that it is detected as a long answer type by the parser when it ' +
      'is parsed back from the markdown string after serialization.';
    const file = makeFile({
      questions: [makeQuestion({
        type: 'long',
        text: 'Explain photosynthesis.',
        referenceAnswer: longAnswer,
      })],
    });
    const parsed = parseQuiz(serializeQuiz(file), 'test.md');
    const q = parsed.questions[0];
    expect(q.type).toBe('long');
    expect(q.referenceAnswer).toBe(longAnswer);
  });

  it('preserves explicit type tag on round-trip', () => {
    // A "short" answer (few words) that is explicitly tagged [LONG]
    const file = makeFile({
      questions: [makeQuestion({
        type: 'long',
        text: 'Why?',
        referenceAnswer: 'Because.',
        explicitTag: 'long',
      })],
    });
    const parsed = parseQuiz(serializeQuiz(file), 'test.md');
    const q = parsed.questions[0];
    expect(q.type).toBe('long');
    expect(q.explicitTag).toBe('long');
  });

  it('preserves question body on round-trip', () => {
    const file = makeFile({
      questions: [makeQuestion({
        type: 'mcq',
        text: 'Based on the context, what is true?',
        body: 'Read the following passage carefully.',
        options: [
          { text: 'Option A', isCorrect: true },
          { text: 'Option B', isCorrect: false },
        ],
      })],
    });
    const parsed = parseQuiz(serializeQuiz(file), 'test.md');
    expect(parsed.questions[0].body).toBe('Read the following passage carefully.');
  });

  it('round-trips full frontmatter metadata', () => {
    const file = makeFile({
      metadata: {
        title: 'My Quiz',
        description: 'A test quiz',
        author: 'Ivan',
        tags: ['science', 'biology'],
        timeLimit: 30,
      },
      questions: [makeQuestion()],
    });
    const parsed = parseQuiz(serializeQuiz(file), 'test.md');
    expect(parsed.metadata.title).toBe('My Quiz');
    expect(parsed.metadata.description).toBe('A test quiz');
    expect(parsed.metadata.author).toBe('Ivan');
    expect(parsed.metadata.tags).toEqual(['science', 'biology']);
    expect(parsed.metadata.timeLimit).toBe(30);
  });

  it('emits no frontmatter when metadata is empty', () => {
    const file = makeFile({
      metadata: {},
      questions: [makeQuestion({ text: 'Test?', referenceAnswer: 'Yes.' })],
    });
    const output = serializeQuiz(file);
    expect(output.startsWith('##')).toBe(true);
  });

  it('preserves multiple questions in order', () => {
    const file = makeFile({
      questions: [
        makeQuestion({ id: 'q1', text: 'First question', referenceAnswer: 'A' }),
        makeQuestion({ id: 'q2', text: 'Second question', referenceAnswer: 'B' }),
        makeQuestion({ id: 'q3', text: 'Third question', referenceAnswer: 'C' }),
      ],
    });
    const parsed = parseQuiz(serializeQuiz(file), 'test.md');
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.questions[0].text).toBe('First question');
    expect(parsed.questions[1].text).toBe('Second question');
    expect(parsed.questions[2].text).toBe('Third question');
  });

  it('auto-emits type tag when word count contradicts stored type', () => {
    const file = makeFile({
      questions: [makeQuestion({
        type: 'long',
        text: 'Brief answer question',
        referenceAnswer: 'Short.',
        // explicitTag intentionally absent
      })],
    });
    const parsed = parseQuiz(serializeQuiz(file), 'test.md');
    expect(parsed.questions[0].type).toBe('long');
  });
});
