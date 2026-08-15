/**
 * Utility functions for robust Markdown processing and cursor insertion
 */

/**
 * Preprocesses raw markdown text to ensure consistent rendering across all devices & manual inputs.
 * Fixes common human typing quirks:
 * 1. Missing space after heading hashtags (e.g. "###제목" -> "### 제목")
 * 2. Missing space after blockquotes (e.g. ">인용구" -> "> 인용구")
 * 3. Missing space after list markers (e.g. "-항목" -> "- 항목", "1.순서" -> "1. 순서")
 * 4. Headings/block elements directly attached to prior paragraphs without blank lines
 * 5. Windows CRLF (\r\n) normalization
 */
export function normalizeMarkdown(rawContent: string | null | undefined): string {
  if (!rawContent) return '';

  // 1. Normalize line endings
  let text = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Fix headings without space: e.g. "###제목" -> "### 제목"
  text = text.replace(/(^|\n)(#{1,6})([^\s#\n][^\n]*)/g, '$1$2 $3');

  // 3. Fix blockquotes without space: e.g. ">인용구" -> "> 인용구"
  text = text.replace(/(^|\n)>(?!\s|>)([^\n]*)/g, '$1> $2');

  // 4. Fix unordered list bullets without space: e.g. "-항목" or "*항목" -> "- 항목"
  text = text.replace(/(^|\n)([-*+])([^\s\-*+\n][^\n]*)/g, '$1$2 $3');

  // 5. Fix numbered lists without space: e.g. "1.항목" -> "1. 항목"
  text = text.replace(/(^|\n)(\d+\.)([^\s\d\n][^\n]*)/g, '$1$2 $3');

  // 6. Ensure block elements (headings, blockquotes, code fences) starting on a new line have a preceding newline
  // if they immediately follow a regular text line, preventing CommonMark paragraph coalescing
  text = text.replace(/([^\n])\n(#{1,6}\s+[^\n]+)/g, '$1\n\n$2');
  text = text.replace(/([^\n])\n(```[^\n]*)/g, '$1\n\n$2');

  return text;
}
