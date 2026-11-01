import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase } from './lib/supabase';
import { IndexProvider } from './lib/index-context';
import { LiftsProvider } from './lib/lifts-context';
import TabBar, { type Tab } from './components/TabBar';
import Login from './screens/Login';
import Today from './screens/Today';
import PRs from './screens/PRs';
import Settings from './screens/Settings';
import Placeholder from './screens/Placeholder';

function Shell({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('today');

  function changeTab(next: Tab) {
    setTab(next);
    window.scrollTo(0, 0);
  }

  return (
    <div className="app">
      {/* Today stays mounted so its date and program survive tab switches. */}
      <div hidden={tab !== 'today'}>
        <Today onGoSettings={() => changeTab('settings')} />
      </div>
      {/* PRs stays mounted too, so an open lift survives tab switches. */}
      <div hidden={tab !== 'prs'}>
        <PRs />
      </div>
      {tab === 'calculator' && <Placeholder title="Calculator" note="RM calculator and percentages arrive in the last stage." />}
      {tab === 'settings' && <Settings session={session} />}
      <TabBar tab={tab} onChange={changeTab} />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!configured) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <main className="login">
        <h1 className="large-title">Setup needed</h1>
        <p className="subtitle">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> as environment variables in Vercel,
          then redeploy.
        </p>
      </main>
    );
  }
  if (session === undefined) return <main className="login" />;
  if (!session) return <Login />;
  return (
    <IndexProvider>
      <LiftsProvider>
        <Shell session={session} />
      </LiftsProvider>
    </IndexProvider>
  );
}
