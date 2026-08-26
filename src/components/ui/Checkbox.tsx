// src/components/ui/Checkbox.tsx
// Checkbox con animación Apple-style:
//   - scale al click (0.85)
//   - bounce al activarse (1.0 → 1.15 → 1.0 con cubic-bezier)
//   - tilde que entra con scale + rotación
//   - color de fondo y borde con transición suave
//   - focus ring accesible
//
// Mantiene la API de un checkbox estándar (checked, onChange, disabled).
import { Check, Minus } from 'lucide-react';

export interface CheckboxProps {
  checked: boolean;
  /** Si se pasa, se renderiza como "indeterminado" (un guion en vez de tilde). */
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Etiqueta accesible opcional. */
  ariaLabel?: string;
  /** Tamaño: sm (16px) o md (22px). */
  size?: 'sm' | 'md';
}

export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  ariaLabel,
  size = 'md',
}: CheckboxProps) {
  const dim = size === 'sm' ? 'w-4 h-4' : 'w-[22px] h-[22px]';
  const iconSize = size === 'sm' ? 10 : 14;
  const estadoActivo = checked || indeterminate;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onChange(!checked);
      }}
      className={[
        'inline-flex items-center justify-center rounded-md',
        'border-2 transition-all duration-200',
        'active:scale-[0.85] disabled:opacity-50 disabled:cursor-not-allowed',
        // Box clickable un poco más grande que la caja visible para
        // mejor UX en mobile (sin afectar el layout).
        '-m-1.5 p-1.5',
        dim,
        estadoActivo
          ? 'bg-brand-primary border-brand-primary shadow-sm shadow-brand-primary/30'
          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-brand-accent',
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex items-center justify-center text-white',
          'transition-transform duration-200 ease-out',
          size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5',
          // Animación: el tilde entra con scale 0 → 1 + rotación, y hace un
          // pequeño bounce (overshoot) cuando aparece.
          estadoActivo
            ? 'opacity-100 scale-100 rotate-0'
            : 'opacity-0 scale-50 -rotate-90',
        ].join(' ')}
        style={{
          // Spring/overshoot: cubic-bezier que pasa de 1 a 1.15 a 1 (bounce)
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {indeterminate ? <Minus size={iconSize} strokeWidth={3} /> : <Check size={iconSize} strokeWidth={3.5} />}
      </span>
    </button>
  );
}
