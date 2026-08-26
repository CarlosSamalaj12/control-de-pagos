// src/routes/tabs/CompartidasTab.tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Users,
  Trash2,
  Pencil,
  Check,
  X,
  CircleDollarSign,
  ChevronRight,
  Clock,
  Download,
} from 'lucide-react';
import {
  useSuscripciones,
  useCiclosPeriodo,
  deleteSuscripcion,
  useParticipantesPorPeriodo,
  asegurarCiclosSuscripcion,
  type ParticipantePorPeriodo,
} from '../../hooks/useSuscripciones';
import { usePeople, useCurrentProfile, usePerson } from '../../hooks/useProfile';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Progress } from '../../components/ui/Progress';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { CurrencyText } from '../../components/ui/CurrencyIcon';
import { ModalCobroRapido, type ParticipanteLite } from '../../components/suscripcion/ModalCobroRapido';
import { generateTicketPDF } from '../../lib/pdf/ticketDeuda';
import {
  armarDatosTicket,
  getPagosCrudosParaPersona,
  type CicloParaTicket,
} from '../../lib/pdf/ticketData';
import { getCiclosPorPersonaSuscripcion } from '../../lib/balanceCompartido';
import { getCuentasPagoDelEmisor } from '../../hooks/useCuentasPago';
import type { CuentaPagoResumen } from '../../lib/pdf/ticketDeuda';
import { formatDate, MESES_ES, getPeriodoLabel } from '../../lib/format';
import { useUIStore } from '../../stores/useUIStore';
import { getBalancePorPersona } from '../../lib/balanceCompartido';
import type { Moneda } from '../../types';
import { MONEDA_PRINCIPAL } from '../../types';

