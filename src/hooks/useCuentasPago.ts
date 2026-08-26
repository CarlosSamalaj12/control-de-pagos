// src/hooks/useCuentasPago.ts
// CRUD de las cuentas de pago del emisor (1:N con people).
// Usado en el pie del PDF "Estado de cuenta" para indicarle al
// deudor dónde transferir.
//
// Patrón: `useCuentasPago` reactivo (vía useQuery) para la UI + funciones
// async para mutaciones (que disparan bumpDbVersion → re-render).
import { useQuery } from '../db/useQuery';
import { getDb, runInTransaction, execSql } from '../db/client';
import {
  rowToCuentaPago,
  type CuentaPago,
  type TipoCuentaPago,
} from '../types';
import { uid } from '../lib/id';

/**
 * Hook reactivo: devuelve todas las cuentas del emisor (people_id)
 * ordenadas por predeterminada DESC, orden ASC, created_at ASC.
 * Si `peopleId` es null, devuelve lista vacía.
 */
export function useCuentasPago(peopleId: string | null) {
  const { data, loading, error } = useQuery<any>(
    `SELECT * FROM cuentas_pago
      WHERE people_id = ?
      ORDER BY predeterminada DESC, orden ASC, created_at ASC`,
    peopleId ? [peopleId] : []
  );
  return { cuentas: data.map(rowToCuentaPago), loading, error };
}

/**
 * Versión síncrona (sin hook), útil para pasarle al PDF antes de
 * generarlo. Lanza excepción si la DB no está lista.
 */
export function getCuentasPagoDelEmisor(peopleId: string): CuentaPago[] {
  const db = getDb();
  return db
    .selectArrays(
      `SELECT id, people_id, banco, tipo, numero, predeterminada, orden, created_at, updated_at
         FROM cuentas_pago
        WHERE people_id = ?
        ORDER BY predeterminada DESC, orden ASC, created_at ASC`,
      [peopleId]
    )
    .map((r) =>
      rowToCuentaPago({
        id: r[0],
        people_id: r[1],
        banco: r[2],
        tipo: r[3],
        numero: r[4],
        predeterminada: r[5],
        orden: r[6],
        created_at: r[7],
        updated_at: r[8],
      })
    );
}

/**
 * Crea una cuenta. Si `predeterminada` es true, desmarca el resto
 * del mismo emisor dentro de la misma transacción (garantía de "una
 * sola predeterminada por emisor").
 */
export async function createCuentaPago(input: {
  peopleId: string;
  banco: string;
  tipo: TipoCuentaPago;
  numero: string;
  /** Si no se pasa, la cuenta NO es predeterminada (excepto si es la
   *  primera del emisor, en cuyo caso se marca automáticamente). */
  predeterminada?: boolean;
}): Promise<string> {
  const id = uid();
  const now = Date.now();
  const quierePredeterminada = !!input.predeterminada;

  // ¿Es la primera cuenta? Si lo es, va a ser predeterminada sin
  // que el usuario lo pida (UX: la primera siempre es la "main").
  const db = getDb();
  const total = (db.selectValue(
    'SELECT COUNT(*) FROM cuentas_pago WHERE people_id = ?',
    [input.peopleId]
  ) as number) ?? 0;
  const esPrimera = total === 0;
  const seraPredeterminada = quierePredeterminada || esPrimera;

  runInTransaction(() => {
    if (seraPredeterminada) {
      execSql(
        'UPDATE cuentas_pago SET predeterminada = 0, updated_at = ? WHERE people_id = ?',
        [now, input.peopleId]
      );
    }
    execSql(
      `INSERT INTO cuentas_pago
        (id, people_id, banco, tipo, numero, predeterminada, orden, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.peopleId,
        input.banco.trim(),
        input.tipo,
        input.numero.trim(),
        seraPredeterminada ? 1 : 0,
        now,
        now,
        now,
      ]
    );
  });
  return id;
}

export async function updateCuentaPago(
  id: string,
  patch: Partial<{ banco: string; tipo: TipoCuentaPago; numero: string; predeterminada: boolean }>
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (patch.banco !== undefined) {
    fields.push('banco = ?');
    values.push(patch.banco.trim());
  }
  if (patch.tipo !== undefined) {
    fields.push('tipo = ?');
    values.push(patch.tipo);
  }
  if (patch.numero !== undefined) {
    fields.push('numero = ?');
    values.push(patch.numero.trim());
  }

  if (fields.length === 0 && patch.predeterminada === undefined) return;

  // Si quiere pasar a predeterminada, desmarcar el resto del emisor
  // dentro de la misma tx.
  const quierePredeterminada = patch.predeterminada === true;
  if (quierePredeterminada) {
    const db = getDb();
    const peopleId = (db.selectValue(
      'SELECT people_id FROM cuentas_pago WHERE id = ?',
      [id]
    ) as string) ?? null;
    if (peopleId) {
      const now = Date.now();
      runInTransaction(() => {
        execSql(
          'UPDATE cuentas_pago SET predeterminada = 0, updated_at = ? WHERE people_id = ?',
          [now, peopleId]
        );
        if (fields.length > 0) {
          fields.push('predeterminada = 1', 'updated_at = ?');
          values.push(now, id);
          execSql(
            `UPDATE cuentas_pago SET ${fields.join(', ')} WHERE id = ?`,
            [...values, id]
          );
        } else {
          execSql(
            'UPDATE cuentas_pago SET predeterminada = 1, updated_at = ? WHERE id = ?',
            [now, id]
          );
        }
      });
      return;
    }
  }

  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(Date.now(), id);
    runInTransaction(() => {
      execSql(
        `UPDATE cuentas_pago SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    });
  }
}

export async function deleteCuentaPago(id: string): Promise<void> {
  runInTransaction(() => {
    execSql('DELETE FROM cuentas_pago WHERE id = ?', [id]);
  });
}

/**
 * Marca una cuenta como predeterminada y desmarca el resto del mismo
 * emisor. Helper conveniente para el botón "estrella" de la UI.
 */
export async function setCuentaPredeterminada(id: string): Promise<void> {
  const db = getDb();
  const peopleId = (db.selectValue(
    'SELECT people_id FROM cuentas_pago WHERE id = ?',
    [id]
  ) as string) ?? null;
  if (!peopleId) return;
  const now = Date.now();
  runInTransaction(() => {
    execSql(
      'UPDATE cuentas_pago SET predeterminada = 0, updated_at = ? WHERE people_id = ?',
      [now, peopleId]
    );
    execSql(
      'UPDATE cuentas_pago SET predeterminada = 1, updated_at = ? WHERE id = ?',
      [now, id]
    );
  });
}
