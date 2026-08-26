// src/routes/tabs/HistorialTab.tsx
import { useState } from 'react';
import { useSessionStore } from '../../stores/useSessionStore';
import { useGastos, useCategorias } from '../../hooks/useFinanzas';
import { useQuery } from '../../db/useQuery';
import { Card } from '../../components/ui/Card';
import { Input, Field } from '../../components/ui/Input';
import { formatCurrency, formatDate, MESES_ES } from '../../lib/format';
import { MONEDA_PRINCIPAL } from '../../types';
import { EmptyState } from '../../components/EmptyState';
import { History } from 'lucide-react';

export function HistorialTab() {
  const currentProfileId = useSessionStore((s) => s.currentProfileId);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>(new Date().getMonth() + 1);

  const { gastos } = useGastos(currentProfileId, year, month === 'all' ? undefined : month);
  const { categorias } = useCategorias(currentProfileId);
  const { data: pagosData } = useQuery<any>(
    `SELECT p.*, s.nombre AS servicio_nombre, pr.nombre AS people_nombre
     FROM pagos p
     JOIN ciclos c ON c.id = p.ciclo_id
     JOIN suscripciones s ON s.id = c.suscripcion_id
     JOIN people pr ON pr.id = p.people_id
     WHERE p.fecha_pago >= ? AND p.fecha_pago < ?
     ORDER BY p.fecha_pago DESC`,
    currentProfileId
      ? [new Date(year, month === 'all' ? 0 : month - 1, 1).getTime(), new Date(year, month === 'all' ? 12 : month, 1).getTime()]
      : []
  );

  const eventos = [
    ...gastos.map((g) => ({
      id: g.id,
      fecha: g.date,
      titulo: g.description || categorias.find((c) => c.id === g.categoryId)?.nombre || 'Gasto',
      subtitulo: 'Gasto personal',
      monto: g.amount,
      tipo: 'gasto' as const,
    })),
    ...pagosData.map((p) => ({
      id: p.id,
      fecha: p.fecha_pago,
      titulo: p.servicio_nombre,
      subtitulo: `Pagó: ${p.people_nombre}`,
      monto: p.monto,
      tipo: 'pago' as const,
    })),
  ].sort((a, b) => b.fecha - a.fecha);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Historial</h2>
      <Card>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Año">
            <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())} />
          </Field>
          <Field label="Mes">
            <select className="input" value={month} onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}>
              <option value="all">Todos</option>
              {MESES_ES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      {eventos.length === 0 ? (
        <EmptyState icon={History} title="Sin movimientos" description="No hay gastos ni pagos en este período." />
      ) : (
        <Card>
          <div className="space-y-2">
            {eventos.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className={`w-2 h-2 rounded-full ${e.tipo === 'gasto' ? 'bg-red-500' : 'bg-success'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.titulo}</div>
                  <div className="text-xs text-slate-500">{formatDate(e.fecha)} · {e.subtitulo}</div>
                </div>
                <div className={`font-semibold tabular-nums text-sm ${e.tipo === 'gasto' ? 'text-red-600' : 'text-success'}`}>
                  {e.tipo === 'gasto' ? '-' : '+'}{formatCurrency(e.monto, MONEDA_PRINCIPAL)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
