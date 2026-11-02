import { useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import CalendarSheet from '../components/CalendarSheet';
import { usePlans } from '../lib/plans-context';
import {
  dayNum,
  exerciseKey,
  isTrainingDay,
  nextTrainingDate,
  planEnd,
  planStatus,
  prettyName,
  previousTrainingDate,
  targetReps,
  workoutIndex,
  type Plan,
  type PlanItem,
  type SetLog,
} from '../lib/plan';
import { formatKg } from '../lib/rm';
import { formatLong, formatMedium, formatShort, todayISO, weekdayName } from '../lib/dates';

function parseNum(s: string): number {
  return Number(s.trim().replace(',', '.'));
}

const show = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

function SetRow({
  index,
  target,
  saved,
  placeholderKg,
  placeholderReps,
  onSave,
}: {
  index: number;
  target: string;
  saved: SetLog | undefined;
  placeholderKg: string;
  placeholderReps: string;
  onSave: (weight: number | null, reps: number | null) => void;
}) {
  const [kg, setKg] = useState(show(saved?.weight_kg));
  const [reps, setReps] = useState(show(saved?.reps));
  const [bad, setBad] = useState(false);

  // Follow the saved values when they change from outside (e.g. "Use last time").
  useEffect(() => {
    setKg(show(saved?.weight_kg));
    setReps(show(saved?.reps));
  }, [saved?.weight_kg, saved?.reps]);

  function commit() {
    const w = kg.trim() ? parseNum(kg) : null;
    const r = reps.trim() ? parseNum(reps) : null;
    const ok = (w === null || (Number.isFinite(w) && w >= 0 && w <= 1000)) && (r === null || (Number.isInteger(r) && r >= 0 && r <= 200));
    setBad(!ok);
    if (!ok) return;
    if (w === (saved?.weight_kg ?? null) && r === (saved?.reps ?? null)) return;
    onSave(w, r);
  }

  return (
    <div className={bad ? 'set-row bad' : 'set-row'}>
      <span className="set-n">
        {index + 1}
        {target && <span className="set-target">{target}</span>}
      </span>
      <input
        type="text"
        inputMode="decimal"
        placeholder={placeholderKg || 'kg'}
        aria-label={`Set ${index + 1} weight in kg`}
        value={kg}
        onChange={(e) => setKg(e.target.value)}
        onBlur={commit}
      />
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholderReps || 'reps'}
        aria-label={`Set ${index + 1} reps`}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={commit}
      />
    </div>
  );
}

