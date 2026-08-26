// src/routes/tabs/FinanzasTab.tsx
import { useEffect, useState } from 'react';
import { Plus, Trash2, Target } from 'lucide-react';
import { useSessionStore } from '../../stores/useSessionStore';
import { useGastos, useCategorias, useSalary, useGoals, createGasto, setSalary, deleteGasto, addContribution, deleteGoal, useBudgets, createGoal } from '../../hooks/useFinanzas';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';
import { DatePicker } from '../../components/ui/DatePicker';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/EmptyState';
import { Progress } from '../../components/ui/Progress';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatDate, MESES_ES } from '../../lib/format';
import { getDisponible, getGastosPorCategoria, getBudgetsConConsumido } from '../../lib/balancePersonal';
import { useUIStore } from '../../stores/useUIStore';

export function FinanzasTab() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const currentProfileId = useSessionStore((s) => s.currentProfileId);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const { salary } = useSalary(currentProfileId, year, month);
  const { categorias } = useCategorias(currentProfileId);
  const { gastos } = useGastos(currentProfileId, year, month);
  const { goals } = useGoals(currentProfileId);
  const { budgets } = useBudgets(currentProfileId, year, month);

  const [gastoModal, setGastoModal] = useState(false);
  const [metaModal, setMetaModal] = useState(false);
  const [salaryModal, setSalaryModal] = useState(false);

  const disponible = currentProfileId ? getDisponible(currentProfileId, year, month) : { salary: 0, gastos: 0, disponible: 0, currency: 'ARS' };
  const porCategoria = currentProfileId ? getGastosPorCategoria(currentProfileId, year, month) : [];
  const budgetsConConsumido = currentProfileId ? getBudgetsConConsumido(currentProfileId, year, month) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Finanzas</h2>
        <Button onClick={() => setGastoModal(true)}>
          <Plus size={18} /> Gasto
        </Button>
      </div>

      <div className="text-sm text-slate-500">{MESES_ES[month - 1]} {year}</div>

      {/* Cards sueldo/gastado/libre */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Resumen del mes</div>
          <button onClick={() => setSalaryModal(true)} className="text-xs text-brand-accent font-semibold">
            {salary ? 'Editar sueldo' : 'Cargar sueldo'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-slate-500">Sueldo</div>
            <div className="font-bold text-lg">{disponible.salary > 0 ? formatCurrency(disponible.salary, 'ARS') : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Gastos</div>
            <div className="font-bold text-lg text-red-600">{formatCurrency(disponible.gastos, 'ARS')}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Libre</div>
            <div className={`font-bold text-lg ${disponible.disponible >= 0 ? 'text-success' : 'text-red-600'}`}>
              {formatCurrency(disponible.disponible, 'ARS')}
            </div>
          </div>
        </div>
      </Card>

      {/* Por categoría */}
      {porCategoria.length > 0 && (
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Por categoría</div>
          <div className="space-y-2">
            {porCategoria.map((c) => (
              <div key={c.categoryId ?? 'none'} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.categoryColor }} />
                  <span>{c.categoryNombre}</span>
                </div>
                <span className="font-semibold tabular-nums">{formatCurrency(c.total, 'ARS')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Presupuestos */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Presupuestos</div>
          <button onClick={() => navigate('/presupuestos')} className="text-xs text-brand-accent font-semibold">
            Administrar
          </button>
        </div>
        {budgetsConConsumido.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-3">Sin presupuestos para este mes</div>
        ) : (
          <div className="space-y-3">
            {budgetsConConsumido.map((b) => (
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
        )}
      </Card>

      {/* Gastos del mes */}
      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Gastos del mes ({gastos.length})</div>
        {gastos.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-3">Sin gastos este mes</div>
        ) : (
          <div className="space-y-1">
            {gastos.slice(0, 20).map((g) => {
              const cat = categorias.find((c) => c.id === g.categoryId);
              return (
                <div key={g.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color ?? '#999' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{g.description || cat?.nombre || 'Gasto'}</div>
                    <div className="text-xs text-slate-500">{formatDate(g.date)} · {cat?.nombre ?? '—'}</div>
                  </div>
                  <div className="font-semibold tabular-nums text-sm">{formatCurrency(g.amount, 'ARS')}</div>
                  <button
                    onClick={async () => {
                      if (!confirm('¿Eliminar este gasto?')) return;
                      await deleteGasto(g.id);
                      showToast('Eliminado', 'success');
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Metas */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Metas de ahorro</div>
          <button onClick={() => setMetaModal(true)} className="text-xs text-brand-accent font-semibold">
            + Nueva meta
          </button>
        </div>
        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Sin metas"
            description="Creá tu primera meta de ahorro"
            action={<Button size="sm" onClick={() => setMetaModal(true)}><Plus size={16} /> Crear</Button>}
          />
        ) : (
          <div className="space-y-3">
            {goals.map((g) => {
              const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
              const isComplete = g.currentAmount >= g.targetAmount;
              return (
                <div key={g.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{g.nombre}</span>
                    {isComplete && <Badge variant="success">¡Lograda!</Badge>}
                  </div>
                  <Progress value={pct} />
                  <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                    <span>{formatCurrency(g.currentAmount, 'ARS')} / {formatCurrency(g.targetAmount, 'ARS')}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <ContributionForm goalId={g.id} onContribute={async (a) => {
                      await addContribution(g.id, a, Date.now());
                      showToast('Aporte registrado', 'success');
                    }} />
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm('¿Eliminar meta?')) return;
                      await deleteGoal(g.id);
                      showToast('Eliminada', 'success');
                    }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <NuevoGastoModal
        open={gastoModal}
        onClose={() => setGastoModal(false)}
        onCreate={async (data) => {
          await createGasto({ ...data, profileId: currentProfileId! });
          showToast('Gasto registrado', 'success');
          setGastoModal(false);
        }}
        categorias={categorias}
      />
      <NuevaMetaModal
        open={metaModal}
        onClose={() => setMetaModal(false)}
        onCreate={async (data) => {
          await createGoal({ ...data, profileId: currentProfileId! });
          showToast('Meta creada', 'success');
          setMetaModal(false);
        }}
      />
      <SalaryModal
        open={salaryModal}
        onClose={() => setSalaryModal(false)}
        current={salary?.amount ?? 0}
        onSave={async (amount) => {
          await setSalary({
            profileId: currentProfileId!,
            year, month, amount, currency: 'ARS',
          });
          showToast('Sueldo guardado', 'success');
          setSalaryModal(false);
        }}
      />
    </div>
  );
}

function ContributionForm({ goalId, onContribute }: { goalId: string; onContribute: (amount: number) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>+ Aporte</Button>;
  return (
    <div className="flex gap-2 flex-1">
      <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto" className="!py-2 !text-sm" />
      <Button size="sm" onClick={async () => {
        const v = parseFloat(amount);
        if (!v || v <= 0) return;
        await onContribute(v);
        setAmount('');
        setOpen(false);
      }}>OK</Button>
    </div>
  );
}

function NuevoGastoModal({ open, onClose, onCreate, categorias }: any) {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <Modal open={open} onClose={onClose} title="Nuevo gasto">
      <div className="space-y-3">
        <Field label="Monto (ARS)">
          <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Categoría">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— Sin categoría —</option>
            {categorias.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </Field>
        <Field label="Descripción">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Fecha">
          <DatePicker value={date} onChange={setDate} />
        </Field>
        <Button fullWidth size="lg" onClick={async () => {
          const v = parseFloat(amount);
          if (!v || v <= 0) return;
          await onCreate({ amount: v, categoryId: categoryId || undefined, description, date: new Date(date).getTime() });
        }}>
          Registrar
        </Button>
      </div>
    </Modal>
  );
}

function NuevaMetaModal({ open, onClose, onCreate }: any) {
  const [nombre, setNombre] = useState('');
  const [target, setTarget] = useState('');
  const [color, setColor] = useState('#1F4E78');
  return (
    <Modal open={open} onClose={onClose} title="Nueva meta">
      <div className="space-y-3">
        <Field label="Nombre">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Viaje a Brasil" autoFocus />
        </Field>
        <Field label="Monto objetivo (ARS)">
          <Input type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label="Color">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded cursor-pointer" />
        </Field>
        <Button fullWidth size="lg" onClick={async () => {
          const t = parseFloat(target);
          if (!nombre.trim() || !t || t <= 0) return;
          await onCreate({ nombre: nombre.trim(), targetAmount: t, color, icono: 'target' });
        }}>Crear meta</Button>
      </div>
    </Modal>
  );
}

function SalaryModal({ open, onClose, current, onSave }: any) {
  const [amount, setAmount] = useState(String(current || ''));
  useEffect(() => { if (open) setAmount(String(current || '')); }, [open, current]);
  return (
    <Modal open={open} onClose={onClose} title="Sueldo del mes">
      <div className="space-y-3">
        <Field label="Monto (ARS)">
          <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Button fullWidth size="lg" onClick={async () => {
          const v = parseFloat(amount);
          if (Number.isNaN(v) || v < 0) return;
          await onSave(v);
        }}>Guardar</Button>
      </div>
    </Modal>
  );
}
