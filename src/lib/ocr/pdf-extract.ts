/**
 * Tier 1: Extract text from PDFs that have a text layer (digital PDFs).
 * Uses PDF.js — runs entirely in the browser, no API key needed.
 * Returns null if the PDF has no extractable text (scanned/image-only).
 */
export async function extractPdfText(buffer: ArrayBuffer): Promise<string | null> {
  // Dynamic import keeps this out of the initial bundle
  const pdfjsLib = await import('pdfjs-dist');

  // Point the worker at the bundled worker file
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    if (pageText) pages.push(pageText);
  }

  if (pages.length === 0) return null;

  // Heuristic: if we got fewer than 20 chars per page on average it's probably
  // a scanned PDF where PDF.js only found metadata fragments.
  const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
  if (totalChars / pdf.numPages < 20) return null;

  return pages.join('\n\n');
}
