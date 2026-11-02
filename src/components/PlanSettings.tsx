import { useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { usePlans, type NewPlan } from '../lib/plans-context';
import { blocksOf, parsePlanRows, planEnd, prettyName, suggestRestDays, trainingDaysPerWeek, type ParsedPlan } from '../lib/plan';
import { formatMedium, todayISO, weekdayName } from '../lib/dates';

/** Monday first. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function RestDays({ rest, onChange }: { rest: number[]; onChange: (rest: number[]) => void }) {
  return (
    <div className="weekday-toggle" role="group" aria-label="Training days">
      {WEEK_ORDER.map((d) => {
        const training = !rest.includes(d);
        return (
          <button
            key={d}
            type="button"
            className={training ? 'weekday on pressable' : 'weekday pressable'}
            aria-pressed={training}
            aria-label={`${DAY_LONG[d]}: ${training ? 'training' : 'rest'}`}
            onClick={() => onChange(training ? [...rest, d].sort() : rest.filter((x) => x !== d))}
          >
            {DAY_LETTER[d]}
          </button>
        );
      })}
    </div>
  );
}

function ImportForm({ parsed, fileName, replacing, onDone, onCancel }: { parsed: ParsedPlan; fileName: string; replacing: boolean; onDone: () => void; onCancel: () => void }) {
  const plans = usePlans();
  const count = parsed.days.length;
  const [name, setName] = useState(parsed.name ?? fileName);
  const [start, setStart] = useState(todayISO());
  const [rest, setRest] = useState<number[]>(() => suggestRestDays(count));
  const [months, setMonths] = useState(3);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const startOk = /^\d{4}-\d{2}-\d{2}$/.test(start) && !Number.isNaN(Date.parse(start));
  const perWeek = trainingDaysPerWeek(rest);
  const valid = name.trim().length > 0 && startOk && perWeek > 0;

  function submit() {
    if (!valid) return;
    const plan: NewPlan = { name: name.trim(), start_date: start, months, rest_days: rest, days: parsed.days };
    setBusy(true);
    setProblem(null);
    plans
      .createPlan(plan)
      .then(onDone)
      .catch((e: unknown) => {
        setProblem(e instanceof Error ? e.message : 'Something went wrong.');
        setBusy(false);
      });
  }

  return (
    <section className="card">
      <p className="card-text">
        Found <strong>{count}</strong> {count === 1 ? 'workout' : 'workouts'} in the file:
      </p>
      <ul className="plan-found">
        {parsed.days.map((d) => (
          <li key={d.label}>
            <span className="plan-found-label">Treino {d.label}</span>
            <span className="muted">
              {d.items.filter((i) => i.kind === 'exercise').length} exercises in {blocksOf(d).filter((b) => b.kind !== 'note').length} blocks
              {d.tag ? ` · ${prettyName(d.tag)}` : ''}
            </span>
          </li>
        ))}
      </ul>

      <label className="date-field">
        <span className="field-label">Name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoCorrect="off" />
      </label>

      <label className="date-field">
        <span className="field-label">Treino {parsed.days[0].label} starts on</span>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      {startOk && (
        <p className="hint">
          {weekdayName(start)}. The other workouts follow in order on each training day.
        </p>
      )}

      <span className="field-label">Training days</span>
      <RestDays rest={rest} onChange={setRest} />
      <p className={perWeek === count ? 'hint' : 'hint warn'}>
        {perWeek === 0
          ? 'Pick at least one training day.'
          : perWeek === count
            ? `${count} workouts, ${perWeek} training days a week.`
            : `${count} workouts, ${perWeek} training days a week. The order carries over into the next week.`}
      </p>

      <label className="date-field">
        <span className="field-label">How long will you follow this plan</span>
        <select className="calc-select" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m} {m === 1 ? 'month' : 'months'}
            </option>
          ))}
        </select>
      </label>
      {startOk && <p className="hint">Ends {formatMedium(planEnd({ start_date: start, months }))}. You get a reminder a month before.</p>}

      {replacing && <p className="hint warn">This replaces your current plan. Its logs are kept.</p>}
      {problem && <p className="error">{problem}</p>}
      <button type="button" className="primary-btn pressable" disabled={busy || !valid} onClick={submit}>
        {busy ? 'Saving…' : 'Start plan'}
      </button>
      <button type="button" className="secondary-btn pressable plan-cancel" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}

export default function PlanSettings() {
  const plans = usePlans();
  const plan = plans.plan;
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ parsed: ParsedPlan; fileName: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFile(list: FileList | null) {
    const file = list?.[0];
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setProblem(null);
    setReading(true);
    try {
      const { readSheet } = await import('read-excel-file/browser');
      const rows = await readSheet(file);
      setDraft({ parsed: parsePlanRows(rows), fileName: file.name.replace(/\.[^.]+$/, '') });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setReading(false);
    }
  }

  function run(fn: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    fn()
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'Something went wrong.'))
      .finally(() => setBusy(false));
  }

  const picker = (
    <>
      <input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => void onFile(e.target.files)} />
      <button
        type="button"
        className={plan ? 'secondary-btn pressable' : 'primary-btn pressable'}
        disabled={reading || plans.needsSetup}
        onClick={() => fileInput.current?.click()}
      >
        <FileSpreadsheet size={18} />
        {reading ? 'Reading…' : plan ? 'Import a new plan' : 'Choose xlsx file'}
      </button>
    </>
  );

  return (
    <>
      <h2 className="section-title">Gym plan</h2>
      {plans.needsSetup && <p className="error">{plans.error}</p>}

      {draft ? (
        <ImportForm parsed={draft.parsed} fileName={draft.fileName} replacing={plan !== null} onDone={() => setDraft(null)} onCancel={() => setDraft(null)} />
      ) : plan ? (
        <>
          <section className="card list">
            <div className="row">
              <span>Plan</span>
              <span className="muted">{plan.name}</span>
            </div>
            <div className="row">
              <span>Workouts</span>
              <span className="muted">{plan.days.map((d) => d.label).join(' ')}</span>
            </div>
            <div className="row">
              <span>Starts</span>
              <span className="muted">{formatMedium(plan.start_date)}</span>
            </div>
            <div className="row">
              <span>Training days</span>
              <span className="muted">
                {WEEK_ORDER.filter((d) => !plan.rest_days.includes(d))
                  .map((d) => DAY_SHORT[d])
                  .join(', ')}
              </span>
            </div>
            <label className="row">
              <span>Duration</span>
              <select
                className="inline-select"
                value={plan.months}
                disabled={busy}
                onChange={(e) => run(() => plans.setMonths(Number(e.target.value)))}
                aria-label="Duration in months"
              >
                {Array.from({ length: Math.max(12, plan.months) }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? 'month' : 'months'}
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              <span>Ends</span>
              <span className="muted">{formatMedium(planEnd(plan))}</span>
            </div>
          </section>
          {problem && <p className="error">{problem}</p>}
          <section className="card">
            <p className="card-text">A new xlsx replaces this plan from the date you choose. Your logs stay.</p>
            {picker}
          </section>
          <section className="card list danger-zone">
            <button
              type="button"
              className="row action pressable"
              disabled={busy}
              onClick={() => {
                if (window.confirm('End this plan? Your logs are kept.')) run(plans.endPlan);
              }}
            >
              <span>End plan</span>
            </button>
          </section>
        </>
      ) : (
        <section className="card">
          <p className="card-text">
            Import the xlsx from your coach. The app finds the workouts (Treino A, B, C…), you choose the start date, rest days and how many months the plan runs.
          </p>
          {picker}
          {problem && <p className="error">{problem}</p>}
        </section>
      )}
    </>
  );
}
