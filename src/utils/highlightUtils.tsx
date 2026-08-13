import React from 'react';

/**
 * Highlights occurrences of search query terms inside plain text.
 * Uses soft yellow pastel background (bg-amber-100) with NO padding (p-0) for clean readability.
 */
export function renderHighlightedText(text: string, query?: string): React.ReactNode {
  if (!text) return '';
  if (!query || !query.trim()) return text;

  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(pattern);

  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = terms.some((t) => new RegExp(`^${t}$`, 'i').test(part));
        if (isMatch) {
          return (
            <mark
              key={i}
              className="bg-amber-100/90 text-slate-900 font-semibold p-0 m-0 border-none inline"
            >
              {part}
            </mark>
          );
        }
        return part;
      })}
    </>
  );
}
