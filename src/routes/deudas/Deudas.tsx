// src/routes/deudas/Deudas.tsx
// Vista global de deudas: lista todas las personas que deben, con sus
// ciclos pendientes y opción de generar ticket PDF o registrar el pago
// directo desde acá (sin tener que ir a CicloDetalle).
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileDown,
  ChevronRight,
  Calendar,
  CircleDollarSign,
  ListChecks,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { Badge } from '../../components/ui/Badge';
import { getDeudasPorPersona, getResumenDeudas } from '../../lib/balanceCompartido';
import { formatCurrency, formatDate, getPeriodoLabel } from '../../lib/format';
import { generateTicketPDF } from '../../lib/pdf/ticketDeuda';
import {
  armarDatosTicket,
  getPagosCrudosParaPersona,
  type CicloParaTicket,
} from '../../lib/pdf/ticketData';
import { useCurrentProfile, usePerson } from '../../hooks/useProfile';
import { getCuentasPagoDelEmisor } from '../../hooks/useCuentasPago';
import type { CuentaPagoResumen } from '../../lib/pdf/ticketDeuda';
import { useUIStore } from '../../stores/useUIStore';
import { EmptyState } from '../../components/EmptyState';
import { CobroMultiCicloForm } from '../../components/suscripcion/CobroMultiCicloForm';
import { ModalCobroRapido, type ParticipanteLite } from '../../components/suscripcion/ModalCobroRapido';
import { BarraAccionesFlotante } from '../../components/ui/BarraAccionesFlotante';
import { useSelectionMode } from '../../hooks/useSelectionMode';
import type { DeudaCiclo, DeudaPorPersona } from '../../lib/balanceCompartido';
import { MONEDA_PRINCIPAL } from '../../types';

export function Deudas() {
  const navigate = useNavigate();
  const { peopleId } = useParams<{ peopleId?: string }>();
  const [refresh, setRefresh] = useState(0);

  // Recalcular al volver al tab (por si hubo cambios)
  useEffect(() => {
    setRefresh((x) => x + 1);
  }, []);

  const resumen = getResumenDeudas();
  const deudas = getDeudasPorPersona();

  if (peopleId) {
    const deuda = deudas.find((d) => d.peopleId === peopleId);
    if (!deuda) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/deudas')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-bold">Deuda</h2>
          </div>
          <EmptyState title="Sin deuda" description="Esta persona no tiene cuotas pendientes." />
        </div>
      );
    }
    return (
      <DeudaDetalle
        deuda={deuda}
        onBack={() => navigate('/deudas')}
        onUpdated={() => setRefresh((x) => x + 1)}
      />
    );
  }

  return (
    <DeudasList
      deudas={deudas}
      resumen={resumen}
      onRefresh={() => setRefresh((x) => x + 1)}
    />
  );
}