export function CompartidasTab() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const { suscripciones } = useSuscripciones();
  const { people } = usePeople();
  const { profile } = useCurrentProfile();
  const { person: emisorSelf } = usePerson(profile?.personId ?? null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const periodo = `${year}-${String(month).padStart(2, '0')}`;
  const ciclos = useCiclosPeriodo(periodo);
  // Hook reactivo con TODOS los participantes de TODAS las suscripciones del mes
  const { items: participantesMes } = useParticipantesPorPeriodo(year, month);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showBalance, setShowBalance] = useState(false);
  const [cobroRapido, setCobroRapido] = useState<{
    cicloId: string;
    suscripcionNombre: string;
    periodo: string;
    moneda: Moneda;
    participante: ParticipanteLite;
  } | null>(null);

  // Agrupar participantes por suscripción
  const participantesPorSuscripcion = useMemo(() => {
    const map = new Map<string, ParticipantePorPeriodo[]>();
    for (const p of participantesMes) {
      const list = map.get(p.suscripcionId) ?? [];
      list.push(p);
      map.set(p.suscripcionId, list);
    }
    return map;
  }, [participantesMes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Suscripciones</h2>
          <div className="text-sm text-slate-500">{MESES_ES[month - 1]} {year}</div>
        </div>
        <Button onClick={() => navigate('/suscripciones/nueva')}>
          <Plus size={18} /> Nueva
        </Button>
      </div>

      {suscripciones.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin suscripciones"
          description="Cargá tu primera suscripción compartida para empezar."
          action={
            <Button onClick={() => navigate('/suscripciones/nueva')}>
              <Plus size={18} /> Crear suscripción
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {suscripciones.map((s) => {
            const ciclo = ciclos.find((c) => c.suscripcionId === s.id);
            const cobrado = (ciclo as any)?.cobrado ?? 0;
            const pct = s.costoTotal > 0 ? (cobrado / s.costoTotal) * 100 : 0;
            const parts = participantesPorSuscripcion.get(s.id) ?? [];
            const completos = parts.filter((p) => p.estado === 'completo').length;
            const parciales = parts.filter((p) => p.estado === 'parcial').length;
            const pendientes = parts.filter((p) => p.estado === 'pendiente').length;
            const hayDeuda = pendientes + parciales > 0;

            return (
              <SuscripcionCardMejorada
                key={s.id}
                suscripcion={s}
                participantes={parts}
                estado={(ciclo as any)?.estado ?? 'pendiente'}
                fechaVencimiento={(ciclo as any)?.fechaVencimiento}
                cicloId={(ciclo as any)?.id}
                cobrado={cobrado}
                pct={pct}
                completos={completos}
                parciales={parciales}
                pendientes={pendientes}
                hayDeuda={hayDeuda}
                onClick={() => undefined}
                onSelectPersona={(p) =>
                  navigate(`/suscripciones/${s.id}/persona/${p.peopleId}`)
                }
                onVerCiclo={async () => {
                  // Si el ciclo del mes actual todavía no fue generado
                  // (por ejemplo, la suscripción se creó con
                  // fecha_inicio futura, o el generador falló
                  // silenciosamente), lo creamos al toque. Después
                  // navegamos al detalle del ciclo.
                  if (!ciclo) {
                    await asegurarCiclosSuscripcion(s.id);
                    // Después de regenerar, el useQuery se va a
                    // refrescar y `ciclo` aparecerá en el próximo
                    // render. Para no demorar la navegación,
                    // navegamos a la vista de persona del primer
                    // participante con deuda, que es lo que el
                    // usuario realmente quiere ver.
                    const primerDeudor = parts.find(
                      (p) => p.estado === 'pendiente' || p.estado === 'parcial'
                    );
                    if (primerDeudor) {
                      navigate(
                        `/suscripciones/${s.id}/persona/${primerDeudor.peopleId}`
                      );
                      return;
                    }
                    if (parts[0]) {
                      navigate(
                        `/suscripciones/${s.id}/persona/${parts[0].peopleId}`
                      );
                      return;
                    }
                    // Sin participantes: caemos al edit form como
                    // último recurso.
                    navigate(`/suscripciones/${s.id}`);
                    return;
                  }
                  navigate(`/ciclos/${ciclo.id}`);
                }}
                onEdit={() => navigate(`/suscripciones/${s.id}`)}
                onDelete={() => setDeleteId(s.id)}
                onDescargarEstadoDeCuenta={async (p) => {
                  try {
                    // Traemos TODOS los ciclos de (persona, suscripción) y
                    // dejamos solo los que no están completamente pagados
                    // para que el PDF muestre el historial real de deuda
                    // (no un único "ticket resumen" del mes).
                    const ciclosReales = getCiclosPorPersonaSuscripcion(
                      p.peopleId,
                      s.id
                    );
                    const ciclosParaTicket: CicloParaTicket[] = ciclosReales
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
                    const pagosCrudos = getPagosCrudosParaPersona(p.peopleId, {
                      suscripcionId: s.id,
                    });
                    const cuentasPago: CuentaPagoResumen[] = emisorSelf
                      ? getCuentasPagoDelEmisor(emisorSelf.id).map((c) => ({
                          banco: c.banco,
                          tipo: c.tipo,
                          numero: c.numero,
                        }))
                      : [];
                    const params = armarDatosTicket({
                      scope: 'single',
                      suscripcionId: s.id,
                      suscripcionNombre: s.nombre,
                      ciclos: ciclosParaTicket,
                      pagos: pagosCrudos,
                      deudor: { nombre: p.nombre },
                      emisor: { nombre: profile?.nombre ?? 'Yo' },
                      moneda: s.moneda,
                      cuentasPago,
                    });
                    await generateTicketPDF(params);
                    showToast('PDF generado', 'success');
                  } catch (e: any) {
                    showToast(e?.message ?? 'Error al generar PDF', 'error');
                  }
                }}
                onCobrarParticipante={async (p) => {
                  if (!ciclo) {
                    // Si no hay ciclo del mes actual, lo generamos al
                    // toque y abrimos el modal con el ciclo recién creado.
                    await asegurarCiclosSuscripcion(s.id);
                    const nuevoCiclo = ciclos.find((c) => c.suscripcionId === s.id);
                    if (nuevoCiclo) {
                      setCobroRapido({
                        cicloId: nuevoCiclo.id,
                        suscripcionNombre: s.nombre,
                        periodo: nuevoCiclo.periodo,
                        moneda: s.moneda,
                        participante: {
                          peopleId: p.peopleId,
                          nombre: p.nombre,
                          iniciales: p.iniciales,
                          color: p.color,
                          isSelf: p.isSelf,
                          cuotaEsperada: p.cuotaEsperada,
                          montoPagado: p.montoPagado,
                          falta: p.falta,
                          estado: p.estado,
                        },
                      });
                    } else {
                      // No se pudo generar (e.g. fecha_inicio en el
                      // futuro). Redirigir a la vista de persona para
                      // que use el botón "Regenerar ciclos".
                      navigate(`/suscripciones/${s.id}/persona/${p.peopleId}`);
                    }
                    return;
                  }
                  setCobroRapido({
                    cicloId: ciclo.id,
                    suscripcionNombre: s.nombre,
                    periodo: (ciclo as any).periodo,
                    moneda: s.moneda,
                    participante: {
                      peopleId: p.peopleId,
                      nombre: p.nombre,
                      iniciales: p.iniciales,
                      color: p.color,
                      isSelf: p.isSelf,
                      cuotaEsperada: p.cuotaEsperada,
                      montoPagado: p.montoPagado,
                      falta: p.falta,
                      estado: p.estado,
                    },
                  });
                }}
              />
            );
          })}
        </div>
      )}

      {people.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Quién debe</div>
            <button onClick={() => navigate('/deudas')} className="text-xs text-brand-accent font-semibold">
              Ver detalle
            </button>
          </div>
          <div className="text-sm text-slate-500">Tocá "Ver detalle" para ver todas las deudas y generar un ticket PDF.</div>
        </Card>
      )}

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="¿Eliminar suscripción?">
        <p className="text-sm text-slate-600 mb-4">
          Se eliminarán también los ciclos y pagos asociados. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button
            variant="danger"
            fullWidth
            onClick={async () => {
              if (!deleteId) return;
              try {
                await deleteSuscripcion(deleteId);
                showToast('Suscripción eliminada', 'success');
                setDeleteId(null);
              } catch (e: any) {
                showToast(e.message, 'error');
              }
            }}
          >
            Eliminar
          </Button>
        </div>
      </Modal>

      <BalanceModal open={showBalance} onClose={() => setShowBalance(false)} year={year} month={month} />

      {/* Modal de cobro rápido (flujo A): se abre desde el botón "Cobrar"
          inline en cada fila de participante. No navega a /ciclos/:id. */}
      {cobroRapido && (
        <ModalCobroRapido
          open
          onClose={() => setCobroRapido(null)}
          cicloId={cobroRapido.cicloId}
          contexto={`${cobroRapido.suscripcionNombre} · ${getPeriodoLabel(cobroRapido.periodo)}`}
          moneda={cobroRapido.moneda}
          participantes={[cobroRapido.participante]}
          defaultPeopleId={cobroRapido.participante.peopleId}
          defaultMonto={cobroRapido.participante.falta}
          onSaved={() => setCobroRapido(null)}
        />
      )}
    </div>
  );
}

