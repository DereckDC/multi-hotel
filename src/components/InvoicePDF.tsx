/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Hotel, Room, User, Reservation } from '../types';
import { X, Printer, Download, Mail, CheckCircle, FileText } from 'lucide-react';
import QRView from './QRView';
import { useState } from 'react';
import { jsPDF } from 'jspdf';

interface InvoicePDFProps {
  reservation: Reservation;
  hotel: Hotel | undefined;
  room: Room | undefined;
  guest: User | undefined;
  onClose: () => void;
}

export default function InvoicePDF({
  reservation,
  hotel,
  room,
  guest,
  onClose
}: InvoicePDFProps) {
  const [downloading, setDownloading] = useState(false);
  const [sentByEmail, setSentByEmail] = useState(false);

  // Auto calculate nights
  const getNights = () => {
    const start = new Date(reservation.fechaEntrada);
    const end = new Date(reservation.fechaSalida);
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) || 1;
  };

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Background / Theme elements
        doc.setFillColor(52, 77, 103); // #344D67 (Primary Theme color)
        doc.rect(0, 0, 210, 38, 'F');

        // Header Text
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('ROOMIA SAAS', 15, 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('SISTEMA PMS MULTI-HOTEL CENTRALIZADO', 15, 25);
        doc.text(`ID TRANSACCION: ${reservation.id}`, 15, 30);

        // Date right corner
        doc.setFontSize(10);
        doc.text(`EMISION: ${new Date(reservation.fechaRegistro).toLocaleDateString('es-ES')}`, 145, 18);
        doc.text(`ESTADO: ${reservation.estado.toUpperCase()}`, 145, 25);

        // Divider
        doc.setDrawColor(226, 232, 240); // #E2E8F0
        doc.setLineWidth(0.5);

        // Section 1: Hotel vs Guest details
        doc.setTextColor(26, 28, 30); // #1A1C1E
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('ESTABLECIMIENTO RECEPTOR', 15, 50);
        doc.text('DATOS DEL CLIENTE HOSPEDADO', 115, 50);

        // Details content
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        
        // Hotel details lines split helper
        const hotelName = hotel?.nombre || 'Hotel Roomia';
        const hotelLocation = hotel?.ubicacion || '';
        const hotelPhone = `Tel: ${hotel?.contacto.telefono || ''}`;
        const hotelEmail = `E-mail: ${hotel?.contacto.email || ''}`;

        doc.setTextColor(26, 28, 30);
        doc.text(hotelName, 15, 56);
        doc.setTextColor(100, 116, 139);
        const splitLocation = doc.splitTextToSize(hotelLocation, 85);
        doc.text(splitLocation, 15, 61);
        const locLines = splitLocation.length;
        const currentLocY = 61 + (locLines * 4.5);
        doc.text(hotelPhone, 15, currentLocY);
        doc.text(hotelEmail, 15, currentLocY + 5);

        const guestName = guest ? `${guest.nombre} ${guest.apellido}` : 'Invitado Particular';
        const guestEmail = `E-mail: ${guest?.email || 'destructordereck@gmail.com'}`;
        const guestPhone = `Tel: ${guest?.telefono || ''}`;
        const guestDoc = guest?.documento ? `Documento: ${guest.documento}` : '';

        doc.setTextColor(26, 28, 30);
        doc.text(guestName, 115, 56);
        doc.setTextColor(100, 116, 139);
        doc.text(guestEmail, 115, 61);
        doc.text(guestPhone, 115, 66);
        if (guestDoc) {
          doc.text(guestDoc, 115, 71);
        }

        // Section 2: Details of stay
        const stayY = 88;
        doc.line(15, stayY - 5, 195, stayY - 5);
        doc.setTextColor(26, 28, 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('DETALLE DEL HOSPEDAJE', 15, stayY);

        // Grid for stay
        doc.setFillColor(248, 250, 252); // #F8FAFC
        doc.rect(15, stayY + 4, 180, 16, 'F');
        doc.setDrawColor(241, 245, 249);
        doc.rect(15, stayY + 4, 180, 16, 'D');

        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Habitacion N.', 20, stayY + 10);
        doc.text('Tipo Habitacion', 60, stayY + 10);
        doc.text('Check-In', 110, stayY + 10);
        doc.text('Check-Out', 150, stayY + 10);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(26, 28, 30);
        doc.text(room?.numero || 'S/N', 20, stayY + 15);
        doc.text(room?.tipo || 'Suite', 60, stayY + 15);
        doc.text(reservation.fechaEntrada, 110, stayY + 15);
        doc.text(reservation.fechaSalida, 150, stayY + 15);

        // Table headers for products
        const tableY = 120;
        doc.line(15, tableY - 5, 195, tableY - 5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text('Detalle / Servicio', 15, tableY);
        doc.text('Precio Unitario', 105, tableY, { align: 'right' });
        doc.text('Noches / Cant.', 140, tableY, { align: 'center' });
        doc.text('Importe', 195, tableY, { align: 'right' });
        doc.line(15, tableY + 2, 195, tableY + 2);

        // Row 1: Nights stay
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(26, 28, 30);
        
        const roomNameStr = room?.nombre || 'Hospedaje Standard';
        doc.setFont('helvetica', 'bold');
        doc.text(roomNameStr, 15, tableY + 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Capacidad max: ${room?.capacidad || 2} personas`, 15, tableY + 12);
        
        doc.setFontSize(9);
        doc.setTextColor(26, 28, 30);
        const roomPrice = room?.precio ?? reservation.subtotal;
        doc.text(`$${roomPrice.toFixed(2)} USD`, 105, tableY + 8, { align: 'right' });
        
        const diffNights = getNights();
        doc.text(`${diffNights} noches`, 140, tableY + 8, { align: 'center' });

        const subtotalHospedaje = roomPrice * diffNights;
        doc.setFont('helvetica', 'bold');
        doc.text(`$${subtotalHospedaje.toFixed(2)} USD`, 195, tableY + 8, { align: 'right' });

        // Services
        let currentSrvY = tableY + 20;
        doc.line(15, currentSrvY - 4, 195, currentSrvY - 4);

        reservation.serviciosAdicionales.forEach((service) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(26, 28, 30);
          doc.text(`Servicio Adicional: ${service}`, 15, currentSrvY);
          doc.text('$15.00 USD', 105, currentSrvY, { align: 'right' });
          doc.text('Global', 140, currentSrvY, { align: 'center' });
          doc.setFont('helvetica', 'bold');
          doc.text('$15.00 USD', 195, currentSrvY, { align: 'right' });
          currentSrvY += 6;
        });

        // Totals
        const totalsY = currentSrvY + 10;
        doc.line(15, totalsY - 5, 195, totalsY - 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Subtotal Neto:', 135, totalsY);
        doc.text('Impuestos (IVA 16%):', 135, totalsY + 5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 148, 136); // Teal #0d9488
        doc.text('Monto Total:', 135, totalsY + 11);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 28, 30);
        doc.setFontSize(9);
        doc.text(`$${reservation.subtotal.toFixed(2)} USD`, 195, totalsY, { align: 'right' });
        doc.text(`$${reservation.impuestos.toFixed(2)} USD`, 195, totalsY + 5, { align: 'right' });
        doc.setFontSize(10.5);
        doc.setTextColor(13, 148, 136);
        doc.text(`$${reservation.total.toFixed(2)} USD`, 195, totalsY + 11, { align: 'right' });

        // QR Code draw info
        doc.setDrawColor(52, 77, 103);
        doc.setLineWidth(0.6);
        doc.rect(15, totalsY, 32, 32, 'D');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(52, 77, 103);
        doc.text('CODIGO QR VALIDO', 31, totalsY + 10, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(120, 120, 120);
        doc.text('Muestre en Recepcion', 31, totalsY + 18, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(reservation.id, 31, totalsY + 25, { align: 'center' });

        // Footer lines
        const footerY = totalsY + 40;
        doc.setDrawColor(241, 245, 249);
        doc.line(15, footerY, 195, footerY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text('Este documento es una pre-factura valida de reserva simulada generada por ROOMIA S.A. No posee validez legal externa.', 15, footerY + 4);

        // Save PDF
        doc.save(`PreFactura_Roomia_${reservation.id}.pdf`);
      } catch (err) {
        console.error("PDF Generate Error", err);
        alert("Ocurrio un error generando el PDF: " + (err as any).message);
      } finally {
        setDownloading(false);
      }
    }, 1200);
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmada': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pendiente': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'ocupada': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'finalizada': return 'bg-neutral-100 text-neutral-700 border-neutral-300';
      default: return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  return (
    <div id="invoice-modal" className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm animate-fade-in print:bg-white print:p-0">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-200 flex flex-col print:shadow-none print:border-none print:max-h-full print:rounded-none">
        
        {/* Header toolbar - hidden in printing */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50 rounded-t-2xl print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-neutral-800">Pre-Factura Automatizada</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-neutral-700 text-sm hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition-colors cursor-pointer disabled:bg-teal-400"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Generando...' : 'Descargar PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 rounded-full transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Viewport */}
        <div className="p-8 md:p-10 flex-1 overflow-y-auto" id="printable-area">
          {/* Top Brand Block */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-neutral-200 pb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-display font-bold text-lg">R</span>
                <span className="font-display font-bold text-xl tracking-tight text-neutral-800">ROOMIA SAAS</span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">SISTEMA PMS MULTI-HOTEL CENTRALIZADO</p>
              <p className="text-xs text-neutral-500 mt-1">ID Transación: {reservation.id}</p>
            </div>
            <div className="text-right md:text-right flex flex-col items-end">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(reservation.estado)} uppercase mb-3`}>
                Reserva {reservation.estado}
              </span>
              <p className="text-xs text-neutral-500">Fecha de Emisión: {new Date(reservation.fechaRegistro).toLocaleDateString('es-ES')}</p>
              <p className="text-xs text-neutral-500 font-mono">2026-05-24T04:44:00Z</p>
            </div>
          </div>

          {/* Hotel & Guest metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-b border-neutral-200">
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Establecimiento Receptor</p>
              <h4 className="font-semibold text-neutral-800 text-base">{hotel?.nombre || 'Hotel Roomia'}</h4>
              <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{hotel?.ubicacion}</p>
              <p className="text-xs text-neutral-500 mt-2">Teléfono: {hotel?.contacto.telefono}</p>
              <p className="text-xs text-neutral-500">E-mail: {hotel?.contacto.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Datos del Cliente Hospedado</p>
              <h4 className="font-semibold text-neutral-800 text-base">{guest ? `${guest.nombre} ${guest.apellido}` : 'Invitado Particular'}</h4>
              <p className="text-sm text-neutral-600 mt-1">E-mail: {guest?.email || 'destructordereck@gmail.com'}</p>
              <p className="text-sm text-neutral-600">Teléfono: {guest?.telefono || '+54 11 9876 5432'}</p>
              {guest?.documento && (
                <p className="text-xs text-neutral-500 font-mono mt-1">Documento / Pasaporte: {guest.documento}</p>
              )}
            </div>
          </div>

          {/* Stay Specifics details banner */}
          <div className="py-6 border-b border-neutral-200">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Detalle del Hospedaje</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
              <div>
                <span className="text-xs text-neutral-500 block">Habitación N°</span>
                <span className="font-semibold text-neutral-800 font-mono text-sm">{room?.numero || 'S/N'}</span>
              </div>
              <div>
                <span className="text-xs text-neutral-500 block">Tipo Habitación</span>
                <span className="font-medium text-neutral-800 text-sm">{room?.tipo || 'Suite'}</span>
              </div>
              <div>
                <span className="text-xs text-neutral-500 block">Check-In</span>
                <span className="font-medium text-neutral-800 text-sm whitespace-nowrap">{reservation.fechaEntrada}</span>
              </div>
              <div>
                <span className="text-xs text-neutral-500 block">Check-Out</span>
                <span className="font-medium text-neutral-800 text-sm whitespace-nowrap">{reservation.fechaSalida}</span>
              </div>
            </div>
          </div>

          {/* Cost breakdown table */}
          <div className="py-6">
            <table className="w-full text-left text-sm text-neutral-600">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-400 text-xs font-semibold uppercase">
                  <th className="py-2">Descripción del Servicio / Detalle</th>
                  <th className="py-2 text-right">Precio Unitario</th>
                  <th className="py-2 text-center">Unidad / Noches</th>
                  <th className="py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                <tr>
                  <td className="py-3">
                    <span className="font-medium text-neutral-800 block">{room?.nombre || 'Hospedaje Standard'}</span>
                    <span className="text-xs text-neutral-400">Capacidad máxima: {room?.capacidad} personas ({room?.camas} camas)</span>
                  </td>
                  <td className="py-3 text-right font-mono">${room?.precio || reservation.subtotal} USD</td>
                  <td className="py-3 text-center">{getNights()} {getNights() > 1 ? 'noches' : 'noche'}</td>
                  <td className="py-3 text-right font-semibold text-neutral-800 font-mono">${(room?.precio || 0) * getNights()} USD</td>
                </tr>
                {reservation.serviciosAdicionales.map((service, idx) => (
                  <tr key={idx}>
                    <td className="py-3 text-neutral-700">
                      <span>Adicional: {service}</span>
                    </td>
                    <td className="py-3 text-right font-mono">$15.00 USD</td>
                    <td className="py-3 text-center">Global</td>
                    <td className="py-3 text-right font-semibold text-neutral-800 font-mono">$15.00 USD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & QR Grid */}
          <div className="border-t border-neutral-200 pt-6 flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
            <div className="flex flex-col items-center md:items-start">
              <QRView value={reservation.qrCode} size={110} />
              <p className="text-[10px] text-neutral-400 mt-2 text-center md:text-left leading-relaxed">
                Escanee este código QR en el mostrador del hotel para procesar su Check-In instantáneo.
              </p>
            </div>

            <div className="w-full md:w-64">
              <div className="space-y-2 text-sm text-neutral-600">
                <div className="flex justify-between">
                  <span>Subtotal Neto:</span>
                  <span className="font-mono font-medium text-neutral-800">${reservation.subtotal.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between">
                  <span>Impuestos (IVA 16%):</span>
                  <span className="font-mono text-neutral-800">${reservation.impuestos.toFixed(2)} USD</span>
                </div>
                <div className="h-[1px] bg-neutral-200 my-2" />
                <div className="flex justify-between text-base font-bold text-teal-700">
                  <span>Monto Total:</span>
                  <span className="font-mono">${reservation.total.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Status footer inside invoice */}
              <div className="mt-4 p-3 bg-neutral-50 rounded-lg text-center border border-neutral-100 text-xs text-neutral-500">
                Tipo Pago: <span className="font-semibold">Simulado Integral</span>
              </div>
            </div>
          </div>

          {/* Policies & legal terms */}
          <div className="mt-10 pt-6 border-t border-neutral-100 text-[10px] text-neutral-400 leading-relaxed">
            <p className="font-semibold mb-1">Políticas importantes del hotel:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Check-in formal requerido presentando Identificación Oficial (Cédula de identidad o pasaporte).</li>
              <li>Las cancelaciones deben procesarse con un mínimo de 24 horas antes del ingreso para evitar cargos de No-Show.</li>
              <li>Toda anomalía o daño físico en la estructura será cargado directamente al expediente de facturación finalizado.</li>
            </ul>
          </div>
        </div>

        {/* Mail send notification - hidden in print */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between rounded-b-2xl print:hidden">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Mail className="w-4 h-4 text-neutral-400" />
            <span>¿Enviar esta pre-factura a destructordereck@gmail.com?</span>
          </div>
          <button
            onClick={() => {
              setSentByEmail(true);
              setTimeout(() => setSentByEmail(false), 3000);
            }}
            disabled={sentByEmail}
            className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 border border-neutral-200 rounded text-xs transition-colors cursor-pointer font-medium disabled:bg-emerald-50 disabled:text-emerald-700"
          >
            {sentByEmail ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Enviado al correo</span>
              </>
            ) : (
              <span>Enviar por e-mail</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
