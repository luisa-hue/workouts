import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Pencil, Plus, Repeat } from 'lucide-react';
import Segmented from '../components/Segmented';
import CalendarSheet from '../components/CalendarSheet';
import AnnotatedText from '../components/AnnotatedText';
import LogSheet, { type LogTarget } from '../components/LogSheet';
import { useLogs } from '../lib/logs-context';
import { formatKg } from '../lib/rm';
import { useWorkoutIndex } from '../lib/index-context';
import { buildSchedule } from '../lib/schedule';
import { supabase } from '../lib/supabase';
import { formatLong, formatMedium, formatShort, todayISO, weekdayName } from '../lib/dates';
import { cleanDescription, prettyScoreType, simpleSets } from '../lib/text';
import { PROGRAMS, type LogEntry, type Part, type Program, type Workout } from '../types';

const PROGRAM_KEY = 'workouts.program';

function loadProgram(): Program {
  try {
    const v = localStorage.getItem(PROGRAM_KEY);
    if (v === 'BUILD' || v === 'SHRED') return v;
  } catch {
    /* storage unavailable */
  }
  return 'BUILD';
}

function logSummary(e: LogEntry): string {
  const load = e.weight_kg !== null && e.reps !== null ? `${formatKg(e.weight_kg)} × ${e.reps}` : e.weight_kg !== null ? formatKg(e.weight_kg) : e.reps !== null ? `${e.reps} reps` : '';
  return load;
}

function PartCard({ part, entry, onLog }: { part: Part; entry: LogEntry | undefined; onLog: (title: string, text: string) => void }) {
  const title = (part.title ?? '').trim();
  const isNotes = title.toUpperCase() === 'NOTES';
  const score = prettyScoreType(part.scoreType);
  const sets = simpleSets(part.sets);
  const body = cleanDescription(part.description);
  const summary = entry ? logSummary(entry) : '';
  return (
    <section className={isNotes ? 'card part notes' : 'card part'}>
      <div className="part-head">
        <h2>{title || 'Workout'}</h2>
        {score && <span className="pill">{score}</span>}
      </div>
      {sets && <div className="part-sets">{sets}</div>}
      {body && (
        <p className="part-body">
          <AnnotatedText text={body} />
        </p>
      )}
      {!isNotes &&
        (entry ? (
          <button type="button" className="logged pressable" onClick={() => onLog(title, body)} aria-label="Edit log">
            <Check size={16} className="logged-check" />
            <span className="logged-text">
              {summary && <span className="logged-main">{summary}</span>}
              {entry.comment && <span className="logged-note">{entry.comment}</span>}
              {!summary && !entry.comment && <span className="logged-main">Logged</span>}
            </span>
            <Pencil size={15} className="logged-edit" />
          </button>
        ) : (
          <button type="button" className="log-btn pressable" onClick={() => onLog(title, body)}>
            <Plus size={16} />
            Log
          </button>
        ))}
    </section>
  );
}

