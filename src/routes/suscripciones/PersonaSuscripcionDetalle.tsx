// src/routes/suscripciones/PersonaSuscripcionDetalle.tsx
// Vista de "Meses que me debe una persona en una suscripción".
// Muestra todos los ciclos (pagados, parciales, pendientes) de la
// combinación (persona, suscripción), ordenados del más viejo al más
// nuevo. Los pendientes aparecen arriba con acción "Pagar" o
// "Completar"; los pagados van en una sección colapsable.
// Reusa ModalCobroRapido (un pago) y CobroMultiCicloForm (varios).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  CircleDollarSign,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
} from 'lucide-react';
import { useQuery } from '../../db/useQuery';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { EmptyState } from '../../components/EmptyState';
import { CurrencyText } from '../../components/ui/CurrencyIcon';
import { ModalCobroRapido, type ParticipanteLite } from '../../components/suscripcion/ModalCobroRapido';
import { CobroMultiCicloForm } from '../../components/suscripcion/CobroMultiCicloForm';
import { generateTicketPDF } from '../../lib/pdf/ticketDeuda';
import { armarDatosTicket, getPagosCrudosParaPersona } from '../../lib/pdf/ticketData';
import { FileDown } from 'lucide-react';
import {
  getCiclosPorPersonaSuscripcion,
  getResumenDeudaPersonaSuscripcion,
  type CicloPersonaSuscripcion,
} from '../../lib/balanceCompartido';
import { useCurrentProfile, usePerson } from '../../hooks/useProfile';
import { getCuentasPagoDelEmisor } from '../../hooks/useCuentasPago';
import type { CicloParaTicket } from '../../lib/pdf/ticketData';
import type { CuentaPagoResumen } from '../../lib/pdf/ticketDeuda';
import { formatDate, getPeriodoLabel } from '../../lib/format';
import {
  deletePago,
  asegurarCiclosSuscripcion,
} from '../../hooks/useSuscripciones';
import { useUIStore } from '../../stores/useUIStore';

