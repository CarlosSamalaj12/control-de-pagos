// src/routes/Home.tsx
import { AppShell } from '../components/layout/AppShell';
import { useUIStore } from '../stores/useUIStore';
import { DashboardTab } from './tabs/DashboardTab';
import { CompartidasTab } from './tabs/CompartidasTab';
import { FinanzasTab } from './tabs/FinanzasTab';
import { HistorialTab } from './tabs/HistorialTab';
import { MasTab } from './tabs/MasTab';

export function Home() {
  const tab = useUIStore((s) => s.tab);
  return (
    <AppShell>
      {tab === 'inicio' && <DashboardTab />}
      {tab === 'compartidas' && <CompartidasTab />}
      {tab === 'finanzas' && <FinanzasTab />}
      {tab === 'historial' && <HistorialTab />}
      {tab === 'mas' && <MasTab />}
    </AppShell>
  );
}
