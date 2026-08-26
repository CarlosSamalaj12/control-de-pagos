// src/components/ui/PinInput.tsx
import { type ReactNode } from 'react';

interface PinInputProps {
  length: number;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
}

export function PinInput({ length, value, onChange, onComplete }: PinInputProps) {
  const slots = Array.from({ length }, (_, i) => value[i] ?? '');
  return (
    <div className="flex items-center justify-center gap-3">
      {slots.map((s, i) => (
        <div
          key={i}
          className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold ${
            s
              ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-300'
          }`}
        >
          {s ? '•' : ''}
        </div>
      ))}
    </div>
  );
}

interface NumericKeypadProps {
  onKey: (key: string) => void;
  disabled?: boolean;
}

export function NumericKeypad({ onKey, disabled }: NumericKeypadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado numérico">
      {keys.map((k) => {
        const label = k === 'del' ? '⌫' : k === 'ok' ? 'OK' : k;
        return (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => onKey(k)}
            className={`h-14 rounded-2xl text-xl font-semibold active:scale-95 transition ${
              k === 'ok'
                ? 'bg-brand-primary text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
            } disabled:opacity-50`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
