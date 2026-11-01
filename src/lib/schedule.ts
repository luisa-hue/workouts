/**
 * Endless schedule: the imported workouts play in order, and after the last one the
 * program restarts from the first, forever.
 *
 * Works on the sequence of workout days (the weekdays that appear in the data), so weekends
 * stay rest days and a restart always lands on the same weekday pattern as the original run.
 * Real imported workouts always win over repeats for the dates they cover.
 */

const DAY = 86_400_000;

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};
const isoOf = (n: number): string => new Date(n * DAY).toISOString().slice(0, 10);
const dowOf = (n: number): number => (((n + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday

export interface Resolved {
  /** The date whose stored workout is shown (same as the requested date for real workouts). */
  source: string;
  /** 0 = real workout on its own date, 1 = first repeat of the program, 2 = second, ... */
  cycle: number;
}

export interface Schedule {
  resolve(date: string): Resolved | null;
  has(date: string): boolean;
  /** Closest earlier date with a workout, or null. */
  prev(date: string): string | null;
  /** Closest later date with a workout, or null when there is no data at all. */
  next(date: string): string | null;
}

const EMPTY: Schedule = {
  resolve: () => null,
  has: () => false,
  prev: () => null,
  next: () => null,
};

export function buildSchedule(dates: string[]): Schedule {
  const list = [...new Set(dates)].sort();
  const n = list.length;
  if (n === 0) return EMPTY;

  const have = new Set(list);
  const firstDay = dayNumber(list[0]);
  const lastDay = dayNumber(list[n - 1]);
  const activeDows = new Set(list.map((d) => dowOf(dayNumber(d))));

  function resolveDay(day: number): Resolved | null {
    if (day < firstDay) return null;
    if (day <= lastDay) {
      const iso = isoOf(day);
      return have.has(iso) ? { source: iso, cycle: 0 } : null;
    }
    if (!activeDows.has(dowOf(day))) return null;

    // k = how many workout days lie in (lastDay, day]. Whole weeks first, then the remainder.
    const weeks = Math.floor((day - lastDay) / 7);
    let k = weeks * activeDows.size;
    for (let t = lastDay + weeks * 7 + 1; t <= day; t++) if (activeDows.has(dowOf(t))) k++;

    return { source: list[(k - 1) % n], cycle: Math.floor((k - 1) / n) + 1 };
  }

  return {
    resolve: (date) => resolveDay(dayNumber(date)),
    has: (date) => resolveDay(dayNumber(date)) !== null,
    prev(date) {
      for (let day = dayNumber(date) - 1; day >= firstDay; day--) {
        if (resolveDay(day)) return isoOf(day);
      }
      return null;
    },
    next(date) {
      let day = Math.max(dayNumber(date) + 1, firstDay);
      for (let i = 0; i < 4000; i++, day++) {
        if (resolveDay(day)) return isoOf(day);
      }
      return null;
    },
  };
}
