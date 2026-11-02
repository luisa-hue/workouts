import { useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogOut, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkoutIndex } from '../lib/index-context';
import { importWorkouts, type ImportSummary } from '../lib/importer';
import { formatMedium } from '../lib/dates';
import Segmented from '../components/Segmented';
import PlanSettings from '../components/PlanSettings';
import { usePlans } from '../lib/plans-context';
import { THEMES, loadTheme, saveTheme, type Theme } from '../lib/theme';

type Status = { kind: 'idle' } | { kind: 'working'; message: string } | { kind: 'done'; summary: ImportSummary } | { kind: 'error'; message: string };

export default function Settings({ session }: { session: Session }) {
  const index = useWorkoutIndex();
  const hasPlan = usePlans().plan !== null;
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [theme, setTheme] = useState<Theme>(loadTheme);

  function changeTheme(t: Theme) {
    setTheme(t);
    saveTheme(t);
  }

  async function onFiles(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (fileInput.current) fileInput.current.value = '';
    if (files.length === 0) return;
    try {
      setStatus({ kind: 'working', message: 'Starting…' });
      const summary = await importWorkouts(files, session.user.id, (message) => setStatus({ kind: 'working', message }));
      await index.refresh();
      setStatus({ kind: 'done', summary });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Import failed.' });
    }
  }

  const working = status.kind === 'working';

  return (
    <main>
      <header className="page-head">
        <h1 className="large-title">Settings</h1>
      </header>

      <h2 className="section-title">Appearance</h2>
      <Segmented options={THEMES} value={theme} onChange={changeTheme} label="Appearance" />

      <PlanSettings />

      {!hasPlan && (
        <>
        <h2 className="section-title">Library</h2>
        <section className="card list">
          <div className="row">
            <span>Workouts</span>
            <span className="muted">{index.loading ? '…' : index.total}</span>
          </div>
          <div className="row">
            <span>Range</span>
            <span className="muted">
              {index.min && index.max ? `${formatMedium(index.min)} to ${formatMedium(index.max)}` : 'None yet'}
            </span>
          </div>
          {index.min && index.max && (
            <div className="row">
              <span>After that</span>
              <span className="muted">Restarts at {formatMedium(index.min)}</span>
            </div>
          )}
        </section>

        <h2 className="section-title">Import</h2>
        <section className="card">
          <p className="card-text">
            Choose one or more workout JSON files. Workouts already in the app are skipped, so you can safely re-import
            overlapping files.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            multiple
            hidden
            onChange={(e) => void onFiles(e.target.files)}
          />
          <button type="button" className="primary-btn pressable" disabled={working} onClick={() => fileInput.current?.click()}>
            <Upload size={18} />
            {working ? 'Importing…' : 'Choose JSON files'}
          </button>

          {status.kind === 'working' && <p className="status">{status.message}</p>}
          {status.kind === 'error' && <p className="error">{status.message}</p>}
          {status.kind === 'done' && (
            <div className="status done">
              <p>
                <strong>{status.summary.added}</strong> new {status.summary.added === 1 ? 'workout' : 'workouts'} added.
              </p>
              <p className="muted">
                {status.summary.existing} already in the app
                {status.summary.invalid > 0 ? `, ${status.summary.invalid} skipped (missing uid, date or program)` : ''}
                {status.summary.repeatedInFiles > 0 ? `, ${status.summary.repeatedInFiles} repeated across files` : ''}.
              </p>
            </div>
          )}
        </section>
        </>
      )}

      <h2 className="section-title">Account</h2>
      <section className="card list">
        <div className="row">
          <span>Signed in as</span>
          <span className="muted">{session.user.email}</span>
        </div>
        <button type="button" className="row action pressable" onClick={() => void supabase.auth.signOut()}>
          <span>Sign out</span>
          <LogOut size={18} />
        </button>
      </section>
    </main>
  );
}
