import type { QuizFile } from '@/lib/markdown/types';
import { serializeQuiz } from '@/lib/markdown/serializer';

export function sanitizeFilename(name: string): string {
  const result = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return result || 'quiz';
}

function getBaseName(file: QuizFile): string {
  const raw = file.metadata.title ?? file.filename.replace(/\.[^.]+$/, '');
  return sanitizeFilename(raw);
}

function triggerDownload(content: string, type: string, filename: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function downloadMarkdown(file: QuizFile): void {
  const content = file.rawMarkdown ?? serializeQuiz(file);
  triggerDownload(content, 'text/markdown', `${getBaseName(file)}.md`);
}

export function downloadJson(file: QuizFile): void {
  const content = JSON.stringify(file, null, 2);
  triggerDownload(content, 'application/json', `${getBaseName(file)}.json`);
}

export function downloadPdf(file: QuizFile, includeAnswers: boolean): void {
  const title = escapeHtml(file.metadata.title ?? file.filename);

  const questionsHtml = file.questions
    .map((q, i) => {
      const heading = `<h2>${i + 1}. ${escapeHtml(q.text)}</h2>`;

      if (q.type === 'mcq') {
        const options = (q.options ?? [])
          .map((opt, j) => {
            const letter = String.fromCharCode(65 + j);
            const isCorrect = opt.isCorrect;
            const label = escapeHtml(opt.text);
            if (includeAnswers && isCorrect) {
              return `<li><strong>${letter}. ${label} ✓</strong></li>`;
            }
            return `<li>${letter}. ${label}</li>`;
          })
          .join('\n');
        return `${heading}<ul>${options}</ul>`;
      }

      if (includeAnswers && q.referenceAnswer) {
        return `${heading}<p><em>Answer: ${escapeHtml(q.referenceAnswer)}</em></p>`;
      }

      // blank lines for writing space
      return `${heading}<p style="margin-top:4rem;">&nbsp;</p>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
  h2 { margin-top: 2rem; font-size: 1.1rem; }
  ul { list-style: none; padding-left: 1rem; }
  li { margin: 0.25rem 0; }
</style>
</head>
<body>
<h1>${title}</h1>
${questionsHtml}
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  // Remove iframe after a short delay to allow the print dialog to open
  setTimeout(() => document.body.removeChild(iframe), 1000);
}
