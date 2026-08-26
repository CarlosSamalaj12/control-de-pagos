// src/components/suscripcion/CobroMultiCicloForm.tsx
// Modal full-screen para cobrar VARIOS ciclos (de la misma persona o de
// varias personas) en una sola transacción.
//
// Caso de uso principal (Flujo C del plan): desde Deudas, una persona
// tiene 3 ciclos vencidos (jun, jul, ago). El usuario abre este modal
// desde "Cobrar adeudo completo" y registra los 3 pagos sin tener que
// hacerlo ciclo por ciclo.
//
// Cada fila tiene: suscripción, periodo, fecha de vencimiento, monto
// (editable, default = lo que falta), fecha de pago (default = hoy),
// nota opcional. Total acumulado en sticky footer.
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Input';
import { DatePicker } from '../ui/DatePicker';
import { Checkbox } from '../ui/Checkbox';
import { Badge } from '../ui/Badge';
import { useUIStore } from '../../stores/useUIStore';
import {
  formatCurrency,
  formatDate,
  toInputDate,
  inputDateToTimestamp,
  getPeriodoLabel,
} from '../../lib/format';
import {
  registrarPagosMultiples,
  type PagoMultipleInput,
} from '../../hooks/useSuscripciones';
import { Calendar, CircleDollarSign } from 'lucide-react';
import type { DeudaCiclo, DeudaPorPersona } from '../../lib/balanceCompartido';
import type { Moneda } from '../../types';
import { MONEDA_PRINCIPAL } from '../../types';

// ============================================================================
// Modo 1: cobro multi-ciclo de UNA persona (desde DeudaDetalle o desde
// la card de persona en /deudas).
// ============================================================================
interface CobroMultiCicloPorPersonaProps {
  open: boolean;
  onClose: () => void;
  deuda: DeudaPorPersona;
  /** Ciclos específicos a mostrar; si no se pasa, se usan todos los de la deuda. */
  ciclosOverride?: DeudaCiclo[];
  onSaved?: () => void;
}

// ============================================================================
// Modo 2: cobro multi-ciclo de VARIAS personas (modo selección desde
// /deudas).
// ============================================================================
interface CobroMultiCicloPorPersonasProps {
  open: boolean;
  onClose: () => void;
  deudas: DeudaPorPersona[];
  /** Ciclos específicos a incluir (ya pre-filtrados); si no, se usan todos. */
  ciclosPorDeuda: Record<string, DeudaCiclo[]>;
  onSaved?: () => void;
}

type Props = CobroMultiCicloPorPersonaProps | CobroMultiCicloPorPersonasProps;

interface FilaCobro {
  key: string; // `${cicloId}::${peopleId}` — único por fila
  cicloId: string;
  peopleId: string;
  peopleNombre: string;
  suscripcionId: string;
  suscripcionNombre: string;
  suscripcionColor: string;
  periodo: string;
  fechaVencimiento: number;
  cuotaEsperada: number;
  pendiente: number;
  vencido: boolean;
  diasAtraso: number;
  moneda: Moneda;
  incluir: boolean;
  monto: string;
  fecha: string;
  nota: string;
}

function buildFilas(
  ciclosPorPersona: Array<{ persona: DeudaPorPersona; ciclos: DeudaCiclo[] }>
): FilaCobro[] {
  const hoyStr = toInputDate(new Date());
  const out: FilaCobro[] = [];
  for (const { persona, ciclos } of ciclosPorPersona) {
    for (const c of ciclos) {
      out.push({
        key: `${c.cicloId}::${persona.peopleId}`,
        cicloId: c.cicloId,
        peopleId: persona.peopleId,
        peopleNombre: persona.nombre,
        suscripcionId: c.suscripcionId,
        suscripcionNombre: c.suscripcionNombre,
        suscripcionColor: c.suscripcionColor,
        periodo: c.periodo,
        fechaVencimiento: c.fechaVencimiento,
        cuotaEsperada: c.cuotaEsperada,
        pendiente: c.pendiente,
        vencido: c.vencido,
        diasAtraso: c.diasAtraso,
        // El DeudaCiclo actual no trae moneda explícita, así que usamos
        // MONEDA_PRINCIPAL (GTQ por defecto) como fallback conservador.
        // En el plan §6 item 6 dijimos que el modal agrupa por moneda —
        // en esta primera versión todas las suscripciones del workspace
        // usan la misma moneda (es el caso típico), por lo que este
        // default es suficiente.
        moneda: MONEDA_PRINCIPAL,
        incluir: true,
        monto: c.pendiente > 0 ? c.pendiente.toFixed(2) : '',
        fecha: hoyStr,
        nota: '',
      });
    }
  }
  // Ordenar por persona, luego por fecha de vencimiento (los más viejos primero).
  out.sort((a, b) => {
    if (a.peopleNombre !== b.peopleNombre) {
      return a.peopleNombre.localeCompare(b.peopleNombre);
    }
    return a.fechaVencimiento - b.fechaVencimiento;
  });
  return out;
}

