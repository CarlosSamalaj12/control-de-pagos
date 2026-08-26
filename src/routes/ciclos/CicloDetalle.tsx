// src/routes/ciclos/CicloDetalle.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
  CircleDollarSign,
  ListChecks,
} from 'lucide-react';
import {
  useCiclo,
  usePagosByCiclo,
  useParticipantesConEstadoPago,
  useCiclosVecinos,
  useCiclosBySuscripcion,
  registrarPagosMultiples,
  deletePago,
} from '../../hooks/useSuscripciones';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, Input } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { DatePicker } from '../../components/ui/DatePicker';
import { Badge } from '../../components/ui/Badge';
import { Progress } from '../../components/ui/Progress';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { CurrencyText } from '../../components/ui/CurrencyIcon';
import { BarraAccionesFlotante } from '../../components/ui/BarraAccionesFlotante';
import { ModalCobroRapido, type ParticipanteLite } from '../../components/suscripcion/ModalCobroRapido';
import { useSelectionMode } from '../../hooks/useSelectionMode';
import { formatCurrency, formatDate, toInputDate, inputDateToTimestamp, getPeriodoLabel } from '../../lib/format';
import { useUIStore } from '../../stores/useUIStore';
import type { Moneda } from '../../types';

interface Participante {
  peopleId: string;
  nombre: string;
  iniciales: string;
  color: string;
  isSelf: boolean;
  cuotaEsperada: number;
  montoPagado: number;
  fechaPago: number | null;
  pagoId: string | null;
  pagado: boolean;
  parcial: boolean;
  estado: 'completo' | 'parcial' | 'pendiente' | 'sin_cuota';
  falta: number;
}

