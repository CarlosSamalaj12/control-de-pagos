// src/lib/pdf/ticketData.ts
// Helpers para armar el payload del PDF de "Estado de cuenta".
// Centraliza la query de pagos con JOIN a ciclos+suscripciones y la
// conversión al formato TicketParams de jsPDF.
import { getDb } from '../../db/client';
import type { Moneda } from '../../types';
import type {
  TicketItem,
  TicketPagoHist,
  TicketParams,
  CuentaPagoResumen,
} from './ticketDeuda';

/** Ciclo mínimo para armar el payload del PDF. */
export interface CicloParaTicket {
  cicloId: string;
  suscripcionId: string;
  suscripcionNombre: string;
  suscripcionColor?: string;
  suscripcionIcono?: string;
  periodo: string;
  fechaVencimiento: number;
  cuotaEsperada: number;
  totalPagado: number;
  pendiente: number;
  vencido: boolean;
  diasAtraso: number;
}

/** Pago crudo de la BD con JOIN a ciclos y suscripciones ya resuelto. */
export interface PagoCrudo {
  id: string;
  cicloId: string;
  peopleId: string;
  monto: number;
  fecha: number;
  metodo: 'transferencia' | 'efectivo' | 'tarjeta' | 'otro' | null;
  nota: string | null;
  /** Resuelto por JOIN. */
  suscripcionNombre?: string;
  periodo?: string;
}

/** Query SQL que trae los pagos crudos con JOIN resuelto. */
export function getPagosCrudosParaPersona(
  peopleId: string,
  options: { suscripcionId?: string } = {}
): PagoCrudo[] {
  const db = getDb();
  const where: string[] = ['p.people_id = ?'];
  const params: any[] = [peopleId];
  if (options.suscripcionId) {
    where.push('c.suscripcion_id = ?');
    params.push(options.suscripcionId);
  }
  return db
    .selectArrays(
      `SELECT p.id, p.ciclo_id, p.people_id, p.monto, p.fecha_pago, p.metodo, p.nota,
              s.nombre, c.periodo
         FROM pagos p
         JOIN ciclos c ON c.id = p.ciclo_id
         JOIN suscripciones s ON s.id = c.suscripcion_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.fecha_pago DESC`,
      params
    )
    .map((r) => ({
      id: r[0] as string,
      cicloId: r[1] as string,
      peopleId: r[2] as string,
      monto: +r[3],
      fecha: +r[4],
      metodo: (r[5] as PagoCrudo['metodo']) ?? null,
      nota: (r[6] as string) ?? null,
      suscripcionNombre: (r[7] as string) ?? undefined,
      periodo: (r[8] as string) ?? undefined,
    }));
}

function cicloToItem(c: CicloParaTicket): TicketItem {
  return {
    servicio: c.suscripcionNombre,
    servicioColor: c.suscripcionColor,
    servicioIcono: c.suscripcionIcono,
    periodo: c.periodo,
    vencimiento: c.fechaVencimiento,
    cuota: c.cuotaEsperada,
    pagado: c.totalPagado,
    pendiente: c.pendiente,
    vencido: c.vencido,
    diasAtraso: c.diasAtraso,
  };
}

function pagoCrudoToHist(p: PagoCrudo): TicketPagoHist {
  return {
    id: p.id,
    fecha: p.fecha,
    monto: p.monto,
    metodo: p.metodo,
    nota: p.nota,
    suscripcionNombre: p.suscripcionNombre,
    periodo: p.periodo ?? '',
  };
}

export interface ArmarTicketArgs {
  scope: 'cross' | 'single';
  /** En scope='single', requerido. */
  suscripcionId?: string;
  /** En scope='single', requerido. */
  suscripcionNombre?: string;
  /** Ciclos pendientes (con pagos agregados). */
  ciclos: CicloParaTicket[];
  /** Pagos crudos (con JOIN resuelto a suscripción y período). */
  pagos: PagoCrudo[];
  deudor: { nombre: string; contacto?: string };
  emisor: { nombre: string; contacto?: string };
  moneda: Moneda;
  nota?: string;
  /** Cuentas del emisor para mostrar en el pie del PDF. Opcional. */
  cuentasPago?: CuentaPagoResumen[];
}

/** Arma el TicketParams final para pasar a `generateTicketPDF`. */
export function armarDatosTicket(args: ArmarTicketArgs): TicketParams {
  return {
    deudor: args.deudor,
    emisor: args.emisor,
    fecha: new Date(),
    currency: args.moneda,
    nota: args.nota,
    scope: args.scope,
    suscripcionNombre: args.suscripcionNombre,
    items: args.ciclos.map(cicloToItem),
    pagos: args.pagos.map(pagoCrudoToHist),
    cuentasPago: args.cuentasPago,
  };
}
