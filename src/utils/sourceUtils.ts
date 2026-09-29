/**
 * Source parsing and sanitization utilities
 * Cleans up emojis, broken unicode characters (e.g., \uFFFD replacement glyphs),
 * prefixes like [도서], [일반], and normalizes book titles for grouping.
 */

export type SourceType = 'book' | 'link' | 'general' | 'other';
export type SourceCategory = 'all' | 'link' | 'book' | 'document' | 'memo';

export interface SourceCategoryMeta {
  key: Exclude<SourceCategory, 'all'>;
  label: string;
  tag: string;
  emoji: string;
  badgeClass: string;
  activeClass: string;
  inactiveClass: string;
}

export const SOURCE_CATEGORIES: SourceCategoryMeta[] = [
  {
    key: 'book',
    label: '도서',
    tag: '[도서]',
    emoji: '📚',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm',
    inactiveClass: 'bg-white hover:bg-amber-50 text-slate-700 border-slate-200 hover:border-amber-300',
  },
  {
    key: 'link',
    label: '웹링크',
    tag: '[웹링크]',
    emoji: '🔗',
    badgeClass: 'bg-blue-50 text-blue-900 border-blue-200',
    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm',
    inactiveClass: 'bg-white hover:bg-blue-50 text-slate-700 border-slate-200 hover:border-blue-300',
  },
  {
    key: 'document',
    label: '문서',
    tag: '[문서]',
    emoji: '📄',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    inactiveClass: 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200 hover:border-emerald-300',
  },
  {
    key: 'memo',
    label: '메모',
    tag: '[메모]',
    emoji: '💡',
    badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    activeClass: 'bg-indigo-600 text-white border-indigo-600 shadow-sm',
    inactiveClass: 'bg-white hover:bg-indigo-50 text-slate-700 border-slate-200 hover:border-indigo-300',
  },
];

/**
 * Categorize any idea's sourceUrl into one of the 4 requested categories:
 * 'book' (도서), 'link' (웹링크), 'document' (문서), 'memo' (메모)
 */
export function getSourceCategory(sourceStr?: string): Exclude<SourceCategory, 'all'> {
  if (!sourceStr || !sourceStr.trim()) return 'memo';
  const s = sourceStr.trim().toLowerCase();

  // 1. 도서 (Book)
  if (
    s.includes('[도서]') ||
    s.includes('📚') ||
    s.startsWith('도서:') ||
    s.startsWith('책:') ||
    s.includes('도서')
  ) {
    return 'book';
  }

  // 2. 웹링크 (Web link)
  if (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('www.') ||
    s.includes('🔗') ||
    s.includes('[웹링크]') ||
    s.includes('[링크]') ||
    s.includes('youtube.com') ||
    s.includes('youtu.be')
  ) {
    return 'link';
  }

  // 3. 문서 (Document)
  if (
    s.includes('[문서]') ||
    s.includes('📄') ||
    s.includes('[일반]') ||
    s.startsWith('문서:') ||
    s.includes('리포트') ||
    s.includes('논문')
  ) {
    return 'document';
  }

  // 4. 메모 (Memo / Note / Other)
  return 'memo';
}

/**
 * Parses user search query for source category keywords like:
 * "[도서]", "[웹링크]", "[문서]", "[메모]", "출처:도서", etc.
 */
export function parseSourceCategorySearch(query: string): {
  sourceCategory: SourceCategory;
  cleanQuery: string;
} {
  const trimmed = query.trim();
  if (!trimmed) return { sourceCategory: 'all', cleanQuery: '' };

  // 1. Look for bracketed source tags: [도서], [웹링크], [링크], [문서], [메모], [기타]
  const bracketMatch = trimmed.match(/\[(도서|웹링크|링크|문서|일반|메모|기타)\]/i);
  if (bracketMatch) {
    const matched = bracketMatch[1].toLowerCase();
    let cat: SourceCategory = 'all';
    if (matched === '도서') cat = 'book';
    else if (matched === '웹링크' || matched === '링크') cat = 'link';
    else if (matched === '문서' || matched === '일반') cat = 'document';
    else if (matched === '메모' || matched === '기타') cat = 'memo';

    const clean = trimmed.replace(bracketMatch[0], '').trim();
    return { sourceCategory: cat, cleanQuery: clean };
  }

  // 2. Look for colon prefix: 출처:도서, 출처:웹링크, etc.
  const prefixMatch = trimmed.match(/^출처:\s*(도서|웹링크|링크|문서|메모)(?:\s+(.*))?$/i);
  if (prefixMatch) {
    const matched = prefixMatch[1].toLowerCase();
    let cat: SourceCategory = 'all';
    if (matched === '도서') cat = 'book';
    else if (matched === '웹링크' || matched === '링크') cat = 'link';
    else if (matched === '문서') cat = 'document';
    else if (matched === '메모') cat = 'memo';

    return { sourceCategory: cat, cleanQuery: prefixMatch[2]?.trim() || '' };
  }

  return { sourceCategory: 'all', cleanQuery: trimmed };
}

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
