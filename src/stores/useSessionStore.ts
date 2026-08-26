// src/stores/useSessionStore.ts
// Single-profile: no hay "switcher" entre perfiles. Solo el PIN del usuario actual.
import { create } from 'zustand';
import { getSession, setSession, clearSession } from '../lib/auth/session';
import { verifyPIN } from '../lib/auth/pin';
import { isLocked, recordFailedAttempt, resetAttempts } from '../lib/auth/lockout';
import { getDb } from '../db/client';

interface SessionState {
  currentProfileId: string | null;
  login: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refresh: () => void;
  isLocked: () => { locked: boolean; remainingMs?: number };
}

export const useSessionStore = create<SessionState>((set) => ({
  currentProfileId: getSession(),

  refresh: () => {
    set({ currentProfileId: getSession() });
  },

  logout: () => {
    clearSession();
    set({ currentProfileId: null });
  },

  isLocked: () => isLocked(),

  login: async (pin) => {
    const lockState = isLocked();
    if (lockState.locked) {
      const sec = Math.ceil((lockState.remainingMs ?? 0) / 1000);
      return { ok: false, error: `Bloqueado. Probá en ${sec}s.` };
    }
    if (!/^\d{4,6}$/.test(pin)) {
      return { ok: false, error: 'PIN inválido (4-6 dígitos).' };
    }

    // Traer el hash del profile (único)
    const row = getDb().selectArray(
      'SELECT id, pin_hash FROM profiles ORDER BY created_at LIMIT 1'
    );
    if (!row || row.length === 0) {
      return { ok: false, error: 'No hay perfil configurado.' };
    }
    const profileId = row[0] as string;
    const hash = row[1] as string;

    const ok = await verifyPIN(pin, hash);
    if (!ok) {
      recordFailedAttempt();
      const lock = isLocked();
      if (lock.locked) {
        const sec = Math.ceil((lock.remainingMs ?? 0) / 1000);
        return { ok: false, error: `PIN incorrecto. Bloqueado por ${sec}s.` };
      }
      return { ok: false, error: 'PIN incorrecto.' };
    }

    resetAttempts();
    setSession(profileId, 24);
    set({ currentProfileId: profileId });
    return { ok: true };
  },
}));
