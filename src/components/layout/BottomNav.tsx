// src/components/layout/BottomNav.tsx
import { Home, Users, Wallet, History, MoreHorizontal } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';

const TABS = [
  { key: 'inicio',       label: 'Inicio',       icon: Home },
  { key: 'compartidas',  label: 'Compartidas',  icon: Users },
  { key: 'finanzas',     label: 'Finanzas',     icon: Wallet },
  { key: 'historial',    label: 'Historial',    icon: History },
  { key: 'mas',          label: 'Más',          icon: MoreHorizontal },
] as const;

export function BottomNav() {
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`flex flex-col items-center justify-center py-2 active:scale-95 transition ${
                active ? 'text-brand-primary' : 'text-slate-400'
              }`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] mt-1 ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
