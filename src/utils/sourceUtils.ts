/**
 * Source parsing and sanitization utilities
 * Cleans up emojis, broken unicode characters (e.g., \uFFFD replacement glyphs),
 * prefixes like [도서], [일반], and normalizes book titles for grouping.
 */

export type SourceType = 'book' | 'link' | 'general' | 'other';

/**
 * Detect the type of source based on prefixes or URL pattern
 */
export function getSourceType(sourceStr?: string): SourceType {
  if (!sourceStr) return 'other';
  const s = sourceStr.trim();

  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('www.') || s.startsWith('🔗')) {
    return 'link';
  }
  if (s.includes('[도서]') || s.includes('📚') || s.startsWith('도서:') || s.startsWith('책:')) {
    return 'book';
  }
  if (s.includes('[일반]') || s.includes('📄') || s.startsWith('문서:')) {
    return 'general';
  }
  return 'other';
}

/**
 * Clean up source display text by removing broken unicode symbols (\uFFFD),
 * emoji prefixes (📚, 📄, 💡, 🔗), and brackets ([도서], [일반], etc.)
 */
export function cleanSourceTitle(sourceStr?: string): string {
  if (!sourceStr) return '';
  let cleaned = sourceStr.trim();

  // 1. Remove leading unicode replacement characters (\uFFFD, \uFEFF) and corrupted glyphs
  cleaned = cleaned.replace(/^[\uFFFD\uFEFF\u0000-\u001F\?\!\s]+/, '');

  // 2. Remove emoji icons at start
  cleaned = cleaned.replace(/^[📚📄💡🔗📖🔖📌📁]\s*/, '');

  // 3. Remove bracket tags like [도서], [일반], [기타], [링크], [웹]
  cleaned = cleaned.replace(/^\[(도서|일반|기타|링크|웹|자료|메모)\]\s*/i, '');

  // 4. In case emoji came after or before tag or another broken char was repeated
  cleaned = cleaned.replace(/^[\uFFFD\uFEFF\s📚📄💡🔗\-\:]+/, '');

  return cleaned.trim();
}

/**
 * Normalizes book titles for book shelf grouping.
 * For example:
 * "강신주의 노자 혹은 장자, p.15" or "강신주의 노자 혹은 장자, 제1장" -> "강신주의 노자 혹은 장자"
 * This prevents identical books with different page annotations from being split into separate 1-item groups.
 */
export function extractMainBookTitle(sourceStr?: string): string {
  const clean = cleanSourceTitle(sourceStr);
  if (!clean) return '';

  // If it's a URL, return clean hostname or URL
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('www.')) {
    return clean;
  }

  // Remove trailing page/chapter references like:
  // ", p.12", ", 15p", ", 제2장", ", 1장", ", 14-18쪽", " (p.12)", etc.
  const normalized = clean
    .replace(/,\s*(p\.?|pp\.?|page|페이지|\d+\s*쪽|\d+\s*p|제?\s*\d+\s*(장|절|편|강)).*$/i, '')
    .replace(/\s*\((p\.?|pp\.?|page|\d+\s*쪽|\d+\s*p).*\)$/i, '')
    .trim();

  return normalized || clean;
}
