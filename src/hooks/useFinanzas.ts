// src/hooks/useFinanzas.ts
// Hooks del módulo personal: categorías, gastos, salary, budgets, goals.
import { useQuery } from '../db/useQuery';
import { getDb, runInTransaction, execSql } from '../db/client';
import {
  rowToCategory,
  rowToPersonalExpense,
  rowToSalary,
  rowToBudget,
  rowToSavingsGoal,
  type Category,
  type PersonalExpense,
  type Salary,
  type Budget,
  type SavingsGoal,
} from '../types';
import { uid } from '../lib/id';

// Categorías
export function useCategorias(profileId: string | null) {
  const { data, loading, error } = useQuery<any>(
    'SELECT * FROM categories WHERE profile_id = ? ORDER BY nombre',
    profileId ? [profileId] : []
  );
  return { categorias: data.map(rowToCategory), loading, error };
}

export async function createCategoria(input: Omit<Category, 'id' | 'createdAt'>) {
  const id = uid();
  const now = Date.now();
  runInTransaction(() => {
    execSql(
      `INSERT INTO categories (id, profile_id, nombre, color, icono, tipo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.profileId, input.nombre, input.color, input.icono, input.tipo, now]
    );
  });
  return id;
}

export async function deleteCategoria(id: string) {
  runInTransaction(() => {
    execSql('DELETE FROM categories WHERE id = ?', [id]);
  });
}

// Gastos
export function useGastos(profileId: string | null, year?: number, month?: number) {
  let sql = 'SELECT * FROM personal_expenses WHERE profile_id = ?';
  const params: any[] = [profileId ?? ''];
  if (year != null && month != null) {
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 1).getTime();
    sql += ' AND date >= ? AND date < ?';
    params.push(start, end);
  }
  sql += ' ORDER BY date DESC';
  const { data, loading, error } = useQuery<any>(sql, profileId ? params : []);
  return { gastos: data.map(rowToPersonalExpense), loading, error };
}

export async function createGasto(input: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'>) {
  const id = uid();
  const now = Date.now();
  runInTransaction(() => {
    execSql(
      `INSERT INTO personal_expenses (id, profile_id, category_id, amount, date, description, payment_method, notas, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.profileId,
        input.categoryId ?? null,
        input.amount,
        input.date,
        input.description ?? null,
        input.paymentMethod ?? null,
        input.notas ?? null,
        now,
        now,
      ]
    );
  });
  return id;
}

export async function updateGasto(id: string, patch: Partial<PersonalExpense>) {
  const fields: string[] = [];
  const values: any[] = [];
  const map: Record<string, string> = {
    categoryId: 'category_id',
    amount: 'amount',
    date: 'date',
    description: 'description',
    paymentMethod: 'payment_method',
    notas: 'notas',
  };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const col = map[k];
    if (!col) continue;
    fields.push(`${col} = ?`);
    values.push(v);
  }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(Date.now(), id);
  runInTransaction(() => {
    execSql(`UPDATE personal_expenses SET ${fields.join(', ')} WHERE id = ?`, values);
  });
}

export async function deleteGasto(id: string) {
  runInTransaction(() => {
    execSql('DELETE FROM personal_expenses WHERE id = ?', [id]);
  });
}

// Salary
export function useSalary(profileId: string | null, year: number, month: number) {
  const { data, loading } = useQuery<any>(
    'SELECT * FROM salary WHERE profile_id = ? AND year = ? AND month = ?',
    profileId ? [profileId, year, month] : []
  );
  return {
    salary: data[0] ? rowToSalary(data[0]) : null,
    loading,
  };
}

