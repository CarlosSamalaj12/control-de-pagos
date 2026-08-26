// src/components/suscripcion/ModalCobroRapido.tsx
// Modal reusable para registrar UN pago de una persona a un ciclo.
// Usado desde:
//   - CicloDetalle (botón "Pagar"/"Completar" en cada participante)
//   - CompartidasTab (botón inline "💰" en cada fila de participante)
//   - Deudas (botón por ciclo en la lista de adeudos)
//
// Si se pasa `defaultPeopleId`, el selector de persona queda
// pre-seleccionado y se oculta. Si no, se muestra un select con las
// personas disponibles (todos los people del profile + el resto de
// participantes del ciclo).
import { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Input';
import { DatePicker } from '../ui/DatePicker';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { usePeople } from '../../hooks/useProfile';
import { useUIStore } from '../../stores/useUIStore';
import {
  formatCurrency,
  formatDate,
  toInputDate,
  inputDateToTimestamp,
  getPeriodoLabel,
} from '../../lib/format';
import { registrarPago } from '../../hooks/useSuscripciones';
import type { Moneda } from '../../types';

export interface ParticipanteLite {
  peopleId: string;
  nombre: string;
  iniciales: string;
  color: string;
  isSelf: boolean;
  cuotaEsperada: number;
  montoPagado: number;
  falta: number;
  estado: 'completo' | 'parcial' | 'pendiente' | 'sin_cuota';
}

interface ModalCobroRapidoProps {
  open: boolean;
  onClose: () => void;
  cicloId: string;
  /** Subscription label shown in the header (e.g. "Netflix · Julio 2026"). */
  contexto: string;
  moneda: Moneda;
  /** Participantes del ciclo (se usa para armar el selector si no hay defaultPeopleId). */
  participantes?: ParticipanteLite[];
  /** Pre-selecciona esta persona (y oculta el selector). */
  defaultPeopleId?: string | null;
  /** Pre-llena el monto (típicamente: lo que falta pagar). */
  defaultMonto?: number;
  /** Callback al guardar exitosamente. */
  onSaved?: () => void;
}

export function ModalCobroRapido({
  open,
  onClose,
  cicloId,
  contexto,
  moneda,
  participantes = [],
  defaultPeopleId = null,
  defaultMonto,
  onSaved,
}: ModalCobroRapidoProps) {
  const showToast = useUIStore((s) => s.showToast);
  const { people } = usePeople();

  // Opciones para el selector: primero los participantes del ciclo (orden:
  // pendientes, parciales, completos), después el resto de las personas.
  const opcionesPersona = useMemo(() => {
    if (participantes.length > 0) {
      const ordenados = [...participantes].sort((a, b) => {
        if (a.estado !== b.estado) {
          const order = { pendiente: 0, parcial: 1, sin_cuota: 2, completo: 3 };
          return order[a.estado] - order[b.estado];
        }
        return a.nombre.localeCompare(b.nombre);
      });
      return ordenados;
    }
    return people.map((p: any) => ({
      peopleId: p.id,
      nombre: p.nombre,
      iniciales: p.iniciales,
      color: p.color,
      isSelf: !!p.is_self,
      cuotaEsperada: 0,
      montoPagado: 0,
      falta: 0,
      estado: 'sin_cuota' as const,
    }));
  }, [participantes, people]);

  const initialId =
    defaultPeopleId ??
    opcionesPersona.find((p) => p.estado === 'pendiente')?.peopleId ??
    opcionesPersona.find((p) => p.estado === 'parcial')?.peopleId ??
    opcionesPersona[0]?.peopleId ??
    '';

  const [peopleId, setPeopleId] = useState<string>(initialId);
  const [monto, setMonto] = useState<string>(() => {
    if (defaultMonto && defaultMonto > 0) return String(defaultMonto);
    const p = opcionesPersona.find((x) => x.peopleId === initialId);
    if (p && p.falta > 0) return String(p.falta);
    return '';
  });
  const [fecha, setFecha] = useState<string>(toInputDate(new Date()));
  const [nota, setNota] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const participanteActual = opcionesPersona.find((p) => p.peopleId === peopleId);
  const sugerido =
    participanteActual && participanteActual.falta > 0
      ? participanteActual.falta
      : null;

  const handlePersonaChange = (id: string) => {
    setPeopleId(id);
    const p = opcionesPersona.find((x) => x.peopleId === id);
    if (p && p.falta > 0) {
      setMonto(String(p.falta));
    }
  };

  const handleSubmit = async () => {
    const m = parseFloat(monto);
    // eslint-disable-next-line no-console
    console.log('[ModalCobroRapido] handleSubmit', { peopleId, monto, m, cicloId, fecha });
    if (!peopleId || !m || m <= 0) {
      showToast('Monto inválido', 'error');
      return;
    }
    setSaving(true);
    try {
      await registrarPago({
        cicloId,
        peopleId,
        monto: m,
        fechaPago: fecha ? inputDateToTimestamp(fecha) : Date.now(),
        nota: nota.trim() || undefined,
      });
      // eslint-disable-next-line no-console
      console.log('[ModalCobroRapido] pago registrado OK');
      showToast('Pago registrado', 'success');
      setSaving(false);
      onSaved?.();
      onClose();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[ModalCobroRapido] error al registrar:', e);
      showToast(e?.message ?? 'Error al registrar', 'error');
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar pago">
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-sm">
          <div className="font-medium">{contexto}</div>
          {participanteActual && participanteActual.falta > 0 && (
            <div className="text-xs text-slate-500 mt-1">
              {participanteActual.nombre} debe{' '}
              <span className="font-semibold text-red-600">
                {formatCurrency(participanteActual.falta, moneda)}
              </span>{' '}
              {participanteActual.estado === 'parcial' && (
                <>
                  (ya pagó{' '}
                  <span className="font-semibold text-amber-600">
                    {formatCurrency(participanteActual.montoPagado, moneda)}
                  </span>
                  )
                </>
              )}
            </div>
          )}
        </div>

        {/* Selector de persona: solo si hay más de una opción y no se fijó defaultPeopleId. */}
        {opcionesPersona.length > 1 && !defaultPeopleId && (
          <Field label="Pagó">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {opcionesPersona.map((p) => {
                const selected = p.peopleId === peopleId;
                return (
                  <button
                    key={p.peopleId}
                    type="button"
                    onClick={() => handlePersonaChange(p.peopleId)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition ${
                      selected
                        ? 'bg-brand-primary/10 ring-1 ring-brand-primary'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <ProfileAvatar
                      nombre={p.nombre}
                      iniciales={p.iniciales}
                      color={p.color}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {p.nombre}
                        {p.isSelf && <span className="ml-1 text-xs text-slate-400">(yo)</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {p.estado === 'completo' && (
                          <span className="text-success">Pagó todo</span>
                        )}
                        {p.estado === 'parcial' && (
                          <span className="text-amber-600">Pagó una parte</span>
                        )}
                        {p.estado === 'pendiente' && (
                          <span className="text-red-500">Debe</span>
                        )}
                        {p.estado === 'sin_cuota' && 'Sin cuota asignada'}
                        {p.falta > 0 && p.estado !== 'completo' && (
                          <> · {formatCurrency(p.falta, moneda)}</>
                        )}
                      </div>
                    </div>
                    {selected && (
                      <div className="w-5 h-5 rounded-full bg-brand-primary text-white text-xs flex items-center justify-center">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field
          label={`Monto (${moneda})`}
          hint={
            sugerido !== null
              ? `Sugerido: ${formatCurrency(sugerido, moneda)} (lo que falta)`
              : undefined
          }
        >
          <Input
            type="number"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus={!defaultPeopleId}
          />
        </Field>

        <Field
          label="Fecha de pago"
          hint="Si te pagó antes, elegí esa fecha para registrar el pago atrasado."
        >
          <DatePicker
            value={fecha}
            max={toInputDate(new Date())}
            onChange={setFecha}
          />
        </Field>

        <Field label="Nota (opcional)">
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Transferencia, efectivo, etc."
          />
        </Field>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            fullWidth
            onClick={handleSubmit}
            loading={saving}
            disabled={!peopleId || !parseFloat(monto)}
          >
            Registrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Helper: dado un array de participantes, devuelve el "peopleId" default
 *  para preseleccionar en el modal cuando se abre desde una card que ya
 *  sabe a quién va a cobrar. */
export function participantePendienteId(participantes: ParticipanteLite[]): string | null {
  const pend = participantes.find((p) => p.estado === 'pendiente');
  if (pend) return pend.peopleId;
  const parc = participantes.find((p) => p.estado === 'parcial');
  return parc?.peopleId ?? null;
}

// Re-export helpers por conveniencia.
export { formatCurrency, getPeriodoLabel, formatDate };
