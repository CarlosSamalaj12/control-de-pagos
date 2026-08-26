// src/components/cuentas/CuentaPagoFormModal.tsx
// Modal de alta/edición de una cuenta de pago del emisor.
// Patrón: el padre controla `open` + pasa `initial` (null = alta).
// Tras guardar, llama a `onSave` y cierra.
import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Input';
import { Checkbox } from '../ui/Checkbox';
import { TIPO_CUENTA_LABEL, type CuentaPago, type TipoCuentaPago } from '../../types';

export interface CuentaPagoFormModalProps {
  open: boolean;
  /** null = alta. Objeto = edición (el id viaja dentro). */
  initial: CuentaPago | null;
  /** Si es la única cuenta del emisor, la hacemos predeterminada sin
   *  permitir destildarla (UX: la primera siempre es la principal). */
  esUnica: boolean;
  onClose: () => void;
  onSave: (data: {
    banco: string;
    tipo: TipoCuentaPago;
    numero: string;
    predeterminada: boolean;
  }) => Promise<void> | void;
}

const TIPOS: TipoCuentaPago[] = ['ahorro', 'monetaria', 'tarjeta', 'otra'];

export function CuentaPagoFormModal({
  open,
  initial,
  esUnica,
  onClose,
  onSave,
}: CuentaPagoFormModalProps) {
  const [banco, setBanco] = useState(initial?.banco ?? '');
  const [tipo, setTipo] = useState<TipoCuentaPago>(initial?.tipo ?? 'ahorro');
  const [numero, setNumero] = useState(initial?.numero ?? '');
  const [predeterminada, setPredeterminada] = useState<boolean>(
    initial?.predeterminada ?? esUnica
  );
  const [saving, setSaving] = useState(false);

  // Reset al cambiar `initial` o `open` (así un "Editar" → cerrar →
  // "Agregar" no arrastra el estado de la edición anterior).
  useEffect(() => {
    if (open) {
      setBanco(initial?.banco ?? '');
      setTipo(initial?.tipo ?? 'ahorro');
      setNumero(initial?.numero ?? '');
      setPredeterminada(initial?.predeterminada ?? esUnica);
      setSaving(false);
    }
  }, [open, initial, esUnica]);

  const puedeGuardar = banco.trim().length > 0 && numero.trim().length > 0;

  const handleSave = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      await onSave({
        banco: banco.trim(),
        tipo,
        numero: numero.trim(),
        predeterminada: esUnica ? true : predeterminada,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar cuenta' : 'Agregar cuenta'}>
      <div className="space-y-3">
        <Field label="Banco">
          <Input
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            placeholder="Ej. Banrural, BAM, G&T..."
            autoFocus
          />
        </Field>
        <Field label="Tipo de cuenta">
          <select
            className="input"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCuentaPago)}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_CUENTA_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Número de cuenta">
          <Input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="1234 5678 9012 3456"
            inputMode="text"
            autoComplete="off"
          />
        </Field>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            checked={predeterminada}
            disabled={esUnica}
            onChange={(v) => setPredeterminada(v)}
            ariaLabel="Marcar como predeterminada"
          />
          <label
            className={`text-sm select-none ${esUnica ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}
          >
            Predeterminada{esUnica ? ' (única cuenta)' : ''}
          </label>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button fullWidth onClick={handleSave} disabled={!puedeGuardar} loading={saving}>
            {initial ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
