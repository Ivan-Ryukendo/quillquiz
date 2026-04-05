import type { QuestionType, Option } from './types';
import type { RootContent, List, ListItem, Blockquote, Paragraph, Text, PhrasingContent } from 'mdast';

const TAG_REGEX = /^\[(MCQ|SHORT|LONG)\]\s*/i;
const SHORT_ANSWER_WORD_LIMIT = 50;

export interface DetectionResult {
  type: QuestionType;
  explicitTag?: QuestionType;
  cleanedHeadingText: string;
  options?: Option[];
  referenceAnswer?: string;
  body?: string;
}

function extractText(node: PhrasingContent): string {
  if (node.type === 'text') return (node as Text).value;
  if ('children' in node) {
    return (node as { children: PhrasingContent[] }).children.map(extractText).join('');
  }
  if (node.type === 'inlineCode') return (node as { value: string }).value;
  return '';
}

function extractBlockText(nodes: RootContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'paragraph') {
        return (node as Paragraph).children.map(extractText).join('');
      }
      if (node.type === 'blockquote') {
        return extractBlockText((node as Blockquote).children as RootContent[]);
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function parseExplicitTag(headingText: string): {
  tag?: QuestionType;
  cleaned: string;
} {
  const match = headingText.match(TAG_REGEX);
  if (!match) return { cleaned: headingText };
  return {
    tag: match[1].toLowerCase() as QuestionType,
    cleaned: headingText.replace(TAG_REGEX, '').trim(),
  };
}

function extractOptions(list: List): Option[] | null {
  const items = list.children as ListItem[];
  const hasChecks = items.some((item) => item.checked !== null && item.checked !== undefined);
  if (!hasChecks) return null;

  return items.map((item) => ({
    text: extractBlockText(item.children as RootContent[]).trim(),
    isCorrect: item.checked === true,
  }));
}

function extractBlockquoteAnswer(nodes: RootContent[]): string | undefined {
  for (const node of nodes) {
    if (node.type === 'blockquote') {
      return extractBlockText((node as Blockquote).children as RootContent[]).trim();
    }
  }
  return undefined;
}

function extractBody(nodes: RootContent[]): string | undefined {
  const bodyParts: string[] = [];
  for (const node of nodes) {
    if (node.type === 'paragraph') {
      bodyParts.push(
        (node as Paragraph).children.map(extractText).join('')
      );
    } else {
      break;
    }
  }
  return bodyParts.length > 0 ? bodyParts.join('\n') : undefined;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function detectQuestion(
  headingText: string,
  contentNodes: RootContent[]
): DetectionResult {
  const { tag, cleaned } = parseExplicitTag(headingText);

  // Look for checkbox list (MCQ)
  let options: Option[] | null = null;
  for (const node of contentNodes) {
    if (node.type === 'list') {
      options = extractOptions(node as List);
      if (options) break;
    }
  }

  // Look for blockquote answer
  const referenceAnswer = extractBlockquoteAnswer(contentNodes);

  // Extract body paragraphs (before list/blockquote)
  const body = extractBody(contentNodes);

  // Determine type
  let type: QuestionType;

  if (tag) {
    // Explicit tag overrides auto-detection
    type = tag;
  } else if (options) {
    type = 'mcq';
  } else if (referenceAnswer) {
    type = countWords(referenceAnswer) >= SHORT_ANSWER_WORD_LIMIT ? 'long' : 'short';
  } else {
    type = 'short'; // No answer provided, default to short
  }

  return {
    type,
    explicitTag: tag,
    cleanedHeadingText: cleaned,
    options: options ?? undefined,
    referenceAnswer,
    body,
  };
}