function ExerciseCard({ date, dayIndex, itemIndex, item }: { date: string; dayIndex: number; itemIndex: number; item: PlanItem }) {
  const plans = usePlans();
  const [problem, setProblem] = useState<string | null>(null);
  const key = exerciseKey(item.name);
  const last = plans.lastTime(key, date);
  const count = item.sets ?? 1;
  const lastSets = last ? last.sets.filter(Boolean) : [];
  const hasAny = Array.from({ length: count }, (_, i) => plans.setLog(date, dayIndex, itemIndex, i)).some(Boolean);

  async function save(i: number, w: number | null, r: number | null) {
    setProblem(null);
    try {
      await plans.saveSet(date, dayIndex, itemIndex, i, key, w, r);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  function fillFromLast() {
    if (!last) return;
    void (async () => {
      for (let i = 0; i < count; i++) {
        const s = last.sets[i];
        if (s) await save(i, s.weight_kg, s.reps);
      }
    })();
  }

  const lastText = lastSets
    .map((s) => `${s.weight_kg !== null ? formatKg(s.weight_kg) : '–'}${s.reps !== null ? ` × ${s.reps}` : ''}`)
    .join(' · ');

  return (
    <section className="card part exercise">
      <div className="part-head">
        <h2>{prettyName(item.name)}</h2>
        <span className="pill">{item.reps ? `${count} × ${item.reps}` : `${count} ${count === 1 ? 'set' : 'sets'}`}</span>
      </div>
      {last && (
        <p className="ex-last">
          <span>
            Last time, {formatMedium(last.date)}: {lastText}
          </span>
          {!hasAny && (
            <button type="button" className="link-btn pressable" onClick={fillFromLast}>
              Use
            </button>
          )}
        </p>
      )}
      <div className="set-list">
        {Array.from({ length: count }, (_, i) => {
          const before = last?.sets[i] ?? lastSets[lastSets.length - 1];
          const target = targetReps(item.reps, i);
          const firstNumber = /\d+/.exec(target)?.[0] ?? '';
          return (
            <SetRow
              key={i}
              index={i}
              target={target}
              saved={plans.setLog(date, dayIndex, itemIndex, i)}
              placeholderKg={before?.weight_kg != null ? String(before.weight_kg) : ''}
              placeholderReps={firstNumber || (before?.reps != null ? String(before.reps) : '')}
              onSave={(w, r) => void save(i, w, r)}
            />
          );
        })}
      </div>
      {problem && <p className="error">{problem}</p>}
    </section>
  );
}

function PlanTodayInner({ plan, onGoSettings, jumpToToday }: { plan: Plan; onGoSettings: () => void; jumpToToday: number }) {
  const plans = usePlans();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [override, setOverride] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (jumpToToday > 0) {
      setDate(todayISO());
      setCalendarOpen(false);
    }
  }, [jumpToToday]);

  useEffect(() => {
    setOverride(null);
    setPicking(false);
    setProblem(null);
  }, [date]);

  const scheduled = workoutIndex(plan, date);
  const logged = plans.loggedDays(date);
  // A workout logged on this date wins over the scheduled one (she may have trained a different letter).
  const dayIndex = override ?? (scheduled !== null && logged.includes(scheduled) ? scheduled : logged[0] ?? scheduled);
  const day = dayIndex !== null ? plan.days[dayIndex] : undefined;
  const prev = previousTrainingDate(plan, date);
  const next = nextTrainingDate(plan, date);
  const end = planEnd(plan);
  const status = planStatus(plan, today);
  const doneDates = plans.doneDates();
  const done = dayIndex !== null && plans.isDone(date, dayIndex);
  const week = date >= plan.start_date ? Math.floor((dayNum(date) - dayNum(plan.start_date)) / 7) + 1 : null;
  const title = date === today ? 'Today' : weekdayName(date);

  function toggleDone() {
    if (dayIndex === null) return;
    setBusy(true);
    setProblem(null);
    plans
      .setDone(date, dayIndex, !done)
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'Something went wrong.'))
      .finally(() => setBusy(false));
  }

  function extend() {
    setBusy(true);
    setProblem(null);
    plans
      .setMonths(plan.months + 1)
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'Something went wrong.'))
      .finally(() => setBusy(false));
  }

  const chips = (
    <div className="day-chips" role="group" aria-label="Choose a workout">
      {plan.days.map((d, i) => (
        <button
          key={d.label}
          type="button"
          className={i === dayIndex ? 'day-chip on pressable' : 'day-chip pressable'}
          onClick={() => {
            setOverride(i);
            setPicking(false);
          }}
        >
          {d.label}
        </button>
      ))}
    </div>
  );

  return (
    <main>
      <header className="page-head">
        <div>
          <h1 className="large-title">{title}</h1>
          <p className="subtitle">{formatLong(date)}</p>
          <p className="subtitle">
            {plan.name}
            {week !== null ? ` · Week ${week}` : ''}
          </p>
          {date !== today && (
            <button type="button" className="today-btn pressable" onClick={() => setDate(today)}>
              Back to today
            </button>
          )}
          {day && done && (
            <p className="done-chip">
              <Check size={13} />
              Done
            </p>
          )}
        </div>
        <div className="head-actions">
          <button type="button" className="round-btn pressable" onClick={() => prev && setDate(prev)} disabled={!prev} aria-label="Previous workout">
            <ChevronLeft size={20} />
          </button>
          <button type="button" className="round-btn pressable" onClick={() => setCalendarOpen(true)} aria-label="Open calendar">
            <CalendarDays size={19} />
          </button>
          <button type="button" className="round-btn pressable" onClick={() => next && setDate(next)} disabled={!next} aria-label="Next workout">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {status !== 'active' && (
        <section className="card notice">
          <p className="notice-title">{status === 'ended' ? 'This plan has ended' : 'Last month of this plan'}</p>
          <p className="notice-text">
            {status === 'ended' ? `It ended on ${formatMedium(end)}.` : `It ends on ${formatMedium(end)}.`} Extend it, or import the next plan.
          </p>
          <div className="notice-actions">
            {plan.months < 24 && (
              <button type="button" className="secondary-btn pressable" disabled={busy} onClick={extend}>
                Extend 1 month
              </button>
            )}
            <button type="button" className="primary-btn pressable" onClick={onGoSettings}>
              New plan
            </button>
          </div>
        </section>
      )}

      {day && dayIndex !== null ? (
        <>
          <div className="plan-head">
            <h2>Treino {day.label}</h2>
            {day.tag && <span className="pill">{prettyName(day.tag)}</span>}
            <button type="button" className="link-btn pressable" onClick={() => setPicking((v) => !v)}>
              Switch
            </button>
          </div>
          {override !== null && override !== scheduled && scheduled !== null && (
            <p className="plan-hint">Scheduled today: Treino {plan.days[scheduled].label}</p>
          )}
          {picking && chips}

          {day.items.map((item, i) =>
            item.kind === 'note' ? (
              <p key={i} className="plan-note">
                {prettyName(item.name)}
              </p>
            ) : (
              <ExerciseCard key={`${date}|${dayIndex}|${i}`} date={date} dayIndex={dayIndex} itemIndex={i} item={item} />
            ),
          )}

          {problem && <p className="error">{problem}</p>}
          <button type="button" className={done ? 'done-btn on pressable' : 'done-btn pressable'} disabled={busy} onClick={toggleDone}>
            <Check size={20} />
            {done ? 'Workout done' : 'Mark workout done'}
          </button>
        </>
      ) : (
        <section className="card empty">
          <p className="empty-title">{date < plan.start_date ? 'Plan has not started' : 'Rest day'}</p>
          <p className="empty-text">
            {date < plan.start_date ? `Your plan starts on ${formatMedium(plan.start_date)}.` : 'No workout scheduled. Enjoy it.'}
          </p>
          {next && (
            <button type="button" className="secondary-btn pressable" onClick={() => setDate(next)}>
              Next workout ({formatShort(next)})
            </button>
          )}
          {prev && (
            <button type="button" className="secondary-btn pressable" onClick={() => setDate(prev)}>
              Previous workout ({formatShort(prev)})
            </button>
          )}
          {date >= plan.start_date && (
            <button type="button" className="secondary-btn pressable" onClick={() => setPicking((v) => !v)}>
              Train anyway
            </button>
          )}
          {picking && chips}
        </section>
      )}

      <CalendarSheet
        open={calendarOpen}
        selected={date}
        today={today}
        hasWorkout={(d) => isTrainingDay(plan, d)}
        isDone={(d) => doneDates.has(d)}
        onSelect={(d) => {
          setDate(d);
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />
    </main>
  );
}

export default function PlanToday(props: { onGoSettings: () => void; jumpToToday: number }) {
  const { plan } = usePlans();
  return plan ? <PlanTodayInner key={plan.id} plan={plan} {...props} /> : null;
}
