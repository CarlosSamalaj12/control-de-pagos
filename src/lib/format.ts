// src/lib/format.ts
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { MONEDA_PRINCIPAL, type Moneda } from '../types';

const CURRENCY_LOCALES: Record<Moneda, string> = {
  ARS: 'es-AR',
  USD: 'en-US',
  EUR: 'es-ES',
  GTQ: 'es-GT',
};

export function formatCurrency(n: number, currency: Moneda = MONEDA_PRINCIPAL): string {
  if (Number.isNaN(n) || n == null) n = 0;
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function formatCompact(n: number, currency: Moneda = MONEDA_PRINCIPAL): string {
  if (Number.isNaN(n) || n == null) n = 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toFixed(0);
}

export function formatDate(d: number | Date | string, pattern = 'dd/MM/yyyy'): string {
  const date = typeof d === 'number' ? new Date(d) : d instanceof Date ? d : parseISO(d);
  try {
    return format(date, pattern, { locale: es });
  } catch {
    return '';
  }
}

export function formatRelative(d: number | Date): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  } catch {
    return '';
  }
}

export function getIniciales(nombre: string): string {
  if (!nombre) return '?';
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DIAS_SEMANA_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function getPeriodoLabel(periodo: string): string {
  // 'YYYY-MM' -> 'Junio 2026'; otros formatos ('YYYY-MM-DD') se devuelven tal cual.
  if (/^\d{4}-\d{2}$/.test(periodo)) {
    const [yyyy, mm] = periodo.split('-');
    const monthIdx = parseInt(mm, 10) - 1;
    return MESES_ES[monthIdx] ? `${MESES_ES[monthIdx]} ${yyyy}` : periodo;
  }
  return periodo;
}

export function nowPeriodo(fecha = new Date()): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Fecha local a string 'yyyy-MM-dd' (para inputs type="date"). */
export function toInputDate(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parsea 'yyyy-MM-dd' de un input date como mediodía local (evita el
 * corrimiento de día por timezone al interpretar como UTC midnight).
 */
export function inputDateToTimestamp(s: string): number {
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
}
