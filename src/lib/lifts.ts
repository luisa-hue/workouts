import type { Lift } from '../types';
import { formatKg, roundToStep, type LiftStats } from './rm';

/** "Clean & Jerk" -> "clean and jerk". */
export function normalizeAlias(s: string): string {
  return s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Regex source that matches an alias in free text: any punctuation between words, "&" for "and". */
function patternFor(alias: string): string | null {
  const tokens = normalizeAlias(alias).split(' ').filter(Boolean);
  if (tokens.length === 0 || tokens.join('').length < 2) return null;
  if (tokens.length === 1 && tokens[0] === 'and') return null;
  let out = '';
  tokens.forEach((t, i) => {
    if (i > 0) out += t === 'and' || tokens[i - 1] === 'and' ? '[^a-z0-9&]*' : '[^a-z0-9]+';
    out += t === 'and' ? '(?:and|&)' : t;
  });
  return out;
}

export interface LineMatch {
  liftId: string;
  start: number;
  end: number;
}

export interface Matcher {
  /** Lift mentions in one line of workout text, left to right. The longest name wins when names overlap. */
  find: (line: string) => LineMatch[];
}

export function buildMatcher(lifts: Lift[]): Matcher {
  const entries: { liftId: string; re: RegExp }[] = [];
  for (const lift of lifts) {
    const seen = new Set<string>();
    for (const alias of [lift.name, ...lift.aliases]) {
      const p = patternFor(alias);
      if (!p || seen.has(p)) continue;
      seen.add(p);
      // Trailing (e?s)? accepts plurals: Thrusters, Cleans, Presses.
      entries.push({ liftId: lift.id, re: new RegExp(`(^|[^a-z0-9])(${p})(?:e?s)?(?![a-z0-9])`, 'gi') });
    }
  }

  return {
    find(line) {
      if (entries.length === 0 || !line) return [];
      const found: LineMatch[] = [];
      for (const e of entries) {
        for (const m of line.matchAll(e.re)) {
          const at = m.index ?? 0;
          found.push({ liftId: e.liftId, start: at + m[1].length, end: at + m[0].length });
        }
      }
      found.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
      const picked: LineMatch[] = [];
      for (const f of found) {
        if (!picked.some((p) => f.start < p.end && p.start < f.end)) picked.push(f);
      }
      return picked.sort((a, b) => a.start - b.start);
    },
  };
}

// ---------------------------------------------------------------------------
// Reading reps and percentages around a lift name
// ---------------------------------------------------------------------------

const OF_RM = /\bof\s+(?:your\s+|the\s+|a\s+)?\d{1,2}\s*-?\s*rm\b/gi;
const PCT_RE = /(\d{1,3}(?:\.\d+)?)(?:\s*[-–]\s*(\d{1,3}(?:\.\d+)?))?\s*%/;
const BASE_RE = /^\s*(?:of\s+)?(?:your\s+|the\s+|a\s+)?(\d{1,2})\s*-?\s*rm\b/i;

/**
 * Reps for the lift, from the text just before and after its name.
 * "5 Power Clean" -> 5, "5x3 Back Squat" -> 3, "Back Squat 5x5" -> 5, "5-3-1 Deadlift" -> 5, "build to a 3RM" -> 3.
 * Returns null when the line gives no reps.
 */
export function readReps(beforeRaw: string, afterRaw: string): number | null {
  const before = beforeRaw.replace(OF_RM, ' ');
  const after = afterRaw.replace(OF_RM, ' ');
  let m = /(\d{1,2})\s*-?\s*rm\s*$/i.exec(before);
  if (m) return +m[1];
  m = /^\W{0,4}(?:(?:to|a|your)\s+)*(\d{1,2})\s*-?\s*rm\b/i.exec(after);
  if (m) return +m[1];
  m = /(\d{1,3})\s*[x×]\s*(\d{1,3})\s*$/i.exec(before);
  if (m) return +m[2];
  m = /(\d{1,3})(?:\s*[-–/]\s*\d{1,3})*\s*(?:reps?\s*(?:of\s*)?)?$/i.exec(before);
  if (m) return +m[1];
  m = /^\W{0,3}(\d{1,3})\s*[x×]\s*(\d{1,3})/i.exec(after);
  if (m) return +m[2];
  m = /^[\s:,\-–(]{0,3}(\d{1,3})(?:\s*[-–/]\s*\d{1,3})*(?![\d.])(?!\s*(?:%|kg|lbs?|min|sec|s\b|m\b|cal|:|\/))/i.exec(after);
  if (m) return +m[1];
  return null;
}

interface PercentHit {
  low: number;
  high: number | null;
  /** The percentage is of this RM (1 unless the text says "of 3RM"). */
  baseReps: number;
  /** Index in the segment right after the percentage (and an "of 3RM" tail). */
  end: number;
}

function readPercent(segment: string): PercentHit | null {
  const m = PCT_RE.exec(segment);
  if (!m) return null;
  const low = +m[1];
  const high = m[2] ? +m[2] : null;
  if (low <= 0 || low > 150 || (high !== null && (high <= 0 || high > 150))) return null;
  const afterPct = m.index + m[0].length;
  const base = BASE_RE.exec(segment.slice(afterPct));
  return { low, high, baseReps: base ? +base[1] : 1, end: afterPct + (base ? base[0].length : 0) };
}

// ---------------------------------------------------------------------------
// Annotating a line
// ---------------------------------------------------------------------------

export type Seg = { kind: 'text'; text: string } | { kind: 'chip'; text: string; estimated: boolean };

interface Insert {
  pos: number;
  text: string;
  estimated: boolean;
}

/** Largest rep count that still gets an RM chip. 21-15-9 style lines are conditioning, not strength. */
export const MAX_CHIP_REPS = 10;

/**
 * Splits one line of workout text into plain text and chips.
 * - "5 Power Clean"            -> "5 Power Clean [5RM 80kg]"
 * - "Back Squat @75%"          -> "Back Squat @75% [67.5kg]"
 * - "Back Squat 70-80% of 3RM" -> chip with the kg range, based on the 3RM
 * A line with a percentage gets the kg chip only (the percentage already says which RM it is based on).
 */
export function annotate(line: string, matcher: Matcher, statsOf: (liftId: string) => LiftStats | undefined): Seg[] {
  const matches = matcher.find(line);
  const inserts: Insert[] = [];

  matches.forEach((m, i) => {
    const stats = statsOf(m.liftId);
    if (!stats) return;
    const from = i === 0 ? 0 : matches[i - 1].end;
    const to = i + 1 < matches.length ? matches[i + 1].start : line.length;
    const before = line.slice(from, m.start);
    const after = line.slice(m.end, to);

    const inAfter = readPercent(after);
    const inBefore = inAfter ? null : readPercent(before);
    const pct = inAfter ?? inBefore;

    if (pct) {
      const base = stats.rm(pct.baseReps);
      if (!base) return;
      const lo = roundToStep((base.raw * pct.low) / 100);
      const hi = pct.high !== null ? roundToStep((base.raw * pct.high) / 100) : null;
      const text = hi !== null && hi !== lo ? `${Number(lo.toFixed(2))}–${formatKg(hi)}` : formatKg(lo);
      const pos = inAfter ? m.end + inAfter.end : from + (inBefore as PercentHit).end;
      inserts.push({ pos, text, estimated: !base.tested });
      return;
    }

    const reps = readReps(before, after) ?? 1;
    if (reps > MAX_CHIP_REPS) return;
    const rm = stats.rm(reps);
    if (rm) inserts.push({ pos: m.end, text: `${reps}RM ${formatKg(rm.kg)}`, estimated: !rm.tested });
  });

  if (inserts.length === 0) return [{ kind: 'text', text: line }];

  inserts.sort((a, b) => a.pos - b.pos);
  const segs: Seg[] = [];
  let cursor = 0;
  for (const ins of inserts) {
    if (ins.pos > cursor) segs.push({ kind: 'text', text: line.slice(cursor, ins.pos) });
    segs.push({ kind: 'chip', text: ins.text, estimated: ins.estimated });
    cursor = Math.max(cursor, ins.pos);
  }
  if (cursor < line.length) segs.push({ kind: 'text', text: line.slice(cursor) });
  return segs;
}
