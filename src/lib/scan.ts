import { supabase } from './supabase';
import { cleanDescription } from './text';
import type { Matcher } from './lifts';
import { unmatchedNames } from './names';

export interface Candidate {
  key: string;
  name: string;
  count: number;
  example: string;
}

/** Reads every workout and lists the movement names that no lift matches yet, most frequent first. */
export async function scanForLifts(matcher: Matcher, onProgress: (message: string) => void): Promise<Candidate[]> {
  const found = new Map<string, Candidate>();
  const step = 500;
  for (let from = 0; ; from += step) {
    onProgress(`Reading workouts… ${from}`);
    const { data, error } = await supabase
      .from('workouts')
      .select('parts')
      .order('date')
      .order('uid')
      .range(from, from + step - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const parts = Array.isArray((row as { parts: unknown }).parts) ? ((row as { parts: unknown[] }).parts as unknown[]) : [];
      for (const part of parts) {
        const description = (part as { description?: string | null } | null)?.description;
        for (const line of cleanDescription(description).split('\n')) {
          for (const name of unmatchedNames(line, matcher)) {
            const key = name.toLowerCase();
            const cur = found.get(key);
            if (cur) cur.count++;
            else found.set(key, { key, name, count: 1, example: line.trim().slice(0, 70) });
          }
        }
      }
    }
    if (!data || data.length < step) break;
  }
  return [...found.values()]
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 60);
}
