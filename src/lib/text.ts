const HTML_HINT = /<\/?(br|p|div|span|strong|b|em|i|u|ul|ol|li)\b[^>]*>/i;

/** Workout text is rendered as plain text. If PushPress sent light HTML, flatten it to lines. */
export function cleanDescription(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw.replace(/\r\n?/g, '\n');
  if (HTML_HINT.test(s)) {
    s = s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/** "FOR_LOAD" -> "For load". Hides empty / "none" values. */
export function prettyScoreType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.replace(/[_-]+/g, ' ').trim().toLowerCase();
  if (!s || s === 'none' || s === 'null') return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Only simple values are shown for now; structured sets come with the Log stage. */
export function simpleSets(sets: unknown): string | null {
  if (typeof sets === 'number' && sets > 0) return `${sets} ${sets === 1 ? 'set' : 'sets'}`;
  if (typeof sets === 'string' && sets.trim()) return sets.trim();
  return null;
}
