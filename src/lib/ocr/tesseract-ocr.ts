/**
 * Tier 2: OCR via Tesseract.js — runs in-browser via WASM, no API key needed.
 * Used for images and scanned PDFs when PDF.js finds no text.
 * For PDFs we render each page to a canvas first using PDF.js.
 */

export async function ocrImage(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const { data } = await worker.recognize(url);
    URL.revokeObjectURL(url);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

export async function ocrScannedPdf(
  buffer: ArrayBuffer,
  onProgress?: (page: number, total: number) => void
): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  const pages: string[] = [];

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(i, pdf.numPages);

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 }); // 2x for better OCR quality

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      );
      const url = URL.createObjectURL(blob);
      const { data } = await worker.recognize(url);
      URL.revokeObjectURL(url);
      if (data.text.trim()) pages.push(data.text.trim());
    }
  } finally {
    await worker.terminate();
  }

  return pages.join('\n\n');
}
