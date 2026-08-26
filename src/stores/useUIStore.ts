// src/stores/useUIStore.ts
import { create } from 'zustand';

type TabKey = 'inicio' | 'compartidas' | 'finanzas' | 'historial' | 'mas';

interface UIState {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  toast: { id: number; message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

let _toastId = 0;

export const useUIStore = create<UIState>((set) => ({
  tab: 'inicio',
  setTab: (t) => set({ tab: t }),
  toast: null,
  showToast: (message, type = 'success') => {
    const id = ++_toastId;
    set({ toast: { id, message, type } });
    setTimeout(() => {
      if (useUIStore.getState().toast?.id === id) {
        set({ toast: null });
      }
    }, 3000);
  },
}));
