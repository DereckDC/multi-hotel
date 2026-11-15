/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Hotel, Room, User, Reservation } from '../types';
import { X, Printer, Download, FileText } from 'lucide-react';
import QRView from './QRView';
import { useMemo, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { isNativeApp } from '../utils/platform';
import { savePdfNative, printPdfNative } from '../utils/nativeFiles';
import { buildInvoiceData, money } from '../utils/invoiceData';
import { buildInvoiceA4, buildInvoiceTicket, printPdfInBrowser, TicketWidth } from '../utils/invoicePdf';

interface InvoicePDFProps {
  reservation: Reservation;
  hotel: Hotel | undefined;
  room: Room | undefined;
  guest: User | undefined;
  onClose: () => void;
}

const TICKET_WIDTH_KEY = 'roomia_ticket_width';

const readTicketWidth = (): TicketWidth => {
  try {
    return localStorage.getItem(TICKET_WIDTH_KEY) === '58' ? 58 : 80;
  } catch {
    return 80;
  }
};

/**
 * Prefactura de una reserva.
 *  · Descargar PDF: hoja A4 (en el navegador se descarga; en la app Android se guarda y se abre "compartir").
 *  · Imprimir: ticket para impresora térmica de 80 o 58 mm.
 */
export default function InvoicePDF({ reservation, hotel, room, guest, onClose }: InvoicePDFProps) {
  const [busy, setBusy] = useState<null | 'download' | 'print'>(null);
  const [ticketWidth, setTicketWidth] = useState<TicketWidth>(readTicketWidth);

  const data = useMemo(() => buildInvoiceData(reservation, hotel, room, guest), [reservation, hotel, room, guest]);

  const changeTicketWidth = (w: TicketWidth) => {
    setTicketWidth(w);
    try {
      localStorage.setItem(TICKET_WIDTH_KEY, String(w));
    } catch {
      // Sin almacenamiento: solo se recuerda mientras el modal esté abierto
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy('download');
    try {
      const doc = await buildInvoiceA4(data);
      const fileName = `PreFactura_Roomia_${reservation.id}.pdf`;
      if (isNativeApp()) {
        // App Android: el WebView no descarga archivos; se guarda y se abre la hoja de compartir
        const inDocs = await savePdfNative(doc.output('datauristring'), fileName, `Pre-Factura Roomia #${reservation.id}`);
        if (inDocs) alert('PDF guardado en Documentos/Roomia.');
      } else {
        doc.save(fileName);
      }
    } catch (err) {
      console.error('PDF Generate Error', err);
      alert('Ocurrió un error generando el PDF: ' + ((err as any)?.message || 'intente de nuevo'));
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async () => {
    if (busy) return;
    setBusy('print');
    try {
      const { doc, widthMm, heightMm } = await buildInvoiceTicket(data, ticketWidth);
      if (isNativeApp()) {
        await printPdfNative(doc.output('datauristring'), `Ticket_Roomia_${reservation.id}`, { widthMm, heightMm });
      } else {
        printPdfInBrowser(doc);
      }
    } catch (err) {
      console.error('Ticket Print Error', err);
      alert('No se pudo preparar la impresión: ' + ((err as any)?.message || 'intente de nuevo'));
    } finally {
      setBusy(null);
    }
  };

  const statusColor = (() => {
    switch (reservation.estado) {
      case 'confirmada': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pendiente': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'ocupada': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'finalizada': return 'bg-neutral-100 text-neutral-700 border-neutral-300';
      default: return 'bg-red-50 text-red-700 border-red-200';
    }
  })();

  const pagoColor = data.pago.tono === 'ok'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : data.pago.tono === 'bad'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-amber-50 border-amber-200 text-amber-800';

  return (
    <div id="invoice-modal" className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center p-2 sm:p-4 z-[100] backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[94vh] sm:max-h-[88vh] border border-neutral-200 flex flex-col">

        {/* Barra de acciones */}
        <div className="px-3 py-2.5 sm:px-4 border-b border-neutral-100 flex items-center justify-between gap-2 bg-neutral-50 rounded-t-2xl">
          <div className="flex items-center gap-1.5 min-w-0">
            <FileText className="w-4 h-4 text-teal-600 shrink-0" />
            <h3 className="font-semibold text-neutral-800 text-xs sm:text-sm truncate">Pre-Factura</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-stretch rounded-lg border border-neutral-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!!busy}
                title="Imprimir ticket en impresora de facturas"
                className="flex items-center gap-1 px-2 py-1.5 text-neutral-700 text-xs font-semibold hover:bg-neutral-100 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{busy === 'print' ? 'Preparando...' : 'Imprimir'}</span>
              </button>
              <select
                aria-label="Ancho del papel del ticket"
                title="Ancho del papel de la impresora"
                value={ticketWidth}
                onChange={(e) => changeTicketWidth(e.target.value === '58' ? 58 : 80)}
                className="text-[11px] font-semibold text-neutral-600 bg-neutral-50 border-l border-neutral-200 px-1 focus:outline-none cursor-pointer"
              >
                <option value={80}>80 mm</option>
                <option value={58}>58 mm</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!!busy}
              title="Descargar la prefactura en PDF (hoja A4)"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:bg-teal-400"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{busy === 'download' ? 'Generando...' : 'Descargar PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar prefactura"
              className="p-1.5 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Vista previa */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 text-neutral-900">
          {/* Marca y número */}
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <BrandLogo showText={true} lightText={false} size="md" />
              <p className="text-[11px] text-neutral-500 font-mono mt-1.5">N° {data.id}</p>
            </div>
            <div className="text-right shrink-0">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${statusColor}`}>
                {data.estado}
              </span>
              <p className="text-[11px] text-neutral-500 mt-1.5">Emisión: {data.fechaEmision}</p>
            </div>
          </div>

          {/* Establecimiento y cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-y border-neutral-200 py-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Establecimiento</p>
              <p className="font-bold text-sm text-neutral-950 truncate">{data.emisor.nombre}</p>
              {data.emisor.direccion && <p className="text-[11px] text-neutral-600 leading-snug">{data.emisor.direccion}</p>}
              {data.emisor.telefono && <p className="text-[11px] text-neutral-600">Tel: {data.emisor.telefono}</p>}
              {data.emisor.email && <p className="text-[11px] text-neutral-600 truncate">{data.emisor.email}</p>}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Cliente</p>
              <p className="font-bold text-sm text-neutral-950 truncate">{data.cliente.nombre}</p>
              {data.cliente.documento && <p className="text-[11px] text-neutral-600 font-mono">Cédula / Pasaporte: {data.cliente.documento}</p>}
              {data.cliente.telefono && <p className="text-[11px] text-neutral-600">Tel: {data.cliente.telefono}</p>}
              {data.cliente.email && <p className="text-[11px] text-neutral-600 truncate">{data.cliente.email}</p>}
            </div>
          </div>

          {/* Estadía */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
            <div className="col-span-2 sm:col-span-1 min-w-0">
              <span className="text-[9px] text-neutral-400 font-bold uppercase block">{data.isAlquiler ? 'Inmueble' : 'Habitación'}</span>
              <span className="font-bold text-neutral-950 text-xs block truncate">{data.estadia.unidad}</span>
              {data.estadia.tipo && <span className="text-[10px] text-neutral-500">{data.estadia.tipo}</span>}
            </div>
            <div>
              <span className="text-[9px] text-neutral-400 font-bold uppercase block">{data.isAlquiler ? 'Inicio' : 'Check-in'}</span>
              <span className="font-bold text-neutral-950 text-xs font-mono">{data.estadia.entrada}</span>
            </div>
            <div>
              <span className="text-[9px] text-neutral-400 font-bold uppercase block">{data.isAlquiler ? 'Fin' : 'Check-out'}</span>
              <span className="font-bold text-neutral-950 text-xs font-mono">{data.estadia.salida}</span>
            </div>
            <div>
              <span className="text-[9px] text-neutral-400 font-bold uppercase block">{data.isAlquiler ? 'Plazo' : 'Duración'}</span>
              <span className="font-bold text-neutral-950 text-xs">{data.estadia.duracion}</span>
            </div>
          </div>

          {/* Conceptos */}
          <div>
            <div className="flex justify-between text-[9px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-200 pb-1">
              <span>Concepto</span>
              <span>Importe</span>
            </div>
            <ul className="divide-y divide-neutral-100">
              {data.lineas.map((line, idx) => (
                <li key={idx} className="py-2 flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-neutral-950">{line.descripcion}</p>
                    <p className="text-[10.5px] text-neutral-500">
                      {line.unitario !== null ? `${line.cantidad} × ${money(line.unitario)}` : (line.detalle || line.cantidad)}
                      {line.unitario !== null && line.detalle ? ` · ${line.detalle}` : ''}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-xs text-neutral-950 shrink-0">{money(line.importe)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Totales y QR */}
          <div className="border-t border-neutral-200 pt-3 flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
            <div className="flex flex-col items-center shrink-0">
              <QRView value={data.qr} size={96} />
              <p className="text-[9.5px] text-neutral-500 mt-1.5 text-center max-w-[150px] leading-snug">
                Presente este código QR en recepción para su check-in.
              </p>
            </div>

            <div className="w-full sm:w-60 space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span className="font-mono font-semibold text-neutral-950">{money(data.subtotal)} USD</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>{data.ivaLabel}</span>
                <span className="font-mono font-semibold text-neutral-950">{money(data.impuestos)} USD</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-teal-700 border-t border-neutral-200 pt-1.5">
                <span>Total</span>
                <span className="font-mono">{money(data.total)} USD</span>
              </div>
              {data.abonado !== null && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Abonado</span>
                  <span className="font-mono">-{money(data.abonado)} USD</span>
                </div>
              )}
              {data.pendiente !== null && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Saldo pendiente</span>
                  <span className="font-mono">{money(data.pendiente)} USD</span>
                </div>
              )}
              <div className={`mt-2 p-2.5 rounded-xl text-center border ${pagoColor}`}>
                <p className="font-bold text-[11px]">{data.pago.titulo}</p>
                <p className="text-[10px] mt-0.5 opacity-90">{data.pago.detalle}</p>
              </div>
            </div>
          </div>

          {/* Condiciones */}
          <div className="border-t border-neutral-200 pt-3 text-[10px] text-neutral-500 leading-relaxed">
            <p className="font-bold text-neutral-700 mb-0.5">Condiciones</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {data.politicas.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <p className="mt-2 text-neutral-400">
              Pre-factura informativa de la reserva. No es un comprobante tributario autorizado por el SRI.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