export function CicloDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const ciclo = useCiclo(id ?? null);
  const pagos = usePagosByCiclo(id ?? null);
  const { participantes } = useParticipantesConEstadoPago(
    id ?? null,
    ciclo?.suscripcionId ?? null
  );
  const { anterior, siguiente } = useCiclosVecinos(
    id ?? null,
    ciclo?.suscripcionId ?? null
  );
  // usePeople(): ya no se usa acá; ModalCobroRapido consume la lista internamente.

  const [pagoModal, setPagoModal] = useState(false);
  const [cobroMasivoOpen, setCobroMasivoOpen] = useState(false);
  const [defaultPeopleId, setDefaultPeopleId] = useState<string | null>(null);
  const [defaultMonto, setDefaultMonto] = useState<number | null>(null);
  const selection = useSelectionMode();

  if (!ciclo) {
    return (
      <div className="p-4 text-center text-slate-500">
        Cargando... o ciclo no encontrado
      </div>
    );
  }

  const cobrado = pagos.reduce((s, p) => s + p.monto, 0);
  const pct = ciclo.costoTotal > 0 ? (cobrado / ciclo.costoTotal) * 100 : 0;
  const pendiente = Math.max(0, ciclo.costoTotal - cobrado);

  const completos = participantes.filter((p) => p.estado === 'completo');
  const parciales = participantes.filter((p) => p.estado === 'parcial');
  const pendientes = participantes.filter((p) => p.estado === 'pendiente');
  const sinCuota = participantes.filter((p) => p.estado === 'sin_cuota');

  // ¿Hay algo que cobrar (pendientes o parciales)?
  const hayCobroPendiente = pendientes.length + parciales.length > 0;

  const openPagoModal = (prefillPeopleId?: string, monto?: number) => {
    setDefaultPeopleId(prefillPeopleId ?? null);
    setDefaultMonto(monto ?? null);
    setPagoModal(true);
  };
  const closePagoModal = () => {
    setPagoModal(false);
    setDefaultPeopleId(null);
    setDefaultMonto(null);
  };

  return (
    <div className="space-y-4">
      {/* Header con navegación por meses */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500 truncate">
            {ciclo.suscripcionNombre}
          </div>
          <h2 className="text-lg font-bold truncate">
            {formatearPeriodoLegible(ciclo.periodo)}
          </h2>
        </div>
      </div>

      {/* Stepper de meses */}
      <Card className="!p-2">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => anterior && navigate(`/ciclos/${anterior.id}`)}
            disabled={!anterior}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 text-center">
            <div className="text-base font-semibold tabular-nums">{ciclo.periodo}</div>
            <div className="text-xs text-slate-500">
              Vence {formatDate(ciclo.fechaVencimiento)}
            </div>
          </div>
          <button
            onClick={() => siguiente && navigate(`/ciclos/${siguiente.id}`)}
            disabled={!siguiente}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        {/* Mini historial: chips clicables de los últimos meses */}
        <HistorialChips
          suscripcionId={ciclo.suscripcionId}
          cicloActualId={ciclo.id}
          navigate={navigate}
        />
      </Card>

      {/* Resumen monetario */}
      <Card>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: ciclo.suscripcionColor }}
          >
            <span className="text-sm font-bold">
              {ciclo.suscripcionNombre.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{ciclo.suscripcionNombre}</div>
            <div className="text-xs text-slate-500">{ciclo.periodo}</div>
          </div>
          <Badge
            variant={
              ciclo.estado === 'cobrado'
                ? 'success'
                : ciclo.estado === 'parcial'
                ? 'warning'
                : ciclo.estado === 'vencido'
                ? 'danger'
                : 'neutral'
            }
          >
            {ciclo.estado}
          </Badge>
        </div>
        <Progress value={pct} showLabel />
        <div className="grid grid-cols-3 gap-3 mt-3 text-center">
          <div>
            <div className="text-xs text-slate-500">Costo</div>
            <div className="font-bold flex justify-center">
              <CurrencyText moneda={ciclo.moneda} monto={ciclo.costoTotal} size="sm" />
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Cobrado</div>
            <div className="font-bold text-success flex justify-center">
              <CurrencyText moneda={ciclo.moneda} monto={cobrado} size="sm" />
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Pendiente</div>
            <div className="font-bold text-amber-600 flex justify-center">
              <CurrencyText moneda={ciclo.moneda} monto={pendiente} size="sm" />
            </div>
          </div>
        </div>
      </Card>

      {/* Resumen de cobro por participante */}
      {participantes.length > 0 && (
        <Card>
          <div className="mb-3">
            <div className="text-sm text-slate-500">Cobro a participantes</div>
            <div className="text-2xl font-bold mt-1">
              <span
                className={
                  completos.length === participantes.length
                    ? 'text-success'
                    : 'text-amber-600'
                }
              >
                {completos.length + parciales.length}
              </span>
              <span className="text-slate-400"> / {participantes.length}</span>
              {completos.length === participantes.length && (
                <span className="ml-2 text-sm font-semibold text-success">¡Listo!</span>
              )}
            </div>
          </div>
          {/* Desglose */}
          <div className="flex flex-wrap gap-2 text-xs mb-3">
            {completos.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                <Check size={12} strokeWidth={3} />
                {completos.length} {completos.length === 1 ? 'pagó todo' : 'pagaron todo'}
              </span>
            )}
            {parciales.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                <CircleDollarSign size={12} />
                {parciales.length} {parciales.length === 1 ? 'pagó una parte' : 'pagaron una parte'}
              </span>
            )}
            {pendientes.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                <X size={12} strokeWidth={3} />
                {pendientes.length} {pendientes.length === 1 ? 'falta' : 'faltan'}
              </span>
            )}
            {sinCuota.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {sinCuota.length} sin cuota
              </span>
            )}
          </div>
          {/* CTAs principales */}
          {hayCobroPendiente && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => setCobroMasivoOpen(true)}
                size="md"
                variant="primary"
                fullWidth
              >
                <Zap size={18} /> Cobrar adeudos del mes ({pendientes.length + parciales.length})
              </Button>
              {!selection.active && pendientes.length + parciales.length > 1 && (
                <Button
                  onClick={selection.enter}
                  size="md"
                  variant="secondary"
                >
                  <ListChecks size={18} /> Elegir
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <SeccionParticipantes
          titulo={`Falta cobrar (${pendientes.length})`}
          
          icono={<X size={16} className="text-red-500" />}
          participantes={pendientes}
          moneda={ciclo.moneda}
          showRegistrar
          selection={selection}
          onRegistrar={(peopleId, monto) => openPagoModal(peopleId, monto)}
          onEliminar={async (p) => {
            if (!p.pagoId) return;
            if (!confirm('¿Eliminar pago?')) return;
            await deletePago(p.pagoId);
            showToast('Pago eliminado', 'success');
          }}
        />
      )}

      {/* Parciales */}
      {parciales.length > 0 && (
        <SeccionParticipantes
          titulo={`Pagaron una parte (${parciales.length})`}
          
          icono={<CircleDollarSign size={16} className="text-amber-500" />}
          participantes={parciales}
          moneda={ciclo.moneda}
          showRegistrar
          selection={selection}
          onRegistrar={(peopleId, monto) => openPagoModal(peopleId, monto)}
          onEliminar={async (p) => {
            if (!p.pagoId) return;
            if (!confirm('¿Eliminar pago?')) return;
            await deletePago(p.pagoId);
            showToast('Pago eliminado', 'success');
          }}
        />
      )}

      {/* Completos */}
      {completos.length > 0 && (
        <SeccionParticipantes
          titulo={`Pagaron todo (${completos.length})`}
          
          icono={<Check size={16} className="text-green-500" />}
          participantes={completos}
          moneda={ciclo.moneda}
          showRegistrar={false}
          selection={selection}
          onEliminar={async (p) => {
            if (!p.pagoId) return;
            if (!confirm('¿Eliminar pago?')) return;
            await deletePago(p.pagoId);
            showToast('Pago eliminado', 'success');
          }}
        />
      )}

      {/* Sin cuota asignada (info) */}
      {sinCuota.length > 0 && (
        <SeccionParticipantes
          titulo={`Sin cuota asignada (${sinCuota.length})`}
          
          icono={<Clock size={16} className="text-slate-400" />}
          participantes={sinCuota}
          moneda={ciclo.moneda}
          showRegistrar
          selection={selection}
          onRegistrar={(peopleId, monto) => openPagoModal(peopleId, monto)}
          onEliminar={async (p) => {
            if (!p.pagoId) return;
            if (!confirm('¿Eliminar pago?')) return;
            await deletePago(p.pagoId);
            showToast('Pago eliminado', 'success');
          }}
        />
      )}

      {/* Fallback: si la suscripción no tiene participantes cargados */}
      {participantes.length === 0 && pagos.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Pagos ({pagos.length})</h3>
          </div>
          <div className="space-y-1">
            {pagos.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <ProfileAvatar
                  nombre={p.nombre}
                  iniciales={p.iniciales}
                  color={p.color}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{p.nombre}</div>
                  <div className="text-xs text-slate-500">{formatDate(p.fechaPago)}</div>
                </div>
                <div className="font-semibold tabular-nums text-sm">
                  {formatCurrency(p.monto, ciclo.moneda)}
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('¿Eliminar pago?')) return;
                    await deletePago(p.id);
                    showToast('Pago eliminado', 'success');
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Botón flotante para registrar pago suelto */}
      {participantes.length > 0 && !hayCobroPendiente && !selection.active && (
        <Button fullWidth onClick={() => openPagoModal()} variant="secondary">
          <Plus size={18} /> Registrar otro pago
        </Button>
      )}

      {/* Modal: registrar pago simple (reutilizado para flujo individual desde la fila) */}
      <ModalCobroRapido
        open={pagoModal}
        onClose={closePagoModal}
        cicloId={ciclo.id}
        contexto={`${ciclo.suscripcionNombre} · ${getPeriodoLabel(ciclo.periodo)}`}
        moneda={ciclo.moneda}
        participantes={participantes as unknown as ParticipanteLite[]}
        defaultPeopleId={defaultPeopleId}
        defaultMonto={defaultMonto ?? pendiente}
      />

      {/* Modal: cobro masivo (varios pagos de una).
          - Sin selección: pre-tilda todos los pendientes+parciales.
          - Con selección activa: pre-tilda solo los ids seleccionados. */}
      <Modal
        open={cobroMasivoOpen}
        onClose={() => {
          setCobroMasivoOpen(false);
          selection.clear();
        }}
        title={
          selection.count > 0
            ? `Cobrar a ${selection.count} ${selection.count === 1 ? 'persona' : 'personas'}`
            : 'Cobrar adeudos del mes'
        }
        fullScreen
      >
        <CobroMasivoForm
          cicloId={ciclo.id}
          moneda={ciclo.moneda}
          participantes={
            selection.count > 0
              ? [...pendientes, ...parciales].filter((p) =>
                  selection.isSelected(p.peopleId)
                )
              : [...pendientes, ...parciales]
          }
          onClose={() => {
            setCobroMasivoOpen(false);
            selection.clear();
          }}
          onDone={(count) => {
            showToast(
              count === 1 ? '1 pago registrado' : `${count} pagos registrados`,
              'success'
            );
            setCobroMasivoOpen(false);
            selection.clear();
          }}
        />
      </Modal>

      {/* Barra flotante de selección múltiple */}
      {selection.active && (
        <BarraAccionesFlotante
          count={selection.count}
          ctaLabel={
            selection.count === 1
              ? 'Cobrar a 1'
              : `Cobrar a ${selection.count}`
          }
          ctaDisabled={selection.count === 0}
          onCta={() => setCobroMasivoOpen(true)}
          onCancel={selection.clear}
        />
      )}
    </div>
  );
}

