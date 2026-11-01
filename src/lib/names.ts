import type { Matcher } from './lifts';

const NOISE =
  /^(rest|rounds?|rds?|min|mins|minutes?|sec|secs|seconds?|amrap|emom|time|then|rx|scaled|score|notes?|cap|every|sets?|reps?|partner|cal|cals|calories|meters?|km|rpe|week|day|buy|total|each)$/i;
const TRAILING = /^(reps?|rm|kg|sets?|at|for|to|of|then|and|or|each|per|total|x)$/i;

function titleCase(words: string[]): string {
  return words
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/** One text chunk ("5 Power Clean @70%") to a movement name ("Power Clean"), or null when it is not one. */
function nameFromChunk(chunk: string): string | null {
  let c = chunk.replace(/\([^)]*\)?/g, ' ');
  c = c.replace(/@.*$/, ' ').replace(/\d+(?:\.\d+)?\s*(?:-\s*\d+(?:\.\d+)?\s*)?%.*$/, ' ');
  c = c.replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|lbs?|reps?|rm|cals?|mins?|secs?|km|m)\b/gi, ' ');
  const parts = c.split(':');
  for (let i = parts.length - 1; i >= 0; i--) {
    let p = parts[i].replace(/\s[-–]\s.*$/, ' ');
    p = p.replace(/^(?:[\s\d\-–/.,*•]|[x×](?=[\s\d]))+/, '');
    p = p.replace(/[^A-Za-z&' -]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = p.split(' ').filter(Boolean).slice(0, 4);
    while (words.length > 0 && TRAILING.test(words[words.length - 1])) words.pop();
    if (words.length === 0 || NOISE.test(words[0])) continue;
    const name = words.join(' ');
    if (name.length < 3 || name.length > 32 || !/[A-Za-z]{3}/.test(name)) continue;
    return titleCase(words);
  }
  return null;
}

/** Movement names in a line that no lift matches yet. */
export function unmatchedNames(line: string, matcher: Matcher): string[] {
  if (line.length > 140 || !/\d/.test(line)) return [];
  const out: string[] = [];
  for (const chunk of line.split(/\+|;|\/\/|\s{2,}|,(?=\s*\d)/)) {
    if (matcher.find(chunk).length > 0) continue;
    const name = nameFromChunk(chunk);
    if (name) out.push(name);
  }
  return out;
}
