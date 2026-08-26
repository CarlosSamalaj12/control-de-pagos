// src/App.tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Onboarding } from './routes/Onboarding';
import { Login } from './routes/Login';
import { Home } from './routes/Home';
import { NuevaSuscripcion } from './routes/suscripciones/NuevaSuscripcion';
import { EditarSuscripcion } from './routes/suscripciones/EditarSuscripcion';
import { PersonaSuscripcionDetalle } from './routes/suscripciones/PersonaSuscripcionDetalle';
import { CicloDetalle } from './routes/ciclos/CicloDetalle';
import { Deudas } from './routes/deudas/Deudas';
import { People } from './routes/people/People';
import { Configuracion } from './routes/Configuracion';
import { Presupuestos } from './routes/finanzas/Presupuestos';
import { initDb, getMode } from './db/client';
import { useCurrentProfile } from './hooks/useProfile';
import { useSessionStore } from './stores/useSessionStore';
import { checkVencimientos, canNotify } from './lib/notifications';

function Protected({ children }: { children: React.ReactNode }) {
  const currentProfileId = useSessionStore((s) => s.currentProfileId);
  if (!currentProfileId) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppContent() {
  const { profile, loading } = useCurrentProfile();
  const currentProfileId = useSessionStore((s) => s.currentProfileId);
  const refresh = useSessionStore((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (currentProfileId && canNotify()) {
      checkVencimientos();
    }
  }, [currentProfileId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isOnboarding = !profile;
  const showLogin = !isOnboarding && !currentProfileId;

  return (
    <Routes>
      {isOnboarding && <Route path="*" element={<Onboarding />} />}
      {showLogin && <Route path="*" element={<Login />} />}
      {!isOnboarding && currentProfileId && (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Home /></Protected>} />
          <Route path="/suscripciones/nueva" element={<Protected><NuevaSuscripcion /></Protected>} />
          <Route path="/suscripciones/:id" element={<Protected><EditarSuscripcion /></Protected>} />
          <Route path="/suscripciones/:id/persona/:peopleId" element={<Protected><PersonaSuscripcionDetalle /></Protected>} />
          <Route path="/ciclos/:id" element={<Protected><CicloDetalle /></Protected>} />
          <Route path="/deudas" element={<Protected><Deudas /></Protected>} />
          <Route path="/deudas/:peopleId" element={<Protected><Deudas /></Protected>} />
          <Route path="/people" element={<Protected><People /></Protected>} />
          <Route path="/configuracion" element={<Protected><Configuracion /></Protected>} />
          <Route path="/presupuestos" element={<Protected><Presupuestos /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'opfs' | 'idb' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const m = await initDb();
        setMode(m);
        setReady(true);
      } catch (e: any) {
        console.error('[init]', e);
        setError(e?.message ?? 'Error al inicializar la base de datos');
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <p className="text-xs text-slate-500">Tu navegador puede no soportar las APIs necesarias. Probá con Chrome, Edge o Firefox recientes.</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-primary to-brand-accent text-white">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <div className="text-lg font-semibold">Preparando base de datos local</div>
        <div className="text-sm text-white/70 mt-1">Cargando SQLite...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppContent />
      {mode === 'idb' && (
        <div className="fixed bottom-20 left-4 right-4 z-40 text-center">
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
            Modo compatibilidad (sin OPFS)
          </span>
        </div>
      )}
    </BrowserRouter>
  );
}
