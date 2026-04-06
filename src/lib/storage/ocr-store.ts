import { getDB, type OcrCacheEntry } from './db';

async function hashFile(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getCachedOcr(buffer: ArrayBuffer): Promise<OcrCacheEntry | undefined> {
  const hash = await hashFile(buffer);
  const db = await getDB();
  return db.get('ocrCache', hash);
}

export async function saveOcrCache(
  buffer: ArrayBuffer,
  filename: string,
  markdown: string,
  method: OcrCacheEntry['method'],
  converted: boolean = false
): Promise<OcrCacheEntry> {
  const hash = await hashFile(buffer);
  const entry: OcrCacheEntry = { hash, filename, markdown, method, converted, cachedAt: Date.now() };
  const db = await getDB();
  await db.put('ocrCache', entry);
  return entry;
}

export async function getAllOcrCache(): Promise<OcrCacheEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('ocrCache', 'by-cachedAt');
}

export async function deleteOcrCache(hash: string): Promise<void> {
  const db = await getDB();
  await db.delete('ocrCache', hash);
}
