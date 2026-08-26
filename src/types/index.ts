// src/types/index.ts
export type Periodicidad = 'mensual' | 'semanal' | 'cada_n_dias';
export type EstadoCiclo = 'pendiente' | 'parcial' | 'cobrado' | 'vencido';
export type TipoCategoria = 'expense' | 'income';
export type Moneda = 'ARS' | 'USD' | 'EUR' | 'GTQ';

// ============================================================================
// Cuentas de pago del emisor (banco + tipo + número). Usadas en el pie
// del PDF "Estado de cuenta" para que el deudor sepa dónde transferir.
// Modelo 1:N: un `people` (típicamente el is_self=1) tiene muchas
// `cuentas_pago`. Solo una puede ser `predeterminada` a la vez.
// ============================================================================
export type TipoCuentaPago = 'ahorro' | 'monetaria' | 'tarjeta' | 'otra';

export const TIPO_CUENTA_LABEL: Record<TipoCuentaPago, string> = {
  ahorro: 'Ahorro',
  monetaria: 'Monetaria',
  tarjeta: 'Tarjeta',
  otra: 'Otra',
};

export interface CuentaPago {
  id: string;
  peopleId: string;
  banco: string;
  tipo: TipoCuentaPago;
  numero: string;
  predeterminada: boolean;
  orden: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Moneda principal de la app. Se usa como default en formularios, en
 * helpers de formato (formatCurrency / formatCompact) y en vistas de
 * resumen que agregan ciclos de suscripciones con monedas distintas
 * (Deudas, BalanceModal). Cambiar este valor si la app se adapta a
 * otro país.
 */
export const MONEDA_PRINCIPAL: Moneda = 'GTQ';
export type MetodoPago =
  | 'efectivo'
  | 'tarjeta_debito'
  | 'tarjeta_credito'
  | 'transferencia'
  | 'otro';
export type MetodoPagoCompartido = 'transferencia' | 'efectivo' | 'tarjeta' | 'otro';

// ============================================================================
// Auth: el perfil del usuario actual (Carlos). Single-profile por device.
// ============================================================================
export interface Profile {
  id: string;
  nombre: string;
  pinHash: string;
  personId: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Persona: cualquier persona que aparece en suscripciones compartidas.
// Incluye al usuario actual (isSelf = true) y a los roommates/terceros.
// ============================================================================
export interface Person {
  id: string;
  nombre: string;
  color: string;
  iniciales: string;
  contacto?: string;
  notas?: string;
  isSelf: boolean;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Finanzas personales (por perfil/usuario)
// ============================================================================
export interface Category {
  id: string;
  profileId: string;
  nombre: string;
  color: string;
  icono: string;
  tipo: TipoCategoria;
  createdAt: number;
}

export interface Salary {
  id: string;
  profileId: string;
  year: number;
  month: number;
  amount: number;
  currency: Moneda;
  notas?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PersonalExpense {
  id: string;
  profileId: string;
  categoryId?: string;
  amount: number;
  date: number;
  description?: string;
  paymentMethod?: MetodoPago;
  notas?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Budget {
  id: string;
  profileId: string;
  categoryId: string;
  year: number;
  month: number;
  amount: number;
  createdAt: number;
  updatedAt: number;
}

export interface SavingsGoal {
  id: string;
  profileId: string;
  nombre: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: number;
  color: string;
  icono: string;
  notas?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  date: number;
  nota?: string;
  createdAt: number;
}

// ============================================================================
// Suscripciones compartidas (referencian people, NO profiles)
// ============================================================================
export interface Suscripcion {
  id: string;
  nombre: string;
  costoTotal: number;
  moneda: Moneda;
  periodicidad: Periodicidad;
  diaVencimiento?: number;
  intervaloDias?: number;
  color: string;
  icono: string;
  payerPeopleId: string;
  fechaInicio: number;
  activo: boolean;
  notas?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SuscripcionParticipante {
  suscripcionId: string;
  peopleId: string;
  cuotaEsperada: number;
  activo: boolean;
}

export interface Ciclo {
  id: string;
  suscripcionId: string;
  periodo: string;
  fechaVencimiento: number;
  estado: EstadoCiclo;
  createdAt: number;
}

export interface Pago {
  id: string;
  cicloId: string;
  peopleId: string;
  monto: number;
  fechaPago: number;
  metodo?: MetodoPagoCompartido;
  nota?: string;
  createdAt: number;
}

// ============================================================================
// Mappers snake_case (DB) -> camelCase (TS)
// ============================================================================
export const rowToProfile = (r: any): Profile => ({
  id: r.id,
  nombre: r.nombre,
  pinHash: r.pin_hash,
  personId: r.person_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const rowToPerson = (r: any): Person => ({
  id: r.id,
  nombre: r.nombre,
  color: r.color,
  iniciales: r.iniciales,
  contacto: r.contacto,
  notas: r.notas,
  isSelf: !!r.is_self,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const rowToCategory = (r: any): Category => ({
  id: r.id,
  profileId: r.profile_id,
  nombre: r.nombre,
  color: r.color,
  icono: r.icono,
  tipo: r.tipo,
  createdAt: r.created_at,
});

export const rowToSalary = (r: any): Salary => ({
  id: r.id,
  profileId: r.profile_id,
  year: r.year,
  month: r.month,
  amount: r.amount,
  currency: r.currency,
  notas: r.notas,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const rowToPersonalExpense = (r: any): PersonalExpense => ({
  id: r.id,
  profileId: r.profile_id,
  categoryId: r.category_id,
  amount: r.amount,
  date: r.date,
  description: r.description,
  paymentMethod: r.payment_method,
  notas: r.notas,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const rowToBudget = (r: any): Budget => ({
  id: r.id,
  profileId: r.profile_id,
  categoryId: r.category_id,
  year: r.year,
  month: r.month,
  amount: r.amount,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const rowToSavingsGoal = (r: any): SavingsGoal => ({
  id: r.id,
  profileId: r.profile_id,
  nombre: r.nombre,
  targetAmount: r.target_amount,
  currentAmount: r.current_amount,
  deadline: r.deadline,
  color: r.color,
  icono: r.icono,
  notas: r.notas,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const rowToGoalContribution = (r: any): GoalContribution => ({
  id: r.id,
  goalId: r.goal_id,
  amount: r.amount,
  date: r.date,
  nota: r.nota,
  createdAt: r.created_at,
});

export const rowToSuscripcion = (r: any): Suscripcion => ({
  id: r.id,
  nombre: r.nombre,
  costoTotal: r.costo_total,
  moneda: r.moneda,
  periodicidad: r.periodicidad,
  diaVencimiento: r.dia_vencimiento,
  intervaloDias: r.intervalo_dias,
  color: r.color,
  icono: r.icono,
  payerPeopleId: r.payer_people_id,
  fechaInicio: r.fecha_inicio ?? r.created_at,
  activo: !!r.activo,
  notas: r.notas,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const rowToCiclo = (r: any): Ciclo => ({
  id: r.id,
  suscripcionId: r.suscripcion_id,
  periodo: r.periodo,
  fechaVencimiento: r.fecha_vencimiento,
  estado: r.estado,
  createdAt: r.created_at,
});

export const rowToPago = (r: any): Pago => ({
  id: r.id,
  cicloId: r.ciclo_id,
  peopleId: r.people_id,
  monto: r.monto,
  fechaPago: r.fecha_pago,
  metodo: r.metodo,
  nota: r.nota,
  createdAt: r.created_at,
});

export const rowToCuentaPago = (r: any): CuentaPago => ({
  id: r.id,
  peopleId: r.people_id,
  banco: r.banco,
  tipo: r.tipo as TipoCuentaPago,
  numero: r.numero,
  predeterminada: !!r.predeterminada,
  orden: r.orden ?? 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
