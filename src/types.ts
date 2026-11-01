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
