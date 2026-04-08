// src/lib/markdown/serializer.ts
import { stringify as stringifyYaml } from 'yaml';
import type { QuizFile, Question, QuizMetadata } from './types';

function serializeMetadata(metadata: QuizMetadata): string {
  const obj: Record<string, unknown> = {};
  if (metadata.title !== undefined) obj.title = metadata.title;
  if (metadata.description !== undefined) obj.description = metadata.description;
  if (metadata.author !== undefined) obj.author = metadata.author;
  if (metadata.tags !== undefined && metadata.tags.length > 0) obj.tags = metadata.tags;
  if (metadata.timeLimit !== undefined) obj.time_limit = metadata.timeLimit;

  if (Object.keys(obj).length === 0) return '';
  return `---\n${stringifyYaml(obj).trimEnd()}\n---\n\n`;
}

function serializeQuestion(question: Question): string {
  // Determine if we need an explicit tag:
  // 1. If explicitTag is set, use it
  // 2. If type is 'long'/'short' and word count doesn't match the type, emit tag to preserve type
  let needsTag = question.explicitTag;

  if (!needsTag && (question.type === 'long' || question.type === 'short')) {
    const wordCount = question.referenceAnswer ?
      question.referenceAnswer.split(/\s+/).filter(Boolean).length : 0;
    const isLongByWordCount = wordCount >= 50;
    const isLongByType = question.type === 'long';
    if (isLongByWordCount !== isLongByType) {
      needsTag = question.type;
    }
  }

  if (!needsTag && question.type === 'mcq' && !(question.options?.length)) {
    needsTag = 'mcq';
  }

  const tag = needsTag ? `[${needsTag.toUpperCase()}] ` : '';
  let block = `## ${tag}${question.text}\n`;

  if (question.body) {
    block += `\n${question.body}\n`;
  }

  switch (question.type) {
    case 'mcq': {
      const options = question.options ?? [];
      if (options.length > 0) {
        block += '\n' + options.map((o) => `- [${o.isCorrect ? 'x' : ' '}] ${o.text}`).join('\n') + '\n';
      }
      break;
    }
    case 'short':
    case 'long': {
      if (question.referenceAnswer) {
        const lines = question.referenceAnswer.split('\n').map((l) => `> ${l}`).join('\n');
        block += `\n${lines}\n`;
      }
      break;
    }
    // Future question types: add a case here + in QuestionCard
  }

  return block;
}

export function serializeQuiz(file: QuizFile): string {
  const frontmatter = serializeMetadata(file.metadata);
  const questionBlocks = file.questions.map(serializeQuestion).join('\n---\n\n');
  return frontmatter + questionBlocks;
}
