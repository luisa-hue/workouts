export type Program = 'BUILD' | 'SHRED';
export const PROGRAMS: Program[] = ['BUILD', 'SHRED'];

export interface Part {
  title?: string | null;
  description?: string | null;
  scoreType?: string | null;
  sets?: unknown;
}

export interface Lift {
  id: string;
  name: string;
  /** Other names the lift goes by in workout text (the name itself is always matched too). */
  aliases: string[];
}

/** A tested result: `weight_kg` for `reps` reps. */
export interface LiftRecord {
  id: string;
  lift_id: string;
  reps: number;
  weight_kg: number;
  date: string; // YYYY-MM-DD
  note: string | null;
}

export interface Workout {
  uid: string;
  date: string; // YYYY-MM-DD
  weekday: string | null;
  program: string;
  parts: Part[] | null;
}

/** What was done on one calendar date for one part of a program's workout. */
export interface LogEntry {
  id: string;
  date: string; // YYYY-MM-DD, the calendar date (not the workout uid: loop repeats reuse uids)
  program: string;
  /** Index of the part in the workout. -1 is the whole workout (the "done" mark). */
  part_index: number;
  weight_kg: number | null;
  reps: number | null;
  comment: string | null;
  done: boolean;
}

export const WORKOUT_SLOT = -1;
