import { useState, type FormEvent } from 'react';
import { Plus, Search, Sparkles } from 'lucide-react';
import { useLifts } from '../lib/lifts-context';
import { DEFAULT_LIFTS } from '../lib/defaultLifts';
import { normalizeAlias } from '../lib/lifts';
import { formatKg, RM_COLUMNS, type RmValue } from '../lib/rm';
import LiftDetail from './LiftDetail';
import ScanLifts from './ScanLifts';

export function RmCell({ label, value }: { label: string; value: RmValue | null }) {
  return (
    <span className="rm-cell">
      <span className="rm-label">{label}</span>
      <span className={value ? (value.tested ? 'rm-val' : 'rm-val est') : 'rm-val none'}>{value ? formatKg(value.kg) : '–'}</span>
    </span>
  );
}

export default function PRs() {
  const lifts = useLifts();
  const [openId, setOpenId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const open = openId ? lifts.lifts.find((l) => l.id === openId) : undefined;
  if (scanning) return <ScanLifts onBack={() => setScanning(false)} />;
  if (open) return <LiftDetail lift={open} onBack={() => setOpenId(null)} />;

  const have = new Set(lifts.lifts.map((l) => normalizeAlias(l.name)));
  const missingDefaults = DEFAULT_LIFTS.filter((d) => !have.has(normalizeAlias(d.name))).length;

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    void act(async () => {
      await lifts.addLift(n);
      setName('');
    });
  }

  function onDefaults() {
    void act(async () => {
      const added = await lifts.addDefaults();
      setMessage(`${added} ${added === 1 ? 'lift' : 'lifts'} added.`);
    });
  }

  return (
    <main>
      <header className="page-head">
        <div>
          <h1 className="large-title">PRs</h1>
          <p className="subtitle">Tested results, with estimates from your other lifts.</p>
        </div>
      </header>

      {lifts.needsSetup ? (
        <section className="card empty">
          <p className="empty-title">One more step</p>
          <p className="empty-text">
            Run <code>supabase/schema.sql</code> again in the Supabase SQL Editor to create the lifts and records tables, then reload this page.
          </p>
        </section>
      ) : (
        <>
          {lifts.error && <p className="error">{lifts.error}</p>}
          {lifts.loading ? (
            <p className="loading">Loading…</p>
          ) : lifts.lifts.length === 0 ? (
            <section className="card empty">
              <p className="empty-title">No lifts yet</p>
              <p className="empty-text">Start with the common barbell lifts, then add your numbers. You can rename or remove any of them.</p>
              <button type="button" className="primary-btn pressable" disabled={busy} onClick={onDefaults}>
                <Sparkles size={18} />
                Add common lifts
              </button>
            </section>
          ) : (
            <>
              <section className="card list">
                {lifts.lifts.map((l) => {
                  const stats = lifts.statsFor(l.id);
                  return (
                    <button key={l.id} type="button" className="row lift-row pressable" onClick={() => setOpenId(l.id)}>
                      <span className="lift-name">{l.name}</span>
                      <span className="rm-cells">
                        {RM_COLUMNS.map((r) => (
                          <RmCell key={r} label={`${r}RM`} value={stats.rm(r)} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </section>
              <p className="footnote">
                <span className="est-dot" /> Blue values are estimated from your other results.
              </p>
            </>
          )}

          <h2 className="section-title">Add a lift</h2>
          <form className="card" onSubmit={onAdd}>
            <div className="group">
              <input
                type="text"
                placeholder="Name, e.g. Back Squat"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoCapitalize="words"
                autoCorrect="off"
                enterKeyHint="done"
              />
            </div>
            <button type="submit" className="secondary-btn pressable" disabled={busy || !name.trim()}>
              <Plus size={18} />
              Add lift
            </button>
          </form>

          <h2 className="section-title">Library</h2>
          <section className="card">
            <p className="card-text">
              Workout lines that contain a lift name or alias show your numbers on Today. Scan your imported workouts to find
              movements that are not matched yet.
            </p>
            <button type="button" className="secondary-btn pressable" onClick={() => setScanning(true)}>
              <Search size={18} />
              Find lifts in my workouts
            </button>
            {lifts.lifts.length > 0 && missingDefaults > 0 && (
              <button type="button" className="secondary-btn pressable stacked" disabled={busy} onClick={onDefaults}>
                <Sparkles size={18} />
                Add common lifts ({missingDefaults} missing)
              </button>
            )}
            {message && <p className="status">{message}</p>}
          </section>
          {problem && <p className="error">{problem}</p>}
        </>
      )}
    </main>
  );
}
