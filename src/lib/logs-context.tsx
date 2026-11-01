import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { WORKOUT_SLOT, type LogEntry } from '../types';

export interface PartLogInput {
  weight_kg: number | null;
  reps: number | null;
  comment: string;
}

interface LogsValue {
  loading: boolean;
  error: string | null;
  /** True when the logs table does not exist yet (schema.sql not run). */
  needsSetup: boolean;
  entry: (date: string, program: string, partIndex: number) => LogEntry | undefined;
  isDone: (date: string, program: string) => boolean;
  /** Dates the workout of this program was marked done (drives the green dots in the calendar). */
  doneDates: (program: string) => Set<string>;
  /** Saves a part log. An empty one (no load, reps or comment) removes the log instead. */
  savePart: (date: string, program: string, partIndex: number, input: PartLogInput) => Promise<void>;
  removePart: (date: string, program: string, partIndex: number) => Promise<void>;
  setDone: (date: string, program: string, done: boolean) => Promise<void>;
}

const Ctx = createContext<LogsValue | null>(null);

interface ErrorLike {
  code?: string;
  message: string;
}

function isMissingTable(e: ErrorLike): boolean {
  return e.code === 'PGRST205' || e.code === '42P01' || /could not find the table|does not exist/i.test(e.message);
}

function friendly(e: ErrorLike): Error {
  if (isMissingTable(e)) return new Error('The logs table is missing. Run supabase/schema.sql in Supabase first.');
  return new Error(e.message);
}

const COLUMNS = 'id,date,program,part_index,weight_kg,reps,comment,done';
const keyOf = (date: string, program: string, idx: number) => `${date}|${program}|${idx}`;

function normalize(r: LogEntry): LogEntry {
  return { ...r, weight_kg: r.weight_kg === null ? null : Number(r.weight_kg) };
}

async function fetchLogs(): Promise<{ rows: LogEntry[]; error: ErrorLike | null }> {
  const rows: LogEntry[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase
      .from('logs')
      .select(COLUMNS)
      .order('date')
      .order('part_index')
      .range(from, from + step - 1);
    if (error) return { rows: [], error };
    rows.push(...((data ?? []) as unknown as LogEntry[]));
    if (!data || data.length < step) break;
  }
  return { rows: rows.map(normalize), error: null };
}

export function LogsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    loading: true,
    error: null as string | null,
    needsSetup: false,
    rows: [] as LogEntry[],
  });

  const refresh = useCallback(async () => {
    const { rows, error } = await fetchLogs();
    if (error) {
      setState((s) => ({ ...s, loading: false, error: friendly(error).message, needsSetup: isMissingTable(error) }));
      return;
    }
    setState({ loading: false, error: null, needsSetup: false, rows });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byKey = useMemo(() => new Map(state.rows.map((r) => [keyOf(r.date, r.program, r.part_index), r])), [state.rows]);

  const value = useMemo<LogsValue>(() => {
    function put(row: LogEntry) {
      setState((s) => {
        const k = keyOf(row.date, row.program, row.part_index);
        const rest = s.rows.filter((r) => keyOf(r.date, r.program, r.part_index) !== k);
        return { ...s, rows: [...rest, row] };
      });
    }
    function drop(date: string, program: string, partIndex: number) {
      const k = keyOf(date, program, partIndex);
      setState((s) => ({ ...s, rows: s.rows.filter((r) => keyOf(r.date, r.program, r.part_index) !== k) }));
    }
    async function upsert(date: string, program: string, partIndex: number, fields: Partial<LogEntry>) {
      const { data, error } = await supabase
        .from('logs')
        .upsert(
          { date, program, part_index: partIndex, ...fields, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,date,program,part_index' },
        )
        .select(COLUMNS)
        .single();
      if (error) throw friendly(error);
      put(normalize(data as unknown as LogEntry));
    }
    async function remove(date: string, program: string, partIndex: number) {
      const { error } = await supabase
        .from('logs')
        .delete()
        .eq('date', date)
        .eq('program', program)
        .eq('part_index', partIndex);
      if (error) throw friendly(error);
      drop(date, program, partIndex);
    }

    return {
      loading: state.loading,
      error: state.error,
      needsSetup: state.needsSetup,
      entry: (date, program, idx) => byKey.get(keyOf(date, program, idx)),
      isDone: (date, program) => byKey.get(keyOf(date, program, WORKOUT_SLOT))?.done === true,
      doneDates: (program) =>
        new Set(state.rows.filter((r) => r.program === program && r.part_index === WORKOUT_SLOT && r.done).map((r) => r.date)),
      async savePart(date, program, partIndex, input) {
        const comment = input.comment.trim();
        if (input.weight_kg === null && input.reps === null && !comment) {
          if (byKey.has(keyOf(date, program, partIndex))) await remove(date, program, partIndex);
          return;
        }
        await upsert(date, program, partIndex, {
          weight_kg: input.weight_kg,
          reps: input.reps,
          comment: comment || null,
          done: false,
        });
      },
      removePart: remove,
      async setDone(date, program, done) {
        if (done) await upsert(date, program, WORKOUT_SLOT, { done: true, weight_kg: null, reps: null, comment: null });
        else await remove(date, program, WORKOUT_SLOT);
      },
    };
  }, [state, byKey]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLogs(): LogsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLogs must be used inside LogsProvider');
  return v;
}
