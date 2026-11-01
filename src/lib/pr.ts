import { readReps, MAX_CHIP_REPS, type Matcher } from './lifts';
import { estimateOneRM, type LiftStats, type RmValue } from './rm';

/** Lifts mentioned in a part's text, in order of first appearance, each once. */
export function liftsInText(text: string, matcher: Matcher): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    for (const m of matcher.find(line)) if (!out.includes(m.liftId)) out.push(m.liftId);
  }
  return out;
}

/** Reps the part's text asks for on this lift ("5x3 Back Squat" -> 3), or null when it gives none. */
export function suggestReps(text: string, matcher: Matcher, liftId: string): number | null {
  for (const line of text.split('\n')) {
    const matches = matcher.find(line);
    const i = matches.findIndex((m) => m.liftId === liftId);
    if (i < 0) continue;
    const from = i === 0 ? 0 : matches[i - 1].end;
    const to = i + 1 < matches.length ? matches[i + 1].start : line.length;
    const reps = readReps(line.slice(from, matches[i].start), line.slice(matches[i].end, to));
    return reps !== null && reps >= 1 && reps <= MAX_CHIP_REPS ? reps : null;
  }
  return null;
}

export interface PrResult {
  reps: number;
  weight_kg: number;
  /** What the app showed for these reps before (tested or estimated). Null when the lift had no results yet. */
  previous: RmValue | null;
  /** Estimated 1RM of this set, unrounded. */
  oneRM: number;
}

/**
 * Does `weight` x `reps` beat what the app currently shows for these reps?
 * Compares with the shown (rounded) kg, so lifting exactly what the chip said is not a PR.
 * The first result for a lift always counts. More than 10 reps is conditioning, never an alert.
 */
export function checkPR(stats: LiftStats | undefined, reps: number, weight: number): PrResult | null {
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_CHIP_REPS || !(weight > 0)) return null;
  const oneRM = estimateOneRM(weight, reps);
  if (oneRM === null) return null;
  if (!stats || stats.records.length === 0) return { reps, weight_kg: weight, previous: null, oneRM };
  const previous = stats.rm(reps);
  if (previous && weight <= previous.kg + 1e-9) return null;
  return { reps, weight_kg: weight, previous, oneRM };
}