interface SuscripcionCardMejoradaProps {
  suscripcion: any;
  participantes: ParticipantePorPeriodo[];
  estado: string;
  fechaVencimiento?: number;
  cicloId?: string;
  cobrado: number;
  pct: number;
  completos: number;
  parciales: number;
  pendientes: number;
  hayDeuda: boolean;
  /** @deprecated usar `onSelectPersona` o `onVerCiclo`. Se mantiene por compat. */
  onClick: () => void;
  /** Tap en una fila de participante → nueva vista persona-suscripción. */
  onSelectPersona: (p: ParticipantePorPeriodo) => void;
  /** CTA inferior → detalle del ciclo (todos los participantes del mes). */
  onVerCiclo: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCobrarParticipante: (p: ParticipantePorPeriodo) => void;
  /** Descargar PDF del estado de cuenta de (persona, suscripción). */
  onDescargarEstadoDeCuenta: (p: ParticipantePorPeriodo) => void;
}

function SuscripcionCardMejorada({
  suscripcion: s,
  participantes,
  estado,
  fechaVencimiento,
  cobrado,
  pct,
  completos,
  parciales,
  pendientes,
  hayDeuda,
  onSelectPersona,
  onVerCiclo,
  onEdit,
  onDelete,
  onCobrarParticipante,
  onDescargarEstadoDeCuenta,
}: SuscripcionCardMejoradaProps) {
  return (
    <Card className="!p-3">
      {/* Header de la suscripción */}
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: s.color }}
        >
          <span className="text-xs font-bold">
            {s.nombre.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{s.nombre}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CurrencyText moneda={s.moneda} monto={s.costoTotal} size="xs" />
            <span>· día {s.diaVencimiento ?? '-'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 text-slate-400 hover:text-brand-primary"
            aria-label="Editar"
            title="Editar suscripción"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 text-slate-400 hover:text-red-500"
            aria-label="Eliminar"
            title="Eliminar suscripción"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Estado del mes */}
      <div className="mt-2 flex items-center justify-between">
        <Badge
          variant={
            estado === 'cobrado'
              ? 'success'
              : estado === 'parcial'
              ? 'warning'
              : estado === 'vencido'
              ? 'danger'
              : 'neutral'
          }
        >
          {estado === 'cobrado'
            ? 'Pagado'
            : estado === 'parcial'
            ? 'En curso'
            : estado === 'vencido'
            ? 'Vencido'
            : 'Pendiente'}
        </Badge>
        {participantes.length > 0 && (
          <div className="text-xs text-slate-500">
            <span className={completos > 0 ? 'text-success font-semibold' : 'text-slate-400'}>
              {completos}/{participantes.length}
            </span>{' '}
            {completos === 1 ? 'pagó todo' : 'pagaron todo'}
            {parciales > 0 && (
              <>
                {' · '}
                <span className="text-amber-600 font-medium">
                  {parciales} {parciales === 1 ? 'pagó una parte' : 'pagaron una parte'}
                </span>
              </>
            )}
            {pendientes > 0 && (
              <>
                {' · '}
                <span className="text-red-500 font-medium">
                  {pendientes} {pendientes === 1 ? 'debe' : 'deben'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <Progress value={pct} className="mt-2" />
      <div className="flex items-center justify-between text-xs text-slate-500 mt-1 gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <CurrencyText moneda={s.moneda} monto={cobrado} size="xs" />
          <span>/</span>
          <CurrencyText moneda={s.moneda} monto={s.costoTotal} size="xs" />
        </span>
        {fechaVencimiento && <span>{formatDate(fechaVencimiento)}</span>}
      </div>

      {/* Lista de participantes con checks */}
      {participantes.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
          {participantes.map((p) => (
            <FilaParticipanteCheck
              key={p.peopleId}
              p={p}
              moneda={s.moneda}
              onClick={() => onSelectPersona(p)}
              onCobrar={
                p.estado === 'pendiente' || p.estado === 'parcial'
                  ? () => onCobrarParticipante(p)
                  : undefined
              }
              onDescargar={() => onDescargarEstadoDeCuenta(p)}
            />
          ))}
        </div>
      )}

      {/* Acción principal */}
      <div className="mt-3 flex items-center gap-2">
        {hayDeuda ? (
          <Button fullWidth size="md" onClick={onVerCiclo}>
            <CircleDollarSign size={16} /> Cobrar adeudos del mes
            <ChevronRight size={16} />
          </Button>
        ) : (
          <Button fullWidth size="md" variant="secondary" onClick={onVerCiclo}>
            Ver detalle del ciclo
            <ChevronRight size={16} />
          </Button>
        )}
      </div>
    </Card>
  );
}

function FilaParticipanteCheck({
  p,
  moneda,
  onClick,
  onCobrar,
  onDescargar,
}: {
  p: ParticipantePorPeriodo;
  moneda: string;
  onClick: () => void;
  /** Si se pasa, se renderiza un botón "Cobrar" inline que NO navega. */
  onCobrar?: () => void;
  /** Si se pasa, se renderiza un botón "Descargar" inline. */
  onDescargar?: () => void;
}) {
  let iconBg = 'bg-red-500';
  let Icon = X;
  let textoEstado: React.ReactNode;
  if (p.estado === 'completo') {
    iconBg = 'bg-success';
    Icon = Check;
    textoEstado = (
      <span className="text-success font-medium inline-flex items-center gap-1">
        Pagó todo ·{' '}
        <CurrencyText moneda={moneda as Moneda} monto={p.montoPagado} size="xs" />
      </span>
    );
  } else if (p.estado === 'parcial') {
    iconBg = 'bg-amber-500';
    Icon = CircleDollarSign;
    textoEstado = (
      <span className="inline-flex items-center gap-1 flex-wrap">
        Pagó{' '}
        <CurrencyText moneda={moneda as Moneda} monto={p.montoPagado} size="xs" className="text-amber-600 font-medium" />
        <span>· falta</span>
        <CurrencyText moneda={moneda as Moneda} monto={p.falta} size="xs" className="text-red-500 font-medium" />
      </span>
    );
  } else if (p.estado === 'pendiente') {
    iconBg = 'bg-red-500';
    Icon = X;
    textoEstado = (
      <span className="text-red-500 font-medium inline-flex items-center gap-1">
        Debe{' '}
        <CurrencyText moneda={moneda as Moneda} monto={p.cuotaEsperada} size="xs" />
      </span>
    );
  } else {
    iconBg = 'bg-slate-300';
    Icon = Clock;
    textoEstado = <span className="text-slate-500">Sin cuota</span>;
  }

  return (
    <div className="w-full flex items-center gap-2 py-1.5 px-1 -mx-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-3 min-w-0 text-left"
        title={`Ver meses de ${p.nombre}`}
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
          <div className="text-sm font-medium leading-tight">
            {p.nombre}
            {p.isSelf && <span className="ml-1 text-xs text-slate-400">(yo)</span>}
          </div>
          <div className="text-xs leading-tight">{textoEstado}</div>
        </div>
        <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 shrink-0" />
      </button>
      {onCobrar && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCobrar();
          }}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold active:scale-95 transition"
          aria-label={`Cobrar a ${p.nombre}`}
          title={`Cobrar a ${p.nombre}`}
        >
          <CircleDollarSign size={14} /> Cobrar
        </button>
      )}
      {onDescargar && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDescargar();
          }}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-brand-primary hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition"
          aria-label={`Descargar estado de cuenta de ${p.nombre}`}
          title={`Descargar estado de cuenta de ${p.nombre} (esta suscripción)`}
        >
          <Download size={16} />
        </button>
      )}
    </div>
  );
}

