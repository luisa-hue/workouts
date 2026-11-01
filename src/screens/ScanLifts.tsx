import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useLifts } from '../lib/lifts-context';
import { scanForLifts, type Candidate } from '../lib/scan';

const NEW = '__new__';

export default function ScanLifts({ onBack }: { onBack: () => void }) {
  const lifts = useLifts();
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('Starting…');
  const [found, setFound] = useState<Candidate[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);
  const matcherRef = useRef(lifts.matcher);
  matcherRef.current = lifts.matcher;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    scanForLifts(matcherRef.current, setMessage)
      .then((list) => {
        setFound(list);
        setStatus('done');
      })
      .catch((e: unknown) => {
        setMessage(e instanceof Error ? e.message : 'Scan failed.');
        setStatus('error');
      });
  }, []);

  async function choose(c: Candidate, target: string) {
    if (!target) return;
    setProblem(null);
    try {
      if (target === NEW) await lifts.addLift(c.name);
      else await lifts.addAlias(target, c.name);
      setFound((list) => list.filter((x) => x.key !== c.key));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  return (
    <main>
      <button type="button" className="back-btn pressable" onClick={onBack}>
        <ChevronLeft size={22} />
        PRs
      </button>
      <header className="page-head">
        <div>
          <h1 className="large-title">Find lifts</h1>
          <p className="subtitle">Movements in your workouts that no lift matches yet.</p>
        </div>
      </header>

      {status === 'working' && <p className="loading">{message}</p>}
      {status === 'error' && <p className="error">{message}</p>}
      {problem && <p className="error">{problem}</p>}

      {status === 'done' && found.length === 0 && (
        <section className="card empty">
          <p className="empty-title">Nothing left to match</p>
          <p className="empty-text">Every movement that appears at least twice already belongs to a lift.</p>
        </section>
      )}

      {status === 'done' && found.length > 0 && (
        <>
          <p className="card-text scan-help">
            Pick what each one is. Barbell lifts become a new lift. Another name for a lift you already have becomes an alias.
            Skip anything that is not a lift.
          </p>
          <section className="card list">
            {found.map((c) => (
              <div key={c.key} className="row scan-row">
                <span className="scan-text">
                  <span className="scan-name">{c.name}</span>
                  <span className="scan-meta">
                    {c.count} lines · {c.example}
                  </span>
                </span>
                <select className="scan-select" value="" aria-label={`What is ${c.name}?`} onChange={(e) => void choose(c, e.target.value)}>
                  <option value="">Choose…</option>
                  <option value={NEW}>New lift</option>
                  {lifts.lifts.map((l) => (
                    <option key={l.id} value={l.id}>
                      Alias of {l.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
