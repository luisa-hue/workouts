import { useState, type FormEvent } from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { useLifts } from '../lib/lifts-context';
import { estimateOneRM, formatKg, MAX_REPS, RM_COLUMNS } from '../lib/rm';
import { formatMedium, todayISO } from '../lib/dates';
import type { Lift } from '../types';

function parseKg(s: string): number {
  return Number(s.trim().replace(',', '.'));
}

export default function LiftDetail({ lift, onBack }: { lift: Lift; onBack: () => void }) {
  const lifts = useLifts();
  const stats = lifts.statsFor(lift.id);

  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(todayISO());
  const [name, setName] = useState(lift.name);
  const [aliases, setAliases] = useState(lift.aliases.join(', '));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const r = Number(reps);
  const w = parseKg(weight);
  const validRecord = Number.isInteger(r) && r >= 1 && r <= MAX_REPS && w > 0 && w <= 1000 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const hint = validRecord ? estimateOneRM(w, r) : null;

  const aliasList = aliases
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean);
  const dirty = name.trim() !== lift.name || aliasList.join('|') !== lift.aliases.join('|');

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function onRecord(e: FormEvent) {
    e.preventDefault();
    if (!validRecord) return;
    void act(async () => {
      await lifts.addRecord({ lift_id: lift.id, reps: r, weight_kg: w, date });
      setWeight('');
    });
  }

  function onSaveNames() {
    if (!name.trim()) return;
    void act(async () => {
      await lifts.saveLift(lift.id, name, aliasList);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    });
  }

  function onDeleteRecord(id: string, label: string) {
    if (!window.confirm(`Delete ${label}?`)) return;
    void act(() => lifts.removeRecord(id));
  }

  function onDeleteLift() {
    if (!window.confirm(`Delete ${lift.name} and all its records?`)) return;
    void act(async () => {
      await lifts.removeLift(lift.id);
      onBack();
    });
  }

  return (
    <main>
      <button type="button" className="back-btn pressable" onClick={onBack}>
        <ChevronLeft size={22} />
        PRs
      </button>
      <header className="page-head">
        <h1 className="large-title">{lift.name}</h1>
      </header>

      <div className="rm-cards">
        {RM_COLUMNS.map((n) => {
          const v = stats.rm(n);
          return (
            <section key={n} className="card rm-card">
              <span className="rm-label">{n}RM</span>
              <span className={v ? (v.tested ? 'rm-big' : 'rm-big est') : 'rm-big none'}>{v ? formatKg(v.kg) : '–'}</span>
              <span className="rm-sub">{v ? (v.tested ? (v.date ? formatMedium(v.date) : '') : 'Estimated') : 'No data'}</span>
            </section>
          );
        })}
      </div>

      <h2 className="section-title">Add a result</h2>
      <form className="card" onSubmit={onRecord}>
        <div className="record-grid">
          <label>
            <span className="field-label">Reps</span>
            <input type="text" inputMode="numeric" placeholder="5" value={reps} onChange={(e) => setReps(e.target.value)} />
          </label>
          <label>
            <span className="field-label">Weight (kg)</span>
            <input type="text" inputMode="decimal" placeholder="80" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
        </div>
        <label className="date-field">
          <span className="field-label">Date</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </label>
        {hint !== null && r > 1 && <p className="hint">About {formatKg(hint)} for 1 rep.</p>}
        <button type="submit" className="primary-btn pressable" disabled={busy || !validRecord}>
          Save result
        </button>
      </form>

      <h2 className="section-title">History</h2>
      {stats.records.length === 0 ? (
        <section className="card empty">
          <p className="empty-text">No results yet. Add your best sets and the other RMs are estimated from them.</p>
        </section>
      ) : (
        <section className="card list">
          {stats.records.map((rec) => {
            const label = `${rec.reps} × ${formatKg(rec.weight_kg)}`;
            return (
              <div key={rec.id} className="row">
                <span>
                  <span className="hist-main">{label}</span>
                  <span className="hist-date">{formatMedium(rec.date)}</span>
                </span>
                <button type="button" className="icon-btn pressable" aria-label={`Delete ${label}`} onClick={() => onDeleteRecord(rec.id, label)}>
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </section>
      )}

      <h2 className="section-title">Names in workouts</h2>
      <section className="card">
        <p className="card-text">Any workout line with one of these names shows your numbers. Separate names with commas.</p>
        <div className="group">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} aria-label="Lift name" autoCorrect="off" />
          <input
            type="text"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="Other names, e.g. BB Push Press"
            aria-label="Other names"
            autoCorrect="off"
          />
        </div>
        <button type="button" className="secondary-btn pressable" disabled={busy || !dirty || !name.trim()} onClick={onSaveNames}>
          {saved ? 'Saved' : 'Save names'}
        </button>
      </section>

      {problem && <p className="error">{problem}</p>}

      <section className="card list danger-zone">
        <button type="button" className="row action pressable" disabled={busy} onClick={onDeleteLift}>
          <span>Delete lift</span>
          <Trash2 size={18} />
        </button>
      </section>
    </main>
  );
}
