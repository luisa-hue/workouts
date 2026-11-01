import { Calculator, Dumbbell, Settings, Trophy, type LucideIcon } from 'lucide-react';

export type Tab = 'today' | 'prs' | 'calculator' | 'settings';

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', Icon: Dumbbell },
  { id: 'prs', label: 'PRs', Icon: Trophy },
  { id: 'calculator', label: 'Calculator', Icon: Calculator },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={id === tab ? 'tab active' : 'tab'}
            aria-current={id === tab ? 'page' : undefined}
            onClick={() => onChange(id)}
          >
            <Icon size={24} strokeWidth={id === tab ? 2.4 : 1.9} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