// ----------------------------------------------------------------------------
// Vista principal (lista de personas con deuda). Separada para poder usar el
// modo selección + el modal de cobro multi-ciclo sin enredar el branch de
// "/deudas/:peopleId".
// ----------------------------------------------------------------------------
function DeudasList({
  deudas,
  resumen,
  onRefresh,
}: {
  deudas: DeudaPorPersona[];
  resumen: ReturnType<typeof getResumenDeudas>;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const selection = useSelectionMode();
  // Modal de cobro: o "una persona" (cobro completo de su adeudo) o
  // "varias personas" (modo selección).
  const [cobroPersona, setCobroPersona] = useState<DeudaPorPersona | null>(null);
  const [cobroMultiPersona, setCobroMultiPersona] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (selection.active) selection.clear();
            else navigate(-1);
          }}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold flex-1">Deudas</h2>
        {deudas.length > 1 && !selection.active && (
          <Button size="sm" variant="secondary" onClick={selection.enter}>
            <ListChecks size={16} /> Seleccionar
          </Button>
        )}
        {selection.active && (
          <span className="text-sm text-slate-500">
            {selection.count} {selection.count === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
        )}
      </div>

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Resumen</div>
        <div className="grid grid-cols-2 gap-3 text-center mb-2">
          <div>
            <div className="text-xs text-slate-500">Total adeudado</div>
            <div className="font-bold text-lg text-red-600">{formatCurrency(resumen.totalAdeudado, MONEDA_PRINCIPAL)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Vencido</div>
            <div className="font-bold text-lg text-red-700">{formatCurrency(resumen.totalVencido, MONEDA_PRINCIPAL)}</div>
          </div>
        </div>
        <div className="text-xs text-slate-500 text-center">
          {resumen.totalPersonas} {resumen.totalPersonas === 1 ? 'persona' : 'personas'} ·{' '}
          {resumen.totalCiclosPendientes} {resumen.totalCiclosPendientes === 1 ? 'ciclo pendiente' : 'ciclos pendientes'}
          {resumen.totalCiclosVencidos > 0 && ` · ${resumen.totalCiclosVencidos} vencido${resumen.totalCiclosVencidos === 1 ? '' : 's'}`}
        </div>
      </Card>

      {deudas.length === 0 ? (
        <EmptyState
          title="¡Sin deudas!"
          description="Todos están al día con sus suscripciones."
        />
      ) : (
        <div className="space-y-2">
          {deudas.map((d) => (
            <PersonaDeudaCard
              key={d.peopleId}
              deuda={d}
              onClick={() => {
                if (selection.active) {
                  selection.toggle(d.peopleId);
                  return;
                }
                navigate(`/deudas/${d.peopleId}`);
              }}
              onCobrarTodo={() => setCobroPersona(d)}
              selectionActive={selection.active}
              selected={selection.isSelected(d.peopleId)}
            />
          ))}
        </div>
      )}

      {cobroPersona && (
        <CobroMultiCicloForm
          open
          onClose={() => setCobroPersona(null)}
          deuda={cobroPersona}
          onSaved={() => {
            setCobroPersona(null);
            onRefresh();
            showToast('Pagos registrados', 'success');
          }}
        />
      )}

      {cobroMultiPersona && (
        <CobroMultiCicloForm
          open
          onClose={() => setCobroMultiPersona(false)}
          deudas={deudas.filter((d) => selection.isSelected(d.peopleId))}
          ciclosPorDeuda={Object.fromEntries(
            deudas
              .filter((d) => selection.isSelected(d.peopleId))
              .map((d) => [d.peopleId, d.ciclos])
          )}
          onSaved={() => {
            setCobroMultiPersona(false);
            selection.clear();
            onRefresh();
            showToast('Pagos registrados', 'success');
          }}
        />
      )}

      {selection.active && (
        <BarraAccionesFlotante
          count={selection.count}
          ctaLabel={
            selection.count === 1
              ? 'Cobrar adeudo de 1'
              : `Cobrar adeudos de ${selection.count}`
          }
          ctaDisabled={selection.count === 0}
          onCta={() => setCobroMultiPersona(true)}
          onCancel={selection.clear}
        />
      )}
    </div>
  );
}

