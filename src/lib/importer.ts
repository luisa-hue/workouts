import { supabase } from './supabase';
import { normalizeDate, weekdayName } from './dates';

export interface ImportSummary {
  files: number;
  found: number;
  added: number;
  existing: number;
  invalid: number;
  repeatedInFiles: number;
}

interface Row {
  user_id: string;
  uid: string;
  date: string;
  weekday: string;
  program: string;
  parts: unknown[];
}

// PushPress program ids, in case a file carries the id instead of the name.
const PROGRAM_IDS: Record<string, string> = {
  '6bec7103-c489-4020-9520-2e8cc297af7a': 'BUILD',
  'bd0f4d01-0b1e-401f-b7fe-1b84a73379df': 'SHRED',
};

function normalizeProgram(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  const byId = PROGRAM_IDS[s.toLowerCase()];
  if (byId) return byId;
  const up = s.toUpperCase();
  if (up.includes('BUILD')) return 'BUILD';
  if (up.includes('SHRED')) return 'SHRED';
  return up;
}

async function readList(file: File): Promise<unknown[]> {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${file.name} is not valid JSON.`);
  }
  const list = Array.isArray(json) ? json : (json as { workouts?: unknown })?.workouts;
  if (!Array.isArray(list)) throw new Error(`${file.name} has no "workouts" list.`);
  return list;
}

async function existingUids(): Promise<Set<string>> {
  const out = new Set<string>();
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase
      .from('workouts')
      .select('uid')
      .order('uid')
      .range(from, from + step - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) out.add((r as { uid: string }).uid);
    if (!data || data.length < step) break;
  }
  return out;
}

/** Reads the chosen JSON files and inserts only workouts whose uid is not in the app yet. */
export async function importWorkouts(
  files: File[],
  userId: string,
  onStatus: (message: string) => void,
): Promise<ImportSummary> {
  const byUid = new Map<string, Row>();
  let found = 0;
  let invalid = 0;
  let repeatedInFiles = 0;

  for (const file of files) {
    onStatus(`Reading ${file.name}…`);
    const list = await readList(file);
    for (const item of list) {
      found++;
      const w = (item ?? {}) as Record<string, unknown>;
      const uid = typeof w.uid === 'string' || typeof w.uid === 'number' ? String(w.uid).trim() : '';
      const date = normalizeDate(w.date);
      const program = normalizeProgram(w.program);
      if (!uid || !date || !program) {
        invalid++;
        continue;
      }
      if (byUid.has(uid)) repeatedInFiles++;
      byUid.set(uid, {
        user_id: userId,
        uid,
        date,
        weekday: weekdayName(date),
        program,
        parts: Array.isArray(w.parts) ? w.parts : [],
      });
    }
  }

  onStatus('Checking what is already in the app…');
  const have = await existingUids();
  const fresh = [...byUid.values()].filter((r) => !have.has(r.uid));

  const batch = 100;
  for (let i = 0; i < fresh.length; i += batch) {
    onStatus(`Saving ${Math.min(i + batch, fresh.length)} of ${fresh.length}…`);
    const { error } = await supabase
      .from('workouts')
      .upsert(fresh.slice(i, i + batch), { onConflict: 'user_id,uid', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  return {
    files: files.length,
    found,
    added: fresh.length,
    existing: byUid.size - fresh.length,
    invalid,
    repeatedInFiles,
  };
}
