import { useEffect, useState, type FormEvent } from 'react';
import { Trophy } from 'lucide-react';
import { useLogs } from '../lib/logs-context';
import { useLifts } from '../lib/lifts-context';
import { checkPR, liftsInText, suggestReps, type PrResult } from '../lib/pr';
import { formatKg } from '../lib/rm';
import { formatMedium } from '../lib/dates';

export interface LogTarget {
  date: string;
  program: string;
  partIndex: number;
  title: string;
  /** Cleaned part description, used to find the lifts in it. */
  text: string;
}

function parseNum(s: string): number {
  return Number(s.trim().replace(',', '.'));
}

/** Keeps the sheet above the iOS keyboard: how much of the layout viewport the keyboard covers. */
function useKeyboardInset(active: boolean): { bottom: number; height: number | null } {
  const [v, setV] = useState<{ bottom: number; height: number | null }>({ bottom: 0, height: null });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) {
      setV({ bottom: 0, height: null });
      return;
    }
    const update = () => setV({ bottom: Math.max(0, window.innerHeight - vv.height - vv.offsetTop), height: vv.height });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);
  return v;
}

export default function LogSheet({ target, onClose }: { target: LogTarget | null; onClose: () => void }) {
  const logs = useLogs();
  const lifts = useLifts();
  const open = target !== null;
  const kb = useKeyboardInset(open);

  // Keep the last target while the sheet slides out, so it does not go blank mid-animation.
  const [shown, setShown] = useState<LogTarget | null>(target);
  useEffect(() => {
    if (target) setShown(target);
  }, [target]);
  const t = target ?? shown;

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [comment, setComment] = useState('');
  const [liftId, setLiftId] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pr, setPr] = useState<(PrResult & { liftId: string }) | null>(null);

  const candidates = t ? liftsInText(t.text, lifts.matcher) : [];
  const existing = t ? logs.entry(t.date, t.program, t.partIndex) : undefined;

  // Fill the form each time the sheet opens on a part.
  const slot = target ? `${target.date}|${target.program}|${target.partIndex}` : '';
  useEffect(() => {
    if (!target) return;
    const found = liftsInText(target.text, lifts.matcher);
    const first = found[0] ?? '';
    const saved = logs.entry(target.date, target.program, target.partIndex);
    setWeight(saved?.weight_kg != null ? String(saved.weight_kg) : '');
    setReps(saved?.reps != null ? String(saved.reps) : first ? String(suggestReps(target.text, lifts.matcher, first) ?? '') : '');
    setComment(saved?.comment ?? '');
    setLiftId(first);
    setProblem(null);
    setPr(null);
    setBusy(false);
    // Only when the sheet opens on a different part; later data changes must not wipe what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  function pickLift(id: string) {
    setLiftId(id);
    if (!reps.trim() && id && t) setReps(String(suggestReps(t.text, lifts.matcher, id) ?? ''));
  }

  const w = weight.trim() ? parseNum(weight) : null;
  const r = reps.trim() ? parseNum(reps) : null;
  const weightOk = w === null || (w > 0 && w <= 1000);
  const repsOk = r === null || (Number.isInteger(r) && r >= 1 && r <= 100);
  const empty = w === null && r === null && !comment.trim();
  const canSave = weightOk && repsOk && (!empty || existing !== undefined);

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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!t || !canSave) return;
    void act(async () => {
      await logs.savePart(t.date, t.program, t.partIndex, { weight_kg: w, reps: r, comment });
      const check = liftId && w !== null && r !== null ? checkPR(lifts.statsOf(liftId), r, w) : null;
      if (check) setPr({ ...check, liftId });
      else onClose();
    });
  }

  function onRemove() {
    if (!t || !existing) return;
    if (!window.confirm('Delete this log?')) return;
    void act(async () => {
      await logs.removePart(t.date, t.program, t.partIndex);
      onClose();
    });
  }

  function onSavePr() {
    if (!t || !pr) return;
    void act(async () => {
      await lifts.addRecord({ lift_id: pr.liftId, reps: pr.reps, weight_kg: pr.weight_kg, date: t.date });
      onClose();
    });
  }

  const prLift = pr ? lifts.lifts.find((l) => l.id === pr.liftId) : undefined;
  const style = kb.height ? { bottom: kb.bottom, maxHeight: kb.height - 12 } : undefined;

  return (
    <>
      <div className={open ? 'backdrop open' : 'backdrop'} onClick={onClose} />
      <div
        className={open ? 'sheet log-sheet open' : 'sheet log-sheet'}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="Log"
      >
        <div className="sheet-grab" />
        {t && pr ? (
          <div className="pr-alert">
            <div className="pr-badge">
              <Trophy size={26} />
            </div>
            <h2 className="pr-title">New PR</h2>
            <p className="pr-lift">
              {prLift?.name ?? 'Lift'} · {pr.reps}RM
            </p>
            <p className="pr-big">
              {formatKg(pr.weight_kg)} <span>× {pr.reps}</span>
            </p>
            <p className="pr-sub">
              {pr.previous
                ? `${pr.previous.tested ? 'Was' : 'Estimated before:'} ${formatKg(pr.previous.kg)}${pr.previous.tested && pr.previous.date ? ` on ${formatMedium(pr.previous.date)}` : ''}`
                : 'Your first result for this lift'}
            </p>
            {pr.reps > 1 && <p className="pr-est">About {formatKg(pr.oneRM)} for 1 rep</p>}
            {problem && <p className="error">{problem}</p>}
            <button type="button" className="primary-btn pressable" disabled={busy} onClick={onSavePr}>
              Save as PR
            </button>
            <button type="button" className="secondary-btn pressable" disabled={busy} onClick={onClose}>
              Not now
            </button>
          </div>
        ) : (
          t && (
            <form onSubmit={onSubmit}>
              <div className="log-head">
                <h2 className="log-title">{t.title || 'Workout'}</h2>
                <span className="log-date">{formatMedium(t.date)}</span>
              </div>

              {logs.needsSetup && <p className="error">The logs table is missing. Run supabase/schema.sql in Supabase first.</p>}

              {candidates.length > 0 && (
                <label className="log-field">
                  <span className="field-label">Lift (for PR alerts)</span>
                  <select value={liftId} onChange={(e) => pickLift(e.target.value)}>
                    {candidates.map((id) => (
                      <option key={id} value={id}>
                        {lifts.lifts.find((l) => l.id === id)?.name ?? 'Lift'}
                      </option>
                    ))}
                    <option value="">None</option>
                  </select>
                </label>
              )}

              <div className="record-grid">
                <label>
                  <span className="field-label">Weight (kg)</span>
                  <input type="text" inputMode="decimal" placeholder="80" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </label>
                <label>
                  <span className="field-label">Reps</span>
                  <input type="text" inputMode="numeric" placeholder="5" value={reps} onChange={(e) => setReps(e.target.value)} />
                </label>
              </div>

              <label className="log-field">
                <span className="field-label">Comment</span>
                <textarea rows={3} placeholder="How did it feel?" value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>

              {problem && <p className="error">{problem}</p>}

              <button type="submit" className="primary-btn pressable" disabled={busy || !canSave}>
                {existing ? 'Update log' : 'Save log'}
              </button>
              {existing && (
                <button type="button" className="link-btn danger" disabled={busy} onClick={onRemove}>
                  Delete log
                </button>
              )}
            </form>
          )
        )}
      </div>
    </>
  );
}
