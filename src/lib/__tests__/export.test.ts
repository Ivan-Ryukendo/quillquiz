import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../export';

describe('sanitizeFilename', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(sanitizeFilename('My Quiz')).toBe('my-quiz');
  });

  it('replaces special chars with hyphens', () => {
    expect(sanitizeFilename('Quiz: Part 1!')).toBe('quiz-part-1');
  });

  it('collapses multiple consecutive hyphens into one', () => {
    expect(sanitizeFilename('Quiz  --  Test')).toBe('quiz-test');
  });

  it('returns "quiz" for empty string', () => {
    expect(sanitizeFilename('')).toBe('quiz');
  });

  it('returns "quiz" for string with only special chars', () => {
    expect(sanitizeFilename('!!!')).toBe('quiz');
  });
});
