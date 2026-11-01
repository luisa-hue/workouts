export type Program = 'BUILD' | 'SHRED';
export const PROGRAMS: Program[] = ['BUILD', 'SHRED'];

export interface Part {
  title?: string | null;
  description?: string | null;
  scoreType?: string | null;
  sets?: unknown;
}

export interface Workout {
  uid: string;
  date: string; // YYYY-MM-DD
  weekday: string | null;
  program: string;
  parts: Part[] | null;
}
