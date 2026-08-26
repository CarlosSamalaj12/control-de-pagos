// src/components/cuentas/CuentasPagoCard.tsx
// Card "Datos para pago" que se renderiza dentro de Configuracion.
// Lista las cuentas del emisor, permite alta/edición/borrado y
// marcar una como predeterminada con la estrella.
import { useState } from 'react';
import { Plus, Pencil, Trash2, Star, Wallet } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useUIStore } from '../../stores/useUIStore';
import {
  useCuentasPago,
  createCuentaPago,
  updateCuentaPago,
  deleteCuentaPago,
  setCuentaPredeterminada,
} from '../../hooks/useCuentasPago';
import { TIPO_CUENTA_LABEL, type CuentaPago, type TipoCuentaPago } from '../../types';
import { CuentaPagoFormModal } from './CuentaPagoFormModal';

export interface CuentasPagoCardProps {
  /** `peopleId` del emisor (is_self=1). Si es null, no se muestra el card. */
  peopleId: string | null;
}

export function CuentasPagoCard({ peopleId }: CuentasPagoCardProps) {
  const showToast = useUIStore((s) => s.showToast);
  const { cuentas, loading } = useCuentasPago(peopleId);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<CuentaPago | null>(null);

  if (!peopleId) return null;

  const handleSave = async (data: {
    banco: string;
    tipo: TipoCuentaPago;
    numero: string;
    predeterminada: boolean;
  }) => {
    try {
      if (editing) {
        await updateCuentaPago(editing.id, data);
        showToast('Cuenta actualizada', 'success');
      } else {
        await createCuentaPago({ peopleId, ...data });
        showToast('Cuenta agregada', 'success');
      }
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar', 'error');
      throw e;
    }
  };

  const handleDelete = async (c: CuentaPago) => {
    if (!confirm(`¿Eliminar la cuenta de ${c.banco}?`)) return;
    try {
      await deleteCuentaPago(c.id);
      showToast('Cuenta eliminada', 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Error al eliminar', 'error');
    }
  };

  const handleTogglePredeterminada = async (c: CuentaPago) => {
    if (c.predeterminada) return; // ya es predeterminada, noop
    try {
      await setCuentaPredeterminada(c.id);
    } catch (e: any) {
      showToast(e?.message ?? 'Error al marcar predeterminada', 'error');
    }
  };

  return (
    <Card>
      <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3 flex items-center gap-2">
        <Wallet size={14} className="text-slate-500" />
        Datos para pago
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Aparecen en el pie del PDF de "Estado de cuenta" para que el deudor
        sepa dónde transferir. Podés agregar varias cuentas.
      </p>

      {loading && cuentas.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-3">Cargando…</div>
      ) : cuentas.length === 0 ? (
        <div className="text-sm text-slate-500 text-center py-3 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          No tenés cuentas cargadas. Agregá una para que aparezca en tus
          estados de cuenta.
        </div>
      ) : (
        <div className="space-y-2">
          {cuentas.map((c) => (
            <CuentaPagoRow
              key={c.id}
              cuenta={c}
              onEditar={() => setEditing(c)}
              onBorrar={() => handleDelete(c)}
              onTogglePredeterminada={() => handleTogglePredeterminada(c)}
            />
          ))}
        </div>
      )}

      <div className="mt-3">
        <Button fullWidth variant="secondary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> Agregar cuenta
        </Button>
      </div>

      <CuentaPagoFormModal
        key="new"
        open={showNew}
        initial={null}
        esUnica={cuentas.length === 0}
        onClose={() => setShowNew(false)}
        onSave={handleSave}
      />
      <CuentaPagoFormModal
        key={editing?.id ?? 'edit-none'}
        open={editing !== null}
        initial={editing}
        esUnica={cuentas.length <= 1}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </Card>
  );
}

function CuentaPagoRow({
  cuenta,
  onEditar,
  onBorrar,
  onTogglePredeterminada,
}: {
  cuenta: CuentaPago;
  onEditar: () => void;
  onBorrar: () => void;
  onTogglePredeterminada: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
      <button
        type="button"
        onClick={onTogglePredeterminada}
        disabled={cuenta.predeterminada}
        title={cuenta.predeterminada ? 'Predeterminada' : 'Marcar como predeterminada'}
        className={`shrink-0 p-1.5 rounded-full transition ${
          cuenta.predeterminada
            ? 'text-amber-500'
            : 'text-slate-300 hover:text-amber-500'
        }`}
        aria-label="Marcar como predeterminada"
      >
        <Star
          size={18}
          strokeWidth={2}
          fill={cuenta.predeterminada ? 'currentColor' : 'none'}
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate flex items-center gap-1.5">
          {cuenta.banco}
          {cuenta.predeterminada && (
            <Badge variant="warning" className="!text-[10px] !py-0">
              predeterminada
            </Badge>
          )}
        </div>
        <div className="text-xs text-slate-500 truncate flex items-center gap-1.5">
          <span>{TIPO_CUENTA_LABEL[cuenta.tipo]}</span>
          <span>·</span>
          <span className="tabular-nums">{cuenta.numero}</span>
        </div>
      </div>
      <button
        onClick={onEditar}
        className="p-2 text-slate-500 hover:text-brand-primary"
        aria-label="Editar"
        title="Editar"
      >
        <Pencil size={15} />
      </button>
      <button
        onClick={onBorrar}
        className="p-2 text-slate-500 hover:text-red-500"
        aria-label="Eliminar"
        title="Eliminar"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