export function PersonaSuscripcionDetalle() {
  const { id: suscripcionId, peopleId } = useParams<{ id: string; peopleId: string }>();
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const [refreshKey, setRefreshKey] = useState(0);
  const [payingCiclo, setPayingCiclo] = useState<CicloPersonaSuscripcion | null>(null);
  const [cobroMasivo, setCobroMasivo] = useState(false);
  const [showPaid, setShowPaid] = useState(false);

  // Datos del emisor (el "yo" actual) para mostrar el nombre real
  // en el PDF en vez de "Yo".
  const { profile } = useCurrentProfile();
  const { person: emisorSelf } = usePerson(profile?.personId ?? null);

  // Datos de la suscripción (reactivo: re-render cuando cambie).
  const { data: suscRows } = useQuery<any>(
    'SELECT id, nombre, color, moneda, dia_vencimiento, fecha_inicio FROM suscripciones WHERE id = ?',
    suscripcionId ? [suscripcionId] : []
  );
  const suscripcion = suscRows[0] as
    | {
        id: string;
        nombre: string;
        color: string;
        moneda: 'ARS' | 'USD' | 'EUR' | 'GTQ';
        dia_vencimiento: number | null;
        fecha_inicio: number;
      }
    | undefined;

  // Datos de la persona (reactivo).
  const { data: personRows } = useQuery<any>(
    'SELECT id, nombre, iniciales, color, is_self FROM people WHERE id = ?',
    peopleId ? [peopleId] : []
  );
  const persona = personRows[0] as
    | { id: string; nombre: string; iniciales: string; color: string; is_self: number }
    | undefined;

  // Ciclos de esta combinación. Se re-corre cuando cambia refreshKey
  // (que se incrementa después de un pago o un borrado).
  const ciclos = useMemo<CicloPersonaSuscripcion[]>(() => {
    if (!suscripcionId || !peopleId) return [];
    const result = getCiclosPorPersonaSuscripcion(peopleId, suscripcionId);
    // eslint-disable-next-line no-console
    console.log('[PersonaSuscripcionDetalle] ciclos query', {
      suscripcionId,
      peopleId,
      count: result.length,
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suscripcionId, peopleId, refreshKey]);

  const resumen = useMemo(() => {
    if (!suscripcionId || !peopleId) return null;
    return getResumenDeudaPersonaSuscripcion(peopleId, suscripcionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suscripcionId, peopleId, refreshKey]);

  // Self-heal: si la suscripción existe pero no hay ciclos
  // generados todavía, intentamos generarlos al toque. Útil para
  // suscripciones viejas donde el generador falló silenciosamente.
  const [autoRegenIntentado, setAutoRegenIntentado] = useState(false);
  useEffect(() => {
    if (
      suscripcionId &&
      suscRows.length > 0 &&     // suscripción cargada
      ciclos.length === 0 &&     // sin ciclos
      !autoRegenIntentado        // no intentamos ya
    ) {
      setAutoRegenIntentado(true);
      (async () => {
        const created = await asegurarCiclosSuscripcion(suscripcionId);
        // eslint-disable-next-line no-console
        console.log(
          '[PersonaSuscripcionDetalle] auto-regenerar ciclos:',
          { suscripcionId, created }
        );
        if (created > 0) {
          showToast(
            `Se generaron ${created} ciclo${created === 1 ? '' : 's'} automáticamente`,
            'success'
          );
        } else {
          showToast(
            'No se generaron ciclos nuevos. Revisá la fecha de inicio de la suscripción.',
            'info'
          );
        }
        setRefreshKey((k) => k + 1);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suscripcionId, suscRows.length, ciclos.length, autoRegenIntentado]);

  // No encontrada la suscripción o la persona.
  if (suscRows.length > 0 && !suscripcion) {
    return (
      <PantallaNoEncontrada
        titulo="Suscripción no encontrada"
        detalle="La suscripción que buscás no existe o fue eliminada."
        onBack={() => navigate(-1)}
      />
    );
  }
  if (personRows.length > 0 && !persona) {
    return (
      <PantallaNoEncontrada
        titulo="Persona no encontrada"
        detalle="La persona que buscás no existe."
        onBack={() => navigate(-1)}
      />
    );
  }

  // Si la suscripción o persona todavía no llegaron (loading), placeholder.
  if (!suscripcion || !persona || !resumen) {
    return (
      <div className="p-4 text-center text-slate-500">Cargando…</div>
    );
  }

  const pendientes = ciclos.filter((c) => c.estadoPorPersona !== 'completo');
  const pagados = ciclos.filter((c) => c.estadoPorPersona === 'completo');

  // Armamos un objeto "DeudaPorPersona" sintético para reutilizar
  // CobroMultiCicloForm (que espera esa forma).
  const deudaSintetica = {
    peopleId: persona.id,
    nombre: persona.nombre,
    iniciales: persona.iniciales,
    color: persona.color,
    isSelf: !!persona.is_self,
    total: resumen.totalAdeudado,
    totalVencido: resumen.totalVencido,
    cantidadCiclos: resumen.cantidadCiclosPendientes,
    cantidadVencidos: resumen.cantidadCiclosVencidos,
    // Solo los pendientes; el modal filtra por `ciclosOverride`.
    ciclos: pendientes.map((c) => ({
      cicloId: c.cicloId,
      suscripcionId: c.suscripcionId,
      suscripcionNombre: c.suscripcionNombre,
      suscripcionColor: c.suscripcionColor,
      periodo: c.periodo,
      fechaVencimiento: c.fechaVencimiento,
      cuotaEsperada: c.cuotaEsperada,
      pagado: c.totalPagado,
      pendiente: c.pendiente,
      vencido: c.vencido,
      diasAtraso: c.diasAtraso,
    })),
  };

  // Participante en formato "lite" para ModalCobroRapido.
  const participanteLite: ParticipanteLite = {
    peopleId: persona.id,
    nombre: persona.nombre,
    iniciales: persona.iniciales,
    color: persona.color,
    isSelf: !!persona.is_self,
    cuotaEsperada: payingCiclo?.cuotaEsperada ?? 0,
    montoPagado: payingCiclo?.totalPagado ?? 0,
    falta: payingCiclo?.pendiente ?? 0,
    estado: payingCiclo?.estadoPorPersona ?? 'pendiente',
  };

  const hayPendientes = pendientes.length > 0;
  const todoPagado = !hayPendientes && pagados.length > 0;

  return (
    <div className="space-y-4">
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
            {suscripcion.nombre}
          </div>
          <h2 className="text-lg font-bold truncate">
            Meses con {persona.nombre}
            {!!persona.is_self && (
              <span className="ml-1 text-sm text-slate-400 font-normal">(yo)</span>
            )}
          </h2>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: suscripcion.color }}
          aria-hidden
        >
          <span className="text-xs font-bold">
            {suscripcion.nombre.slice(0, 2).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Resumen */}
      <Card>
        <div className="flex items-center gap-3">
          <ProfileAvatar
            nombre={persona.nombre}
            iniciales={persona.iniciales}
            color={persona.color}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold">
              {persona.nombre}
              {!!persona.is_self && (
                <span className="ml-2 text-xs text-slate-500 font-normal">(yo)</span>
              )}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar size={10} />
              {suscripcion.nombre} · día {suscripcion.dia_vencimiento ?? '?'} de cada mes
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-slate-500">Adeudado</div>
            <div className="font-bold text-red-600 tabular-nums">
              <CurrencyText moneda={suscripcion.moneda} monto={resumen.totalAdeudado} size="sm" />
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Vencido</div>
            <div className="font-bold text-red-700 tabular-nums">
              <CurrencyText moneda={suscripcion.moneda} monto={resumen.totalVencido} size="sm" />
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Ciclos</div>
            <div className="font-bold text-slate-700 tabular-nums">
              {resumen.cantidadCiclosPendientes} / {resumen.cantidadCiclosTotal}
            </div>
          </div>
        </div>
        {hayPendientes && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <Button
              fullWidth
              size="lg"
              variant="primary"
              onClick={() => setCobroMasivo(true)}
            >
              <CircleDollarSign size={18} /> Cobrar adeudos pendientes (
              {pendientes.length})
            </Button>
          </div>
        )}
        <div className="mt-3">
          <Button
            fullWidth
            size="md"
            variant="secondary"
            onClick={async () => {
              try {
                const pagosCrudos = getPagosCrudosParaPersona(persona.id, {
                  suscripcionId: suscripcion.id,
                });
                const ciclosPendientes: CicloParaTicket[] = ciclos
                  .filter((c) => c.estadoPorPersona !== 'completo')
                  .map((c) => ({
                    cicloId: c.cicloId,
                    suscripcionId: c.suscripcionId,
                    suscripcionNombre: c.suscripcionNombre,
                    suscripcionColor: c.suscripcionColor,
                    suscripcionIcono: c.suscripcionIcono,
                    periodo: c.periodo,
                    fechaVencimiento: c.fechaVencimiento,
                    cuotaEsperada: c.cuotaEsperada,
                    totalPagado: c.totalPagado,
                    pendiente: c.pendiente,
                    vencido: c.vencido,
                    diasAtraso: c.diasAtraso,
                  }));
                const params = armarDatosTicket({
                  scope: 'single',
                  suscripcionId: suscripcion.id,
                  suscripcionNombre: suscripcion.nombre,
                  ciclos: ciclosPendientes,
                  pagos: pagosCrudos,
                  deudor: { nombre: persona.nombre },
                  emisor: {
                    nombre: emisorSelf?.nombre ?? profile?.nombre ?? 'Yo',
                    contacto: emisorSelf?.contacto,
                  },
                  moneda: suscripcion.moneda,
                  cuentasPago: emisorSelf
                    ? getCuentasPagoDelEmisor(emisorSelf.id).map<CuentaPagoResumen>((c) => ({
                        banco: c.banco,
                        tipo: c.tipo,
                        numero: c.numero,
                      }))
                    : undefined,
                });
                await generateTicketPDF(params);
                showToast('PDF generado', 'success');
              } catch (e: any) {
                showToast(e?.message ?? 'Error al generar PDF', 'error');
              }
            }}
          >
            <FileDown size={16} /> Descargar estado de cuenta (PDF)
          </Button>
        </div>
        {todoPagado && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="inline-flex items-center gap-1.5 text-success font-semibold text-sm">
              <Check size={16} strokeWidth={3} /> {persona.nombre} está al día
              con {suscripcion.nombre}
            </div>
          </div>
        )}
      </Card>

      {/* Lista de meses pendientes */}
      {hayPendientes && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold px-1">
            Pendientes ({pendientes.length})
          </div>
          {pendientes.map((c) => (
            <MesCard
              key={c.cicloId}
              ciclo={c}
              moneda={suscripcion.moneda}
              onPagar={() => setPayingCiclo(c)}
            />
          ))}
        </div>
      )}

      {/* Sección colapsable: pagados antes */}
      {pagados.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowPaid((s) => !s)}
            className="w-full flex items-center justify-between text-xs uppercase tracking-wider text-slate-500 font-semibold px-1 py-1 hover:text-slate-700 dark:hover:text-slate-300"
            aria-expanded={showPaid}
          >
            <span>Pagados antes ({pagados.length})</span>
            {showPaid ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showPaid && (
            <div className="space-y-2">
              {pagados.map((c) => (
                <MesCard
                  key={c.cicloId}
                  ciclo={c}
                  moneda={suscripcion.moneda}
                  onDeletePago={async (pagoId) => {
                    if (!confirm('¿Eliminar este pago? El mes volverá a "Pendiente".')) return;
                    try {
                      await deletePago(pagoId);
                      showToast('Pago eliminado', 'success');
                      setRefreshKey((k) => k + 1);
                    } catch (e: any) {
                      showToast(e?.message ?? 'Error al eliminar', 'error');
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Si no hay ciclos en absoluto */}
      {!hayPendientes && pagados.length === 0 && (
        <EmptyState
          icon={Clock}
          title="Sin meses"
          description={`${persona.nombre} no tiene cuotas registradas en ${suscripcion.nombre}. La fecha de inicio de la suscripción es ${formatDate(suscripcion.fecha_inicio)}. Si es anterior a hoy, regenerá los ciclos para crearlos. Si es posterior a hoy, no hay nada que adeudar todavía.`}
          action={
            <Button
              onClick={async () => {
                if (!suscripcionId) return;
                // eslint-disable-next-line no-console
                console.log(
                  '[PersonaSuscripcionDetalle] click Regenerar, suscripcionId=',
                  suscripcionId,
                  'fecha_inicio=',
                  suscripcion?.fecha_inicio
                );
                const created = await asegurarCiclosSuscripcion(suscripcionId);
                // eslint-disable-next-line no-console
                console.log('[PersonaSuscripcionDetalle] generados:', created);
                if (created > 0) {
                  showToast(
                    `Se generaron ${created} ciclo${created === 1 ? '' : 's'}`,
                    'success'
                  );
                } else {
                  showToast(
                    'No se generaron ciclos. Verificá la fecha de inicio de la suscripción (debe ser anterior a hoy).',
                    'info'
                  );
                }
                setRefreshKey((k) => k + 1);
              }}
            >
              <CircleDollarSign size={16} /> Regenerar ciclos
            </Button>
          }
        />
      )}

      {/* Modal: pago puntual de un mes */}
      {payingCiclo && (
        <ModalCobroRapido
          open
          onClose={() => setPayingCiclo(null)}
          cicloId={payingCiclo.cicloId}
          contexto={`${suscripcion.nombre} · ${getPeriodoLabel(payingCiclo.periodo)}`}
          moneda={suscripcion.moneda}
          participantes={[participanteLite]}
          defaultPeopleId={persona.id}
          defaultMonto={payingCiclo.pendiente}
          onSaved={() => {
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Modal: cobro masivo (varios meses pendientes de esta suscripción) */}
      {cobroMasivo && (
        <CobroMultiCicloForm
          open
          onClose={() => setCobroMasivo(false)}
          deuda={deudaSintetica as any}
          onSaved={() => {
            setCobroMasivo(false);
            setRefreshKey((k) => k + 1);
            showToast('Pagos registrados', 'success');
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Subcomponentes
// ============================================================================

function MesCard({
  ciclo,
  moneda,
  onPagar,
  onDeletePago,
}: {
  ciclo: CicloPersonaSuscripcion;
  moneda: 'ARS' | 'USD' | 'EUR' | 'GTQ';
  onPagar?: () => void;
  onDeletePago?: (pagoId: string) => void;
}) {
  const esCompleto = ciclo.estadoPorPersona === 'completo';
  const esParcial = ciclo.estadoPorPersona === 'parcial';
  const sinCuota = ciclo.estadoPorPersona === 'sin_cuota';

  const iconoBadge = esCompleto ? (
    <span className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center">
      <Check size={12} strokeWidth={3} />
    </span>
  ) : esParcial ? (
    <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
      <CircleDollarSign size={12} strokeWidth={3} />
    </span>
  ) : sinCuota ? (
    <span className="w-6 h-6 rounded-full bg-slate-300 text-white flex items-center justify-center">
      <Clock size={12} />
    </span>
  ) : (
    <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center">
      <X size={12} strokeWidth={3} />
    </span>
  );

  // Texto del estado (legible).
  let textoEstado: React.ReactNode;
  if (esCompleto) {
    textoEstado = (
      <span className="text-success font-medium">Pagó todo</span>
    );
  } else if (esParcial) {
    textoEstado = (
      <span className="text-amber-600 font-medium">
        Pagó una parte
      </span>
    );
  } else if (sinCuota) {
    textoEstado = <span className="text-slate-500">Sin cuota asignada</span>;
  } else if (ciclo.vencido) {
    textoEstado = (
      <span className="text-red-500 font-medium">
        Debe
        {ciclo.diasAtraso > 0 && (
          <Badge variant="danger" className="!py-0 ml-1">
            -{ciclo.diasAtraso}d
          </Badge>
        )}
      </span>
    );
  } else {
    textoEstado = <span className="text-red-500 font-medium">Debe</span>;
  }

  return (
    <Card className="!p-3">
      <div className="flex items-start gap-3">
        {iconoBadge}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-sm">
              {getPeriodoLabel(ciclo.periodo)}
            </div>
            {esCompleto ? null : ciclo.vencido ? (
              <Badge variant="danger">-{ciclo.diasAtraso}d</Badge>
            ) : (
              <Badge variant="warning">Pendiente</Badge>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Vence {formatDate(ciclo.fechaVencimiento)} · Cuota{' '}
            <CurrencyText moneda={moneda} monto={ciclo.cuotaEsperada} size="xs" />
          </div>
          <div className="text-xs mt-1">{textoEstado}</div>
          {esParcial && (
            <div className="text-xs text-slate-500 mt-0.5">
              Pagó{' '}
              <CurrencyText moneda={moneda} monto={ciclo.totalPagado} size="xs" className="text-amber-600 font-medium" />
              <span> · falta </span>
              <CurrencyText moneda={moneda} monto={ciclo.pendiente} size="xs" className="text-red-500 font-medium" />
            </div>
          )}
          {esCompleto && ciclo.pagos.length > 0 && (
            <div className="text-xs text-slate-500 mt-0.5 space-y-0.5">
              {ciclo.pagos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1 flex-wrap"
                >
                  <span>
                    Pagó{' '}
                    <CurrencyText moneda={moneda} monto={p.monto} size="xs" /> el{' '}
                    {formatDate(p.fechaPago)}
                  </span>
                  {onDeletePago && (
                    <button
                      onClick={() => onDeletePago(p.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="Eliminar pago"
                      aria-label="Eliminar pago"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {!esCompleto && !sinCuota && onPagar && (
          <Button
            size="sm"
            variant={esParcial ? 'primary' : 'secondary'}
            onClick={onPagar}
          >
            {esParcial ? 'Completar' : 'Pagar'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function PantallaNoEncontrada({
  titulo,
  detalle,
  onBack,
}: {
  titulo: string;
  detalle: string;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">{titulo}</h2>
      </div>
      <EmptyState title={titulo} description={detalle} />
    </div>
  );
}
