import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { addDays } from './plan';
import { todayISO } from './dates';
import type { Plan, PlanDay, SetLog } from './plan';

export interface NewPlan {
  name: string;
  start_date: string;
  months: number;
  rest_days: number[];
  days: PlanDay[];
}

export interface LastTime {
  date: string;
  weight_kg: number | null;
  reps: number | null;
}

export interface BlockEntry {
  itemIndex: number;
  /** exerciseKey(name) */
  exercise: string;
  weight: number | null;
  reps: number | null;
}

interface PlansValue {
  loading: boolean;
  error: string | null;
  /** True when the plans tables do not exist yet (schema.sql not run). */
  needsSetup: boolean;
  /** The active plan, if any. */
  plan: Plan | null;
  /** Dates where a workout of the active plan was marked done. */
  doneDates: () => Set<string>;
  isDone: (date: string, dayIndex: number) => boolean;
  /** Workouts (indexes into plan.days) that have logs or a done mark on this date. */
  loggedDays: (date: string) => number[];
  /** The logged result of one exercise on a date (its row also carries the block's comment when it is the first). */
  setLog: (date: string, dayIndex: number, itemIndex: number) => SetLog | undefined;
  /** The most recent day before `beforeDate` where this exercise was logged. */
  lastTime: (exercise: string, beforeDate: string) => LastTime | null;
  /**
   * Saves the log of one block: a result per exercise plus one comment (kept on the first exercise).
   * Exercises left empty are removed.
   */
  saveBlock: (date: string, dayIndex: number, entries: BlockEntry[], comment: string) => Promise<void>;
  removeBlock: (date: string, dayIndex: number, itemIndexes: number[]) => Promise<void>;
  setDone: (date: string, dayIndex: number, done: boolean) => Promise<void>;
  /** Makes this the active plan; the previous one is kept (inactive) with its logs. */
  createPlan: (p: NewPlan) => Promise<void>;
  setMonths: (months: number) => Promise<void>;
  /** Stops using the plan. Logs are kept. */
  endPlan: () => Promise<void>;
}

const Ctx = createContext<PlansValue | null>(null);

interface ErrorLike {
  code?: string;
  message: string;
}

function isMissingTable(e: ErrorLike): boolean {
  return e.code === 'PGRST205' || e.code === '42P01' || /could not find the table|does not exist/i.test(e.message);
}

function friendly(e: ErrorLike): Error {
  if (isMissingTable(e)) return new Error('The plan tables are missing. Run supabase/schema.sql in Supabase first.');
  return new Error(e.message);
}

const PLAN_COLS = 'id,name,start_date,months,rest_days,days,active';
const SET_COLS = 'id,plan_id,date,day_index,item_index,set_index,exercise,weight_kg,reps,comment';
const SESSION_COLS = 'plan_id,date,day_index';
/** How far back set logs are loaded; enough for "last time" without pulling years of history. */
const HISTORY_DAYS = 200;

interface Session {
  plan_id: string;
  date: string;
  day_index: number;
}

const setKey = (planId: string, date: string, day: number, item: number) => `${planId}|${date}|${day}|${item}`;
const sessionKey = (planId: string, date: string, day: number) => `${planId}|${date}|${day}`;

async function fetchAll<T>(table: string, columns: string, since: string): Promise<{ rows: T[]; error: ErrorLike | null }> {
  const rows: T[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .gte('date', since)
      .order('date')
      .range(from, from + step - 1);
    if (error) return { rows: [], error };
    rows.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < step) break;
  }
  return { rows, error: null };
}

function normalizePlan(r: Plan): Plan {
  return { ...r, rest_days: r.rest_days ?? [], days: r.days ?? [] };
}

const itemSlot = (r: Pick<SetLog, 'plan_id' | 'date' | 'day_index' | 'item_index'>) => setKey(r.plan_id, r.date, r.day_index, r.item_index);

