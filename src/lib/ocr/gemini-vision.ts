/**
 * Tier 3: OCR via Gemini Vision — high quality, uses the user's Gemini API key.
 * Sends image/PDF pages as base64 inline data to gemini-2.0-flash.
 * For PDFs, renders each page to a canvas via PDF.js then sends as JPEG.
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const EXTRACT_PROMPT =
  'Extract all text from this image exactly as it appears. ' +
  'Preserve headings, lists, tables, and paragraph structure using markdown formatting. ' +
  'Output only the extracted text — no commentary.';

async function geminiVisionRequest(
  apiKey: string,
  base64Data: string,
  mimeType: string
): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: EXTRACT_PROMPT },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini Vision error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini Vision');
  return text.trim();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function geminiOcrImage(
  apiKey: string,
  buffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const base64 = arrayBufferToBase64(buffer);
  return geminiVisionRequest(apiKey, base64, mimeType);
}

export async function geminiOcrPdf(
  apiKey: string,
  buffer: ArrayBuffer,
  onProgress?: (page: number, total: number) => void
): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(i, pdf.numPages);

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9)
    );
    const pageBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(pageBuffer);
    const text = await geminiVisionRequest(apiKey, base64, 'image/jpeg');
    if (text) pages.push(text);
  }

  return pages.join('\n\n');
}
