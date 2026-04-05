import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, RootContent, Heading, PhrasingContent, Text } from 'mdast';
import { nanoid } from 'nanoid';
import { extractFrontmatter } from './frontmatter';
import { detectQuestion } from './detect';
import type { Question, QuizFile } from './types';

function getHeadingText(heading: Heading): string {
  return heading.children
    .map((child: PhrasingContent) => {
      if (child.type === 'text') return (child as Text).value;
      if ('children' in child) {
        return (child as { children: PhrasingContent[] }).children
          .map((c: PhrasingContent) => (c.type === 'text' ? (c as Text).value : ''))
          .join('');
      }
      if (child.type === 'inlineCode') return (child as { value: string }).value;
      return '';
    })
    .join('');
}

function groupByHeading(tree: Root): Array<{ heading: Heading; content: RootContent[] }> {
  const groups: Array<{ heading: Heading; content: RootContent[] }> = [];
  let currentGroup: { heading: Heading; content: RootContent[] } | null = null;

  for (const node of tree.children) {
    if (node.type === 'heading') {
      const heading = node as Heading;

      // h1 headings are section titles, not questions
      if (heading.depth === 1) {
        currentGroup = null;
        continue;
      }

      // If we encounter a heading of same or lesser depth, close previous group
      if (currentGroup && heading.depth <= currentGroup.heading.depth) {
        groups.push(currentGroup);
      }

      currentGroup = { heading, content: [] };
    } else if (currentGroup) {
      // Skip thematic breaks (---) between questions
      if (node.type === 'thematicBreak') continue;
      currentGroup.content.push(node);
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

export function parseQuestions(markdown: string, sourceFile: string): Question[] {
  const processor = unified().use(remarkParse).use(remarkGfm);
  const tree = processor.parse(markdown) as Root;

  const groups = groupByHeading(tree);
  const questions: Question[] = [];

  for (const group of groups) {
    const headingText = getHeadingText(group.heading);
    const detection = detectQuestion(headingText, group.content);

    questions.push({
      id: nanoid(10),
      type: detection.type,
      text: detection.cleanedHeadingText,
      body: detection.body,
      options: detection.options,
      referenceAnswer: detection.referenceAnswer,
      sourceFile,
      explicitTag: detection.explicitTag,
    });
  }

  return questions;
}

export function parseQuiz(markdown: string, filename: string): QuizFile {
  const { metadata, content } = extractFrontmatter(markdown);
  const questions = parseQuestions(content, filename);

  return {
    id: nanoid(12),
    filename,
    metadata,
    questions,
    rawMarkdown: markdown,
    uploadedAt: Date.now(),
  };
}
