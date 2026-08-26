// src/hooks/useSuscripciones.ts
import { useQuery } from '../db/useQuery';
import { getDb, runInTransaction, execSql } from '../db/client';
import { rowToSuscripcion, rowToCiclo, rowToPago, type Suscripcion, type Moneda } from '../types';
import { uid } from '../lib/id';
import { generarCiclosFuturos } from '../lib/cicloGenerator';
import { SQL_RESUMEN_SUSCRIPCIONES_PERIODO, SQL_PARTICIPANTES_POR_PERIODO, type ResumenSuscripcionPeriodo } from '../lib/balanceCompartido';

export function useSuscripciones() {
  const { data, loading, error } = useQuery<any>(
    'SELECT * FROM suscripciones ORDER BY activo DESC, nombre'
  );
  return { suscripciones: data.map(rowToSuscripcion), loading, error };
}

export function useSuscripcion(id: string | null) {
  const { data } = useQuery<any>('SELECT * FROM suscripciones WHERE id = ?', id ? [id] : []);
  return data[0] ? rowToSuscripcion(data[0]) : null;
}

export function useParticipantes(suscripcionId: string | null) {
  const { data, loading, error } = useQuery<any>(
    `SELECT sp.*, p.nombre, p.iniciales, p.color
     FROM suscripcion_participantes sp
     JOIN people p ON p.id = sp.people_id
     WHERE sp.suscripcion_id = ? AND sp.activo = 1
     ORDER BY p.nombre`,
    suscripcionId ? [suscripcionId] : []
  );
  return {
    participantes: data.map((r) => ({
      suscripcionId: r.suscripcion_id,
      peopleId: r.people_id,
      cuotaEsperada: r.cuota_esperada,
      activo: !!r.activo,
      nombre: r.nombre,
      iniciales: r.iniciales,
      color: r.color,
    })),
    loading,
    error,
  };
}

export interface CreateSuscripcionInput {
  nombre: string;
  costoTotal: number;
  moneda: Moneda;
  periodicidad: 'mensual' | 'semanal' | 'cada_n_dias';
  diaVencimiento?: number;
  intervaloDias?: number;
  color: string;
  icono: string;
  payerPeopleId: string;
  fechaInicio?: number;
  participantes: Array<{ peopleId: string; cuotaEsperada: number }>;
  notas?: string;
}

