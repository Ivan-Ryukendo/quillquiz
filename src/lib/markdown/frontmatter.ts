import { parse as parseYaml } from 'yaml';
import type { QuizMetadata } from './types';

export function extractFrontmatter(markdown: string): {
  metadata: QuizMetadata;
  content: string;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    return { metadata: {}, content: markdown };
  }

  try {
    const raw = parseYaml(match[1]) as Record<string, unknown>;
    const metadata: QuizMetadata = {};

    if (typeof raw.title === 'string') metadata.title = raw.title;
    if (typeof raw.description === 'string') metadata.description = raw.description;
    if (typeof raw.author === 'string') metadata.author = raw.author;
    if (typeof raw.time_limit === 'number') metadata.timeLimit = raw.time_limit;
    if (Array.isArray(raw.tags)) {
      metadata.tags = raw.tags.filter((t): t is string => typeof t === 'string');
    }

    return { metadata, content: match[2] };
  } catch {
    return { metadata: {}, content: markdown };
  }
}
