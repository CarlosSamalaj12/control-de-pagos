// src/stores/useConfigStore.ts
import { create } from 'zustand';

type Tema = 'light' | 'dark' | 'system';

interface ConfigState {
  tema: Tema;
  setTema: (t: Tema) => void;
  notificaciones: boolean;
  setNotificaciones: (v: boolean) => void;
  diasAnticipacion: number;
  setDiasAnticipacion: (n: number) => void;
}

const STORAGE_KEY = 'config:ui';

function loadConfig(): Partial<ConfigState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveConfig(s: ConfigState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tema: s.tema,
        notificaciones: s.notificaciones,
        diasAnticipacion: s.diasAnticipacion,
      })
    );
  } catch {
    /* noop */
  }
}

const initial = loadConfig();

export const useConfigStore = create<ConfigState>((set, get) => ({
  tema: initial.tema ?? 'system',
  notificaciones: initial.notificaciones ?? false,
  diasAnticipacion: initial.diasAnticipacion ?? 3,
  setTema: (t) => {
    set({ tema: t });
    saveConfig(get());
    applyTema(t);
  },
  setNotificaciones: (v) => {
    set({ notificaciones: v });
    saveConfig(get());
  },
  setDiasAnticipacion: (n) => {
    set({ diasAnticipacion: n });
    saveConfig(get());
  },
}));

function applyTema(t: Tema) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const sysDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const isDark = t === 'dark' || (t === 'system' && sysDark);
  root.classList.toggle('dark', isDark);
}

// Aplicar al cargar
if (typeof document !== 'undefined') {
  applyTema(useConfigStore.getState().tema);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    applyTema(useConfigStore.getState().tema);
  });
}
