// src/lib/balancePersonal.ts
import { getDb } from '../db/client';

export interface DisponibleMes {
  salary: number;
  gastos: number;
  disponible: number;
  currency: string;
}

export function getDisponible(profileId: string, year: number, month: number, currency = 'ARS'): DisponibleMes {
  const db = getDb();
  const start = new Date(year, month - 1, 1).getTime();
  const end = new Date(year, month, 1).getTime();

  const salary =
    (db.selectValue(
      `SELECT COALESCE(amount, 0) FROM salary
       WHERE profile_id = ? AND year = ? AND month = ? AND currency = ?`,
      [profileId, year, month, currency]
    ) as number) ?? 0;

  const gastos =
    (db.selectValue(
      `SELECT COALESCE(SUM(amount), 0) FROM personal_expenses
       WHERE profile_id = ? AND date >= ? AND date < ?`,
      [profileId, start, end]
    ) as number) ?? 0;

  return { salary, gastos, disponible: salary - gastos, currency };
}

export interface GastoPorCategoria {
  categoryId: string | null;
  categoryNombre: string;
  categoryColor: string;
  total: number;
}

export function getGastosPorCategoria(profileId: string, year: number, month: number): GastoPorCategoria[] {
  const db = getDb();
  const start = new Date(year, month - 1, 1).getTime();
  const end = new Date(year, month, 1).getTime();
  return db
    .selectArrays(
      `SELECT c.id, COALESCE(c.nombre, 'Sin categoría'), COALESCE(c.color, '#999999'),
              COALESCE(SUM(pe.amount), 0)
       FROM personal_expenses pe
       LEFT JOIN categories c ON c.id = pe.category_id
       WHERE pe.profile_id = ? AND pe.date >= ? AND pe.date < ?
       GROUP BY c.id
       ORDER BY SUM(pe.amount) DESC`,
      [profileId, start, end]
    )
    .map((r) => ({
      categoryId: r[0],
      categoryNombre: r[1],
      categoryColor: r[2],
      total: +r[3],
    }));
}

export interface BudgetConConsumido {
  budgetId: string;
  categoryId: string;
  categoryNombre: string;
  categoryColor: string;
  amount: number;
  consumido: number;
  pct: number;
}

export function getBudgetsConConsumido(profileId: string, year: number, month: number): BudgetConConsumido[] {
  const db = getDb();
  const start = new Date(year, month - 1, 1).getTime();
  const end = new Date(year, month, 1).getTime();
  return db
    .selectArrays(
      `SELECT b.id, c.id, c.nombre, c.color, b.amount,
              COALESCE((SELECT SUM(pe.amount) FROM personal_expenses pe
                         WHERE pe.profile_id = b.profile_id
                           AND pe.category_id = b.category_id
                           AND pe.date >= ? AND pe.date < ?), 0) AS consumido
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       WHERE b.profile_id = ? AND b.year = ? AND b.month = ?
       ORDER BY c.nombre`,
      [start, end, profileId, year, month]
    )
    .map((r) => {
      const amount = +r[4];
      const consumido = +r[5];
      return {
        budgetId: r[0],
        categoryId: r[1],
        categoryNombre: r[2],
        categoryColor: r[3],
        amount,
        consumido,
        pct: amount > 0 ? Math.min(200, (consumido / amount) * 100) : 0,
      };
    });
}
