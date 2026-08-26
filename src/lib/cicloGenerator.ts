// src/lib/cicloGenerator.ts
// Genera los próximos N ciclos para una suscripción, sin duplicar.
import { addDays, addMonths, addWeeks, setDate, startOfDay } from 'date-fns';
import { runInTransaction, execSql, qAll, qScalar } from '../db/client';
import { uid } from './id';
import type { Suscripcion } from '../types';

function safeDayOfMonth(year: number, month: number, day: number): number {
  if (day <= 28) return day;
  const last = new Date(year, month + 1, 0).getDate();
  return Math.min(day, last);
}

function computeFirstVencimiento(s: Suscripcion, from: Date): Date {
  const base = startOfDay(from);
  if (s.periodicidad === 'mensual') {
    const d = s.diaVencimiento ?? 1;
    const day = safeDayOfMonth(base.getFullYear(), base.getMonth(), d);
    let first = setDate(base, day);
    if (first < base) first = addMonths(first, 1);
    return first;
  }
  if (s.periodicidad === 'semanal') {
    const target = s.diaVencimiento ?? 0;
    const diff = (target - base.getDay() + 7) % 7;
    return addDays(base, diff);
  }
  if (s.periodicidad === 'cada_n_dias') {
    const n = s.intervaloDias ?? 30;
    return addDays(base, n);
  }
  return base;
}

function computePeriodo(d: Date, periodicidad: Suscripcion['periodicidad']): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  if (periodicidad === 'mensual') return `${y}-${m}`;
  if (periodicidad === 'semanal') {
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    const sy = start.getFullYear();
    const sm = String(start.getMonth() + 1).padStart(2, '0');
    const sd = String(start.getDate()).padStart(2, '0');
    return `${sy}-${sm}-${sd}`;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function nextFecha(actual: Date, s: Suscripcion): Date {
  if (s.periodicidad === 'mensual') return addMonths(actual, 1);
  if (s.periodicidad === 'semanal') return addWeeks(actual, 1);
  return addDays(actual, s.intervaloDias ?? 30);
}

/** Lee una suscripción por id. Si no existe, retorna null. */
function loadSuscripcion(suscripcionId: string): Suscripcion | null {
  // OJO: NO usar qScalar acá — qScalar devuelve solo la primera
  // columna (el id), no la fila entera. Con qAll + [0] sí obtenemos
  // un objeto con todos los campos. Bug histórico que rompía la
  // generación de ciclos (leía `row.nombre` como `undefined` y por
  // eso caía a Date.now() como fecha de inicio).
  const rows = qAll<any>(
    `SELECT id, nombre, costo_total, moneda, periodicidad, dia_vencimiento, intervalo_dias, color, icono, payer_people_id, activo, notas, fecha_inicio, created_at, updated_at
     FROM suscripciones WHERE id = ?`,
    [suscripcionId]
  );
  const row = rows[0];
  // eslint-disable-next-line no-console
  console.log('[cicloGenerator] loadSuscripcion', { suscripcionId, found: !!row, fechaInicio: row?.fecha_inicio });
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.nombre,
    costoTotal: row.costo_total,
    moneda: row.moneda,
    periodicidad: row.periodicidad,
    diaVencimiento: row.dia_vencimiento ?? undefined,
    intervaloDias: row.intervalo_dias ?? undefined,
    color: row.color,
    icono: row.icono,
    payerPeopleId: row.payer_people_id,
    fechaInicio: row.fecha_inicio ?? row.created_at,
    activo: !!row.activo,
    notas: row.notas ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function generarCiclosFuturos(suscripcionId: string, count = 12, fromTimestamp?: number): number {
  let s: Suscripcion | null;
  try {
    s = loadSuscripcion(suscripcionId);
  } catch (e) {
    console.warn('[cicloGenerator] no se pudo cargar la suscripción:', e);
    return 0;
  }
  if (!s) {
    // eslint-disable-next-line no-console
    console.warn('[cicloGenerator] suscripción no encontrada:', suscripcionId);
    return 0;
  }

  // Si la suscripción tiene fecha_inicio, arrancamos desde ahí.
  // Si no, usamos "hoy".
  const start = fromTimestamp ?? s.fechaInicio ?? Date.now();
  const startDate = new Date(start);
  // eslint-disable-next-line no-console
  console.log('[cicloGenerator] generar', {
    suscripcionId,
    nombre: s.nombre,
    fechaInicio: s.fechaInicio,
    startISO: startDate.toISOString(),
    diaVencimiento: s.diaVencimiento,
    periodicidad: s.periodicidad,
    count,
  });

  // Ajustamos el día al día de vencimiento de la suscripción
  // (e.g. si fecha_inicio = 2026-06-15 y día = 7, primer ciclo es 2026-06-07)
  let fecha = computeFirstVencimiento(s, startDate);
  const now = Date.now();
  let created = 0;
  const logs: string[] = [];

  runInTransaction(() => {
    for (let i = 0; i < count; i++) {
      const periodo = computePeriodo(fecha, s!.periodicidad);
      const existing = qScalar<any>(
        'SELECT id FROM ciclos WHERE suscripcion_id = ? AND periodo = ?',
        [suscripcionId, periodo],
        null
      );
      if (!existing) {
        execSql(
          `INSERT INTO ciclos (id, suscripcion_id, periodo, fecha_vencimiento, estado, created_at)
           VALUES (?, ?, ?, ?, 'pendiente', ?)`,
          [uid(), suscripcionId, periodo, fecha.getTime(), now]
        );
        created++;
        logs.push(`+${periodo}`);
      } else {
        logs.push(`=${periodo}`);
      }
      fecha = nextFecha(fecha, s!);
    }
  });

  // eslint-disable-next-line no-console
  console.log('[cicloGenerator] resultado', { created, detalle: logs.join(' ') });
  return created;
}