export async function createSuscripcion(input: CreateSuscripcionInput) {
  const id = uid();
  const now = Date.now();
  const fechaInicio = input.fechaInicio ?? now;
  runInTransaction(() => {
    execSql(
      `INSERT INTO suscripciones (id, nombre, costo_total, moneda, periodicidad, dia_vencimiento, intervalo_dias, color, icono, payer_people_id, fecha_inicio, activo, notas, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id,
        input.nombre.trim(),
        input.costoTotal,
        input.moneda,
        input.periodicidad,
        input.diaVencimiento ?? null,
        input.intervaloDias ?? null,
        input.color,
        input.icono,
        input.payerPeopleId,
        fechaInicio,
        input.notas ?? null,
        now,
        now,
      ]
    );
    for (const p of input.participantes) {
      execSql(
        `INSERT INTO suscripcion_participantes (suscripcion_id, people_id, cuota_esperada, activo)
         VALUES (?, ?, ?, 1)`,
        [id, p.peopleId, p.cuotaEsperada]
      );
    }
  });
  // Generar ciclos. Si falla, no tumbar la creación — el usuario puede regenerarlos después.
  try {
    generarCiclosFuturos(id, 12);
  } catch (e) {
    console.warn('[createSuscripcion] generarCiclosFuturos falló:', e);
  }
  return id;
}

export async function updateSuscripcion(id: string, patch: Partial<CreateSuscripcionInput>) {
  const fields: string[] = [];
  const values: any[] = [];
  const fieldMap: Record<string, string> = {
    nombre: 'nombre',
    costoTotal: 'costo_total',
    moneda: 'moneda',
    periodicidad: 'periodicidad',
    diaVencimiento: 'dia_vencimiento',
    intervaloDias: 'intervalo_dias',
    color: 'color',
    icono: 'icono',
    payerPeopleId: 'payer_people_id',
    fechaInicio: 'fecha_inicio',
    notas: 'notas',
  };
  // Si alguno de estos campos cambia, los ciclos se tienen que
  // regenerar (al menos para cubrir el rango [fechaInicio, hoy +
  // algunos meses]). El generador hace `IF NOT EXISTS` por
  // (suscripcion_id, periodo), así que no duplica los que ya existen.
  const camposQueAfectanCiclos = new Set([
    'fechaInicio',
    'periodicidad',
    'diaVencimiento',
    'intervaloDias',
  ]);
  let regenerarCiclos = false;
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'participantes') continue;
    if (v === undefined) continue;
    if (!fieldMap[k]) continue;
    fields.push(`${fieldMap[k]} = ?`);
    values.push(v);
    if (camposQueAfectanCiclos.has(k)) regenerarCiclos = true;
  }
  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(Date.now(), id);
    runInTransaction(() => {
      execSql(`UPDATE suscripciones SET ${fields.join(', ')} WHERE id = ?`, values);
    });
  }
  if (patch.participantes) {
    const parts = patch.participantes;
    runInTransaction(() => {
      execSql('DELETE FROM suscripcion_participantes WHERE suscripcion_id = ?', [id]);
      for (const p of parts) {
        execSql(
          `INSERT INTO suscripcion_participantes (suscripcion_id, people_id, cuota_esperada, activo)
           VALUES (?, ?, ?, 1)`,
          [id, p.peopleId, p.cuotaEsperada]
        );
      }
    });
  }
  // Regenerar ciclos para cubrir el rango [fechaInicio, hoy + 12m].
  // Es seguro aunque no haya cambios: `IF NOT EXISTS` por periodo.
  if (regenerarCiclos) {
    try {
      generarCiclosFuturos(id, 24);
    } catch (e) {
      console.warn('[updateSuscripcion] generarCiclosFuturos falló:', e);
    }
  }
}

export async function deleteSuscripcion(id: string) {
  runInTransaction(() => {
    execSql('DELETE FROM suscripciones WHERE id = ?', [id]);
  });
}

/**
 * Garantiza que existan ciclos para la suscripción. Útil cuando la
 * suscripción se creó con una fecha_inicio futura, o cuando se cambió
 * la fecha_inicio y se quieren generar los atrasados. El generador hace
 * `IF NOT EXISTS` por (suscripcion_id, periodo), así que es seguro
 * llamarlo cuando ya hay ciclos.
 *
 * Devuelve la cantidad de ciclos nuevos creados.
 */
export async function asegurarCiclosSuscripcion(suscripcionId: string): Promise<number> {
  try {
    return generarCiclosFuturos(suscripcionId, 24);
  } catch (e) {
    console.warn('[asegurarCiclosSuscripcion] falló:', e);
    return 0;
  }
}

export function useCiclosBySuscripcion(suscripcionId: string | null, limit = 24) {
  const { data } = useQuery<any>(
    'SELECT * FROM ciclos WHERE suscripcion_id = ? ORDER BY fecha_vencimiento DESC LIMIT ?',
    suscripcionId ? [suscripcionId, limit] : []
  );
  return data.map(rowToCiclo);
}

export function useCiclosPeriodo(periodo: string) {
  const { data } = useQuery<any>(
    `SELECT c.*, s.nombre AS s_nombre, s.color AS s_color, s.icono AS s_icono,
            s.costo_total, s.payer_people_id,
            (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE ciclo_id = c.id) AS cobrado
     FROM ciclos c
     JOIN suscripciones s ON s.id = c.suscripcion_id
     WHERE c.periodo = ? AND s.activo = 1
     ORDER BY c.fecha_vencimiento`,
    [periodo]
  );
  return data.map((r) => ({
    ...rowToCiclo(r),
    suscripcionNombre: r.s_nombre,
    suscripcionColor: r.s_color,
    suscripcionIcono: r.s_icono,
    costoTotal: r.costo_total,
    payerPeopleId: r.payer_people_id,
    cobrado: r.cobrado,
  }));
}

export function useCiclo(id: string | null) {
  const { data } = useQuery<any>(
    `SELECT c.*, s.nombre AS s_nombre, s.color AS s_color, s.icono AS s_icono,
            s.costo_total, s.payer_people_id, s.moneda
     FROM ciclos c
     JOIN suscripciones s ON s.id = c.suscripcion_id
     WHERE c.id = ?`,
    id ? [id] : []
  );
  if (data.length === 0) return null;
  const r = data[0];
  return {
    ...rowToCiclo(r),
    suscripcionNombre: r.s_nombre,
    suscripcionColor: r.s_color,
    suscripcionIcono: r.s_icono,
    costoTotal: r.costo_total,
    payerPeopleId: r.payer_people_id,
    moneda: r.moneda,
  };
}

export function usePagosByCiclo(cicloId: string | null) {
  const { data } = useQuery<any>(
    `SELECT p.*, pr.nombre, pr.iniciales, pr.color
     FROM pagos p
     JOIN people pr ON pr.id = p.people_id
     WHERE p.ciclo_id = ?
     ORDER BY p.fecha_pago DESC`,
    cicloId ? [cicloId] : []
  );
  return data.map((r) => ({
    ...rowToPago(r),
    nombre: r.nombre,
    iniciales: r.iniciales,
    color: r.color,
  }));
}

/**
 * Une los participantes activos de la suscripción con los pagos del ciclo.
 * Devuelve una fila por participante con:
 *   - pagado: boolean
 *   - pagoId, montoPagado, fechaPago (si pagó)
 * Para pagos múltiples de la misma persona en un ciclo, suma los montos
 * y conserva el más reciente.
 */
export function useParticipantesConEstadoPago(cicloId: string | null, suscripcionId: string | null) {
  const { data, loading, error } = useQuery<any>(
    `SELECT
       sp.people_id,
       sp.cuota_esperada,
       p.nombre,
       p.iniciales,
       p.color,
       p.is_self,
       (SELECT COALESCE(SUM(monto), 0)
          FROM pagos
         WHERE ciclo_id = ? AND people_id = sp.people_id) AS monto_pagado,
       (SELECT id          FROM pagos WHERE ciclo_id = ? AND people_id = sp.people_id ORDER BY fecha_pago DESC LIMIT 1) AS pago_id,
       (SELECT fecha_pago  FROM pagos WHERE ciclo_id = ? AND people_id = sp.people_id ORDER BY fecha_pago DESC LIMIT 1) AS fecha_pago
     FROM suscripcion_participantes sp
     JOIN people p ON p.id = sp.people_id
     WHERE sp.suscripcion_id = ? AND sp.activo = 1
     ORDER BY (monto_pagado >= sp.cuota_esperada) DESC, p.nombre`,
    cicloId && suscripcionId
      ? [cicloId, cicloId, cicloId, suscripcionId]
      : []
  );
  return {
    participantes: data.map((r) => {
      const cuota = r.cuota_esperada ?? 0;
      const monto = r.monto_pagado ?? 0;
      const estado: 'completo' | 'parcial' | 'pendiente' | 'sin_cuota' =
        cuota === 0
          ? 'sin_cuota'
          : monto >= cuota
          ? 'completo'
          : monto > 0
          ? 'parcial'
          : 'pendiente';
      return {
        peopleId: r.people_id,
        nombre: r.nombre,
        iniciales: r.iniciales,
        color: r.color,
        isSelf: !!r.is_self,
        cuotaEsperada: cuota,
        montoPagado: monto,
        fechaPago: r.fecha_pago ?? null,
        pagoId: r.pago_id ?? null,
        pagado: estado === 'completo',
        parcial: estado === 'parcial',
        estado,
        falta: Math.max(0, cuota - monto),
      };
    }),
    loading,
    error,
  };
}

/**
 * Hook reactivo: resumen de cada suscripción activa para un periodo
 * (YYYY-MM). Se actualiza automáticamente cuando se registran pagos,
 * se eliminan, etc., porque usa el sistema reactivo del DB.
 */
export function useResumenSuscripcionesPeriodo(
  year: number,
  month: number
): { items: ResumenSuscripcionPeriodo[]; loading: boolean } {
  const periodo = `${year}-${String(month).padStart(2, '0')}`;
  const { data, loading } = useQuery<any>(SQL_RESUMEN_SUSCRIPCIONES_PERIODO, [periodo]);
  const items: ResumenSuscripcionPeriodo[] = data.map((r) => ({
    suscripcionId: r.suscripcion_id,
    nombre: r.nombre,
    color: r.color,
    moneda: r.moneda as ResumenSuscripcionPeriodo['moneda'],
    costoTotal: +(r.costo_total ?? 0),
    cicloId: r.ciclo_id ?? null,
    cicloEstado: r.ciclo_estado ?? null,
    cobrado: +(r.cobrado ?? 0),
    totalParticipantes: +(r.total_participantes ?? 0),
    completos: +(r.completos ?? 0),
    parciales: +(r.parciales ?? 0),
    pendientes: +(r.pendientes ?? 0),
    sinCuota: +(r.sin_cuota ?? 0),
  }));
  return { items, loading };
}

export interface ParticipantePorPeriodo {
  suscripcionId: string;
  suscripcionNombre: string;
  suscripcionColor: string;
  moneda: 'ARS' | 'USD' | 'EUR' | 'GTQ';
  costoTotal: number;
  cicloId: string | null;
  cicloEstado: string | null;
  peopleId: string;
  nombre: string;
  iniciales: string;
  color: string;
  isSelf: boolean;
  cuotaEsperada: number;
  montoPagado: number;
  fechaPago: number | null;
  pagoId: string | null;
  estado: 'completo' | 'parcial' | 'pendiente' | 'sin_cuota';
  falta: number;
}

/**
 * Hook reactivo: TODOS los participantes de TODAS las suscripciones
 * activas, con su estado de pago en el periodo. Una fila por
 * (suscripción, persona). Útil para mostrar checks inline en cards.
 */
export function useParticipantesPorPeriodo(
  year: number,
  month: number
): { items: ParticipantePorPeriodo[]; loading: boolean } {
  const periodo = `${year}-${String(month).padStart(2, '0')}`;
  const { data, loading } = useQuery<any>(SQL_PARTICIPANTES_POR_PERIODO, [periodo]);
  const items: ParticipantePorPeriodo[] = data.map((r) => {
    const cuota = +(r.cuota_esperada ?? 0);
    const monto = +(r.monto_pagado ?? 0);
    const estado: ParticipantePorPeriodo['estado'] =
      cuota === 0
        ? 'sin_cuota'
        : monto >= cuota
        ? 'completo'
        : monto > 0
        ? 'parcial'
        : 'pendiente';
    return {
      suscripcionId: r.suscripcion_id,
      suscripcionNombre: r.suscripcion_nombre,
      suscripcionColor: r.suscripcion_color,
      moneda: r.moneda as ParticipantePorPeriodo['moneda'],
      costoTotal: +(r.costo_total ?? 0),
      cicloId: r.ciclo_id ?? null,
      cicloEstado: r.ciclo_estado ?? null,
      peopleId: r.people_id,
      nombre: r.nombre,
      iniciales: r.iniciales,
      color: r.color,
      isSelf: !!r.is_self,
      cuotaEsperada: cuota,
      montoPagado: monto,
      fechaPago: r.fecha_pago ?? null,
      pagoId: r.pago_id ?? null,
      estado,
      falta: Math.max(0, cuota - monto),
    };
  });
  return { items, loading };
}

/**
 * Devuelve el ciclo anterior y siguiente (por fecha_vencimiento) de la misma
 * suscripción, dado un ciclo actual. Sirve para navegar mes a mes.
 * Trae todos los ciclos de la suscripción y calcula los vecinos en JS.
 */
export function useCiclosVecinos(cicloId: string | null, suscripcionId: string | null) {
  const { data } = useQuery<any>(
    `SELECT id, periodo, fecha_vencimiento, estado
     FROM ciclos
     WHERE suscripcion_id = ?
     ORDER BY fecha_vencimiento DESC`,
    suscripcionId ? [suscripcionId] : []
  );
  // data viene DESC: idx=0 es el más reciente, idx=length-1 el más viejo.
  // siguiente (mes próximo) = idx-1
  // anterior (mes pasado) = idx+1
  const idx = data.findIndex((r) => r.id === cicloId);
  return {
    anterior: idx >= 0 && idx < data.length - 1 ? data[idx + 1] : null,
    siguiente: idx > 0 ? data[idx - 1] : null,
  };
}

/**
 * Recalcula el estado de un ciclo en base a la suma de sus pagos
 * contra el costo_total de la suscripción. Helper interno, llamado
 * desde registrarPago / registrarPagosMultiples / deletePago dentro
 * de la misma transacción.
 */
function recalcularEstadoCiclo(cicloId: string) {
  const db = getDb();
  const total = (db.selectValue(
    'SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE ciclo_id = ?',
    [cicloId]
  ) as number) ?? 0;
  const costo = (db.selectValue(
    'SELECT s.costo_total FROM ciclos c JOIN suscripciones s ON s.id = c.suscripcion_id WHERE c.id = ?',
    [cicloId]
  ) as number) ?? 0;
  const venc = (db.selectValue(
    'SELECT fecha_vencimiento FROM ciclos WHERE id = ?',
    [cicloId]
  ) as number) ?? 0;
  let estado: 'pendiente' | 'parcial' | 'cobrado' | 'vencido';
  if (total >= costo) estado = 'cobrado';
  else if (total > 0) estado = 'parcial';
  else estado = venc < Date.now() ? 'vencido' : 'pendiente';
  execSql('UPDATE ciclos SET estado = ? WHERE id = ?', [estado, cicloId]);
}

export async function registrarPago(input: {
  cicloId: string;
  peopleId: string;
  monto: number;
  fechaPago: number;
  metodo?: 'transferencia' | 'efectivo' | 'tarjeta' | 'otro';
  nota?: string;
}) {
  const id = uid();
  const now = Date.now();
  runInTransaction(() => {
    execSql(
      `INSERT INTO pagos (id, ciclo_id, people_id, monto, fecha_pago, metodo, nota, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.cicloId, input.peopleId, input.monto, input.fechaPago, input.metodo ?? null, input.nota ?? null, now]
    );
    recalcularEstadoCiclo(input.cicloId);
  });
  return id;
}