function PersonaDeudaCard({
  deuda,
  onClick,
  onCobrarTodo,
  selectionActive,
  selected,
}: {
  deuda: any;
  onClick: () => void;
  onCobrarTodo: () => void;
  selectionActive: boolean;
  selected: boolean;
}) {
  return (
    <Card
      className={`transition ${selectionActive ? (selected ? 'ring-2 ring-primary' : '') : 'cursor-pointer active:scale-[0.98]'}`}
    >
      <div className="flex items-center gap-3">
        {selectionActive && (
          <div className="shrink-0">
            <Checkbox
              checked={selected}
              onChange={() => onClick()}
              ariaLabel={`Seleccionar ${deuda.nombre}`}
            />
          </div>
        )}
        <button
          onClick={onClick}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          <ProfileAvatar
            nombre={deuda.nombre}
            iniciales={deuda.iniciales}
            color={deuda.color}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold flex items-center gap-2">
              {deuda.nombre}
              {deuda.isSelf && <span className="text-xs text-slate-500">(yo)</span>}
            </div>
            <div className="text-xs text-slate-500">
              {deuda.cantidadCiclos} {deuda.cantidadCiclos === 1 ? 'ciclo' : 'ciclos'}
              {deuda.cantidadVencidos > 0 && (
                <span className="text-red-600 font-medium">
                  {' '}
                  · {deuda.cantidadVencidos} vencido{deuda.cantidadVencidos === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold text-red-600 tabular-nums">{formatCurrency(deuda.total, MONEDA_PRINCIPAL)}</div>
            {deuda.totalVencido > 0 && (
              <div className="text-xs text-red-700">{formatCurrency(deuda.totalVencido, MONEDA_PRINCIPAL)} vencido</div>
            )}
          </div>
          {!selectionActive && <ChevronRight size={18} className="text-slate-400 shrink-0" />}
        </button>
      </div>
      {!selectionActive && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              onCobrarTodo();
            }}
          >
            <CircleDollarSign size={14} /> Cobrar adeudo completo
          </Button>
        </div>
      )}
    </Card>
  );
}

