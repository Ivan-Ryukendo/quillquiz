/**
 * Retry an async function with exponential backoff on 429 (rate limit) errors.
 * Other errors are thrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 4, baseDelayMs = 2000 }: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimit = message.includes('429');

      if (!isRateLimit || attempt === maxAttempts - 1) throw err;

      // Exponential backoff: 2s, 4s, 8s …
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/** Human-readable message for common Gemini/OpenRouter HTTP errors. */
export function friendlyApiError(status: number, provider: string, body?: string): string {
  const detail = body ? ` (${body.slice(0, 120)})` : '';
  if (status === 429) return `${provider} rate limit reached — please wait a moment and try again.${detail}`;
  if (status === 401 || status === 403) return `${provider} API key is invalid or lacks permission.${detail}`;
  if (status === 400) return `${provider} rejected the request — check your API key format.${detail}`;
  return `${provider} error: ${status}${detail}`;
}