export async function deletePago(pagoId: string) {
  const db = getDb();
  const cicloId = (db.selectValue('SELECT ciclo_id FROM pagos WHERE id = ?', [pagoId]) as string) ?? null;
  if (!cicloId) return;
  runInTransaction(() => {
    execSql('DELETE FROM pagos WHERE id = ?', [pagoId]);
    recalcularEstadoCiclo(cicloId);
  });
}

export interface PagoMultipleInput {
  cicloId: string;
  peopleId: string;
  monto: number;
  fechaPago: number;
  metodo?: 'transferencia' | 'efectivo' | 'tarjeta' | 'otro';
  nota?: string;
}

/**
 * Registra varios pagos en una sola transacción y recalcula el estado
 * de los ciclos afectados. Pensado para el flujo "cargar varios
 * pagos vencidos a un mismo deudor" (CobroMultiCicloForm) o para
 * pagos masivos desde CobroMasivoForm.
 *
 * No se valida que los pagos sean del mismo people_id o del mismo
 * ciclo: el caller ya lo garantiza. Devuelve la cantidad de pagos
 * insertados y los ciclos cuyo estado fue actualizado.
 */
export async function registrarPagosMultiples(
  pagos: PagoMultipleInput[]
): Promise<{ pagosCreados: number; ciclosActualizados: string[] }> {
  if (pagos.length === 0) {
    return { pagosCreados: 0, ciclosActualizados: [] };
  }
  const now = Date.now();
  const ciclosAfectados = new Set<string>();
  runInTransaction(() => {
    for (const p of pagos) {
      const id = uid();
      execSql(
        `INSERT INTO pagos (id, ciclo_id, people_id, monto, fecha_pago, metodo, nota, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, p.cicloId, p.peopleId, p.monto, p.fechaPago, p.metodo ?? null, p.nota ?? null, now]
      );
      ciclosAfectados.add(p.cicloId);
    }
    for (const cicloId of ciclosAfectados) {
      recalcularEstadoCiclo(cicloId);
    }
  });
  return {
    pagosCreados: pagos.length,
    ciclosActualizados: Array.from(ciclosAfectados),
  };
}