// ============================================================================
// Subcomponentes
// ============================================================================

function SeccionParticipantes({
  titulo,
  icono,
  participantes,
  moneda,
  showRegistrar,
  selection,
  onRegistrar,
  onEliminar,
}: {
  titulo: string;
  icono: React.ReactNode;
  participantes: Participante[];
  moneda: Moneda;
  showRegistrar: boolean;
  selection: ReturnType<typeof useSelectionMode>;
  onRegistrar?: (peopleId: string, monto: number) => void;
  onEliminar: (p: Participante) => void | Promise<void>;
}) {
  return (
    <>
      <div className="flex items-center gap-2 pt-2">
        {icono}
        <h3 className="font-semibold">{titulo}</h3>
        {selection.active && (
          <span className="text-xs text-slate-500">
            ({participantes.filter((p) => selection.isSelected(p.peopleId)).length}/{participantes.length})
          </span>
        )}
      </div>
      <Card>
        <div className="space-y-1">
          {participantes.map((p) => (
            <FilaParticipante
              key={p.peopleId}
              p={p}
              moneda={moneda}
              showRegistrar={showRegistrar}
              selection={selection}
              onRegistrar={onRegistrar}
              onEliminar={onEliminar}
            />
          ))}
        </div>
      </Card>
    </>
  );
}

