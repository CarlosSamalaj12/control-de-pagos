// src/components/ui/DatePicker.tsx
// Picker de fecha con un botón visible y clickeable. El input nativo
// está oculto (pero no display:none) y se abre programáticamente con
// showPicker() al tocar el botón. Así tenemos control total sobre la
// apariencia del trigger (icono, color, hover, press) y el picker
// nativo sigue funcionando (mejor UX móvil que cualquier custom calendar).
import { forwardRef, useRef, type InputHTMLAttributes } from 'react';
import { Calendar } from 'lucide-react';
import { formatDate } from '../../lib/format';

export interface DatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'size'> {
  value: string;
  onChange: (v: string) => void;
  /** Máximo en formato 'yyyy-MM-dd' (opcional, nativo del input). */
  max?: string;
  /** Mínimo en formato 'yyyy-MM-dd' (opcional). */
  min?: string;
  /** Etiqueta opcional arriba del picker. */
  label?: string;
  /** Tamaño visual del botón: 'md' (default) o 'lg'. */
  pickerSize?: 'md' | 'lg';
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(
    { value, onChange, max, min, label, pickerSize = 'md', className = '', ...rest },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    // Combinar el ref interno con el externo
    const setRefs = (el: HTMLInputElement | null) => {
      inputRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as any).current = el;
    };

    const abrirPicker = () => {
      const el = inputRef.current;
      if (!el) return;
      // showPicker() es estándar en navegadores modernos; si no existe,
      // caemos al focus() (que abre el picker en la mayoría).
      try {
        if (typeof (el as any).showPicker === 'function') {
          (el as any).showPicker();
          return;
        }
      } catch {
        // ignore — algunos navegadores lanzan si no es user gesture
      }
      el.focus();
    };

    // Para mostrar algo legible cuando hay valor, usamos formatDate
    // con el timestamp; si no hay valor, mostramos placeholder.
    let textoLegible = '';
    if (value) {
      const ts = new Date(`${value}T12:00:00`).getTime();
      if (!Number.isNaN(ts)) textoLegible = formatDate(ts);
    }

    const sizeClass =
      pickerSize === 'lg' ? 'h-14 text-base px-4' : 'h-12 text-sm px-3';

    return (
      <div className="w-full">
        {label && (
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1 block">
            {label}
          </label>
        )}
        <div className={`relative flex items-stretch w-full`}>
          {/* Input nativo, invisible pero funcional. */}
          <input
            ref={setRefs}
            type="date"
            value={value}
            max={max}
            min={min}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
            {...rest}
          />
          {/* Botón custom que muestra el valor. */}
          <button
            type="button"
            onClick={abrirPicker}
            className={`w-full ${sizeClass} rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 flex items-center justify-between text-left transition-all duration-200 active:scale-[0.985] hover:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/40 focus:border-brand-accent ${className}`}
          >
            <span
              className={
                textoLegible
                  ? 'text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-400'
              }
            >
              {textoLegible || 'Elegir fecha'}
            </span>
            <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
              <Calendar size={pickerSize === 'lg' ? 18 : 16} strokeWidth={2} />
            </span>
          </button>
        </div>
      </div>
    );
  }
);
