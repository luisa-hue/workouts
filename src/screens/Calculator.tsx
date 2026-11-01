import { useMemo, useState } from 'react';
import { useLifts } from '../lib/lifts-context';
import { estimateOneRM, formatKg, MAX_REPS, rmPercent, roundToStep, weightForReps } from '../lib/rm';

const PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

function parseNum(s: string): number {
  return Number(s.trim().replace(',', '.'));
}

export default function Calculator() {
  const lifts = useLifts();
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('1');
  const [liftId, setLiftId] = useState('');

  const withData = useMemo(() => lifts.lifts.filter((l) => lifts.statsOf(l.id)?.best1RM != null), [lifts]);

  const w = parseNum(weight);
  const r = Number(reps);
  const valid = w > 0 && w <= 1000 && Number.isInteger(r) && r >= 1 && r <= MAX_REPS;
  const oneRM = valid ? estimateOneRM(w, r) : null;

  function pickLift(id: string) {
    setLiftId(id);
    if (!id) return;
    const best = lifts.statsFor(id).best1RM;
    if (best != null) {
      setWeight(String(Number(best.toFixed(1))));
      setReps('1');
    }
  }

  return (
    <main>
      <header className="page-head">
        <div>
          <h1 className="large-title">Calculator</h1>
          <p className="subtitle">Estimate your 1RM, then see every rep range and percentage.</p>
        </div>
      </header>

      <section className="card">
        {withData.length > 0 && (
          <label className="date-field first">
            <span className="field-label">Start from a lift</span>
            <select className="calc-select" value={liftId} onChange={(e) => pickLift(e.target.value)}>
              <option value="">Enter manually</option>
              {withData.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="record-grid">
          <label>
            <span className="field-label">Weight (kg)</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="80"
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value);
                setLiftId('');
              }}
            />
          </label>
          <label>
            <span className="field-label">Reps</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="5"
              value={reps}
              onChange={(e) => {
                setReps(e.target.value);
                setLiftId('');
              }}
            />
          </label>
        </div>
        <div className="calc-result">
          <span className="rm-label">Estimated 1RM</span>
          <span className={oneRM ? 'rm-big' : 'rm-big none'}>{oneRM ? formatKg(roundToStep(oneRM)) : '–'}</span>
          {oneRM && <span className="rm-sub">{formatKg(oneRM)} before rounding to 2.5kg</span>}
        </div>
      </section>

      {oneRM && (
        <>
          <h2 className="section-title">Percentages</h2>
          <section className="card list">
            {PERCENTS.map((p) => (
              <div key={p} className="row">
                <span className="calc-pct">{p}%</span>
                <span className="calc-kg">{formatKg(roundToStep((oneRM * p) / 100))}</span>
              </div>
            ))}
          </section>

          <h2 className="section-title">Rep ranges</h2>
          <section className="card list">
            {Array.from({ length: MAX_REPS }, (_, i) => i + 1).map((n) => {
              const kg = weightForReps(oneRM, n);
              return (
                <div key={n} className={n === r ? 'row calc-row current' : 'row calc-row'}>
                  <span className="calc-reps">{n === 1 ? '1 rep' : `${n} reps`}</span>
                  <span className="calc-pct muted">{rmPercent(n)}%</span>
                  <span className="calc-kg">{kg === null ? '–' : formatKg(roundToStep(kg))}</span>
                </div>
              );
            })}
          </section>
          <p className="footnote">Based on the standard rep table. Accuracy drops above 10 reps.</p>
        </>
      )}
    </main>
  );
}
