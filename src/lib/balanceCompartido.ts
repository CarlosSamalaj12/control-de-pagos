// src/lib/balanceCompartido.ts
// Cálculo de balances del módulo compartido. SQL puro.
// Usa `people` (no `profiles`) porque los roommates no son usuarios de la app.
import { getDb } from '../db/client';
import { MESES_ES } from './format';
import type { Moneda } from '../types';

export interface ResumenSuscripcion {
  suscripcionId: string;
  nombre: string;
  payerPeopleId: string;
  payerNombre: string;
  totalCiclo: number;
  cobrado: number;
  pendiente: number;
  pct: number;
}

export interface BalancePersona {
  peopleId: string;
  nombre: string;
  iniciales: string;
  color: string;
  isSelf: boolean;
  saldo: number; // positivo = le deben, negativo = debe
  detalle: Array<{
    suscripcionId: string;
    nombre: string;
    cuotaEsperada: number;
    pagado: number;
    pendiente: number;
  }>;
}

export function getResumenPeriodo(year: number, month: number) {
  const db = getDb();
  const periodo = `${year}-${String(month).padStart(2, '0')}`;

  const totalCosto = (db.selectValue(
    `SELECT COALESCE(SUM(s.costo_total), 0)
     FROM ciclos c
     JOIN suscripciones s ON s.id = c.suscripcion_id
     WHERE c.periodo = ? AND s.activo = 1`,
    [periodo]
  ) as number) ?? 0;

  const totalCobrado = (db.selectValue(
    `SELECT COALESCE(SUM(p.monto), 0)
     FROM pagos p
     JOIN ciclos c ON c.id = p.ciclo_id
     WHERE c.periodo = ?`,
    [periodo]
  ) as number) ?? 0;

  return {
    periodo,
    label: `${MESES_ES[month - 1]} ${year}`,
    totalCosto,
    totalCobrado,
    pendiente: Math.max(0, totalCosto - totalCobrado),
    pct: totalCosto > 0 ? Math.min(100, (totalCobrado / totalCosto) * 100) : 0,
  };
}

export function getProximosVencimientos(dias = 14, limit = 10) {
  const db = getDb();
  const ahora = Date.now();
  const limite = ahora + dias * 24 * 60 * 60 * 1000;
  return db.selectArrays(
    `SELECT c.id, s.nombre, s.color, c.fecha_vencimiento, c.estado, s.costo_total,
            (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE ciclo_id = c.id) AS cobrado
     FROM ciclos c
     JOIN suscripciones s ON s.id = c.suscripcion_id
     WHERE s.activo = 1
       AND c.estado IN ('pendiente', 'parcial')
       AND c.fecha_vencimiento >= ?
       AND c.fecha_vencimiento <= ?
     ORDER BY c.fecha_vencimiento ASC
     LIMIT ?`,
    [ahora, limite, limit]
  ).map((row) => ({
    cicloId: row[0],
    nombre: row[1],
    color: row[2],
    fechaVencimiento: row[3],
    estado: row[4],
    costoTotal: row[5],
    cobrado: row[6],
  }));
}

/**
 * Resumen de cada suscripción activa para un periodo (YYYY-MM).
 * Para cada suscripción devuelve:
 *   - totalParticipantes
 *   - cicloId (si existe ciclo generado)
 *   - cobrado (suma de pagos del ciclo)
 *   - completos / parciales / pendientes (conteo de participantes según su estado de pago)
 * Usado por el Dashboard para mostrar el card "Cobros pendientes".
 */
export interface ResumenSuscripcionPeriodo {
  suscripcionId: string;
  nombre: string;
  color: string;
  moneda: 'ARS' | 'USD' | 'EUR' | 'GTQ';
  costoTotal: number;
  cicloId: string | null;
  cicloEstado: 'pendiente' | 'parcial' | 'cobrado' | 'vencido' | null;
  cobrado: number;
  totalParticipantes: number;
  completos: number;
  parciales: number;
  pendientes: number;
  sinCuota: number;
}

/** SQL base para el resumen de suscripciones del periodo. Se reutiliza
 *  tanto por la versión imperativa (getResumenSuscripcionesPeriodo) como
 *  por el hook reactivo (useResumenSuscripcionesPeriodo). */
