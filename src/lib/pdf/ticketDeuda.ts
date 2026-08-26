// src/lib/pdf/ticketDeuda.ts
// Genera un "Estado de cuenta" PDF formal con dos secciones:
//   1. Detalle de cuotas pendientes (cuota, pagado, pendiente, estado)
//   2. Historial completo de pagos (fecha, suscripción, monto, método, nota)
//   Totales por suscripción (si es cross) y totales globales
//   (vencido, por vencer, pagado histórico, adeudado).
import jsPDF from 'jspdf';
// jspdf-autotable v3 es CJS. En Vite a veces el default export no
// llega como función, así que usamos applyPlugin (oficial) que
// extiende el prototype de jsPDF con el método `autoTable`. Eso
// elimina el problema de interoperabilidad de módulos.
import { applyPlugin } from 'jspdf-autotable';
import { iconToPng } from './iconToPng';
applyPlugin(jsPDF);
import { formatCurrency, formatDate, getPeriodoLabel } from '../format';
import { TIPO_CUENTA_LABEL, type Moneda, type TipoCuentaPago } from '../../types';

export interface TicketItem {
  servicio: string;
  servicioColor?: string;
  servicioIcono?: string;
  periodo: string;
  vencimiento: number; // timestamp
  cuota: number;
  pagado: number;
  pendiente: number;
  vencido: boolean;
  diasAtraso: number;
}

export interface TicketPagoHist {
  id: string;
  fecha: number; // timestamp
  monto: number;
  metodo: 'transferencia' | 'efectivo' | 'tarjeta' | 'otro' | null;
  nota: string | null;
  /** Solo presente en scope='cross'. En scope='single' puede omitirse (igual al header). */
  suscripcionNombre?: string;
  periodo: string;
}

/** Resumen de una cuenta de pago del emisor para el pie del PDF. */
export interface CuentaPagoResumen {
  banco: string;
  tipo: TipoCuentaPago;
  numero: string;
}

export interface TicketParams {
  deudor: { nombre: string; contacto?: string };
  emisor: { nombre: string; contacto?: string };
  fecha: Date;
  items: TicketItem[];
  currency: Moneda;
  nota?: string;
  /** 'cross' = estado de cuenta global de la persona. 'single' = por suscripción. */
  scope: 'cross' | 'single';
  /** Solo en scope='single'. */
  suscripcionNombre?: string;
  /** Historial completo de pagos. */
  pagos: TicketPagoHist[];
  /** Cuentas de pago del emisor para mostrar en el pie. Opcional. */
  cuentasPago?: CuentaPagoResumen[];
}

const NAVY: [number, number, number] = [31, 78, 120];
const RED: [number, number, number] = [192, 0, 0];
const DARK: [number, number, number] = [31, 41, 55];
const GRAY: [number, number, number] = [107, 114, 128];
const LIGHT: [number, number, number] = [241, 245, 249];
const GREEN: [number, number, number] = [22, 163, 74];

function safeStr(s: string | null | undefined, fallback = '—'): string {
  if (s == null) return fallback;
  const t = String(s).trim();
  return t.length === 0 ? fallback : t;
}

function metodoLabel(m: TicketPagoHist['metodo']): string {
  switch (m) {
    case 'transferencia':
      return 'Transf.';
    case 'efectivo':
      return 'Efectivo';
    case 'tarjeta':
      return 'Tarjeta';
    case 'otro':
      return 'Otro';
    default:
      return '—';
  }
}