function BalanceModal({ open, onClose, year, month }: { open: boolean; onClose: () => void; year: number; month: number }) {
  const navigate = useNavigate();
  const balance = open ? getBalancePorPersona(year, month) : [];
  return (
    <Modal open={open} onClose={onClose} title={`Balance ${MESES_ES[month - 1]} ${year}`}>
      <div className="space-y-2">
        {balance.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4">Sin suscripciones activas</div>
        ) : balance.map((b) => (
          <button
            key={b.peopleId}
            onClick={() => { onClose(); navigate(`/deudas/${b.peopleId}`); }}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-95 transition"
          >
            <div className="flex items-center gap-3">
              <ProfileAvatar nombre={b.nombre} iniciales={b.iniciales} color={b.color} size="md" />
              <div className="text-left">
                <div className="font-medium text-sm">{b.nombre}{b.isSelf ? ' (yo)' : ''}</div>
                <div className="text-xs text-slate-500">{b.detalle.length} suscripciones</div>
              </div>
            </div>
            <div className={`font-bold ${b.saldo >= 0 ? 'text-success' : 'text-red-600'}`}>
              {b.saldo >= 0 ? '+' : ''}
              <CurrencyText moneda={MONEDA_PRINCIPAL} monto={b.saldo} size="sm" />
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
