import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { buildMatcher, normalizeAlias, type Matcher } from './lifts';
import { buildStats, EMPTY_STATS, type LiftStats } from './rm';
import { DEFAULT_LIFTS } from './defaultLifts';
import type { Lift, LiftRecord } from '../types';

export interface NewRecord {
  lift_id: string;
  reps: number;
  weight_kg: number;
  date: string;
}

interface LiftsValue {
  loading: boolean;
  /** Load error, if any. */
  error: string | null;
  /** True when the lifts/records tables do not exist yet (schema.sql not run). */
  needsSetup: boolean;
  lifts: Lift[];
  matcher: Matcher;
  /** Stats for a lift that has records; undefined when it has none (so Today shows no chip). */
  statsOf: (liftId: string) => LiftStats | undefined;
  /** Stats for any lift, empty when it has no records. */
  statsFor: (liftId: string) => LiftStats;
  refresh: () => Promise<void>;
  addLift: (name: string, aliases?: string[]) => Promise<void>;
  saveLift: (id: string, name: string, aliases: string[]) => Promise<void>;
  removeLift: (id: string) => Promise<void>;
  addAlias: (liftId: string, alias: string) => Promise<void>;
  addDefaults: () => Promise<number>;
  addRecord: (r: NewRecord) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
}

const Ctx = createContext<LiftsValue | null>(null);

interface ErrorLike {
  code?: string;
  message: string;
}

function isMissingTable(e: ErrorLike): boolean {
  return e.code === 'PGRST205' || e.code === '42P01' || /could not find the table|does not exist/i.test(e.message);
}

function friendly(e: ErrorLike): Error {
  if (e.code === '23505') return new Error('That name is already in your lifts.');
  if (isMissingTable(e)) return new Error('The lifts tables are missing. Run supabase/schema.sql in Supabase first.');
  return new Error(e.message);
}

async function fetchAll<T>(table: string, columns: string, order: string): Promise<{ rows: T[]; error: ErrorLike | null }> {
  const rows: T[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order)
      .range(from, from + step - 1);
    if (error) return { rows: [], error };
    rows.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < step) break;
  }
  return { rows, error: null };
}

function cleanAliases(name: string, aliases: string[]): string[] {
  const seen = new Set([normalizeAlias(name)]);
  const out: string[] = [];
  for (const a of aliases) {
    const t = a.trim();
    const key = normalizeAlias(t);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function LiftsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    loading: true,
    error: null as string | null,
    needsSetup: false,
    lifts: [] as Lift[],
    records: [] as LiftRecord[],
  });

  const refresh = useCallback(async () => {
    const [l, r] = await Promise.all([
      fetchAll<Lift>('lifts', 'id,name,aliases', 'name'),
      fetchAll<LiftRecord>('records', 'id,lift_id,reps,weight_kg,date,note', 'date'),
    ]);
    const err = l.error ?? r.error;
    if (err) {
      setState((s) => ({ ...s, loading: false, error: friendly(err).message, needsSetup: isMissingTable(err) }));
      return;
    }
    setState({
      loading: false,
      error: null,
      needsSetup: false,
      lifts: l.rows.map((x) => ({ ...x, aliases: x.aliases ?? [] })),
      records: r.rows.map((x) => ({ ...x, weight_kg: Number(x.weight_kg) })),
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const matcher = useMemo(() => buildMatcher(state.lifts), [state.lifts]);

  const stats = useMemo(() => {
    const byLift = new Map<string, LiftRecord[]>();
    for (const r of state.records) {
      const list = byLift.get(r.lift_id);
      if (list) list.push(r);
      else byLift.set(r.lift_id, [r]);
    }
    return new Map([...byLift].map(([id, list]) => [id, buildStats(list)]));
  }, [state.records]);

  const value = useMemo<LiftsValue>(() => {
    async function run(p: PromiseLike<{ error: ErrorLike | null }>) {
      const { error } = await p;
      if (error) throw friendly(error);
    }
    return {
      loading: state.loading,
      error: state.error,
      needsSetup: state.needsSetup,
      lifts: state.lifts,
      matcher,
      statsOf: (id) => stats.get(id),
      statsFor: (id) => stats.get(id) ?? EMPTY_STATS,
      refresh,
      async addLift(name, aliases = []) {
        const n = name.trim();
        await run(supabase.from('lifts').insert({ name: n, aliases: cleanAliases(n, aliases) }));
        await refresh();
      },
      async saveLift(id, name, aliases) {
        const n = name.trim();
        await run(supabase.from('lifts').update({ name: n, aliases: cleanAliases(n, aliases) }).eq('id', id));
        await refresh();
      },
      async removeLift(id) {
        await run(supabase.from('lifts').delete().eq('id', id));
        await refresh();
      },
      async addAlias(liftId, alias) {
        const lift = state.lifts.find((l) => l.id === liftId);
        if (!lift) return;
        await run(
          supabase
            .from('lifts')
            .update({ aliases: cleanAliases(lift.name, [...lift.aliases, alias]) })
            .eq('id', liftId),
        );
        await refresh();
      },
      async addDefaults() {
        const have = new Set(state.lifts.map((l) => normalizeAlias(l.name)));
        const fresh = DEFAULT_LIFTS.filter((d) => !have.has(normalizeAlias(d.name))).map((d) => ({
          name: d.name,
          aliases: cleanAliases(d.name, d.aliases),
        }));
        if (fresh.length > 0) await run(supabase.from('lifts').insert(fresh));
        await refresh();
        return fresh.length;
      },
      async addRecord(r) {
        await run(supabase.from('records').insert(r));
        await refresh();
      },
      async removeRecord(id) {
        await run(supabase.from('records').delete().eq('id', id));
        await refresh();
      },
    };
  }, [state, matcher, stats, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLifts(): LiftsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLifts must be used inside LiftsProvider');
  return v;
}
