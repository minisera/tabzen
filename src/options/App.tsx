import { useEffect, type ComponentType } from 'react';
import {
  History as HistoryIcon,
  Info,
  Keyboard,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useHashRoute } from '@/shared/hooks/useHashRoute';
import { useSettingsStore } from '@/shared/stores/settings-store';
import { General } from './pages/General';
import { Allowlist } from './pages/Allowlist';
import { Shortcuts } from './pages/Shortcuts';
import { History } from './pages/History';
import { About } from './pages/About';

interface NavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  Page: ComponentType;
}

const NAV: NavItem[] = [
  { id: 'general', label: '一般', icon: Sliders, Page: General },
  { id: 'allowlist', label: '除外ドメイン', icon: ShieldCheck, Page: Allowlist },
  { id: 'shortcuts', label: 'ショートカット', icon: Keyboard, Page: Shortcuts },
  { id: 'history', label: '復元履歴', icon: HistoryIcon, Page: History },
  { id: 'about', label: 'About', icon: Info, Page: About },
];

export default function App() {
  const [route, navigate] = useHashRoute('general');
  const load = useSettingsStore((s) => s.load);
  const current = NAV.find((n) => n.id === route) ?? NAV[0];
  const CurrentPage = current.Page;

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto p-6 flex gap-6">
        <aside className="w-56 shrink-0">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-semibold">Tab Tidy</h1>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => navigate(n.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors',
                    route === n.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {n.label}
                </button>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <CurrentPage />
        </main>
      </div>
    </div>
  );
}
