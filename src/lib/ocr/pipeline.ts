'use client';

import { getCachedOcr, saveOcrCache } from '../storage/ocr-store';
import { getSettings } from '../storage/settings-store';
import { extractPdfText } from './pdf-extract';
import { ocrImage, ocrScannedPdf } from './tesseract-ocr';
import { geminiOcrImage, geminiOcrPdf } from './gemini-vision';

export type OcrMethod = 'pdfjs' | 'tesseract' | 'gemini';

export interface OcrResult {
  markdown: string;
  method: OcrMethod;
  fromCache: boolean;
}

export interface OcrProgressEvent {
  stage: 'cache' | 'pdfjs' | 'tesseract' | 'gemini';
  page?: number;
  total?: number;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function runOcrPipeline(
  file: File,
  onProgress?: (event: OcrProgressEvent) => void
): Promise<OcrResult> {
  const buffer = await file.arrayBuffer();

  // Check IndexedDB cache first
  onProgress?.({ stage: 'cache' });
  const cached = await getCachedOcr(buffer);
  if (cached) {
    return { markdown: cached.markdown, method: cached.method, fromCache: true };
  }

  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
  const isImage = IMAGE_TYPES.includes(file.type);

  if (!isPdf && !isImage) {
    throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }

  const settings = await getSettings();

  // ── Tier 1: PDF.js (digital PDFs only) ────────────────────────────────────
  if (isPdf) {
    onProgress?.({ stage: 'pdfjs' });
    try {
      const text = await extractPdfText(buffer.slice(0));
      if (text) {
        await saveOcrCache(buffer, file.name, text, 'pdfjs');
        return { markdown: text, method: 'pdfjs', fromCache: false };
      }
    } catch {
      // Fall through to next tier
    }
  }

  // ── Tier 2: Tesseract.js (images + scanned PDFs) ──────────────────────────
  // Skip Tesseract if user has a Gemini key — go straight to high quality
  if (!settings.geminiApiKey) {
    onProgress?.({ stage: 'tesseract' });
    try {
      const text = isPdf
        ? await ocrScannedPdf(buffer.slice(0), (page, total) =>
            onProgress?.({ stage: 'tesseract', page, total })
          )
        : await ocrImage(buffer.slice(0), file.type);

      if (text) {
        await saveOcrCache(buffer, file.name, text, 'tesseract');
        return { markdown: text, method: 'tesseract', fromCache: false };
      }
    } catch {
      // Fall through to Gemini if available
    }
  }

  // ── Tier 3: Gemini Vision (high quality, uses API key) ────────────────────
  if (settings.geminiApiKey) {
    onProgress?.({ stage: 'gemini' });
    const text = isPdf
      ? await geminiOcrPdf(settings.geminiApiKey, buffer.slice(0), (page, total) =>
          onProgress?.({ stage: 'gemini', page, total })
        )
      : await geminiOcrImage(settings.geminiApiKey, buffer.slice(0), file.type);

    await saveOcrCache(buffer, file.name, text, 'gemini');
    return { markdown: text, method: 'gemini', fromCache: false };
  }

  throw new Error(
    'Could not extract text. Add a Gemini API key in Settings for better OCR, or use a digital (non-scanned) PDF.'
  );
}
