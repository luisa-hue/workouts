import type { LiftRecord } from '../types';

/** % of 1RM for 1..30 reps (index = reps - 1). */
const TABLE = [
  100, 97, 94, 92, 89, 86, 83, 81, 78, 75, 73, 71, 70, 68, 67, 65, 64, 63, 61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50,
];

export const MAX_REPS = TABLE.length;
export const RM_COLUMNS = [1, 3, 5] as const;

export function rmPercent(reps: number): number | null {
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) return null;
  return TABLE[reps - 1];
}

/** Estimated 1RM from a set of `reps` at `weight`. */
export function estimateOneRM(weight: number, reps: number): number | null {
  const p = rmPercent(reps);
  return p === null ? null : (weight * 100) / p;
}

/** Load expected for `reps` reps given a 1RM. */
export function weightForReps(oneRM: number, reps: number): number | null {
  const p = rmPercent(reps);
  return p === null ? null : (oneRM * p) / 100;
}

export function roundToStep(kg: number, step = 2.5): number {
  return Math.round(kg / step) * step;
}

/** 90 -> "90kg", 92.5 -> "92.5kg". */
export function formatKg(kg: number): string {
  return `${Number(kg.toFixed(2))}kg`;
}

export interface RmValue {
  kg: number;
  /** Unrounded value, used as the base for percentage maths so rounding does not compound. */
  raw: number;
  /** True when this exact rep count was tested. Otherwise the value is estimated from the best result. */
  tested: boolean;
  date: string | null;
}

export interface LiftStats {
  /** Records for this lift, newest first. */
  records: LiftRecord[];
  /** Best estimated 1RM across all records (unrounded). */
  best1RM: number | null;
  rm: (reps: number) => RmValue | null;
}

export const EMPTY_STATS: LiftStats = { records: [], best1RM: null, rm: () => null };

export function buildStats(input: LiftRecord[]): LiftStats {
  const records = [...input].sort((a, b) => (a.date === b.date ? b.weight_kg - a.weight_kg : a.date < b.date ? 1 : -1));
  const tested = new Map<number, { kg: number; date: string }>();
  let best1RM: number | null = null;

  for (const r of records) {
    const cur = tested.get(r.reps);
    // Records are newest first, so `<=` keeps the earliest date among equal weights.
    if (!cur || r.weight_kg > cur.kg || (r.weight_kg === cur.kg && r.date <= cur.date)) {
      tested.set(r.reps, { kg: r.weight_kg, date: r.date });
    }
    const e = estimateOneRM(r.weight_kg, r.reps);
    if (e !== null && (best1RM === null || e > best1RM)) best1RM = e;
  }

  return {
    records,
    best1RM,
    rm(reps) {
      const t = tested.get(reps);
      if (t) return { kg: t.kg, raw: t.kg, tested: true, date: t.date };
      if (best1RM === null) return null;
      const w = weightForReps(best1RM, reps);
      return w === null ? null : { kg: roundToStep(w), raw: w, tested: false, date: null };
    },
  };
}