function DeudaDetalle({ deuda, onBack, onUpdated }: { deuda: any; onBack: () => void; onUpdated: () => void }) {
  const { profile } = useCurrentProfile();
  const { person: emisorSelf } = usePerson(profile?.personId ?? null);
  const { person: deudorPerson } = usePerson(deuda.peopleId);
  const showToast = useUIStore((s) => s.showToast);
  const [payingCiclo, setPayingCiclo] = useState<DeudaCiclo | null>(null);
  const [cobroMasivo, setCobroMasivo] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Detalle de deuda</h2>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <ProfileAvatar
            nombre={deuda.nombre}
            iniciales={deuda.iniciales}
            color={deuda.color}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold flex items-center gap-2">
              {deuda.nombre}
              {deuda.isSelf && <span className="text-xs text-slate-500">(yo)</span>}
            </div>
            <div className="text-xs text-slate-500">
              {deuda.cantidadCiclos} {deuda.cantidadCiclos === 1 ? 'ciclo' : 'ciclos'} · {deuda.cantidadVencidos} vencido{deuda.cantidadVencidos === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 text-center">
          <div>
            <div className="text-xs text-slate-500">Total</div>
            <div className="font-bold text-xl text-red-600">{formatCurrency(deuda.total, MONEDA_PRINCIPAL)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Vencido</div>
            <div className="font-bold text-xl text-red-700">{formatCurrency(deuda.totalVencido, MONEDA_PRINCIPAL)}</div>
          </div>
        </div>
        {/* CTA principal: cobrar todos los ciclos pendientes de una. */}
        {deuda.cantidadCiclos > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              fullWidth
              size="lg"
              variant="primary"
              onClick={() => setCobroMasivo(true)}
            >
              <CircleDollarSign size={18} /> Cobrar adeudo completo ({deuda.cantidadCiclos} {deuda.cantidadCiclos === 1 ? 'ciclo' : 'ciclos'})
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Detalle por ciclo</div>
        <div className="space-y-2">
          {deuda.ciclos.map((c: any) => (
            <CicloDeudaRow
              key={c.cicloId}
              ciclo={c}
              onPay={() => setPayingCiclo(c)}
            />
          ))}
        </div>
      </Card>

      <Button
        fullWidth
        size="lg"
        variant="secondary"
        onClick={async () => {
          try {
            const pagosCrudos = getPagosCrudosParaPersona(deuda.peopleId);
            // DeudaCiclo usa `pagado`, CicloParaTicket usa `totalPagado`.
            // Mapeamos explícitamente para que el PDF reciba el nombre
            // correcto + el color y el ícono de la suscripción.
            const ciclosParaTicket: CicloParaTicket[] = deuda.ciclos.map(
              (c: any) => ({
                cicloId: c.cicloId,
                suscripcionId: c.suscripcionId,
                suscripcionNombre: c.suscripcionNombre,
                suscripcionColor: c.suscripcionColor,
                suscripcionIcono: c.suscripcionIcono,
                periodo: c.periodo,
                fechaVencimiento: c.fechaVencimiento,
                cuotaEsperada: c.cuotaEsperada,
                totalPagado: c.pagado,
                pendiente: c.pendiente,
                vencido: c.vencido,
                diasAtraso: c.diasAtraso,
              })
            );
            const params = armarDatosTicket({
              scope: 'cross',
              ciclos: ciclosParaTicket,
              pagos: pagosCrudos,
              deudor: { nombre: deuda.nombre, contacto: deudorPerson?.contacto },
              emisor: {
                nombre: emisorSelf?.nombre ?? profile?.nombre ?? 'Yo',
                contacto: emisorSelf?.contacto,
              },
              moneda: MONEDA_PRINCIPAL,
              cuentasPago: emisorSelf
                ? getCuentasPagoDelEmisor(emisorSelf.id).map<CuentaPagoResumen>((c) => ({
                    banco: c.banco,
                    tipo: c.tipo,
                    numero: c.numero,
                  }))
                : undefined,
            });
            await generateTicketPDF(params);
          } catch (e: any) {
            showToast(e?.message ?? 'Error al generar PDF', 'error');
          }
        }}
      >
        <FileDown size={18} /> Descargar estado de cuenta (PDF)
      </Button>

      {payingCiclo && (
        <ModalCobroRapido
          open
          onClose={() => setPayingCiclo(null)}
          cicloId={payingCiclo.cicloId}
          contexto={`${payingCiclo.suscripcionNombre} · ${getPeriodoLabel(payingCiclo.periodo)}`}
          moneda="USD"
          participantes={[
            {
              peopleId: deuda.peopleId,
              nombre: deuda.nombre,
              iniciales: deuda.iniciales,
              color: deuda.color,
              isSelf: deuda.isSelf,
              cuotaEsperada: payingCiclo.cuotaEsperada,
              montoPagado: payingCiclo.pagado,
              falta: payingCiclo.pendiente,
              estado: 'pendiente',
            } as ParticipanteLite,
          ]}
          defaultPeopleId={deuda.peopleId}
          defaultMonto={payingCiclo.pendiente}
          onSaved={() => {
            setPayingCiclo(null);
            onUpdated();
          }}
        />
      )}

      {cobroMasivo && (
        <CobroMultiCicloForm
          open
          onClose={() => setCobroMasivo(false)}
          deuda={deuda}
          onSaved={() => {
            setCobroMasivo(false);
            onUpdated();
            showToast('Pagos registrados', 'success');
          }}
        />
      )}
    </div>
  );
}

function CicloDeudaRow({ ciclo, onPay }: { ciclo: any; onPay: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
      <button
        onClick={() => navigate(`/ciclos/${ciclo.cicloId}`)}
        className="flex items-center gap-3 flex-1 min-w-0 active:scale-[0.99] transition"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: ciclo.suscripcionColor }}
        >
          {ciclo.suscripcionNombre.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <div className="font-medium text-sm truncate">{ciclo.suscripcionNombre}</div>
            {ciclo.vencido && (
              <Badge variant="danger">-{ciclo.diasAtraso}d</Badge>
            )}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar size={10} />
            {getPeriodoLabel(ciclo.periodo)} · venció {formatDate(ciclo.fechaVencimiento)}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-sm text-red-600 tabular-nums">{formatCurrency(ciclo.pendiente, MONEDA_PRINCIPAL)}</div>
          <div className="text-xs text-slate-500">de {formatCurrency(ciclo.cuotaEsperada, MONEDA_PRINCIPAL)}</div>
        </div>
      </button>
      <Button size="sm" onClick={onPay} title="Registrar pago">
        <CircleDollarSign size={16} />
      </Button>
    </div>
  );
}
