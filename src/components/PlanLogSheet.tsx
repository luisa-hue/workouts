import { useEffect, useState, type FormEvent } from 'react';
import { usePlans } from '../lib/plans-context';
import { BLOCK_LABEL, exerciseKey, prettyName, type BlockKind, type PlanItem } from '../lib/plan';
import { formatKg } from '../lib/rm';
import { formatMedium } from '../lib/dates';
import { useKeyboardInset } from './LogSheet';

export interface PlanLogTarget {
  date: string;
  dayIndex: number;
  kind: BlockKind;
  items: { index: number; item: PlanItem }[];
}

function parseNum(s: string): number {
  return Number(s.trim().replace(',', '.'));
}

const show = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/** Log of one block (solo exercise, bi-set, tri-set): a weight and reps per exercise, one comment. */
export default function PlanLogSheet({ target, onClose }: { target: PlanLogTarget | null; onClose: () => void }) {
  const plans = usePlans();
  const open = target !== null;
  const kb = useKeyboardInset(open);

  // Keep the last target while the sheet slides out, so it does not go blank mid-animation.
  const [shown, setShown] = useState<PlanLogTarget | null>(target);
  useEffect(() => {
    if (target) setShown(target);
  }, [target]);
  const t = target ?? shown;

  const [weights, setWeights] = useState<string[]>([]);
  const [reps, setReps] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const slot = target ? `${target.date}|${target.dayIndex}|${target.items[0]?.index}` : '';
  useEffect(() => {
    if (!target) return;
    const logs = target.items.map((x) => plans.setLog(target.date, target.dayIndex, x.index));
    setWeights(logs.map((l) => show(l?.weight_kg)));
    setReps(logs.map((l) => show(l?.reps)));
    setComment(logs[0]?.comment ?? '');
    setProblem(null);
    setBusy(false);
    // Only when the sheet opens on a different block; later data changes must not wipe what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  const exercises = t ? t.items.filter((x) => x.item.kind === 'exercise') : [];
  const parsed = exercises.map((_, i) => ({
    w: (weights[i] ?? '').trim() ? parseNum(weights[i]) : null,
    r: (reps[i] ?? '').trim() ? parseNum(reps[i]) : null,
  }));
  const valid = parsed.every(
    ({ w, r }) => (w === null || (Number.isFinite(w) && w >= 0 && w <= 1000)) && (r === null || (Number.isInteger(r) && r >= 0 && r <= 200)),
  );
  const existing = t ? exercises.some((x) => plans.setLog(t.date, t.dayIndex, x.index)) : false;
  const empty = parsed.every(({ w, r }) => w === null && r === null) && !comment.trim();
  const canSave = valid && (!empty || existing);

  const lasts = t ? exercises.map((x) => plans.lastTime(exerciseKey(x.item.name), t.date)) : [];
  const anyLast = lasts.some(Boolean);

  function fillFromLast() {
    setWeights(lasts.map((l, i) => (weights[i]?.trim() ? weights[i] : show(l?.weight_kg))));
    setReps(lasts.map((l, i) => (reps[i]?.trim() ? reps[i] : show(l?.reps))));
  }

  function act(fn: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    fn()
      .then(onClose)
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'Something went wrong.'))
      .finally(() => setBusy(false));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!t || !canSave) return;
    act(() =>
      plans.saveBlock(
        t.date,
        t.dayIndex,
        exercises.map((x, i) => ({ itemIndex: x.index, exercise: exerciseKey(x.item.name), weight: parsed[i].w, reps: parsed[i].r })),
        comment,
      ),
    );
  }

  function onRemove() {
    if (!t || !existing) return;
    if (!window.confirm('Delete this log?')) return;
    act(() =>
      plans.removeBlock(
        t.date,
        t.dayIndex,
        exercises.map((x) => x.index),
      ),
    );
  }

  const style = kb.height ? { bottom: kb.bottom, maxHeight: kb.height - 12 } : undefined;
  const label = t ? BLOCK_LABEL[t.kind] ?? 'Log' : 'Log';

  return (
    <>
      <div className={open ? 'backdrop open' : 'backdrop'} onClick={onClose} />
      <div className={open ? 'sheet log-sheet open' : 'sheet log-sheet'} style={style} role="dialog" aria-modal="true" aria-hidden={!open} aria-label="Log">
        <div className="sheet-grab" />
        {t && (
          <form onSubmit={onSubmit}>
            <div className="log-head">
              <h2 className="log-title">{label}</h2>
              <span className="log-date">{formatMedium(t.date)}</span>
            </div>

            {exercises.map((x, i) => {
              const last = lasts[i];
              return (
                <div key={x.index} className="log-ex">
                  <p className="log-ex-name">{prettyName(x.item.name)}</p>
                  {last && (last.weight_kg !== null || last.reps !== null) && (
                    <p className="log-ex-last">
                      Last time, {formatMedium(last.date)}: {last.weight_kg !== null ? formatKg(last.weight_kg) : '–'}
                      {last.reps !== null ? ` × ${last.reps}` : ''}
                    </p>
                  )}
                  <div className="record-grid">
                    <label>
                      <span className="field-label">Weight (kg)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={show(last?.weight_kg) || '40'}
                        value={weights[i] ?? ''}
                        onChange={(e) => setWeights((w) => w.map((v, j) => (j === i ? e.target.value : v)))}
                      />
                    </label>
                    <label>
                      <span className="field-label">Reps</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={show(last?.reps) || '10'}
                        value={reps[i] ?? ''}
                        onChange={(e) => setReps((r) => r.map((v, j) => (j === i ? e.target.value : v)))}
                      />
                    </label>
                  </div>
                </div>
              );
            })}

            {anyLast && (
              <button type="button" className="link-btn fill-last pressable" onClick={fillFromLast}>
                Fill with last time
              </button>
            )}

            <label className="log-field">
              <span className="field-label">Comment</span>
              <textarea rows={2} placeholder="How did it feel?" value={comment} onChange={(e) => setComment(e.target.value)} />
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
        )}
      </div>
    </>
  );
}
