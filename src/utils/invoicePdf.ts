/**
 * Dos formatos de la prefactura a partir de los mismos datos (`buildInvoiceData`):
 *  · A4 de una sola hoja  -> botón "Descargar PDF"
 *  · Ticket térmico de 80 o 58 mm -> botón "Imprimir"
 */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import RoomiaLogo from '../RoomiaPMSLogoSinFondo.png';
import { InvoiceData, money } from './invoiceData';

export type TicketWidth = 80 | 58;

const qrDataUrl = (value: string, width: number) =>
  QRCode.toDataURL(value, { margin: 1, width, color: { dark: '#000000', light: '#FFFFFF' } });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('logo'));
    img.src = src;
  });

/** Recorta el texto con "..." para que quepa en el ancho dado */
function fit(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '...') > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '...';
}

// ---------------------------------------------------------------------------
// A4 · una sola hoja
// ---------------------------------------------------------------------------
export async function buildInvoiceA4(data: InvoiceData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  // Fuentes integradas del PDF: no dependen de internet (las de Google que se cargaban antes ya no existen)
  const SANS = 'helvetica';
  const SERIF = 'times';

  const L = 15;
  const R = 195;
  const W = R - L;
  const NAVY: [number, number, number] = [7, 23, 38];
  const INK: [number, number, number] = [26, 28, 30];
  const GRAY: [number, number, number] = [100, 116, 139];
  const TEAL: [number, number, number] = [13, 148, 136];

  // Cabecera
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 30, 'F');
  try {
    doc.addImage(await loadImage(RoomiaLogo), 'PNG', L, 8, 13, 13);
  } catch {
    doc.setFillColor(35, 180, 230);
    doc.circle(L + 6.5, 14.5, 6, 'F');
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont(SERIF, 'bold');
  doc.setFontSize(19);
  doc.text('ROOMIA', L + 17, 15.5);
  doc.setFont(SANS, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(35, 180, 230);
  doc.text('PROPERTY MANAGEMENT SYSTEM', L + 17, 20.5);

  doc.setTextColor(255, 255, 255);
  doc.setFont(SANS, 'bold');
  doc.setFontSize(13);
  doc.text('PRE-FACTURA', R, 12.5, { align: 'right' });
  doc.setFontSize(8.5);
  doc.text(`N° ${data.id}`, R, 18, { align: 'right' });
  doc.setFont(SANS, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(190, 200, 210);
  doc.text(`Emisión: ${data.fechaEmision}   ·   Estado: ${data.estado}`, R, 23, { align: 'right' });

  // Emisor y cliente
  const colW = 86;
  const block = (title: string, x: number, name: string, lines: string[]) => {
    let y = 39;
    doc.setFont(SANS, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(title, x, y);
    y += 5;
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(fit(doc, name, colW), x, y);
    y += 4.6;
    doc.setFont(SANS, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    lines.filter(Boolean).forEach(line => {
      const parts: string[] = doc.splitTextToSize(line, colW).slice(0, 2);
      parts.forEach(p => {
        doc.text(p, x, y);
        y += 4;
      });
    });
    return y;
  };
  const yA = block('ESTABLECIMIENTO', L, data.emisor.nombre, [
    data.emisor.direccion,
    data.emisor.telefono ? `Tel: ${data.emisor.telefono}` : '',
    data.emisor.email
  ]);
  const yB = block('CLIENTE', 110, data.cliente.nombre, [
    data.cliente.documento ? `Cédula / Pasaporte: ${data.cliente.documento}` : '',
    data.cliente.telefono ? `Tel: ${data.cliente.telefono}` : '',
    data.cliente.email
  ]);

  // Estadía
  let y = Math.max(yA, yB) + 3;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(L, y, W, 14, 1.5, 1.5, 'FD');
  const cells: [string, string, number][] = [
    [data.isAlquiler ? 'INMUEBLE' : 'HABITACIÓN', data.estadia.unidad, L + 4],
    ['TIPO', data.estadia.tipo || '-', L + 66],
    [data.isAlquiler ? 'INICIO' : 'CHECK-IN', data.estadia.entrada, L + 96],
    [data.isAlquiler ? 'FIN' : 'CHECK-OUT', data.estadia.salida, L + 124],
    [data.isAlquiler ? 'PLAZO' : 'DURACIÓN', data.estadia.duracion, L + 152]
  ];
  cells.forEach(([label, value, x], i) => {
    const maxW = (i < cells.length - 1 ? cells[i + 1][2] : R - 2) - x - 2;
    doc.setFont(SANS, 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(label, x, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(fit(doc, value, maxW), x, y + 10.3);
  });
  y += 22;

  // Tabla de conceptos
  const C_QTY = 118;
  const C_UNIT = 158;
  doc.setFont(SANS, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text('CONCEPTO', L, y);
  doc.text('CANTIDAD', C_QTY, y, { align: 'center' });
  doc.text('P. UNITARIO', C_UNIT, y, { align: 'right' });
  doc.text('IMPORTE', R, y, { align: 'right' });
  y += 2.5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(L, y, R, y);

  // Reserva de espacio: totales (48 mm) + políticas y pie (34 mm)
  const tableBottom = 297 - 34 - 48;
  const n = data.lineas.length;
  const rowH = Math.max(4.6, Math.min(9.5, (tableBottom - y) / Math.max(1, n)));
  const withDetail = rowH >= 7.5;
  doc.setLineWidth(0.15);
  doc.setDrawColor(226, 232, 240);
  data.lineas.forEach(line => {
    if (y + rowH > 282) {
      doc.addPage();
      y = 18;
    }
    const base = y + (withDetail ? 4.4 : rowH / 2 + 1.1);
    doc.setFont(SANS, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(fit(doc, line.descripcion, 88), L, base);
    if (withDetail && line.detalle) {
      doc.setFont(SANS, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.text(fit(doc, line.detalle, 88), L, base + 3.6);
    }
    doc.setFont(SANS, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(line.cantidad, C_QTY, base, { align: 'center' });
    doc.text(line.unitario !== null ? money(line.unitario) : '-', C_UNIT, base, { align: 'right' });
    doc.setFont(SANS, 'bold');
    doc.text(money(line.importe), R, base, { align: 'right' });
    y += rowH;
    doc.line(L, y, R, y);
  });

  // Totales + QR
  if (y + 48 > 263) {
    doc.addPage();
    y = 18;
  }
  y += 6;
  const qr = await qrDataUrl(data.qr, 300);
  doc.addImage(qr, 'PNG', L, y - 2, 30, 30);
  doc.setFont(SANS, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(doc.splitTextToSize('Presente este código QR en recepción para su check-in.', 48), L + 33, y + 4);

  const TX = 128;
  let ty = y + 2;
  const totalRow = (label: string, value: string, opts: { bold?: boolean; color?: [number, number, number]; size?: number } = {}) => {
    doc.setFont(SANS, opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size || 9);
    doc.setTextColor(...(opts.color || GRAY));
    doc.text(label, TX, ty);
    doc.setFont(SANS, 'bold');
    doc.setTextColor(...(opts.color || INK));
    doc.text(value, R, ty, { align: 'right' });
    ty += (opts.size || 9) > 10 ? 7 : 5.2;
  };
  totalRow('Subtotal', `${money(data.subtotal)} USD`);
  totalRow(data.ivaLabel, `${money(data.impuestos)} USD`);
  doc.setDrawColor(203, 213, 225);
  doc.line(TX, ty - 2.6, R, ty - 2.6);
  ty += 2.2;
  totalRow('TOTAL', `${money(data.total)} USD`, { bold: true, color: TEAL, size: 12 });
  if (data.abonado !== null) totalRow('Abonado', `-${money(data.abonado)} USD`, { color: [5, 150, 105] });
  if (data.pendiente !== null) totalRow('Saldo pendiente', `${money(data.pendiente)} USD`, { bold: true, color: [220, 38, 38] });

  // Estado de pago
  const tone: Record<string, [number, number, number]> = { ok: [5, 150, 105], warn: [180, 83, 9], bad: [220, 38, 38] };
  const py = Math.max(ty + 1, y + 31);
  doc.setDrawColor(...tone[data.pago.tono]);
  doc.setLineWidth(0.3);
  doc.roundedRect(TX, py, R - TX, 11.5, 1.5, 1.5, 'D');
  doc.setFont(SANS, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...tone[data.pago.tono]);
  doc.text(data.pago.titulo, (TX + R) / 2, py + 4.6, { align: 'center' });
  doc.setFont(SANS, 'normal');
  doc.setFontSize(6.5);
  doc.text(fit(doc, data.pago.detalle, R - TX - 4), (TX + R) / 2, py + 8.6, { align: 'center' });

  // Políticas y pie, anclados al final de la hoja
  let fy = 297 - 30;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(L, fy, R, fy);
  fy += 4.5;
  doc.setFont(SANS, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...INK);
  doc.text('Condiciones', L, fy);
  doc.setFont(SANS, 'normal');
  doc.setTextColor(...GRAY);
  data.politicas.forEach(p => {
    fy += 3.6;
    doc.text(fit(doc, `·  ${p}`, W), L, fy);
  });
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text('Pre-factura informativa de la reserva generada por Roomia PMS. No es un comprobante tributario autorizado por el SRI.', L, 297 - 9);

  return doc;
}

// ---------------------------------------------------------------------------
// Ticket térmico · 80 o 58 mm, alto según el contenido
// ---------------------------------------------------------------------------
function drawTicket(doc: jsPDF, data: InvoiceData, widthMm: TicketWidth, qr: string): number {
  const M = widthMm === 80 ? 4 : 3;
  const L = M;
  const R = widthMm - M;
  const CW = R - L;
  const CX = widthMm / 2;
  const S = widthMm === 80 ? 1 : 0.88; // escala de letra
  const lh = (size: number) => size * 0.3528 * 1.22;
  let y = M + 2;

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  const text = (t: string, size: number, opts: { bold?: boolean; align?: 'left' | 'center' | 'right'; maxLines?: number } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size * S);
    let lines: string[] = doc.splitTextToSize(t, CW);
    if (opts.maxLines) lines = lines.slice(0, opts.maxLines);
    const x = opts.align === 'center' ? CX : opts.align === 'right' ? R : L;
    lines.forEach(line => {
      y += lh(size * S);
      doc.text(line, x, y, { align: opts.align || 'left' });
    });
  };
  const pair = (left: string, right: string, size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size * S);
    y += lh(size * S);
    const rw = doc.getTextWidth(right);
    doc.text(fit(doc, left, CW - rw - 2), L, y);
    doc.text(right, R, y, { align: 'right' });
  };
  const rule = () => {
    y += 2.2;
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([0.7, 0.7], 0);
    doc.line(L, y, R, y);
    doc.setLineDashPattern([], 0);
    y += 0.8;
  };

  // Encabezado
  text('ROOMIA PMS', 11, { bold: true, align: 'center' });
  text('PRE-FACTURA', 8, { align: 'center' });
  y += 1.5;
  text(data.emisor.nombre, 10, { bold: true, align: 'center', maxLines: 2 });
  if (data.emisor.direccion) text(data.emisor.direccion, 7, { align: 'center', maxLines: 3 });
  if (data.emisor.telefono) text(`Tel: ${data.emisor.telefono}`, 7, { align: 'center' });
  if (data.emisor.email) text(data.emisor.email, 7, { align: 'center' });
  rule();

  pair(`N° ${data.id}`, data.fechaEmision, 8, true);
  text(`Estado: ${data.estado}`, 7.5);
  rule();

  // Cliente
  text('CLIENTE', 7, { bold: true });
  text(data.cliente.nombre, 8.5, { bold: true, maxLines: 2 });
  if (data.cliente.documento) text(`Cédula/Pasaporte: ${data.cliente.documento}`, 7.5);
  if (data.cliente.telefono) text(`Tel: ${data.cliente.telefono}`, 7.5);
  if (data.cliente.email) text(data.cliente.email, 7.5);
  rule();

  // Estadía
  text(data.isAlquiler ? 'ALQUILER' : 'ESTADÍA', 7, { bold: true });
  text(`${data.estadia.unidad}${data.estadia.tipo ? ' (' + data.estadia.tipo + ')' : ''}`, 8, { bold: true, maxLines: 2 });
  pair(data.isAlquiler ? 'Inicio' : 'Check-in', data.estadia.entrada, 8);
  pair(data.isAlquiler ? 'Fin' : 'Check-out', data.estadia.salida, 8);
  pair(data.isAlquiler ? 'Plazo' : 'Duración', data.estadia.duracion, 8);
  rule();

  // Conceptos
  pair('CONCEPTO', 'IMPORTE', 7, true);
  y += 0.6;
  data.lineas.forEach(line => {
    text(line.descripcion, 8, { bold: true, maxLines: 2 });
    const sub = line.unitario !== null ? `${line.cantidad} x ${money(line.unitario)}` : (line.detalle || line.cantidad);
    pair(`  ${sub}`, money(line.importe), 8);
    y += 0.8;
  });
  rule();

  // Totales
  pair('Subtotal', money(data.subtotal), 8);
  pair(data.ivaLabel, money(data.impuestos), 8);
  y += 0.8;
  pair('TOTAL USD', money(data.total), 12, true);
  if (data.abonado !== null) pair('Abonado', `-${money(data.abonado)}`, 8);
  if (data.pendiente !== null) pair('SALDO PENDIENTE', money(data.pendiente), 8.5, true);
  rule();

  // Estado de pago
  y += 0.6;
  text(data.pago.titulo, 8.5, { bold: true, align: 'center', maxLines: 2 });
  text(data.pago.detalle, 7, { align: 'center', maxLines: 3 });

  // QR
  y += 3;
  const q = widthMm === 80 ? 30 : 26;
  doc.addImage(qr, 'PNG', CX - q / 2, y, q, q);
  y += q + 0.5;
  text('Presente este código en recepción', 7, { align: 'center' });
  rule();
  text('Documento informativo. No es un comprobante tributario autorizado por el SRI.', 6.5, { align: 'center', maxLines: 3 });
  text('www.roomiapms.site', 7, { bold: true, align: 'center' });

  return y + M + 4; // margen final para el corte del papel
}

export async function buildInvoiceTicket(
  data: InvoiceData,
  widthMm: TicketWidth
): Promise<{ doc: jsPDF; widthMm: number; heightMm: number }> {
  const qr = await qrDataUrl(data.qr, 320);
  // 1ª pasada: medir el alto en una hoja larga
  const probe = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [widthMm, 1200] });
  const heightMm = Math.max(widthMm + 10, Math.ceil(drawTicket(probe, data, widthMm, qr)));
  // 2ª pasada: hoja del tamaño exacto
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [widthMm, heightMm], compress: true });
  drawTicket(doc, data, widthMm, qr);
  return { doc, widthMm, heightMm };
}

/**
 * Abre el diálogo de impresión del navegador con el PDF (iframe oculto).
 * En navegadores de móvil, que no muestran PDF dentro de un iframe, lo abre en una pestaña.
 */
export function printPdfInBrowser(doc: jsPDF): void {
  const url = URL.createObjectURL(doc.output('blob'));
  const release = () => setTimeout(() => URL.revokeObjectURL(url), 120000);
  const openTab = () => {
    const win = window.open(url, '_blank');
    if (!win) window.location.href = url;
    release();
  };

  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    openTab();
    return;
  }

  document.getElementById('roomia-print-frame')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'roomia-print-frame';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  frame.onload = () => {
    setTimeout(() => {
      try {
        frame.contentWindow!.focus();
        frame.contentWindow!.print();
        release();
      } catch {
        openTab();
      }
    }, 400);
  };
  frame.src = url;
  document.body.appendChild(frame);
}
