export function sanitizeMarkdown(markdown: string): string {
  let sanitized = markdown;

  sanitized = sanitized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  sanitized = sanitized.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  sanitized = sanitized.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "");
  sanitized = sanitized.replace(/<embed\b[^>]*\/?>/gi, "");
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  return sanitized;
}