export const SQL_RESUMEN_SUSCRIPCIONES_PERIODO = `
  SELECT
    s.id AS suscripcion_id,
    s.nombre,
    s.color,
    s.moneda,
    s.costo_total,
    c.id AS ciclo_id,
    c.estado AS ciclo_estado,
    (SELECT COUNT(*)
       FROM suscripcion_participantes
      WHERE suscripcion_id = s.id AND activo = 1) AS total_participantes,
    (SELECT COALESCE(SUM(monto), 0)
       FROM pagos WHERE ciclo_id = c.id) AS cobrado,
    (SELECT COUNT(*)
       FROM suscripcion_participantes sp
      WHERE sp.suscripcion_id = s.id AND sp.activo = 1 AND sp.cuota_esperada > 0
        AND (SELECT COALESCE(SUM(monto), 0) FROM pagos
              WHERE ciclo_id = c.id AND people_id = sp.people_id) >= sp.cuota_esperada) AS completos,
    (SELECT COUNT(*)
       FROM suscripcion_participantes sp
      WHERE sp.suscripcion_id = s.id AND sp.activo = 1 AND sp.cuota_esperada > 0
        AND (SELECT COALESCE(SUM(monto), 0) FROM pagos
              WHERE ciclo_id = c.id AND people_id = sp.people_id) > 0
        AND (SELECT COALESCE(SUM(monto), 0) FROM pagos
              WHERE ciclo_id = c.id AND people_id = sp.people_id) < sp.cuota_esperada) AS parciales,
    (SELECT COUNT(*)
       FROM suscripcion_participantes sp
      WHERE sp.suscripcion_id = s.id AND sp.activo = 1 AND sp.cuota_esperada > 0
        AND (SELECT COALESCE(SUM(monto), 0) FROM pagos
              WHERE ciclo_id = c.id AND people_id = sp.people_id) = 0) AS pendientes,
    (SELECT COUNT(*)
       FROM suscripcion_participantes sp
      WHERE sp.suscripcion_id = s.id AND sp.activo = 1
        AND (sp.cuota_esperada = 0 OR sp.cuota_esperada IS NULL)) AS sin_cuota
  FROM suscripciones s
  LEFT JOIN ciclos c ON c.suscripcion_id = s.id AND c.periodo = ?
  WHERE s.activo = 1
  ORDER BY s.nombre
`;

/** SQL base: cada PARTICIPANTE de cada suscripción activa, con su estado
 *  de pago en el periodo. Una fila por (suscripción, persona). */
export const SQL_PARTICIPANTES_POR_PERIODO = `
  SELECT
    s.id AS suscripcion_id,
    s.nombre AS suscripcion_nombre,
    s.color AS suscripcion_color,
    s.moneda,
    s.costo_total,
    c.id AS ciclo_id,
    c.estado AS ciclo_estado,
    sp.cuota_esperada,
    p.id AS people_id,
    p.nombre,
    p.iniciales,
    p.color,
    p.is_self,
    (SELECT COALESCE(SUM(monto), 0)
       FROM pagos WHERE ciclo_id = c.id AND people_id = p.id) AS monto_pagado,
    (SELECT id FROM pagos
       WHERE ciclo_id = c.id AND people_id = p.id
       ORDER BY fecha_pago DESC LIMIT 1) AS pago_id,
    (SELECT fecha_pago FROM pagos
       WHERE ciclo_id = c.id AND people_id = p.id
       ORDER BY fecha_pago DESC LIMIT 1) AS fecha_pago
  FROM suscripciones s
  JOIN suscripcion_participantes sp ON sp.suscripcion_id = s.id AND sp.activo = 1
  JOIN people p ON p.id = sp.people_id
  LEFT JOIN ciclos c ON c.suscripcion_id = s.id AND c.periodo = ?
  WHERE s.activo = 1
  ORDER BY s.nombre, p.nombre
`;

export function getResumenSuscripcionesPeriodo(
  year: number,
  month: number
): ResumenSuscripcionPeriodo[] {
  const db = getDb();
  const periodo = `${year}-${String(month).padStart(2, '0')}`;
  return db
    .selectArrays(SQL_RESUMEN_SUSCRIPCIONES_PERIODO, [periodo])
    .map((r) => ({
      suscripcionId: r[0] as string,
      nombre: r[1] as string,
      color: r[2] as string,
      moneda: r[3] as ResumenSuscripcionPeriodo['moneda'],
      costoTotal: +(r[4] as number),
      cicloId: (r[5] as string | null) ?? null,
      cicloEstado: (r[6] as ResumenSuscripcionPeriodo['cicloEstado']) ?? null,
      cobrado: +(r[7] as number),
      totalParticipantes: +(r[8] as number),
      completos: +(r[9] as number),
      parciales: +(r[10] as number),
      pendientes: +(r[11] as number),
      sinCuota: +(r[12] as number),
    }));
}