function normalizeSet(r: SetLog): SetLog {
  return { ...r, weight_kg: r.weight_kg === null ? null : Number(r.weight_kg) };
}

export function PlansProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    loading: true,
    error: null as string | null,
    needsSetup: false,
    plan: null as Plan | null,
    sets: [] as SetLog[],
    sessions: [] as Session[],
  });

  const refresh = useCallback(async () => {
    const since = addDays(todayISO(), -HISTORY_DAYS);
    const [p, s, d] = await Promise.all([
      supabase.from('plans').select(PLAN_COLS).eq('active', true).limit(1),
      fetchAll<SetLog>('set_logs', SET_COLS, since),
      fetchAll<Session>('plan_sessions', SESSION_COLS, since),
    ]);
    const err = p.error ?? s.error ?? d.error;
    if (err) {
      setState((x) => ({ ...x, loading: false, error: friendly(err).message, needsSetup: isMissingTable(err) }));
      return;
    }
    const row = ((p.data ?? []) as unknown as Plan[])[0];
    setState({
      loading: false,
      error: null,
      needsSetup: false,
      plan: row ? normalizePlan(row) : null,
      sets: s.rows.map(normalizeSet),
      sessions: d.rows,
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setsByKey = useMemo(
    () => new Map(state.sets.map((r) => [itemSlot(r), r])),
    [state.sets],
  );
  const sessionKeys = useMemo(() => new Set(state.sessions.map((r) => sessionKey(r.plan_id, r.date, r.day_index))), [state.sessions]);

  /** exercise key -> logged days, newest first. */
  const history = useMemo(() => {
    const byExercise = new Map<string, Map<string, SetLog[]>>();
    for (const r of state.sets) {
      if (r.weight_kg === null && r.reps === null) continue;
      let days = byExercise.get(r.exercise);
      if (!days) byExercise.set(r.exercise, (days = new Map()));
      const list = days.get(r.date);
      if (list) list.push(r);
      else days.set(r.date, [r]);
    }
    return new Map(
      [...byExercise].map(([ex, days]) => [ex, [...days].sort((a, b) => (a[0] < b[0] ? 1 : -1))] as const),
    );
  }, [state.sets]);

  const value = useMemo<PlansValue>(() => {
    const plan = state.plan;

    return {
      loading: state.loading,
      error: state.error,
      needsSetup: state.needsSetup,
      plan,
      doneDates: () => new Set(state.sessions.filter((r) => plan && r.plan_id === plan.id).map((r) => r.date)),
      loggedDays: (date) =>
        plan
          ? [
              ...new Set([
                ...state.sets.filter((r) => r.plan_id === plan.id && r.date === date).map((r) => r.day_index),
                ...state.sessions.filter((r) => r.plan_id === plan.id && r.date === date).map((r) => r.day_index),
              ]),
            ].sort((a, b) => a - b)
          : [],
      isDone: (date, dayIndex) => (plan ? sessionKeys.has(sessionKey(plan.id, date, dayIndex)) : false),
      setLog: (date, dayIndex, itemIndex) => (plan ? setsByKey.get(setKey(plan.id, date, dayIndex, itemIndex)) : undefined),
      lastTime(exercise, beforeDate) {
        const days = history.get(exercise);
        const found = days?.find(([date]) => date < beforeDate);
        if (!found) return null;
        const row = [...found[1]].sort((x, y) => x.item_index - y.item_index)[0];
        return { date: found[0], weight_kg: row.weight_kg, reps: row.reps };
      },
      async saveBlock(date, dayIndex, entries, comment) {
        if (!plan) return;
        const note = comment.trim() || null;
        // The comment lives on the first exercise's row.
        const rows = entries.map((e, i) => ({ e, comment: i === 0 ? note : null }));
        const keep = rows.filter((r) => r.e.weight !== null || r.e.reps !== null || r.comment !== null);
        const drop = rows.filter((r) => !keep.includes(r) && setsByKey.has(setKey(plan.id, date, dayIndex, r.e.itemIndex)));
        let saved: SetLog[] = [];
        if (keep.length > 0) {
          const { data, error } = await supabase
            .from('set_logs')
            .upsert(
              keep.map((r) => ({
                plan_id: plan.id,
                date,
                day_index: dayIndex,
                item_index: r.e.itemIndex,
                set_index: 0,
                exercise: r.e.exercise,
                weight_kg: r.e.weight,
                reps: r.e.reps,
                comment: r.comment,
                updated_at: new Date().toISOString(),
              })),
              { onConflict: 'user_id,plan_id,date,day_index,item_index,set_index' },
            )
            .select(SET_COLS);
          if (error) throw friendly(error);
          saved = ((data ?? []) as unknown as SetLog[]).map(normalizeSet);
        }
        if (drop.length > 0) {
          const { error } = await supabase
            .from('set_logs')
            .delete()
            .eq('plan_id', plan.id)
            .eq('date', date)
            .eq('day_index', dayIndex)
            .in('item_index', drop.map((r) => r.e.itemIndex));
          if (error) throw friendly(error);
        }
        const touched = new Set(rows.map((r) => setKey(plan.id, date, dayIndex, r.e.itemIndex)));
        setState((s) => ({ ...s, sets: [...s.sets.filter((r) => !touched.has(itemSlot(r))), ...saved] }));
      },
      async removeBlock(date, dayIndex, itemIndexes) {
        if (!plan || itemIndexes.length === 0) return;
        const { error } = await supabase
          .from('set_logs')
          .delete()
          .eq('plan_id', plan.id)
          .eq('date', date)
          .eq('day_index', dayIndex)
          .in('item_index', itemIndexes);
        if (error) throw friendly(error);
        const gone = new Set(itemIndexes.map((i) => setKey(plan.id, date, dayIndex, i)));
        setState((s) => ({ ...s, sets: s.sets.filter((r) => !gone.has(itemSlot(r))) }));
      },
      async setDone(date, dayIndex, done) {
        if (!plan) return;
        if (done) {
          const { error } = await supabase
            .from('plan_sessions')
            .upsert({ plan_id: plan.id, date, day_index: dayIndex }, { onConflict: 'user_id,plan_id,date,day_index' });
          if (error) throw friendly(error);
          setState((s) => ({ ...s, sessions: [...s.sessions, { plan_id: plan.id, date, day_index: dayIndex }] }));
        } else {
          const { error } = await supabase
            .from('plan_sessions')
            .delete()
            .eq('plan_id', plan.id)
            .eq('date', date)
            .eq('day_index', dayIndex);
          if (error) throw friendly(error);
          setState((s) => ({
            ...s,
            sessions: s.sessions.filter((r) => !(r.plan_id === plan.id && r.date === date && r.day_index === dayIndex)),
          }));
        }
      },
      async createPlan(p) {
        if (plan) {
          const { error } = await supabase.from('plans').update({ active: false }).eq('id', plan.id);
          if (error) throw friendly(error);
        }
        const { error } = await supabase.from('plans').insert({ ...p, active: true });
        if (error) {
          // Put the old plan back so the user is not left without one.
          if (plan) await supabase.from('plans').update({ active: true }).eq('id', plan.id);
          throw friendly(error);
        }
        await refresh();
      },
      async setMonths(months) {
        if (!plan) return;
        const { error } = await supabase.from('plans').update({ months }).eq('id', plan.id);
        if (error) throw friendly(error);
        setState((s) => (s.plan ? { ...s, plan: { ...s.plan, months } } : s));
      },
      async endPlan() {
        if (!plan) return;
        const { error } = await supabase.from('plans').update({ active: false }).eq('id', plan.id);
        if (error) throw friendly(error);
        await refresh();
      },
    };
  }, [state, setsByKey, sessionKeys, history, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlans(): PlansValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlans must be used inside PlansProvider');
  return v;
}
