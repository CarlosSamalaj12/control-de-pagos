// src/components/ui/BarraAccionesFlotante.tsx
// Barra inferior fija que aparece cuando hay un modo selección activo.
// Se renderiza encima del BottomNav (z-40) y muestra el contador de
// seleccionados + botones de acción (cobrar / cancelar).
import { CircleDollarSign, X } from 'lucide-react';
import { Button } from './Button';

interface BarraAccionesFlotanteProps {
  count: number;
  /** Texto del CTA principal. Default: "Cobrar a N". */
  ctaLabel?: string;
  /** Si el CTA está deshabilitado (e.g. count = 0). */
  ctaDisabled?: boolean;
  onCta: () => void;
  onCancel: () => void;
}

export function BarraAccionesFlotante({
  count,
  ctaLabel,
  ctaDisabled,
  onCta,
  onCancel,
}: BarraAccionesFlotanteProps) {
  const label = ctaLabel ?? `Cobrar a ${count}`;
  return (
    <div
      className="fixed inset-x-0 bottom-16 z-40 flex justify-center pointer-events-none px-3 pb-2"
      role="region"
      aria-label="Acciones de selección"
    >
      <div className="pointer-events-auto bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-soft-lg flex items-center gap-2 pl-3 pr-2 py-2 max-w-md w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-sm shrink-0">
            {count}
          </div>
          <div className="text-sm font-semibold truncate">
            {count === 1 ? '1 seleccionado' : `${count} seleccionados`}
          </div>
        </div>
        <Button
          size="sm"
          onClick={onCta}
          disabled={ctaDisabled || count === 0}
          className="!py-2"
        >
          <CircleDollarSign size={16} /> {label}
        </Button>
        <button
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-slate-700 dark:hover:bg-slate-600 text-slate-200"
          aria-label="Cancelar selección"
          title="Cancelar"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