export function getBalancePorPersona(year: number, month: number): BalancePersona[] {
  const db = getDb();
  const periodo = `${year}-${String(month).padStart(2, '0')}`;

  const rows = db.selectArrays(
    `SELECT s.id AS sid, s.nombre, s.payer_people_id,
            p.id AS pid, p.nombre AS pnombre, p.iniciales, p.color, p.is_self,
            sp.cuota_esperada,
            (SELECT COALESCE(SUM(pg.monto), 0)
               FROM pagos pg
               JOIN ciclos c ON c.id = pg.ciclo_id
              WHERE c.suscripcion_id = s.id
                AND c.periodo = ?
                AND pg.people_id = p.id) AS pagado
     FROM suscripciones s
     JOIN suscripcion_participantes sp ON sp.suscripcion_id = s.id AND sp.activo = 1
     JOIN people p ON p.id = sp.people_id
     WHERE s.activo = 1`,
    [periodo]
  );

  const map = new Map<string, BalancePersona>();
  for (const r of rows) {
    const [sid, sNombre, , pid, pNombre, pIniciales, pColor, isSelf, cuota, pagado] = r;
    if (!map.has(pid)) {
      map.set(pid, {
        peopleId: pid,
        nombre: pNombre,
        iniciales: pIniciales,
        color: pColor,
        isSelf: !!isSelf,
        saldo: 0,
        detalle: [],
      });
    }
    const b = map.get(pid)!;
    const pendiente = Math.max(0, +cuota - +pagado);
    b.detalle.push({
      suscripcionId: sid,
      nombre: sNombre,
      cuotaEsperada: +cuota,
      pagado: +pagado,
      pendiente,
    });
    // Saldo = lo que pagó - lo que debía
    b.saldo += +pagado - +cuota;
  }
  return Array.from(map.values()).sort((a, b) => b.saldo - a.saldo);
}

export function getDeudaDetallePara(
  deudorPeopleId: string,
  year: number,
  month: number
) {
  const db = getDb();
  const periodo = `${year}-${String(month).padStart(2, '0')}`;
  return db.selectArrays(
    `SELECT s.id, s.nombre, s.payer_people_id, c.id AS ciclo_id, c.periodo, sp.cuota_esperada,
            (SELECT COALESCE(SUM(pg.monto), 0)
               FROM pagos pg
              WHERE pg.ciclo_id = c.id AND pg.people_id = ?) AS pagado
     FROM suscripciones s
     JOIN suscripcion_participantes sp ON sp.suscripcion_id = s.id
     JOIN ciclos c ON c.suscripcion_id = s.id AND c.periodo = ?
     WHERE s.activo = 1
       AND sp.activo = 1
       AND sp.people_id = ?
     ORDER BY c.fecha_vencimiento ASC`,
    [deudorPeopleId, periodo, deudorPeopleId]
  ).map((r) => ({
    suscripcionId: r[0],
    nombre: r[1],
    payerPeopleId: r[2],
    cicloId: r[3],
    periodo: r[4],
    cuotaEsperada: +r[5],
    pagado: +r[6],
    pendiente: Math.max(0, +r[5] - +r[6]),
  }));
}

// ============================================================================
// Deudas globales: aggregate de todas las cuotas pendientes (todos los
// periodos) agrupadas por persona. Incluye info de si está vencido.
// ============================================================================
export interface DeudaCiclo {
  cicloId: string;
  suscripcionId: string;
  suscripcionNombre: string;
  suscripcionColor: string;
  suscripcionIcono?: string;
  periodo: string;
  fechaVencimiento: number;
  cuotaEsperada: number;
  pagado: number;
  pendiente: number;
  vencido: boolean;
  diasAtraso: number;
}

export interface DeudaPorPersona {
  peopleId: string;
  nombre: string;
  iniciales: string;
  color: string;
  isSelf: boolean;
  total: number;
  totalVencido: number;
  cantidadCiclos: number;
  cantidadVencidos: number;
  ciclos: DeudaCiclo[];
}