export async function setSalary(input: Omit<Salary, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = getDb();
  const existing = (db.selectValue(
    'SELECT id FROM salary WHERE profile_id = ? AND year = ? AND month = ?',
    [input.profileId, input.year, input.month]
  ) as string) ?? null;
  const now = Date.now();
  runInTransaction(() => {
    if (existing) {
      execSql(
        `UPDATE salary SET amount = ?, currency = ?, notas = ?, updated_at = ? WHERE id = ?`,
        [input.amount, input.currency, input.notas ?? null, now, existing]
      );
    } else {
      execSql(
        `INSERT INTO salary (id, profile_id, year, month, amount, currency, notas, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid(), input.profileId, input.year, input.month, input.amount, input.currency, input.notas ?? null, now, now]
      );
    }
  });
}

// Budgets
export function useBudgets(profileId: string | null, year: number, month: number) {
  const { data, loading } = useQuery<any>(
    'SELECT * FROM budgets WHERE profile_id = ? AND year = ? AND month = ?',
    profileId ? [profileId, year, month] : []
  );
  return { budgets: data.map(rowToBudget), loading };
}

export async function setBudget(input: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = getDb();
  const existing = (db.selectValue(
    'SELECT id FROM budgets WHERE profile_id = ? AND category_id = ? AND year = ? AND month = ?',
    [input.profileId, input.categoryId, input.year, input.month]
  ) as string) ?? null;
  const now = Date.now();
  runInTransaction(() => {
    if (existing) {
      execSql('UPDATE budgets SET amount = ?, updated_at = ? WHERE id = ?', [input.amount, now, existing]);
    } else {
      execSql(
        `INSERT INTO budgets (id, profile_id, category_id, year, month, amount, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid(), input.profileId, input.categoryId, input.year, input.month, input.amount, now, now]
      );
    }
  });
}

export async function deleteBudget(id: string) {
  runInTransaction(() => {
    execSql('DELETE FROM budgets WHERE id = ?', [id]);
  });
}

// Savings goals
export function useGoals(profileId: string | null) {
  const { data, loading } = useQuery<any>(
    'SELECT * FROM savings_goals WHERE profile_id = ? ORDER BY created_at DESC',
    profileId ? [profileId] : []
  );
  return { goals: data.map(rowToSavingsGoal), loading };
}

export async function createGoal(input: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt' | 'currentAmount'> & { currentAmount?: number }) {
  const id = uid();
  const now = Date.now();
  runInTransaction(() => {
    execSql(
      `INSERT INTO savings_goals (id, profile_id, nombre, target_amount, current_amount, deadline, color, icono, notas, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.profileId,
        input.nombre,
        input.targetAmount,
        input.currentAmount ?? 0,
        input.deadline ?? null,
        input.color,
        input.icono,
        input.notas ?? null,
        now,
        now,
      ]
    );
  });
  return id;
}

export async function addContribution(goalId: string, amount: number, date: number, nota?: string) {
  const now = Date.now();
  runInTransaction(() => {
    execSql(
      `INSERT INTO goal_contributions (id, goal_id, amount, date, nota, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uid(), goalId, amount, date, nota ?? null, now]
    );
    execSql(
      `UPDATE savings_goals SET current_amount = current_amount + ?, updated_at = ? WHERE id = ?`,
      [amount, now, goalId]
    );
  });
}

export async function deleteContribution(contributionId: string) {
  const db = getDb();
  const goalId = (db.selectValue('SELECT goal_id FROM goal_contributions WHERE id = ?', [contributionId]) as string) ?? null;
  if (!goalId) return;
  const amount = (db.selectValue('SELECT amount FROM goal_contributions WHERE id = ?', [contributionId]) as number) ?? 0;
  const now = Date.now();
  runInTransaction(() => {
    execSql('DELETE FROM goal_contributions WHERE id = ?', [contributionId]);
    execSql('UPDATE savings_goals SET current_amount = MAX(0, current_amount - ?), updated_at = ? WHERE id = ?', [
      amount,
      now,
      goalId,
    ]);
  });
}

export async function deleteGoal(id: string) {
  runInTransaction(() => {
    execSql('DELETE FROM savings_goals WHERE id = ?', [id]);
  });
}
