import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase } from './lib/supabase';
import { IndexProvider } from './lib/index-context';
import { LiftsProvider } from './lib/lifts-context';
import { LogsProvider } from './lib/logs-context';
import { PlansProvider, usePlans } from './lib/plans-context';
import TabBar, { type Tab } from './components/TabBar';
import Login from './screens/Login';
import Today from './screens/Today';
import PlanToday from './screens/PlanToday';
import PRs from './screens/PRs';
import Settings from './screens/Settings';
import Calculator from './screens/Calculator';

function Shell({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('today');
  const [todayTap, setTodayTap] = useState(0);
  const plans = usePlans();

  function changeTab(next: Tab) {
    // Tapping Today, even when already there, jumps back to the current date.
    if (next === 'today') setTodayTap((n) => n + 1);
    setTab(next);
    window.scrollTo(0, 0);
  }

  return (
    <div className="app">
      {/* Today stays mounted so its date and program survive tab switches.
          A user with a gym plan (xlsx) gets the plan view; everyone else keeps the PushPress view. */}
      <div hidden={tab !== 'today'}>
        {plans.loading ? (
          <main>
            <p className="loading">Loading…</p>
          </main>
        ) : plans.plan ? (
          <PlanToday onGoSettings={() => changeTab('settings')} jumpToToday={todayTap} />
        ) : (
          <Today onGoSettings={() => changeTab('settings')} jumpToToday={todayTap} />
        )}
      </div>
      {/* PRs stays mounted too, so an open lift survives tab switches. */}
      <div hidden={tab !== 'prs'}>
        <PRs />
      </div>
      {tab === 'calculator' && <Calculator />}
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
        <LogsProvider>
          <PlansProvider>
            <Shell session={session} />
          </PlansProvider>
        </LogsProvider>
      </LiftsProvider>
    </IndexProvider>
  );
}
