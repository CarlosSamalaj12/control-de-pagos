// src/routes/tabs/DashboardTab.tsx
import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  AlertCircle,
  CheckCircle2,
  Clock,
  Check,
  X,
  CircleDollarSign,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Progress } from '../../components/ui/Progress';
import { CurrencyText, getCurrencySymbol } from '../../components/ui/CurrencyIcon';
import { useSessionStore } from '../../stores/useSessionStore';
import { useCurrentProfile } from '../../hooks/useProfile';
import {
  getResumenPeriodo,
  getProximosVencimientos,
  getBalancePorPersona,
  type ResumenSuscripcionPeriodo,
} from '../../lib/balanceCompartido';
import { getDisponible, getGastosPorCategoria, getBudgetsConConsumido } from '../../lib/balancePersonal';
import { useGoals } from '../../hooks/useFinanzas';
import { useResumenSuscripcionesPeriodo } from '../../hooks/useSuscripciones';
import { formatCurrency, formatCompact, formatDate, MESES_ES } from '../../lib/format';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Moneda } from '../../types';
import { MONEDA_PRINCIPAL } from '../../types';

export function DashboardTab() {
  const navigate = useNavigate();
  const currentProfileId = useSessionStore((s) => s.currentProfileId);
  const { profile } = useCurrentProfile();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const [resumen, setResumen] = useState(() => getResumenPeriodo(year, month));
  const [proximos, setProximos] = useState(() => getProximosVencimientos(14, 5));
  const [balance, setBalance] = useState(() => getBalancePorPersona(year, month));
  const { items: suscripcionesResumen } = useResumenSuscripcionesPeriodo(year, month);
  const [disponible, setDisponible] = useState(() =>
    currentProfileId ? getDisponible(currentProfileId, year, month) : { salary: 0, gastos: 0, disponible: 0, currency: 'ARS' }
  );
  const [gastosPorCat, setGastosPorCat] = useState(() =>
    currentProfileId ? getGastosPorCategoria(currentProfileId, year, month) : []
  );
  const [budgets, setBudgets] = useState(() =>
    currentProfileId ? getBudgetsConConsumido(currentProfileId, year, month) : []
  );
  const { goals } = useGoals(currentProfileId);

  const refresh = () => {
    setResumen(getResumenPeriodo(year, month));
    setProximos(getProximosVencimientos(14, 5));
    setBalance(getBalancePorPersona(year, month));
    if (currentProfileId) {
      setDisponible(getDisponible(currentProfileId, year, month));
      setGastosPorCat(getGastosPorCategoria(currentProfileId, year, month));
      setBudgets(getBudgetsConConsumido(currentProfileId, year, month));
    }
  };

  const changePeriod = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setYear(y);
    setMonth(m);
    setTimeout(refresh, 0);
  };

  const pieData = gastosPorCat
    .filter((g) => g.total > 0)
    .map((g) => ({ name: g.categoryNombre, value: g.total, color: g.categoryColor }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => changePeriod(-1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Mes anterior">
          <ChevronLeft size={20} />
        </button>
        <div className="font-semibold text-lg">{MESES_ES[month - 1]} {year}</div>
        <button onClick={() => changePeriod(1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Mes siguiente">
          <ChevronRight size={20} />
        </button>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Compartidas</div>
          <Badge variant={resumen.pct >= 100 ? 'success' : resumen.pct >= 50 ? 'warning' : 'neutral'}>
            {resumen.pct.toFixed(0)}%
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-slate-500">A cobrar</div>
            <div className="font-bold text-lg flex justify-center">
              {suscripcionesResumen.length > 0 ? (
                <CurrencyText moneda={suscripcionesResumen[0].moneda} monto={resumen.totalCosto} size="sm" />
              ) : (
                <span>{formatCurrency(resumen.totalCosto, MONEDA_PRINCIPAL)}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Cobrado</div>
            <div className="font-bold text-lg text-success flex justify-center">
              {suscripcionesResumen.length > 0 ? (
                <CurrencyText moneda={suscripcionesResumen[0].moneda} monto={resumen.totalCobrado} size="sm" />
              ) : (
                <span>{formatCurrency(resumen.totalCobrado, MONEDA_PRINCIPAL)}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Pendiente</div>
            <div className="font-bold text-lg text-amber-600 flex justify-center">
              {suscripcionesResumen.length > 0 ? (
                <CurrencyText moneda={suscripcionesResumen[0].moneda} monto={resumen.pendiente} size="sm" />
              ) : (
                <span>{formatCurrency(resumen.pendiente, MONEDA_PRINCIPAL)}</span>
              )}
            </div>
          </div>
        </div>
        <Progress value={resumen.pct} className="mt-3" />
      </Card>

      {/* Card: Cobros pendientes (desglose por suscripción) */}
      {suscripcionesResumen.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Cobros pendientes
            </div>
            <button
              onClick={() => navigate('/compartidas')}
              className="text-xs text-brand-accent font-semibold"
            >
              Ver todas
            </button>
          </div>
          <div className="space-y-2">
            {suscripcionesResumen.map((s) => (
              <SuscripcionCobroItem
                key={s.suscripcionId}
                s={s}
                onClick={() =>
                  s.cicloId
                    ? navigate(`/ciclos/${s.cicloId}`)
                    : navigate(`/suscripciones/${s.suscripcionId}`)
                }
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Personales</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-slate-500">Sueldo</div>
            <div className="font-bold text-lg">{disponible.salary > 0 ? formatCompact(disponible.salary) : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Gastado</div>
            <div className="font-bold text-lg text-red-600">{formatCompact(disponible.gastos)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Libre</div>
            <div className={`font-bold text-lg ${disponible.disponible >= 0 ? 'text-success' : 'text-red-600'}`}>
              {formatCompact(disponible.disponible)}
            </div>
          </div>
        </div>
      </Card>

      {pieData.length > 0 && (
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Por categoría</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(+v, 'ARS')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {budgets.length > 0 && (
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Presupuestos</div>
          <div className="space-y-3">
            {budgets.map((b) => (
              <div key={b.budgetId}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.categoryColor }} />
                    <span className="font-medium">{b.categoryNombre}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatCurrency(b.consumido, 'ARS')} / {formatCurrency(b.amount, 'ARS')}
                  </div>
                </div>
                <Progress value={b.pct} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {goals.length > 0 && (
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Metas</div>
          <div className="space-y-3">
            {goals.slice(0, 3).map((g) => {
              const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{g.nombre}</span>
                    <span className="text-xs text-slate-500">
                      {formatCurrency(g.currentAmount, 'ARS')} / {formatCurrency(g.targetAmount, 'ARS')}
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Próximos vencimientos</div>
        {proximos.length === 0 ? (
          <div className="text-sm text-slate-400 py-2 text-center">Sin vencimientos próximos</div>
        ) : (
          <div className="space-y-2">
            {proximos.map((v) => {
              const Icon = v.estado === 'vencido' ? AlertCircle : v.estado === 'parcial' ? Clock : CheckCircle2;
              const variant = v.estado === 'vencido' ? 'danger' : v.estado === 'parcial' ? 'warning' : 'neutral';
              return (
                <div key={v.cicloId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: (v.color as string) + '20' }}>
                    <Icon size={16} className="text-slate-700 dark:text-slate-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{v.nombre as string}</div>
                    <div className="text-xs text-slate-500">{formatDate(v.fechaVencimiento as number)}</div>
                  </div>
                  <Badge variant={variant as any}>{v.estado as string}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {balance.length > 0 && (
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Balance del mes</div>
          <div className="space-y-2">
            {balance.slice(0, 5).map((b) => {
              // Tomamos la moneda de la primera suscripción que tenga info;
              // si no hay, fallback a USD
              const moneda =
                b.detalle.length > 0 && suscripcionesResumen.length > 0
                  ? suscripcionesResumen.find((s) => s.suscripcionId === b.detalle[0].suscripcionId)?.moneda ?? MONEDA_PRINCIPAL
                  : MONEDA_PRINCIPAL;
              return (
                <div key={b.peopleId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="font-medium">{b.nombre}{b.isSelf ? ' (yo)' : ''}</span>
                  </div>
                  <div className={`font-semibold tabular-nums ${b.saldo >= 0 ? 'text-success' : 'text-red-600'}`}>
                    {b.saldo >= 0 ? '+' : ''}
                    <CurrencyText moneda={moneda as any} monto={b.saldo} size="xs" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Subcomponente: cada suscripción con su desglose del mes
// ============================================================================

function SuscripcionCobroItem({
  s,
  onClick,
}: {
  s: ResumenSuscripcionPeriodo;
  onClick: () => void;
}) {
  const total = s.totalParticipantes;
  const allDone = total > 0 && s.pendientes === 0 && s.parciales === 0;
  const hayAlgo = total > 0;
  const hayDeuda = s.pendientes + s.parciales > 0;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.99] transition text-left"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: s.color }}
      >
        <span className="text-xs font-bold">{s.nombre.slice(0, 2).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{s.nombre}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {hayAlgo ? (
            <>
              <span className={s.completos > 0 ? 'text-success font-medium' : 'text-slate-400'}>
                {s.completos}/{total}
              </span>{' '}
              {s.completos === 1 ? 'pagó' : 'pagaron'}
              {s.parciales > 0 && (
                <>
                  {' · '}
                  <span className="text-amber-600 font-medium">
                    {s.parciales} parcial{s.parciales !== 1 ? 'es' : ''}
                  </span>
                </>
              )}
              {s.pendientes > 0 && (
                <>
                  {' · '}
                  <span className="text-red-500 font-medium">
                    {s.pendientes} falta{s.pendientes !== 1 ? 'n' : ''}
                  </span>
                </>
              )}
            </>
          ) : (
            'Sin participantes'
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {allDone ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs">
            <Check size={12} strokeWidth={3} /> Listo
          </span>
        ) : s.cicloEstado === 'vencido' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle size={12} /> Vencido
          </span>
        ) : hayDeuda ? (
          <CurrencyText
            moneda={s.moneda}
            monto={s.costoTotal - s.cobrado}
            size="sm"
            className="text-amber-700 font-semibold"
          />
        ) : null}
        <ChevronRightIcon size={16} className="text-slate-300" />
      </div>
    </button>
  );
}

