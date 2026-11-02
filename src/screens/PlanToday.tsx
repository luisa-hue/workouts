import { useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import CalendarSheet from '../components/CalendarSheet';
import PlanLogSheet, { type PlanLogTarget } from '../components/PlanLogSheet';
import { usePlans } from '../lib/plans-context';
import {
  BLOCK_LABEL,
  blocksOf,
  dayNum,
  isTrainingDay,
  nextTrainingDate,
  planEnd,
  planStatus,
  prettyName,
  previousTrainingDate,
  workoutIndex,
  type Plan,
  type PlanBlock,
  type SetLog,
} from '../lib/plan';
import { formatKg } from '../lib/rm';
import { formatLong, formatMedium, formatShort, todayISO, weekdayName } from '../lib/dates';

function BlockCard({
  date,
  dayIndex,
  block,
  onLog,
}: {
  date: string;
  dayIndex: number;
  block: PlanBlock;
  onLog: () => void;
}) {
  const plans = usePlans();
  const label = BLOCK_LABEL[block.kind];
  const logs = block.items.map((x) => ({ x, log: plans.setLog(date, dayIndex, x.index) }));
  const logged = logs.filter((l) => l.log && (l.log.weight_kg !== null || l.log.reps !== null));
  const comment = logs[0]?.log?.comment ?? null;
  const has = logs.some((l) => l.log);
  const solo = block.items.length === 1;
  const result = (l: SetLog) =>
    l.weight_kg !== null && l.reps !== null ? `${formatKg(l.weight_kg)} × ${l.reps}` : l.weight_kg !== null ? formatKg(l.weight_kg) : l.reps !== null ? `${l.reps} reps` : '';

  return (
    <section className="card part block">
      {label && <div className="part-sets">{label}</div>}
      <ul className="block-list">
        {block.items.map(({ item, index }) => (
          <li key={index}>
            <span className="block-name">{prettyName(item.name)}</span>
            <span className="block-target">{item.reps ? `${item.sets} × ${item.reps}` : `${item.sets} ${item.sets === 1 ? 'set' : 'sets'}`}</span>
          </li>
        ))}
      </ul>
      {has ? (
        <button type="button" className="logged pressable" onClick={onLog} aria-label="Edit log">
          <Check size={16} className="logged-check" />
          <span className="logged-text">
            {logged.map(({ x, log }) =>
              solo ? (
                <span key={x.index} className="logged-main">
                  {result(log!)}
                </span>
              ) : (
                <span key={x.index} className="logged-line">
                  <span className="logged-ex">{prettyName(x.item.name)}</span>
                  <span className="logged-main">{result(log!)}</span>
                </span>
              ),
            )}
            {comment && <span className="logged-note">{comment}</span>}
            {logged.length === 0 && !comment && <span className="logged-main">Logged</span>}
          </span>
          <Pencil size={15} className="logged-edit" />
        </button>
      ) : (
        <button type="button" className="log-btn pressable" onClick={onLog}>
          <Plus size={16} />
          Log
        </button>
      )}
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
  const [logTarget, setLogTarget] = useState<PlanLogTarget | null>(null);
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
    setLogTarget(null);
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

          {blocksOf(day).map((b) =>
            b.kind === 'note' ? (
              <p key={b.key} className="plan-note">
                {prettyName(b.items[0].item.name)}
              </p>
            ) : (
              <BlockCard
                key={`${date}|${dayIndex}|${b.key}`}
                date={date}
                dayIndex={dayIndex}
                block={b}
                onLog={() => setLogTarget({ date, dayIndex, kind: b.kind, items: b.items })}
              />
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

      <PlanLogSheet target={logTarget} onClose={() => setLogTarget(null)} />

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
