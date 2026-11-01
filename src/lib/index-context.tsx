import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { PROGRAMS, type Program } from '../types';

interface WorkoutIndex {
  loading: boolean;
  error: string | null;
  /** Bumps every time the index is (re)loaded, so screens can refetch. */
  version: number;
  total: number;
  min: string | null;
  max: string | null;
  /** Sorted ascending, per program. */
  datesByProgram: Record<Program, string[]>;
  refresh: () => Promise<void>;
}

interface Row {
  date: string;
  program: string;
}

const Ctx = createContext<WorkoutIndex | null>(null);

export function IndexProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ loading: true, error: null as string | null, version: 0, rows: [] as Row[] });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const rows: Row[] = [];
    const step = 1000; // Supabase returns at most 1000 rows per request
    for (let from = 0; ; from += step) {
      const { data, error } = await supabase
        .from('workouts')
        .select('date,program')
        .order('date')
        .order('uid')
        .range(from, from + step - 1);
      if (error) {
        setState((s) => ({ ...s, loading: false, error: error.message }));
        return;
      }
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < step) break;
    }
    setState((s) => ({ loading: false, error: null, version: s.version + 1, rows }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<WorkoutIndex>(() => {
    const datesByProgram: Record<Program, string[]> = { BUILD: [], SHRED: [] };
    let min: string | null = null;
    let max: string | null = null;
    for (const r of state.rows) {
      if ((PROGRAMS as string[]).includes(r.program)) datesByProgram[r.program as Program].push(r.date);
      if (!min || r.date < min) min = r.date;
      if (!max || r.date > max) max = r.date;
    }
    return {
      loading: state.loading,
      error: state.error,
      version: state.version,
      total: state.rows.length,
      min,
      max,
      datesByProgram,
      refresh,
    };
  }, [state, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkoutIndex(): WorkoutIndex {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkoutIndex must be used inside IndexProvider');
  return v;
}