export default function Today({ onGoSettings, jumpToToday }: { onGoSettings: () => void; jumpToToday: number }) {
  const index = useWorkoutIndex();
  const logs = useLogs();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [program, setProgram] = useState<Program>(loadProgram);
  const [rows, setRows] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [doneBusy, setDoneBusy] = useState(false);
  const [doneError, setDoneError] = useState<string | null>(null);

  // The Today tab was tapped: go back to the current date.
  useEffect(() => {
    if (jumpToToday > 0) {
      setDate(todayISO());
      setCalendarOpen(false);
    }
  }, [jumpToToday]);

  const dates = index.datesByProgram[program];
  const schedule = useMemo(() => buildSchedule(dates), [dates]);
  const resolved = schedule.resolve(date);
  const source = resolved?.source ?? null; // the stored date whose workout is shown (differs on repeats)
  const prev = schedule.prev(date);
  const next = schedule.next(date);

  useEffect(() => {
    if (!source) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .from('workouts')
      .select('uid,date,weekday,program,parts')
      .eq('date', source)
      .eq('program', program)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setRows([]);
        } else {
          setRows((data ?? []) as Workout[]);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, program, index.version]);

  function changeProgram(p: Program) {
    setProgram(p);
    try {
      localStorage.setItem(PROGRAM_KEY, p);
    } catch {
      /* storage unavailable */
    }
  }

  // Changing day or program closes the log sheet.
  useEffect(() => {
    setLogTarget(null);
    setDoneError(null);
  }, [date, program]);

  const doneDates = logs.doneDates(program);
  const done = doneDates.has(date);

  function toggleDone() {
    setDoneBusy(true);
    setDoneError(null);
    logs
      .setDone(date, program, !done)
      .catch((e: unknown) => setDoneError(e instanceof Error ? e.message : 'Something went wrong.'))
      .finally(() => setDoneBusy(false));
  }

  const workout = rows[0];
  const parts = workout?.parts ?? [];
  const title = date === today ? 'Today' : weekdayName(date);
  const libraryEmpty = !index.loading && index.total === 0 && !index.error;
  const busy = index.loading || loading;

  return (
    <main>
      <header className="page-head">
        <div>
          <h1 className="large-title">{title}</h1>
          <p className="subtitle">{formatLong(date)}</p>
          {workout && done && (
            <p className="done-chip">
              <Check size={13} />
              Done
            </p>
          )}
          {date !== today && (
            <button type="button" className="today-btn pressable" onClick={() => setDate(today)}>
              Back to today
            </button>
          )}
          {resolved && resolved.cycle > 0 && (
            <p className="repeat">
              <Repeat size={13} />
              Cycle {resolved.cycle + 1} · from {formatMedium(resolved.source)}
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

      <Segmented options={PROGRAMS} value={program} onChange={changeProgram} label="Program" />

      {(error || index.error) && <p className="error">{error || index.error}</p>}

      {libraryEmpty ? (
        <section className="card empty">
          <p className="empty-title">No workouts yet</p>
          <p className="empty-text">Import your workout JSON files in Settings.</p>
          <button type="button" className="primary-btn pressable" onClick={onGoSettings}>
            Open Settings
          </button>
        </section>
      ) : busy ? (
        <p className="loading">Loading…</p>
      ) : workout ? (
        parts.length > 0 ? (
          <>
            {parts.map((p, i) => (
              <PartCard
                key={i}
                part={p}
                entry={logs.entry(date, program, i)}
                onLog={(title, text) => setLogTarget({ date, program, partIndex: i, title, text })}
              />
            ))}
            {doneError && <p className="error">{doneError}</p>}
            <button type="button" className={done ? 'done-btn on pressable' : 'done-btn pressable'} disabled={doneBusy} onClick={toggleDone}>
              <Check size={20} />
              {done ? 'Workout done' : 'Mark workout done'}
            </button>
          </>
        ) : (
          <section className="card empty">
            <p className="empty-text">This workout has no parts.</p>
          </section>
        )
      ) : (
        <section className="card empty">
          <p className="empty-title">No {program} workout</p>
          <p className="empty-text">
            {index.min && date < index.min ? `The program starts on ${formatMedium(index.min)}.` : 'Rest day.'}
          </p>
          {prev && (
            <button type="button" className="secondary-btn pressable" onClick={() => setDate(prev)}>
              Previous workout ({formatShort(prev)})
            </button>
          )}
          {next && (
            <button type="button" className="secondary-btn pressable" onClick={() => setDate(next)}>
              Next workout ({formatShort(next)})
            </button>
          )}
        </section>
      )}

      <CalendarSheet
        open={calendarOpen}
        selected={date}
        today={today}
        hasWorkout={schedule.has}
        isDone={(d) => doneDates.has(d)}
        onSelect={(d) => {
          setDate(d);
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />

      <LogSheet target={logTarget} onClose={() => setLogTarget(null)} />
    </main>
  );
}
