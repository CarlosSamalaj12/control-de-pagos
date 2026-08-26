// src/routes/finanzas/Presupuestos.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSessionStore } from '../../stores/useSessionStore';
import { useCategorias, useBudgets, setBudget, deleteBudget } from '../../hooks/useFinanzas';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';
import { Progress } from '../../components/ui/Progress';
import { formatCurrency } from '../../lib/format';
import { getBudgetsConConsumido } from '../../lib/balancePersonal';
import { useUIStore } from '../../stores/useUIStore';

export function Presupuestos() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const currentProfileId = useSessionStore((s) => s.currentProfileId);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const { categorias } = useCategorias(currentProfileId);
  const { budgets } = useBudgets(currentProfileId, year, month);
  const conConsumido = currentProfileId ? getBudgetsConConsumido(currentProfileId, year, month) : [];
  const [editing, setEditing] = useState<{ categoryId: string; amount: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Presupuestos</h2>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mes">
            <Input type="number" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10) || 1)} />
          </Field>
          <Field label="Año">
            <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())} />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Por categoría</div>
        <div className="space-y-3">
          {categorias.map((c) => {
            const budget = budgets.find((b) => b.categoryId === c.id);
            const cc = conConsumido.find((x) => x.categoryId === c.id);
            const amount = budget?.amount ?? 0;
            const consumido = cc?.consumido ?? 0;
            return (
              <div key={c.id} className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <span className="flex-1 text-sm font-medium">{c.nombre}</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={budget?.amount ?? ''}
                  onChange={(e) => setEditing({ categoryId: c.id, amount: e.target.value })}
                  onBlur={async () => {
                    if (editing && editing.categoryId === c.id) {
                      const v = parseFloat(editing.amount);
                      if (!Number.isNaN(v) && v >= 0) {
                        await setBudget({ profileId: currentProfileId!, categoryId: c.id, year, month, amount: v });
                        showToast('Presupuesto guardado', 'success');
                      } else if (budget) {
                        await deleteBudget(budget.id);
                        showToast('Eliminado', 'success');
                      }
                      setEditing(null);
                    }
                  }}
                  className="!w-24 !py-2 !text-sm"
                />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
