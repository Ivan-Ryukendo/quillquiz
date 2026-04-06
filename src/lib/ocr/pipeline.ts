'use client';

import { getCachedOcr, saveOcrCache } from '../storage/ocr-store';
import { extractPdfText } from './pdf-extract';
import { ocrImage, ocrScannedPdf } from './tesseract-ocr';
import { geminiOcrImage, geminiOcrPdf } from './gemini-vision';
import { convertRawTextToQuizMarkdown } from '../ai/converter';
import { getSettings } from '../storage/settings-store';

export type OcrMethod = 'pdfjs' | 'tesseract' | 'gemini';

export interface OcrResult {
  markdown: string;
  method: OcrMethod;
  converted: boolean;
  fromCache: boolean;
}

export type OcrStage = 'cache' | 'pdfjs' | 'tesseract' | 'gemini' | 'converting';

export interface OcrProgressEvent {
  stage: OcrStage;
  page?: number;
  total?: number;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function runOcrPipeline(
  file: File,
  onProgress?: (event: OcrProgressEvent) => void
): Promise<OcrResult> {
  const buffer = await file.arrayBuffer();

  // ── Check cache and load settings in parallel ─────────────────────────────
  onProgress?.({ stage: 'cache' });
  const [cached, settings] = await Promise.all([getCachedOcr(buffer), getSettings()]);
  if (cached) {
    return {
      markdown: cached.markdown,
      method: cached.method,
      converted: cached.converted,
      fromCache: true,
    };
  }

  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
  const isImage = IMAGE_TYPES.includes(file.type);

  if (!isPdf && !isImage) {
    throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }
  let rawText = '';
  let method: OcrMethod = 'pdfjs';

  // ── Tier 1: PDF.js (digital PDFs only) ────────────────────────────────────
  if (isPdf) {
    onProgress?.({ stage: 'pdfjs' });
    try {
      const text = await extractPdfText(buffer.slice(0));
      if (text) {
        rawText = text;
        method = 'pdfjs';
      }
    } catch {
      // Fall through
    }
  }

  // ── Tier 2: Tesseract.js ───────────────────────────────────────────────────
  // Use when: image file, or scanned PDF (PDF.js found nothing), AND no Gemini key
  if (!rawText && !settings.geminiApiKey) {
    onProgress?.({ stage: 'tesseract' });
    try {
      const text = isPdf
        ? await ocrScannedPdf(buffer.slice(0), (page, total) =>
            onProgress?.({ stage: 'tesseract', page, total })
          )
        : await ocrImage(buffer.slice(0), file.type);

      if (text) {
        rawText = text;
        method = 'tesseract';
      }
    } catch {
      // Fall through
    }
  }

  // ── Tier 3: Gemini Vision ─────────────────────────────────────────────────
  // Use when: image/scanned PDF AND Gemini key is set (skips Tesseract)
  if (!rawText && settings.geminiApiKey) {
    onProgress?.({ stage: 'gemini' });
    const text = isPdf
      ? await geminiOcrPdf(settings.geminiApiKey, buffer.slice(0), (page, total) =>
          onProgress?.({ stage: 'gemini', page, total })
        )
      : await geminiOcrImage(settings.geminiApiKey, buffer.slice(0), file.type);

    rawText = text;
    method = 'gemini';
  }

  if (!rawText) {
    throw new Error(
      'Could not extract text. Add a Gemini API key in Settings for better OCR, or use a digital (non-scanned) PDF.'
    );
  }

  // ── AI Conversion: raw text → quiz markdown ────────────────────────────────
  onProgress?.({ stage: 'converting' });
  const converted = await convertRawTextToQuizMarkdown(rawText);
  const finalMarkdown = converted ?? rawText;
  const wasConverted = converted !== null;

  // Cache the final result so re-uploads skip everything
  await saveOcrCache(buffer, file.name, finalMarkdown, method, wasConverted);

  return { markdown: finalMarkdown, method, converted: wasConverted, fromCache: false };
}
