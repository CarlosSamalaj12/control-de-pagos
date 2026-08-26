// src/routes/suscripciones/EditarSuscripcion.tsx
// Vista de "Detalle de Suscripción":
//   - Header con nombre + color
//   - Resumen del CICLO ACTUAL con checks de pago por persona + botón "Registrar pagos"
//   - Historial de ciclos (chips tappables)
//   - Form de edición al final
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  CircleDollarSign,
} from 'lucide-react';
import { useQuery } from '../../db/useQuery';
import { SuscripcionForm, type SuscripcionFormInitial } from '../../components/suscripcion/SuscripcionForm';
import {
  useCiclosBySuscripcion,
  useParticipantesConEstadoPago,
} from '../../hooks/useSuscripciones';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { EmptyState } from '../../components/EmptyState';
import { CurrencyText } from '../../components/ui/CurrencyIcon';
import { formatDate } from '../../lib/format';
import type { Moneda } from '../../types';

export function EditarSuscripcion() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: suscRow, loading: loadingSusc } = useQuery<any>(
    'SELECT * FROM suscripciones WHERE id = ?',
    id ? [id] : []
  );
  const { data: partRows, loading: loadingPart } = useQuery<any>(
    'SELECT people_id, cuota_esperada, activo FROM suscripcion_participantes WHERE suscripcion_id = ?',
    id ? [id] : []
  );

  // Ciclos + estado del más reciente
  const ciclos = useCiclosBySuscripcion(id ?? null, 12);
  const cicloActual = ciclos[0];
  const { participantes: estadoActual } = useParticipantesConEstadoPago(
    cicloActual?.id ?? null,
    id ?? null
  );

  if (loadingSusc || loadingPart) {
    return <div className="p-4 text-center text-slate-500">Cargando...</div>;
  }

  if (!suscRow || suscRow.length === 0) {
    return (
      <EmptyState
        title="Suscripción no encontrada"
        description="Quizás fue eliminada."
        action={<Button onClick={() => navigate('/')}>Volver al inicio</Button>}
      />
    );
  }

  const s = suscRow[0];
  const initial: SuscripcionFormInitial = {
    id: s.id,
    nombre: s.nombre,
    costoTotal: s.costo_total,
    moneda: s.moneda,
    periodicidad: s.periodicidad,
    diaVencimiento: s.dia_vencimiento ?? undefined,
    intervaloDias: s.intervalo_dias ?? undefined,
    color: s.color,
    icono: s.icono,
    payerPeopleId: s.payer_people_id,
    fechaInicio: s.fecha_inicio ?? s.created_at,
    participantes: partRows
      .filter((p: any) => p.activo)
      .map((p: any) => ({ peopleId: p.people_id, cuotaEsperada: p.cuota_esperada })),
  };

  const moneda: Moneda = s.moneda;
  const completos = estadoActual.filter((p) => p.estado === 'completo').length;
  const parciales = estadoActual.filter((p) => p.estado === 'parcial').length;
  const pendientes = estadoActual.filter((p) => p.estado === 'pendiente').length;
  const totalParticipantes = estadoActual.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: s.color }}
        >
          <span className="text-xs font-bold">
            {s.nombre.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{s.nombre}</h1>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CurrencyText moneda={moneda} monto={s.costo_total} size="xs" />
            <span>· {initial.participantes.length} participantes</span>
          </div>
        </div>
      </div>

      {/* Resumen del ciclo actual (con checks por persona) */}
      {cicloActual ? (
        <Card>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Ciclo actual
              </div>
              <div className="text-2xl font-bold mt-0.5">{cicloActual.periodo}</div>
              <div className="text-xs text-slate-500">
                Vence {formatDate(cicloActual.fechaVencimiento)}
              </div>
            </div>
            <Badge
              variant={
                cicloActual.estado === 'cobrado'
                  ? 'success'
                  : cicloActual.estado === 'parcial'
                  ? 'warning'
                  : cicloActual.estado === 'vencido'
                  ? 'danger'
                  : 'neutral'
              }
            >
              {cicloActual.estado}
            </Badge>
          </div>

          {/* Desglose */}
          {totalParticipantes > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              {completos > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                  <Check size={12} strokeWidth={3} />
                  {completos} {completos === 1 ? 'pagó completo' : 'pagaron completo'}
                </span>
              )}
              {parciales > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                  <CircleDollarSign size={12} />
                  {parciales} {parciales === 1 ? 'pago parcial' : 'pagos parciales'}
                </span>
              )}
              {pendientes > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                  <X size={12} strokeWidth={3} />
                  {pendientes} {pendientes === 1 ? 'falta' : 'faltan'}
                </span>
              )}
            </div>
          )}

          {/* Checks por persona */}
          {totalParticipantes > 0 && (
            <div className="space-y-1 mb-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              {estadoActual.map((p) => (
                <FilaCheckPersona
                  key={p.peopleId}
                  p={p}
                  moneda={moneda}
                  onClick={() => navigate(`/ciclos/${cicloActual.id}`)}
                />
              ))}
            </div>
          )}

          {/* Botón principal: ir al detalle del ciclo */}
          <Button
            fullWidth
            onClick={() => navigate(`/ciclos/${cicloActual.id}`)}
            variant={pendientes + parciales > 0 ? 'primary' : 'secondary'}
          >
            {pendientes + parciales > 0
              ? 'Registrar pagos de este mes'
              : 'Ver detalle del ciclo'}
            <ChevronRight size={16} />
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="text-center text-sm text-slate-500 py-3">
            Aún no hay ciclos generados para esta suscripción.
          </div>
        </Card>
      )}

      {/* Historial de ciclos */}
      {ciclos.length > 1 && (
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
            Historial de ciclos
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ciclos.map((c) => {
              const dot =
                c.estado === 'cobrado'
                  ? 'bg-success'
                  : c.estado === 'parcial'
                  ? 'bg-amber-500'
                  : c.estado === 'vencido'
                  ? 'bg-red-500'
                  : 'bg-slate-300';
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/ciclos/${c.id}`)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary/40 transition"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  {c.periodo}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Separador + form de edición */}
      <div className="pt-2">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Configuración
        </div>
        <SuscripcionForm mode="edit" initial={initial} embedded />
      </div>
    </div>
  );
}

function FilaCheckPersona({
  p,
  moneda,
  onClick,
}: {
  p: {
    peopleId: string;
    nombre: string;
    iniciales: string;
    color: string;
    isSelf: boolean;
    cuotaEsperada: number;
    montoPagado: number;
    estado: 'completo' | 'parcial' | 'pendiente' | 'sin_cuota';
    falta: number;
  };
  moneda: Moneda;
  onClick: () => void;
}) {
  let iconBg = 'bg-red-500';
  let Icon = X;
  if (p.estado === 'completo') {
    iconBg = 'bg-success';
    Icon = Check;
  } else if (p.estado === 'parcial') {
    iconBg = 'bg-amber-500';
    Icon = CircleDollarSign;
  } else if (p.estado === 'sin_cuota') {
    iconBg = 'bg-slate-300';
    Icon = Clock;
  }

  let textoEstado: React.ReactNode;
  let textoColor = 'text-slate-500';
  if (p.estado === 'completo') {
    textoEstado = (
      <span className="text-success font-medium inline-flex items-center gap-1">
        Pagó <CurrencyText moneda={moneda} monto={p.montoPagado} size="xs" />
      </span>
    );
  } else if (p.estado === 'parcial') {
    textoEstado = (
      <span className="inline-flex items-center gap-1 flex-wrap">
        Pagó{' '}
        <CurrencyText moneda={moneda} monto={p.montoPagado} size="xs" className="text-amber-600 font-medium" />
        <span>· falta</span>
        <CurrencyText moneda={moneda} monto={p.falta} size="xs" className="text-red-500 font-medium" />
      </span>
    );
  } else if (p.estado === 'pendiente') {
    textoEstado = (
      <span className="text-red-500 font-medium inline-flex items-center gap-1">
        Debe <CurrencyText moneda={moneda} monto={p.cuotaEsperada} size="xs" />
      </span>
    );
  } else {
    textoEstado = <span className={textoColor}>Sin cuota</span>;
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2 px-1 -mx-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-left"
    >
      <div className="relative shrink-0">
        <ProfileAvatar
          nombre={p.nombre}
          iniciales={p.iniciales}
          color={p.color}
          size="sm"
        />
        <span
          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${iconBg} text-white flex items-center justify-center`}
        >
          <Icon size={10} strokeWidth={3} />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {p.nombre}
          {p.isSelf && <span className="ml-1 text-xs text-slate-400">(yo)</span>}
        </div>
        <div className="text-xs">{textoEstado}</div>
      </div>
      <ChevronRight size={16} className="text-slate-300" />
    </button>
  );
}