export function CobroMultiCicloForm(props: Props) {
  if ('deuda' in props && props.deuda) {
    return <CobroMultiCicloPorPersona {...props} />;
  }
  return <CobroMultiCicloPorPersonas {...(props as CobroMultiCicloPorPersonasProps)} />;
}

// ----------------------------------------------------------------------------

function CobroMultiCicloPorPersona({
  open,
  onClose,
  deuda,
  ciclosOverride,
  onSaved,
}: CobroMultiCicloPorPersonaProps) {
  const showToast = useUIStore((s) => s.showToast);
  const ciclos = ciclosOverride ?? deuda.ciclos;
  const grupos = useMemo(
    () => [{ persona: deuda, ciclos }],
    [deuda, ciclos]
  );

  return (
    <Modal open={open} onClose={onClose} title="Cobrar adeudo" fullScreen>
      <CobroMultiCicloBody
        grupos={grupos}
        onClose={onClose}
        onSaved={onSaved}
        showToast={showToast}
      />
    </Modal>
  );
}

function CobroMultiCicloPorPersonas({
  open,
  onClose,
  deudas,
  ciclosPorDeuda,
  onSaved,
}: CobroMultiCicloPorPersonasProps) {
  const showToast = useUIStore((s) => s.showToast);
  const grupos = useMemo(() => {
    return deudas.map((d) => ({
      persona: d,
      ciclos: ciclosPorDeuda[d.peopleId] ?? d.ciclos,
    }));
  }, [deudas, ciclosPorDeuda]);

  return (
    <Modal open={open} onClose={onClose} title="Cobrar adeudos" fullScreen>
      <CobroMultiCicloBody
        grupos={grupos}
        onClose={onClose}
        onSaved={onSaved}
        showToast={showToast}
      />
    </Modal>
  );
}

// ----------------------------------------------------------------------------

interface CobroMultiCicloBodyProps {
  grupos: Array<{ persona: DeudaPorPersona; ciclos: DeudaCiclo[] }>;
  onClose: () => void;
  onSaved?: () => void;
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}

