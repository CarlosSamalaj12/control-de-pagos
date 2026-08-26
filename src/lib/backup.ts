// src/lib/backup.ts
// Export / import JSON. NO incluye pinHash por seguridad.
import { getDb, runInTransaction } from '../db/client';

interface BackupShape {
  schemaVersion: number;
  exportedAt: number;
  app: 'control-pagos-pwa';
  data: {
    profiles: any[];
    categories: any[];
    salary: any[];
    personal_expenses: any[];
    budgets: any[];
    savings_goals: any[];
    goal_contributions: any[];
    suscripciones: any[];
    suscripcion_participantes: any[];
    ciclos: any[];
    pagos: any[];
    cuentas_pago: any[];
    config: any[];
  };
}

const TABLES: { key: keyof BackupShape['data']; order: number; cascade?: string[] }[] = [
  { key: 'profiles', order: 1 },
  { key: 'categories', order: 2 },
  { key: 'salary', order: 3 },
  { key: 'personal_expenses', order: 4 },
  { key: 'budgets', order: 5 },
  { key: 'savings_goals', order: 6 },
  { key: 'goal_contributions', order: 7 },
  { key: 'suscripciones', order: 8 },
  { key: 'suscripcion_participantes', order: 9 },
  { key: 'ciclos', order: 10 },
  { key: 'pagos', order: 11 },
  { key: 'cuentas_pago', order: 12 },
  { key: 'config', order: 13 },
];

export function exportBackup(): BackupShape {
  const db = getDb();
  const data: any = {};
  for (const t of TABLES) {
    const rows = db.selectArrays(`SELECT * FROM ${t.key}`);
    data[t.key] = rows.map((row) => {
      const obj: any = {};
      // Usar el primer row para conocer nombres de columnas
      return row;
    });
  }
  // Versión más limpia: usar exec con rowMode 'object'
  const data2: any = {};
  for (const t of TABLES) {
    const r = db.exec({
      sql: `SELECT * FROM ${t.key}`,
      rowMode: 'object',
      returnValue: 'resultRows',
    });
    // Filtrar pin_hash de profiles
    if (t.key === 'profiles') {
      data2[t.key] = (r as any[]).map((row) => {
        const { pin_hash, ...rest } = row;
        return rest;
      });
    } else {
      data2[t.key] = r;
    }
  }

  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    app: 'control-pagos-pwa',
    data: data2,
  };
}

export function downloadBackup() {
  const backup = exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `control-pagos-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackup(backup: BackupShape, mode: 'replace' | 'merge' = 'replace') {
  if (!backup || backup.app !== 'control-pagos-pwa') {
    throw new Error('Archivo de backup inválido.');
  }
  if (backup.schemaVersion !== 1) {
    throw new Error(`Versión de schema no soportada: ${backup.schemaVersion}`);
  }
  const db = getDb();

  runInTransaction(() => {
    if (mode === 'replace') {
      for (const t of [...TABLES].reverse()) {
        db.exec(`DELETE FROM ${t.key}`);
      }
    }
    for (const t of TABLES) {
      const rows = backup.data[t.key] || [];
      if (rows.length === 0) continue;
      // Insertar fila por fila
      const sample = rows[0];
      const cols = Object.keys(sample);
      const placeholders = cols.map(() => '?').join(', ');
      for (const row of rows) {
        const values = cols.map((c) => row[c] ?? null);
        try {
          db.exec(`INSERT OR IGNORE INTO ${t.key} (${cols.join(', ')}) VALUES (${placeholders})`, values);
        } catch (e) {
          console.warn(`[import] falló fila en ${t.key}:`, e);
        }
      }
    }
  });
}
