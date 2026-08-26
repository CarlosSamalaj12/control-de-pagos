// src/components/ui/CurrencyIcon.tsx
// Ícono visual para cada moneda. GTQ (Quetzal), USD, EUR, ARS.
// Se usa en combinación con CurrencyText para reemplazar formatCurrency
// en los lugares donde se quiere ver un ícono + número, en vez de solo texto.

import type { LucideIcon } from 'lucide-react';
import { Banknote, DollarSign, Euro } from 'lucide-react';
import type { Moneda } from '../../types';
import { MONEDA_PRINCIPAL } from '../../types';

export interface CurrencyMeta {
  /** Símbolo corto (Q, $, €, AR$) */
  symbol: string;
  /** Color de fondo (referencia visual al país) */
  color: string;
  /** Ícono Lucide (para usos donde se prefiera ícono a símbolo) */
  Icon: LucideIcon;
  /** Nombre legible */
  nombre: string;
}

export const CURRENCY_META: Record<Moneda, CurrencyMeta> = {
  GTQ: { symbol: 'Q', color: '#4997D0', Icon: Banknote, nombre: 'Quetzal' },
  USD: { symbol: '$', color: '#2E7D32', Icon: DollarSign, nombre: 'Dólar' },
  EUR: { symbol: '€', color: '#003399', Icon: Euro, nombre: 'Euro' },
  ARS: { symbol: '$', color: '#74ACDF', Icon: Banknote, nombre: 'Peso argentino' },
};

export type CurrencySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<CurrencySize, { box: string; text: string }> = {
  xs: { box: 'w-4 h-4', text: 'text-[9px]' },
  sm: { box: 'w-5 h-5', text: 'text-[10px]' },
  md: { box: 'w-7 h-7', text: 'text-xs' },
  lg: { box: 'w-9 h-9', text: 'text-sm' },
  xl: { box: 'w-12 h-12', text: 'text-base' },
};

/**
 * Badge circular con el símbolo de la moneda adentro.
 * Ej: <CurrencyIcon moneda="GTQ" size="md" /> → círculo celeste con "Q" blanca
 */
export function CurrencyIcon({
  moneda,
  size = 'md',
  className = '',
}: {
  moneda: Moneda;
  size?: CurrencySize;
  className?: string;
}) {
  const meta = CURRENCY_META[moneda] ?? CURRENCY_META.USD;
  const s = SIZE_CLASSES[size];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ${s.box} ${s.text} ${className}`}
      style={{ backgroundColor: meta.color }}
      title={`${meta.nombre} (${moneda})`}
      aria-label={meta.nombre}
    >
      {meta.symbol}
    </span>
  );
}

const NUMBER_LOCALES: Record<Moneda, string> = {
  ARS: 'es-AR',
  USD: 'es',
  EUR: 'es-ES',
  GTQ: 'es-GT',
};

/**
 * Formatea SOLO el número (sin símbolo de moneda). Útil para combinar
 * con <CurrencyIcon /> o <CurrencyText />.
 */
export function formatNumberOnly(n: number, moneda: Moneda = MONEDA_PRINCIPAL): string {
  if (Number.isNaN(n) || n == null) n = 0;
  try {
    return new Intl.NumberFormat(NUMBER_LOCALES[moneda] ?? 'es', {
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

/**
 * Texto con ícono de moneda + número formateado. Reemplaza a formatCurrency
 * en los lugares donde se quiere ver el ícono visual.
 *
 *   <CurrencyText moneda="GTQ" monto={78} /> → [Q] 78.00
 */
export function CurrencyText({
  moneda,
  monto,
  size = 'sm',
  className = '',
  iconOnRight = false,
}: {
  moneda: Moneda;
  monto: number;
  size?: CurrencySize;
  className?: string;
  /** Si true, muestra el ícono a la derecha del número */
  iconOnRight?: boolean;
}) {
  const num = formatNumberOnly(monto, moneda);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {!iconOnRight && <CurrencyIcon moneda={moneda} size={size} />}
      <span className="tabular-nums">{num}</span>
      {iconOnRight && <CurrencyIcon moneda={moneda} size={size} />}
    </span>
  );
}

/** Devuelve el símbolo corto de la moneda. */
export function getCurrencySymbol(moneda: Moneda): string {
  return CURRENCY_META[moneda]?.symbol ?? moneda;
}