function FilaParticipante({
  p,
  moneda,
  showRegistrar,
  selection,
  onRegistrar,
  onEliminar,
}: {
  p: Participante;
  moneda: Moneda;
  showRegistrar: boolean;
  selection: ReturnType<typeof useSelectionMode>;
  onRegistrar?: (peopleId: string, monto: number) => void;
  onEliminar: (p: Participante) => void | Promise<void>;
}) {
  const iconWrap = (icon: React.ReactNode, bg: string) => (
    <div className="relative">
      <ProfileAvatar nombre={p.nombre} iniciales={p.iniciales} color={p.color} size="sm" />
      <span
        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${bg} text-white flex items-center justify-center`}
      >
        {icon}
      </span>
    </div>
  );

  let iconBadge;
  if (p.estado === 'completo') {
    iconBadge = iconWrap(<Check size={10} strokeWidth={3} />, 'bg-success');
  } else if (p.estado === 'parcial') {
    iconBadge = iconWrap(<CircleDollarSign size={10} strokeWidth={3} />, 'bg-amber-500');
  } else {
    iconBadge = iconWrap(<X size={10} strokeWidth={3} />, 'bg-red-500');
  }

  const selected = selection.isSelected(p.peopleId);
  const enModoSeleccion = selection.active;
  // En modo selección solo se pueden tildar los que tengan algo que cobrar.
  const seleccionable = p.estado === 'pendiente' || p.estado === 'parcial';

  return (
    <div
      role={enModoSeleccion ? 'button' : undefined}
      onClick={
        enModoSeleccion && seleccionable
          ? () => selection.toggle(p.peopleId)
          : undefined
      }
      className={`flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 ${
        enModoSeleccion && seleccionable ? 'cursor-pointer' : ''
      } ${selected ? 'bg-primary/5' : ''} ${enModoSeleccion && !seleccionable ? 'opacity-40' : ''} px-2 -mx-2 rounded-lg`}
    >
      {enModoSeleccion && (
        <div className="shrink-0">
          <Checkbox
            checked={selected}
            disabled={!seleccionable}
            onChange={() => selection.toggle(p.peopleId)}
            ariaLabel={`Seleccionar ${p.nombre}`}
          />
        </div>
      )}
      {iconBadge}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {p.nombre}
          {p.isSelf && <span className="ml-1 text-xs text-slate-400">(yo)</span>}
        </div>
        <div className="text-xs text-slate-500">
          {p.cuotaEsperada > 0 ? (
            <>
              Cuota{' '}
              <span className="font-medium">
                {formatCurrency(p.cuotaEsperada, moneda)}
              </span>
              {p.estado === 'parcial' && (
                <>
                  {' · pagó '}
                  <span className="font-medium text-amber-600">
                    {formatCurrency(p.montoPagado, moneda)}
                  </span>
                </>
              )}
              {p.estado === 'pendiente' && (
                <>
                  {' · debe '}
                  <span className="font-medium text-red-500">
                    {formatCurrency(p.falta, moneda)}
                  </span>
                </>
              )}
            </>
          ) : p.fechaPago ? (
            formatDate(p.fechaPago)
          ) : (
            'Sin cuota asignada'
          )}
        </div>
      </div>
      {!enModoSeleccion && p.estado === 'completo' && (
        <>
          <div className="font-semibold tabular-nums text-sm text-success">
            {formatCurrency(p.montoPagado, moneda)}
          </div>
          {p.pagoId && (
            <button
              onClick={() => onEliminar(p)}
              className="p-1.5 text-slate-400 hover:text-red-500"
              title="Eliminar pago"
              aria-label="Eliminar pago"
            >
              <Trash2 size={14} />
            </button>
          )}
        </>
      )}
      {!enModoSeleccion && p.estado !== 'completo' && (
        <>
          <div className="text-right">
            {p.estado === 'parcial' && (
              <div className="text-xs font-medium text-amber-600 tabular-nums">
                Faltan {formatCurrency(p.falta, moneda)}
              </div>
            )}
            {p.estado === 'pendiente' && p.cuotaEsperada > 0 && (
              <div className="text-xs font-medium text-red-500 tabular-nums">
                {formatCurrency(p.falta, moneda)}
              </div>
            )}
          </div>
          {showRegistrar && onRegistrar && (
            <Button
              size="sm"
              variant={p.estado === 'parcial' ? 'primary' : 'secondary'}
              onClick={() => onRegistrar(p.peopleId, p.falta)}
            >
              {p.estado === 'parcial' ? (
                'Completar'
              ) : (
                <>
                  <Plus size={14} /> Pagar
                </>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function HistorialChips({
  suscripcionId,
  cicloActualId,
  navigate,
}: {
  suscripcionId: string;
  cicloActualId: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  // Cargamos los últimos 6 ciclos para mostrar chips de navegación rápida
  const ciclos = useCiclosBySuscripcion(suscripcionId, 6);
  if (ciclos.length <= 1) return null;
  return (
    <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 -mx-1 px-1">
      {ciclos.map((c) => (
        <button
          key={c.id}
          onClick={() => navigate(`/ciclos/${c.id}`)}
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            c.id === cicloActualId
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          {c.periodo}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Form: pago simple → migrado a `ModalCobroRapido`
// ============================================================================
// (PagoForm viejo eliminado; ahora se usa el componente compartido en
// `../../components/suscripcion/ModalCobroRapido`.)

// ============================================================================
// Form: cobro masivo (varios pagos de una)
// ============================================================================

interface FilaCobro {
  peopleId: string;
  incluir: boolean;
  monto: string;
  fecha: string;
  nota: string;
  nombre: string;
  cuotaEsperada: number;
  falta: number;
  montoYaPagado: number;
  estado: Participante['estado'];
}

function CobroMasivoForm({
  cicloId,
  moneda,
  participantes,
  onClose,
  onDone,
}: {
  cicloId: string;
  moneda: Moneda;
  participantes: Participante[];
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const hoyStr = toInputDate(new Date());
  const [filas, setFilas] = useState<FilaCobro[]>(() =>
    participantes.map((p) => ({
      peopleId: p.peopleId,
      incluir: true,
      monto: p.falta > 0 ? String(p.falta) : '',
      fecha: hoyStr,
      nota: '',
      nombre: p.nombre,
      cuotaEsperada: p.cuotaEsperada,
      falta: p.falta,
      montoYaPagado: p.montoPagado,
      estado: p.estado,
    }))
  );
  const [guardando, setGuardando] = useState(false);

  const totalSeleccionado = filas
    .filter((f) => f.incluir)
    .reduce((acc, f) => acc + (parseFloat(f.monto) || 0), 0);
  const cantSeleccionados = filas.filter((f) => f.incluir).length;

  const setFila = (peopleId: string, patch: Partial<FilaCobro>) => {
    setFilas((prev) =>
      prev.map((f) => (f.peopleId === peopleId ? { ...f, ...patch } : f))
    );
  };

  const handleRegistrar = async () => {
    const aRegistrar = filas.filter(
      (f) => f.incluir && parseFloat(f.monto) > 0
    );
    if (aRegistrar.length === 0) {
      onClose();
      return;
    }
    setGuardando(true);
    try {
      // Una sola transacción para todos los pagos: o se insertan todos
      // o ninguno (atomicidad). Más eficiente y consistente con
      // CobroMultiCicloForm.
      const result = await registrarPagosMultiples(
        aRegistrar.map((f) => ({
          cicloId,
          peopleId: f.peopleId,
          monto: parseFloat(f.monto),
          fechaPago: f.fecha ? inputDateToTimestamp(f.fecha) : Date.now(),
          nota: f.nota || undefined,
        }))
      );
      onDone(result.pagosCreados);
    } catch (e) {
      console.error('[CobroMasivo] error:', e);
      setGuardando(false);
    }
  };

  if (participantes.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center py-6">
        No hay participantes pendientes para cobrar.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-500">
        Tildá los que te pagaron, ajustá el monto si es distinto a la cuota, y
        registrá todo de una.
      </div>

      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {filas.map((f) => (
          <div
            key={f.peopleId}
            className={`rounded-lg border p-3 transition-colors ${
              f.incluir
                ? 'border-primary/40 bg-primary/5'
                : 'border-slate-200 dark:border-slate-700 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <Checkbox
                  checked={f.incluir}
                  onChange={(v) => setFila(f.peopleId, { incluir: v })}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <div className="text-sm font-medium">{f.nombre}</div>
                  <div className="text-xs text-slate-500">
                    {f.estado === 'parcial' ? (
                      <>
                        Ya pagó {formatCurrency(f.montoYaPagado, moneda)} ·{' '}
                        <span className="text-amber-600 font-medium">
                          faltan {formatCurrency(f.falta, moneda)}
                        </span>
                      </>
                    ) : f.cuotaEsperada > 0 ? (
                      <>
                        Cuota{' '}
                        <span className="font-medium">
                          {formatCurrency(f.cuotaEsperada, moneda)}
                        </span>
                      </>
                    ) : (
                      'Sin cuota asignada'
                    )}
                  </div>
                </div>
                {f.incluir && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Monto">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={f.monto}
                        onChange={(e) =>
                          setFila(f.peopleId, { monto: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Fecha">
                      <DatePicker
                        value={f.fecha}
                        max={hoyStr}
                        onChange={(v) => setFila(f.peopleId, { fecha: v })}
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
        <div className="text-sm">
          <div className="text-slate-500">A registrar</div>
          <div className="font-bold tabular-nums">
            {cantSeleccionados} {cantSeleccionados === 1 ? 'pago' : 'pagos'} ·{' '}
            {formatCurrency(totalSeleccionado, moneda)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={handleRegistrar} disabled={guardando || cantSeleccionados === 0}>
            {guardando ? 'Guardando…' : 'Registrar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatearPeriodoLegible(periodo: string): string {
  // "2026-07" → "Julio 2026"
  // "2026-07-15" → "15 jul 2026"
  // "2026-W28" → "Semana 28, 2026"
  const matchMes = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (matchMes) {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const m = parseInt(matchMes[2], 10);
    if (m >= 1 && m <= 12) return `${meses[m - 1]} ${matchMes[1]}`;
  }
  return periodo;
}
