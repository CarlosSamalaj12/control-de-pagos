// src/routes/deudas/TicketDeuda.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileDown, Printer } from 'lucide-react';
import { usePerson } from '../../hooks/useProfile';
import { useCurrentProfile } from '../../hooks/useProfile';
import { getDeudaDetallePara } from '../../lib/balanceCompartido';
import { generateTicketPDF } from '../../lib/pdf/ticketDeuda';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { formatCurrency } from '../../lib/format';
import { useState } from 'react';
import { Input } from '../../components/ui/Input';

export function TicketDeuda() {
  const { peopleId } = useParams<{ peopleId: string }>();
  const navigate = useNavigate();
  const { person: deudor } = usePerson(peopleId ?? null);
  const { profile: emisorProfile } = useCurrentProfile();
  const { person: emisorSelf } = usePerson(emisorProfile?.personId ?? null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  if (!deudor || !peopleId) {
    return <div className="p-4 text-center text-slate-500">Cargando...</div>;
  }

  const detalles = getDeudaDetallePara(peopleId, year, month);
  const total = detalles.reduce((s, d) => s + d.pendiente, 0);

  const handleDownload = () => {
    generateTicketPDF({
      deudor: { nombre: deudor.nombre, iniciales: deudor.iniciales },
      emisor: { nombre: emisorSelf?.nombre ?? emisorProfile?.nombre ?? 'Yo', iniciales: emisorSelf?.iniciales ?? 'YO' },
      fecha: new Date(),
      detalles: detalles
        .filter((d) => d.pendiente > 0)
        .map((d) => ({ servicio: d.nombre, periodo: d.periodo, monto: d.pendiente })),
      total,
      currency: 'USD',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Ticket de deuda</h2>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <ProfileAvatar nombre={deudor.nombre} iniciales={deudor.iniciales} color={deudor.color} size="lg" />
          <div>
            <div className="text-xs text-slate-500">Deudor</div>
            <div className="font-semibold">{deudor.nombre}</div>
            {deudor.contacto && <div className="text-xs text-slate-500">{deudor.contacto}</div>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-slate-500">Mes</div>
            <Input type="number" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10) || 1)} className="!py-2" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Año</div>
            <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())} className="!py-2" />
          </div>
        </div>
      </Card>

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
          Detalle ({detalles.filter((d) => d.pendiente > 0).length} items)
        </div>
        {detalles.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-3">Sin suscripciones compartidas</div>
        ) : (
          <div className="space-y-2">
            {detalles.map((d, i) => (
              <div key={i} className={`flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 ${d.pendiente === 0 ? 'opacity-50' : ''}`}>
                <div>
                  <div className="text-sm font-medium">{d.nombre}</div>
                  <div className="text-xs text-slate-500">{d.periodo}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{formatCurrency(d.pagado, 'USD')}</div>
                  <div className="text-xs text-slate-500">de {formatCurrency(d.cuotaEsperada, 'USD')}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3">
              <div className="font-semibold">Total adeudado</div>
              <div className="text-xl font-bold text-red-600">{formatCurrency(total, 'USD')}</div>
            </div>
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <Button fullWidth size="lg" onClick={handleDownload} disabled={total === 0}>
          <FileDown size={18} /> Descargar PDF
        </Button>
        <Button variant="secondary" size="lg" onClick={() => window.print()}>
          <Printer size={18} />
        </Button>
      </div>
    </div>
  );
}