export async function generateTicketPDF(params: TicketParams) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15; // margen
  const total = params.items.reduce((s, d) => s + d.pendiente, 0);
  const totalVencido = params.items
    .filter((d) => d.vencido)
    .reduce((s, d) => s + d.pendiente, 0);
  const porVencer = total - totalVencido;
  const totalPagadoHist = params.pagos.reduce((s, p) => s + p.monto, 0);
  const folio = `EC-${formatDate(params.fecha, 'yyyyMMdd-HHmm')}`;
  const isSingle = params.scope === 'single';

  // ---- Pre-render de íconos por servicio (una sola vez) --------------------
  // Key por servicio (en scope='single' el servicio coincide con
  // suscripcionNombre, así que reutilizamos el mismo PNG para el
  // header y para la fila de la tabla).
  const iconosPreRenderizados = new Map<string, string>();
  const serviciosUnicos = new Map<string, { icono?: string; color?: string }>();
  for (const it of params.items) {
    const key = it.servicio;
    if (!serviciosUnicos.has(key)) {
      serviciosUnicos.set(key, {
        icono: it.servicioIcono,
        color: it.servicioColor,
      });
    }
  }
  await Promise.all(
    Array.from(serviciosUnicos.entries()).map(async ([key, { icono, color }]) => {
      if (!icono || !color) return;
      const png = await iconToPng(icono, color, 32);
      if (png) iconosPreRenderizados.set(key, png);
    })
  );
  // En scope='single' el ícono del header es el mismo que el del
  // primer item (mismo nombre de servicio).
  const headerIconoPng =
    isSingle && params.suscripcionNombre
      ? iconosPreRenderizados.get(params.suscripcionNombre) ?? null
      : null;
  const headerIconoSize = 10; // mm
  const headerIconoX = M;
  const headerIconoY = 9;
  const titleX = headerIconoPng ? headerIconoX + headerIconoSize + 4 : M;

  // ---- Banda superior -----------------------------------------------------
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 3, 'F');

  // ---- Encabezado ----------------------------------------------------------
  if (headerIconoPng) {
    try {
      doc.addImage(
        headerIconoPng,
        'PNG',
        headerIconoX,
        headerIconoY,
        headerIconoSize,
        headerIconoSize
      );
    } catch {
      // ignore - si falla el addImage seguimos con el header en texto
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text('ESTADO DE CUENTA', titleX, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(
    isSingle ? 'Detalle por suscripción' : 'Control de Pagos Compartidos',
    titleX,
    24
  );

  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(`Folio: ${folio}`, W - M, 16, { align: 'right' });
  doc.setTextColor(...GRAY);
  doc.text(
    `Fecha de emisión: ${formatDate(params.fecha, "dd 'de' MMMM 'de' yyyy")}`,
    W - M,
    21,
    { align: 'right' }
  );
  doc.text(`Moneda: ${params.currency}`, W - M, 26, { align: 'right' });
  if (isSingle && params.suscripcionNombre) {
    doc.setTextColor(...DARK);
    doc.text(
      `Suscripción: ${params.suscripcionNombre}`,
      W - M,
      31,
      { align: 'right' }
    );
  }

  const headerBottomY = isSingle ? 35 : 30;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(M, headerBottomY, W - M, headerBottomY);

  // ---- Bloques Emisor / Deudor --------------------------------------------
  const boxW = (W - M * 2 - 6) / 2;
  const boxY = headerBottomY + 6;
  const boxH = 22;

  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, boxY, boxW, boxH, 2, 2, 'F');
  doc.roundedRect(M + boxW + 6, boxY, boxW, boxH, 2, 2, 'F');

  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'bold');
  doc.text('EMISOR (A QUIEN SE PAGA)', M + 4, boxY + 6);
  doc.text('DEUDOR', M + boxW + 10, boxY + 6);

  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(
    doc.splitTextToSize(params.emisor.nombre, boxW - 8)[0] ?? '',
    M + 4,
    boxY + 12.5
  );
  doc.text(
    doc.splitTextToSize(params.deudor.nombre, boxW - 8)[0] ?? '',
    M + boxW + 10,
    boxY + 12.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  if (params.emisor.contacto)
    doc.text(params.emisor.contacto, M + 4, boxY + 18);
  if (params.deudor.contacto)
    doc.text(params.deudor.contacto, M + boxW + 10, boxY + 18);

  // ---- Tabla 1: Detalle de cuotas pendientes --------------------------------
  const tableStartY = boxY + boxH + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('DETALLE DE CUOTAS PENDIENTES', M, tableStartY);

  if (params.items.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('Sin cuotas pendientes.', M, tableStartY + 7);
  } else {
    (doc as any).autoTable({
      startY: tableStartY + 3,
      head: [
        ['', 'Servicio', 'Período', 'Vencimiento', 'Estado', 'Cuota', 'Pagado', 'Pendiente'],
      ],
      body: params.items.map((d) => [
        '', // Logo cell (imagen inyectada en didDrawCell)
        d.servicio,
        getPeriodoLabel(d.periodo),
        formatDate(d.vencimiento),
        d.vencido ? `Vencido (${d.diasAtraso}d)` : 'Por vencer',
        formatCurrency(d.cuota, params.currency),
        formatCurrency(d.pagado, params.currency),
        formatCurrency(d.pendiente, params.currency),
      ]),
      headStyles: {
        fillColor: NAVY,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: { fontSize: 9, textColor: DARK, minCellHeight: 7 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        0: { cellWidth: 8 },       // Logo
        1: { cellWidth: 32 },      // Servicio
        2: { cellWidth: 24 },      // Período
        3: { cellWidth: 22 },      // Vencimiento
        4: { cellWidth: 24 },      // Estado
        5: { halign: 'right' },    // Cuota
        6: { halign: 'right' },    // Pagado
        7: { halign: 'right' },    // Pendiente
      },
      margin: { left: M, right: M },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const item = params.items[data.row.index];
        if (!item?.vencido) return;
        if (data.column.index === 4 || data.column.index === 7) {
          data.cell.styles.textColor = RED;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawCell: (data: any) => {
        // Dibujar el ícono en la celda de Logo (columna 0)
        if (data.section === 'body' && data.column.index === 0) {
          const item = params.items[data.row.index];
          if (!item) return;
          const png = iconosPreRenderizados.get(item.servicio);
          if (png && data.cell && data.cell.x != null) {
            try {
              const iconSize = 5; // mm
              const cellX = data.cell.x;
              const cellY = data.cell.y;
              const cellH = data.cell.height;
              doc.addImage(
                png,
                'PNG',
                cellX + 1.5,
                cellY + (cellH - iconSize) / 2,
                iconSize,
                iconSize
              );
            } catch {
              // ignore - skip icon if can't draw
            }
          }
        }
      },
    });
  }

  let y = (doc as any).lastAutoTable?.finalY ?? tableStartY + 12;

  // ---- Tabla 2: Historial de pagos (NUEVO) ---------------------------------
  y += 10;
  if (y > H - 40) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('HISTORIAL DE PAGOS', M, y);

  if (params.pagos.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('Sin pagos registrados.', M, y + 7);
    y += 10;
  } else {
    // Ordenar historial por fecha DESC (más reciente primero)
    const pagosOrd = [...params.pagos].sort((a, b) => b.fecha - a.fecha);

    (doc as any).autoTable({
      startY: y + 3,
      head: [
        isSingle
          ? ['Fecha', 'Período', 'Monto', 'Método', 'Nota']
          : ['Fecha', 'Suscripción', 'Período', 'Monto', 'Método', 'Nota'],
      ],
      body: pagosOrd.map((p) => [
        formatDate(p.fecha),
        isSingle
          ? getPeriodoLabel(p.periodo)
          : safeStr(p.suscripcionNombre),
        getPeriodoLabel(p.periodo),
        formatCurrency(p.monto, params.currency),
        metodoLabel(p.metodo),
        safeStr(p.nota),
      ]),
      headStyles: {
        fillColor: NAVY,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: { fontSize: 9, textColor: DARK },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        3: { halign: 'right', textColor: GREEN, fontStyle: 'bold' },
      },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable?.finalY ?? y + 8;
  }

  // ---- Subtotales por suscripción (solo si cross) --------------------------
  if (!isSingle) {
    const porSusc = new Map<string, { pagado: number; pendiente: number }>();
    for (const it of params.items) {
      const acc = porSusc.get(it.servicio) ?? { pagado: 0, pendiente: 0 };
      acc.pagado += it.pagado;
      acc.pendiente += it.pendiente;
      porSusc.set(it.servicio, acc);
    }
    for (const p of params.pagos) {
      const key = p.suscripcionNombre ?? '—';
      const acc = porSusc.get(key) ?? { pagado: 0, pendiente: 0 };
      acc.pagado += p.monto;
      porSusc.set(key, acc);
    }
    if (porSusc.size > 0) {
      y += 8;
      if (y > H - 30) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text('SUBTOTALES POR SUSCRIPCIÓN', M, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      const subs = Array.from(porSusc.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      );
      for (const [nombre, acc] of subs) {
        if (y > H - 20) {
          doc.addPage();
          y = 20;
        }
        const linea = `• ${nombre}: Pagado ${formatCurrency(acc.pagado, params.currency)}   ·   Pendiente ${formatCurrency(acc.pendiente, params.currency)}`;
        doc.text(linea, M, y);
        y += 5;
      }
    }
  }

  // ---- Totales ---------------------------------------------------------------
  const totW = 84;
  const totX = W - M - totW;
  const totalBlockH = totalPagadoHist > 0 ? 40 : 28;
  if (y + totalBlockH + 20 > H) {
    doc.addPage();
    y = 20;
  }
  let ty = y + 8;

  // Total pagado histórico (verde)
  if (totalPagadoHist > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GREEN);
    doc.text('Total pagado (histórico):', totX, ty);
    doc.text(formatCurrency(totalPagadoHist, params.currency), W - M, ty, {
      align: 'right',
    });
    ty += 6;
  }

  // Total vencido (rojo)
  if (totalVencido > 0.005) {
    doc.setTextColor(...RED);
    doc.text('Total vencido:', totX, ty);
    doc.text(formatCurrency(totalVencido, params.currency), W - M, ty, {
      align: 'right',
    });
    ty += 6;
  }

  // Por vencer (gris)
  doc.setTextColor(...GRAY);
  doc.text('Por vencer:', totX, ty);
  doc.text(formatCurrency(porVencer, params.currency), W - M, ty, {
    align: 'right',
  });
  ty += 4;

  // Caja destacada TOTAL ADEUDADO
  doc.setFillColor(...NAVY);
  doc.roundedRect(totX, ty, totW, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL ADEUDADO', totX + 4, ty + 8);
  doc.text(
    formatCurrency(total, params.currency),
    totX + totW - 4,
    ty + 8,
    { align: 'right' }
  );

  // ---- Nota opcional ----------------------------------------------------------
  let notaY = ty + 18;
  if (params.nota) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    const lines = doc.splitTextToSize(
      `Observaciones: ${params.nota}`,
      W - M * 2
    );
    doc.text(lines, M, notaY);
    notaY += lines.length * 4 + 4;
  }

  // ---- Calcular altura del bloque de cuentas (si hay) --------------------------
  // Lo necesitamos antes para que las firmas no se superpongan con
  // el bloque del pie.
  const cuentas = params.cuentasPago ?? [];
  // 1 línea de título + N líneas de cuentas + ~6mm de padding
  // + ~6mm de margen antes del footer final.
  const bloqueCuentasH = cuentas.length > 0 ? 6 + cuentas.length * 4.5 + 6 : 0;

  // ---- Firmas -------------------------------------------------------------------
  // Si hay cuentas, el bloque del pie va a ocupar espacio abajo: las
  // firmas no pueden pisarlo. H-28 es la "base" original; restamos
  // bloqueCuentasH para empujar las firmas más arriba.
  const firmaY = Math.min(
    Math.max(notaY + 22, y + 55),
    H - 28 - bloqueCuentasH
  );
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.3);
  doc.line(M, firmaY, M + 70, firmaY);
  doc.line(W - M - 70, firmaY, W - M, firmaY);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Firma del emisor', M, firmaY + 5);
  doc.text('Firma del deudor (aclaración)', W - M - 70, firmaY + 5);

  // ---- Datos de pago (bloque encima del footer) -------------------------------
  if (cuentas.length > 0) {
    // El bloque arranca 10mm arriba del borde inferior, menos su altura.
    const bloqueY = H - 10 - bloqueCuentasH;

    // Separador sutil arriba del bloque.
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.2);
    doc.line(M, bloqueY - 2, W - M, bloqueY - 2);

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text('DATOS PARA PAGO', M, bloqueY + 3);

    // Una línea por cuenta: "Banco · Tipo · Número"
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    let cy = bloqueY + 7;
    for (const c of cuentas) {
      const texto = `${c.banco} · ${TIPO_CUENTA_LABEL[c.tipo]} · ${c.numero}`;
      doc.text(texto, M, cy);
      cy += 4.5;
    }
  }

  // ---- Footer (fecha de generación) --------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Documento generado el ${formatDate(
      new Date(),
      "dd/MM/yyyy 'a las' HH:mm"
    )} · Control de Pagos Compartidos`,
    M,
    H - 10
  );

  // ---- Guardar ---------------------------------------------------------------------
  const safeName = params.deudor.nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const periodo = formatDate(params.fecha, 'yyyy-MM');
  const filename = isSingle
    ? `estado-cuenta-${safeName}-${params.suscripcionNombre ?? 'suscripcion'}-${periodo}.pdf`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/(^-|-$)/g, '')
    : `estado-cuenta-${safeName}-${periodo}.pdf`;
  doc.save(filename);
}
