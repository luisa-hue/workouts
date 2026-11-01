import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import Segmented from '../components/Segmented';
import CalendarSheet from '../components/CalendarSheet';
import { useWorkoutIndex } from '../lib/index-context';
import { buildSchedule } from '../lib/schedule';
import { supabase } from '../lib/supabase';
import { formatLong, formatMedium, formatShort, todayISO, weekdayName } from '../lib/dates';
import { cleanDescription, prettyScoreType, simpleSets } from '../lib/text';
import { PROGRAMS, type Part, type Program, type Workout } from '../types';

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

function PartCard({ part }: { part: Part }) {
  const title = (part.title ?? '').trim();
  const isNotes = title.toUpperCase() === 'NOTES';
  const score = prettyScoreType(part.scoreType);
  const sets = simpleSets(part.sets);
  const body = cleanDescription(part.description);
  return (
    <section className={isNotes ? 'card part notes' : 'card part'}>
      <div className="part-head">
        <h2>{title || 'Workout'}</h2>
        {score && <span className="pill">{score}</span>}
      </div>
      {sets && <div className="part-sets">{sets}</div>}
      {body && <p className="part-body">{body}</p>}
    </section>
  );
}

export default function Today({ onGoSettings }: { onGoSettings: () => void }) {
  const index = useWorkoutIndex();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [program, setProgram] = useState<Program>(loadProgram);
  const [rows, setRows] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

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
          parts.map((p, i) => <PartCard key={i} part={p} />)
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
        onSelect={(d) => {
          setDate(d);
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />
    </main>
  );
}