function CobroMultiCicloBody({
  grupos,
  onClose,
  onSaved,
  showToast,
}: CobroMultiCicloBodyProps) {
  const [filas, setFilas] = useState<FilaCobro[]>(() => buildFilas(grupos));
  const [guardando, setGuardando] = useState(false);

  // Re-sincronizar si cambian los grupos (e.g. se abre con otra persona).
  useEffect(() => {
    setFilas(buildFilas(grupos));
  }, [grupos]);

  const totalSeleccionado = filas
    .filter((f) => f.incluir)
    .reduce((acc, f) => acc + (parseFloat(f.monto) || 0), 0);
  const cantSeleccionados = filas.filter((f) => f.incluir).length;
  // Detectar si hay alguna fila con monto inválido.
  const hayInvalido = filas.some(
    (f) => f.incluir && (!parseFloat(f.monto) || parseFloat(f.monto) <= 0)
  );

  const setFila = (key: string, patch: Partial<FilaCobro>) => {
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  };

  const handleRegistrar = async () => {
    const aRegistrar = filas.filter(
      (f) => f.incluir && parseFloat(f.monto) > 0
    );
    if (aRegistrar.length === 0) return;
    setGuardando(true);
    try {
      const pagosInput: PagoMultipleInput[] = aRegistrar.map((f) => ({
        cicloId: f.cicloId,
        peopleId: f.peopleId,
        monto: parseFloat(f.monto),
        fechaPago: f.fecha ? inputDateToTimestamp(f.fecha) : Date.now(),
        nota: f.nota.trim() || undefined,
      }));
      const result = await registrarPagosMultiples(pagosInput);
      showToast(
        result.pagosCreados === 1
          ? '1 pago registrado'
          : `${result.pagosCreados} pagos registrados`,
        'success'
      );
      onSaved?.();
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al registrar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (filas.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center py-6">
        No hay ciclos pendientes para cobrar.
      </div>
    );
  }

  // Agrupar filas por persona para renderizar headers.
  const porPersona = new Map<string, { persona: DeudaPorPersona; filas: FilaCobro[] }>();
  for (const f of filas) {
    if (!porPersona.has(f.peopleId)) {
      const persona = grupos.find((g) => g.persona.peopleId === f.peopleId)!.persona;
      porPersona.set(f.peopleId, { persona, filas: [] });
    }
    porPersona.get(f.peopleId)!.filas.push(f);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-sm text-slate-500 mb-3">
        Tildá los ciclos que te pagaron, ajustá el monto y la fecha si
        querés, y registrá todo de una.
      </div>

      <div className="space-y-4 overflow-y-auto flex-1 -mx-1 px-1 pb-2">
        {Array.from(porPersona.values()).map(({ persona, filas: filasP }) => (
          <div key={persona.peopleId}>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                {persona.nombre}
                {persona.isSelf && <span className="ml-1 normal-case font-normal">(yo)</span>}
              </div>
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
              <div className="text-xs text-slate-500">
                {filasP.filter((f) => f.incluir).length}/{filasP.length}
              </div>
            </div>
            <div className="space-y-2">
              {filasP.map((f) => (
                <FilaCobroMultiCiclo
                  key={f.key}
                  f={f}
                  moneda={f.moneda}
                  onChange={(patch) => setFila(f.key, patch)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm min-w-0">
            <div className="text-slate-500">A registrar</div>
            <div className="font-bold tabular-nums truncate">
              {cantSeleccionados === 0
                ? '—'
                : cantSeleccionados === 1
                ? `1 pago · ${formatCurrency(totalSeleccionado, filas[0].moneda)}`
                : `${cantSeleccionados} pagos · ${formatCurrency(totalSeleccionado, filas[0].moneda)}`}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrar}
              disabled={
                guardando || cantSeleccionados === 0 || hayInvalido
              }
              loading={guardando}
            >
              <CircleDollarSign size={16} /> Registrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilaCobroMultiCiclo({
  f,
  moneda,
  onChange,
}: {
  f: FilaCobro;
  moneda: Moneda;
  onChange: (patch: Partial<FilaCobro>) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        f.incluir
          ? 'border-primary/40 bg-primary/5'
          : 'border-slate-200 dark:border-slate-700 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="pt-1 shrink-0">
          <Checkbox
            checked={f.incluir}
            onChange={(v) => onChange({ incluir: v })}
            ariaLabel={`Marcar ${f.suscripcionNombre} ${f.periodo}`}
          />
        </div>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ backgroundColor: f.suscripcionColor }}
          aria-hidden
        >
          {f.suscripcionNombre.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-medium truncate">{f.suscripcionNombre}</div>
            {f.vencido && (
              <Badge variant="danger">-{f.diasAtraso}d</Badge>
            )}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar size={10} />
            {getPeriodoLabel(f.periodo)} · venció {formatDate(f.fechaVencimiento)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Pendiente{' '}
            <span className="font-semibold text-red-600">
              {formatCurrency(f.pendiente, moneda)}
            </span>{' '}
            (de {formatCurrency(f.cuotaEsperada, moneda)})
          </div>
          {f.incluir && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Field label="Monto">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={f.monto}
                  onChange={(e) => onChange({ monto: e.target.value })}
                />
              </Field>
              <Field label="Fecha de pago">
                <DatePicker
                  value={f.fecha}
                  max={toInputDate(new Date())}
                  onChange={(v) => onChange({ fecha: v })}
                />
              </Field>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