export function getDeudasPorPersona(): DeudaPorPersona[] {
  const db = getDb();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  // Para cada (participante, ciclo) calculamos cuánto pagó vs cuánto debe.
  // Filtramos a los que tengan pendiente > 0.
  const rows = db.selectArrays(
    `SELECT sp.people_id,
            p.nombre, p.iniciales, p.color, p.is_self,
            s.id, s.nombre, s.color, s.icono,
            c.id, c.periodo, c.fecha_vencimiento,
            sp.cuota_esperada,
            COALESCE((SELECT SUM(monto) FROM pagos WHERE ciclo_id = c.id AND people_id = sp.people_id), 0) AS pagado
     FROM suscripcion_participantes sp
     JOIN suscripciones s ON s.id = sp.suscripcion_id AND s.activo = 1
     JOIN people p ON p.id = sp.people_id
     JOIN ciclos c ON c.suscripcion_id = s.id
     WHERE sp.activo = 1
       AND c.estado IN ('pendiente', 'parcial', 'vencido')
     ORDER BY p.nombre, c.fecha_vencimiento ASC`
  );

  const map = new Map<string, DeudaPorPersona>();
  for (const r of rows) {
    const [peopleId, nombre, iniciales, color, isSelf, sid, snombre, scolor, sicono, cid, periodo, fechaVencRaw, cuota, pagado] = r;
    const fechaVenc = +fechaVencRaw;
    const cuotaEsperada = +cuota;
    const pagadoNum = +pagado;
    const pendiente = cuotaEsperada - pagadoNum;
    if (pendiente <= 0.005) continue; // no debe nada (tolerancia por redondeo)

    if (!map.has(peopleId)) {
      map.set(peopleId, {
        peopleId,
        nombre,
        iniciales,
        color,
        isSelf: !!isSelf,
        total: 0,
        totalVencido: 0,
        cantidadCiclos: 0,
        cantidadVencidos: 0,
        ciclos: [],
      });
    }
    const d = map.get(peopleId)!;
    const vencido = fechaVenc < now;
    const diasAtraso = vencido ? Math.floor((now - fechaVenc) / oneDay) : 0;
    d.ciclos.push({
      cicloId: cid,
      suscripcionId: sid,
      suscripcionNombre: snombre,
      suscripcionColor: scolor,
      suscripcionIcono: sicono as string,
      periodo,
      fechaVencimiento: fechaVenc,
      cuotaEsperada,
      pagado: pagadoNum,
      pendiente,
      vencido,
      diasAtraso,
    });
    d.total += pendiente;
    d.cantidadCiclos += 1;
    if (vencido) {
      d.totalVencido += pendiente;
      d.cantidadVencidos += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function getResumenDeudas() {
  const deudas = getDeudasPorPersona();
  return {
    totalPersonas: deudas.length,
    totalAdeudado: deudas.reduce((s, d) => s + d.total, 0),
    totalVencido: deudas.reduce((s, d) => s + d.totalVencido, 0),
    totalCiclosPendientes: deudas.reduce((s, d) => s + d.cantidadCiclos, 0),
    totalCiclosVencidos: deudas.reduce((s, d) => s + d.cantidadVencidos, 0),
  };
}

// ============================================================================
// Vista "Meses que me debe una persona en una suscripción"
// ============================================================================
// Devuelve todos los ciclos de la combinación (people, suscripcion),
// incluyendo pagados, parciales y pendientes, hasta el mes actual
// (fecha_vencimiento <= now + 30d para no traer los 12 meses futuros
// que genera cicloGenerator). Ordenados del más viejo al más nuevo
// (los pendientes arriba, los pagados al final).
export interface CicloPersonaSuscripcion {
  cicloId: string;
  suscripcionId: string;
  suscripcionNombre: string;
  suscripcionColor: string;
  suscripcionIcono?: string;
  suscripcionMoneda: Moneda;
  periodo: string;
  fechaVencimiento: number;
  cuotaEsperada: number;
  totalPagado: number;
  pagos: Array<{
    id: string;
    monto: number;
    fechaPago: number;
    nota: string | null;
  }>;
  pendiente: number;
  vencido: boolean;
  diasAtraso: number;
  estadoPorPersona: 'completo' | 'parcial' | 'pendiente' | 'sin_cuota';
}

export function getCiclosPorPersonaSuscripcion(
  peopleId: string,
  suscripcionId: string,
): CicloPersonaSuscripcion[] {
  const db = getDb();
  const now = Date.now();
  const cutoff = now + 30 * 24 * 60 * 60 * 1000; // 30 días hacia adelante
  const oneDay = 24 * 60 * 60 * 1000;

  // Traemos primero los ciclos, después un SELECT separado para los
  // pagos (más portable que un GROUP_CONCAT en SQLite-WASM).
  const cicloRows = db.selectArrays(
    `SELECT c.id, s.id, s.nombre, s.color, s.icono, s.moneda,
            c.periodo, c.fecha_vencimiento,
            sp.cuota_esperada
     FROM suscripcion_participantes sp
     JOIN suscripciones s ON s.id = sp.suscripcion_id
     JOIN ciclos c ON c.suscripcion_id = s.id
     WHERE sp.people_id = ? AND sp.suscripcion_id = ? AND sp.activo = 1
       AND s.activo = 1
       AND c.fecha_vencimiento <= ?
     ORDER BY c.fecha_vencimiento ASC`,
    [peopleId, suscripcionId, cutoff]
  );

  if (cicloRows.length === 0) return [];

  // Recolectamos los pagos por ciclo en un solo SELECT con WHERE IN
  // para evitar N+1.
  const cicloIds: string[] = cicloRows.map((r) => r[0] as string);
  const placeholders = cicloIds.map(() => '?').join(',');
  const pagoRows = db.selectArrays(
    `SELECT id, ciclo_id, monto, fecha_pago, nota
       FROM pagos
      WHERE ciclo_id IN (${placeholders})
        AND people_id = ?
      ORDER BY fecha_pago ASC`,
    [...cicloIds, peopleId]
  );

  // Indexamos pagos por ciclo.
  const pagosPorCiclo = new Map<string, Array<{ id: string; monto: number; fechaPago: number; nota: string | null }>>();
  for (const p of pagoRows) {
    const [pid, cicloId, monto, fechaPago, nota] = p;
    const list = pagosPorCiclo.get(cicloId) ?? [];
    list.push({
      id: pid,
      monto: +monto,
      fechaPago: +fechaPago,
      nota: nota ?? null,
    });
    pagosPorCiclo.set(cicloId, list);
  }

  const out: CicloPersonaSuscripcion[] = cicloRows.map((r) => {
    const [cicloId, sId, sNombre, sColor, sIcono, sMoneda, periodo, fechaVencRaw, cuotaRaw] = r;
    const fechaVenc = +fechaVencRaw;
    const cuotaEsperada = +cuotaRaw;
    const pagos = pagosPorCiclo.get(cicloId as string) ?? [];
    const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
    const pendiente = Math.max(0, cuotaEsperada - totalPagado);
    const vencido = pendiente > 0 && fechaVenc < now;
    const diasAtraso = vencido ? Math.floor((now - fechaVenc) / oneDay) : 0;
    const estadoPorPersona: CicloPersonaSuscripcion['estadoPorPersona'] =
      cuotaEsperada <= 0
        ? 'sin_cuota'
        : pendiente <= 0.005
        ? 'completo'
        : totalPagado > 0
        ? 'parcial'
        : 'pendiente';
    return {
      cicloId: cicloId as string,
      suscripcionId: sId as string,
      suscripcionNombre: sNombre as string,
      suscripcionColor: sColor as string,
      suscripcionIcono: sIcono as string,
      suscripcionMoneda: sMoneda as Moneda,
      periodo: periodo as string,
      fechaVencimiento: fechaVenc,
      cuotaEsperada,
      totalPagado,
      pagos,
      pendiente,
      vencido,
      diasAtraso,
      estadoPorPersona,
    };
  });

  return out;
}

export function getResumenDeudaPersonaSuscripcion(
  peopleId: string,
  suscripcionId: string
) {
  const ciclos = getCiclosPorPersonaSuscripcion(peopleId, suscripcionId);
  let totalAdeudado = 0;
  let totalVencido = 0;
  let cantidadCiclosPendientes = 0;
  let cantidadCiclosVencidos = 0;
  let cantidadCiclosPagados = 0;
  for (const c of ciclos) {
    if (c.estadoPorPersona === 'completo') {
      cantidadCiclosPagados += 1;
      continue;
    }
    cantidadCiclosPendientes += 1;
    totalAdeudado += c.pendiente;
    if (c.vencido) {
      cantidadCiclosVencidos += 1;
      totalVencido += c.pendiente;
    }
  }
  return {
    totalAdeudado,
    totalVencido,
    cantidadCiclosPendientes,
    cantidadCiclosVencidos,
    cantidadCiclosPagados,
    cantidadCiclosTotal: ciclos.length,
  };
}
