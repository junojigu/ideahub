/**
 * Date utility for parsing diverse date formats (e.g. '2026-08-05', '2026.08.05', 'Wed Jun 24', ISO strings)
 * and formatting them into standard 'YYYY.MM.DD' display format.
 */

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

export function parseTimestamp(dateStr?: string): number {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const str = dateStr.trim();
  if (!str) return 0;

  // 1. Standard ISO or YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // 2. English short format like "Wed Jun 24", "Jun 24 2026", "Wed Jul 29"
  const englishMatch = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2})(?:\s+(\d{4}))?/i);
  if (englishMatch) {
    const monthKey = englishMatch[1].toLowerCase();
    const monthNum = parseInt(MONTH_MAP[monthKey] || '1', 10) - 1;
    const dayNum = parseInt(englishMatch[2], 10);
    const yearNum = englishMatch[3] ? parseInt(englishMatch[3], 10) : 2026;
    return new Date(yearNum, monthNum, dayNum).getTime();
  }

  // 3. Fallback to Date.parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;

  return 0;
}

export function formatDate(dateStr?: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '2026.08.05';
  const str = dateStr.trim();
  if (!str) return '2026.08.05';

  // If already in YYYY.MM.DD format
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(str)) return str;

  // 1. Try YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  // 2. Try English format like "Wed Jun 24", "Wed Jul 29"
  const englishMatch = str.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2})(?:\s+(\d{4}))?/i);
  if (englishMatch) {
    const monthKey = englishMatch[1].toLowerCase();
    const m = MONTH_MAP[monthKey] || '01';
    const d = englishMatch[2].padStart(2, '0');
    const y = englishMatch[3] || '2026';
    return `${y}.${m}.${d}`;
  }

  // 3. Try Date object fallback
  const timestamp = parseTimestamp(str);
  if (timestamp > 0) {
    const dt = new Date(timestamp);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  return str;
}
