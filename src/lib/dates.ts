const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local-time YYYY-MM-DD. */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses YYYY-MM-DD as a local date at noon (avoids DST/timezone edge cases). */
export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function todayISO(): string {
  return toISO(new Date());
}

function valid(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m - 1, d, 12);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Accepts YYYY-MM-DD (optionally with a time), DD.MM.YYYY and DD/MM/YYYY. */
export function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s);
  if (m) return valid(+m[3], +m[2], +m[1]);
  return null;
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[fromISO(iso).getDay()];
}

const long = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
const short = new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
const med = new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
const month = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' });

export const formatLong = (iso: string) => long.format(fromISO(iso));
export const formatShort = (iso: string) => short.format(fromISO(iso));
export const formatMedium = (iso: string) => med.format(fromISO(iso));
export const formatMonth = (year: number, monthIndex: number) => month.format(new Date(year, monthIndex, 1, 12));
