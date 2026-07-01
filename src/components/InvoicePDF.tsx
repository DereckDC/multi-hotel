/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Hotel, Room, User, Reservation } from '../types';
import { X, Printer, Download, Mail, CheckCircle, FileText } from 'lucide-react';
import QRView from './QRView';
import { useState } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { BrandLogo } from './BrandLogo';
import RoomiaLogo from '../RoomiaPMSLogoSinFondo.png';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

async function loadAndAddFont(doc: jsPDF, url: string, fontName: string, fontStyle: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const filename = `${fontName}-${fontStyle}.ttf`;
    doc.addFileToVFS(filename, base64);
    doc.addFont(filename, fontName, fontStyle);
    return true;
  } catch (err) {
    console.warn(`Could not load custom font ${fontName} (${fontStyle}) from ${url}. Using standard fallback.`, err);
    return false;
  }
}

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

  const isPropiedad = hotel && (hotel.tipoEstablecimiento === 'casa' || hotel.tipoEstablecimiento === 'departamento');
  const isAlquiler = isPropiedad && hotel?.finalidad === 'alquiler';

  // Auto calculate nights
  const getNights = () => {
    const start = new Date(reservation.fechaEntrada);
    const end = new Date(reservation.fechaSalida);
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) || 1;
  };

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(async () => {
      try {
        const qrDataUrl = await QRCode.toDataURL(reservation.qrCode || reservation.id, {
          margin: 1,
          width: 180,
          color: {
            dark: '#111827',
            light: '#FFFFFF'
          }
        });

        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // ----------------- ESTABLISHED BRAND TYPOGRAPHY LOAD -----------------
        const fontsLoaded = { montserrat: false, playfair: false };
        try {
          const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
          
          const loadFontsPromise = (async () => {
            // Montserrat is the primary sans-serif font
            await loadAndAddFont(doc, 'https://fonts.gstatic.com/s/montserrat/v25/JTUHjIg1_i6t8kCHKm4MV96gxpxq.ttf', 'Montserrat', 'normal');
            await loadAndAddFont(doc, 'https://fonts.gstatic.com/s/montserrat/v25/JTURjIg1_i6t8kCHKm4MV_d7zpxq.ttf', 'Montserrat', 'bold');
            // Playfair Display is the elegant display/serif font
            await loadAndAddFont(doc, 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZ27E9X6Sk8Vf112gE-NyHYB3Y42.ttf', 'PlayfairDisplay', 'normal');
            await loadAndAddFont(doc, 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFlD-vYSZ27E9X6Sk8Vf112gE-NyG3FcbY.ttf', 'PlayfairDisplay', 'bold');
          })();

          await Promise.race([loadFontsPromise, timeout(3000)]);
          fontsLoaded.montserrat = true;
          fontsLoaded.playfair = true;
        } catch (e) {
          console.warn("Could not load premium Google Fonts within timeout, falling back gracefully.", e);
        }

        const getSansFont = () => fontsLoaded.montserrat ? 'Montserrat' : 'helvetica';
        const getSerifFont = () => fontsLoaded.playfair ? 'PlayfairDisplay' : 'times';

        // Decorate doc.setFont to map 'helvetica' to 'Montserrat' and 'times' to 'PlayfairDisplay' automatically
        const originalSetFont = doc.setFont;
        doc.setFont = function(fontName: string, fontStyle?: string) {
          let targetFont = fontName;
          if (fontName === 'helvetica' || fontName === 'Helvetica') {
            targetFont = getSansFont();
          } else if (fontName === 'times' || fontName === 'Times') {
            targetFont = getSerifFont();
          }
          return originalSetFont.call(this, targetFont, fontStyle);
        } as any;

        // Apply default font
        doc.setFont('helvetica', 'normal');

        // ----------------- BRANDED HEADER BLOCK WITH LOGO -----------------
        // Background / Theme elements
        doc.setFillColor(7, 23, 38); // Official Roomia PMS Deep Dark Blue #071726
        doc.rect(0, 0, 210, 38, 'F');

        // Logo Image
        try {
          const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.src = RoomiaLogo;
            img.onload = () => resolve(img);
            img.onerror = () => reject();
          });
          doc.addImage(logoImg, 'PNG', 15, 8, 12, 12);
        } catch (e) {
          // Circular brand-compliant vector fallback badge in case image fails to load
          doc.setFillColor(35, 180, 230); // brand-cyan #23B4E6
          doc.circle(21, 14, 6, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('times', 'bold'); // Mapped to PlayfairDisplay Bold
          doc.setFontSize(10);
          doc.text('R', 19.5, 17.5);
        }

        // Header Text next to logo
        doc.setTextColor(255, 255, 255);
        doc.setFont('times', 'bold'); // Mapped to PlayfairDisplay
        doc.setFontSize(21);
        doc.text('ROOMIA', 31, 16);
        
        doc.setFont('helvetica', 'bold'); // Mapped to Montserrat Bold
        doc.setFontSize(8);
        doc.setTextColor(35, 180, 230); // brand cyan
        doc.text('PROPERTY MANAGEMENT SYSTEM', 31, 21.5);

        doc.setFont('helvetica', 'normal'); // Mapped to Montserrat Regular
        doc.setFontSize(7.5);
        doc.setTextColor(168, 178, 189); // brand grey
        doc.text(`ID TRANSACCIÓN: ${reservation.id}`, 31, 26.5);

        // Date right corner
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`EMISIÓN: ${new Date(reservation.fechaRegistro).toLocaleDateString('es-ES')}`, 145, 16);
        doc.text(`ESTADO: ${reservation.estado.toUpperCase()}`, 145, 21.5);

        // Divider
        doc.setDrawColor(226, 232, 240); // #E2E8F0
        doc.setLineWidth(0.5);

        // Section 1: Hotel vs Guest details
        doc.setTextColor(7, 23, 38); // #071726 deep dark blue
        doc.setFont('times', 'bold');
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
        const guestEmail = `E-mail: ${guest?.email || 'cliente@roomia.com'}`;
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
        doc.setTextColor(7, 23, 38);
        doc.setFont('times', 'bold');
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
        doc.text('Unidad / Noches', 140, tableY, { align: 'center' });
        doc.text('Importe', 195, tableY, { align: 'right' });
        doc.line(15, tableY + 2, 195, tableY + 2);

        // Row 1: Nights stay or monthly rent
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(26, 28, 30);
        
        const isPropiedad = hotel && (hotel.tipoEstablecimiento === 'casa' || hotel.tipoEstablecimiento === 'departamento');
        const isAlquiler = isPropiedad && hotel.finalidad === 'alquiler';

        const roomPrice = room?.precio ?? reservation.subtotal;
        let currentSrvY = tableY + 20;

        if (isAlquiler) {
          // Monthly Rent Row
          const roomNameStr = room?.nombre || 'Alquiler Habitacional';
          doc.setFont('helvetica', 'bold');
          doc.text(roomNameStr, 15, tableY + 8);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(`Alquiler Inmobiliario Completo - ${hotel?.tipoEstablecimiento === 'casa' ? 'Casa' : 'Departamento'}`, 15, tableY + 12);
          
          doc.setFontSize(9);
          doc.setTextColor(26, 28, 30);
          doc.text(`$${roomPrice.toFixed(2)} USD`, 105, tableY + 8, { align: 'right' });
          doc.text('1 mes', 140, tableY + 8, { align: 'center' });
          
          doc.setFont('helvetica', 'bold');
          doc.text(`$${roomPrice.toFixed(2)} USD`, 195, tableY + 8, { align: 'right' });

          // Row 2: Security Deposit Row
          doc.setFont('helvetica', 'bold');
          doc.text('Depósito de Garantía Rembolsable', 15, tableY + 20);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text('Garantía de conservación del inmueble', 15, tableY + 24);

          doc.setFontSize(9);
          doc.setTextColor(26, 28, 30);
          doc.text(`$${roomPrice.toFixed(2)} USD`, 105, tableY + 20, { align: 'right' });
          doc.text('1', 140, tableY + 20, { align: 'center' });

          doc.setFont('helvetica', 'bold');
          doc.text(`$${roomPrice.toFixed(2)} USD`, 195, tableY + 20, { align: 'right' });

          currentSrvY = tableY + 32;
        } else {
          // Standard Hotel Stay Row
          const roomNameStr = room?.nombre || 'Hospedaje Standard';
          doc.setFont('helvetica', 'bold');
          doc.text(roomNameStr, 15, tableY + 8);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(`Capacidad max: ${room?.capacidad || 2} personas`, 15, tableY + 12);
          
          doc.setFontSize(9);
          doc.setTextColor(26, 28, 30);
          doc.text(`$${roomPrice.toFixed(2)} USD`, 105, tableY + 8, { align: 'right' });
          
          const diffNights = getNights();
          doc.text(`${diffNights} noches`, 140, tableY + 8, { align: 'center' });

          const subtotalHospedaje = roomPrice * diffNights;
          doc.setFont('helvetica', 'bold');
          doc.text(`$${subtotalHospedaje.toFixed(2)} USD`, 195, tableY + 8, { align: 'right' });

          currentSrvY = tableY + 20;
        }

        // Services
        doc.line(15, currentSrvY - 4, 195, currentSrvY - 4);

        reservation.serviciosAdicionales.forEach((service) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(26, 28, 30);
          
          // Parse price or use standard fallback
          let serviceName = service;
          let servicePrice = 15;
          if (service.includes('($')) {
            const match = service.match(/\(\$([0-9.]+)\)/);
            if (match && match[1]) {
              servicePrice = parseFloat(match[1]);
            }
          }

          doc.text(`Servicio Adicional: ${serviceName}`, 15, currentSrvY);
          doc.text(`$${servicePrice.toFixed(2)} USD`, 105, currentSrvY, { align: 'right' });
          doc.text('Global', 140, currentSrvY, { align: 'center' });
          doc.setFont('helvetica', 'bold');
          doc.text(`$${servicePrice.toFixed(2)} USD`, 195, currentSrvY, { align: 'right' });
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

        // QR Code draw info - draws the live QR Code image directly in the invoice PDF!
        doc.addImage(qrDataUrl, 'PNG', 15, totalsY, 32, 32);

        // Footer lines
        const footerY = totalsY + 40;
        doc.setDrawColor(241, 245, 249);
        doc.line(15, footerY, 195, footerY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text('Este documento es una pre-factura valida de reserva simulada generada por ROOMIA S.A. No posee validez legal externa.', 15, footerY + 4);

        // Save PDF or Share natively via Android/iOS Web Share API inside APK WebViews
        const pdfBlob = doc.output('blob');
        const pdfFileName = `PreFactura_Roomia_${reservation.id}.pdf`;
        const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              files: [pdfFile],
              title: `Pre-Factura Roomia #${reservation.id}`,
              text: `Aquí tienes la pre-factura del hotel ${hotel?.nombre || 'Hotel Roomia'} correspondiente a tu reserva.`
            });
          } catch (shareErr) {
            console.warn("Share was canceled or failed, attempting standard download fallback:", shareErr);
            doc.save(pdfFileName);
          }
        } else {
          doc.save(pdfFileName);
        }
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
    <div id="invoice-modal" className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center p-2 sm:p-4 z-[100] backdrop-blur-sm animate-fade-in print:bg-white print:p-0">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[94vh] sm:max-h-[85vh] overflow-y-auto border border-neutral-200 flex flex-col print:shadow-none print:border-none print:max-h-full print:rounded-none">
        
        {/* Header toolbar - hidden in printing */}
        <div className="px-3 py-2.5 sm:px-5 sm:py-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50 rounded-t-2xl print:hidden">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
            <h3 className="font-semibold text-neutral-800 text-xs sm:text-sm">Pre-Factura</h3>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2 py-1 bg-white text-neutral-700 text-xs hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1 px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-lg transition-colors cursor-pointer disabled:bg-teal-400"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Generando...' : 'Descargar PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 sm:p-1.5 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600 rounded-full transition-colors cursor-pointer ml-1 sm:ml-2"
            >
              <X className="w-4 h-4 sm:w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Android WebView / APK compatibility notice */}
        <div className="mx-3 sm:mx-5 mt-2.5 p-2 bg-teal-50 border border-teal-150 rounded-xl flex items-start gap-2.5 text-[10px] text-teal-800 leading-normal font-sans print:hidden">
          <span className="text-sm shrink-0">💡</span>
          <div>
            <p className="font-bold uppercase tracking-wider text-[9px] text-teal-900">Compatibilidad con App Móvil / APK activa:</p>
            <p className="mt-0.5">Si estás utilizando nuestra app APK y no puedes descargar directamente el archivo PDF, presiona <strong className="text-teal-950">Imprimir</strong> y elige <strong className="text-teal-950">"Guardar como PDF"</strong>.</p>
          </div>
        </div>

        {/* Invoice Printable Viewport */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto" id="printable-area">
          {/* Top Brand Block */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-neutral-200 pb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BrandLogo showText={true} lightText={false} size="md" />
              </div>
              <p className="text-xs text-neutral-800 font-bold font-mono">SISTEMA PMS MULTI-HOTEL CENTRALIZADO</p>
              <p className="text-xs text-neutral-900 font-bold mt-1">ID Transación: {reservation.id}</p>
            </div>
            <div className="text-right md:text-right flex flex-col items-end">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(reservation.estado)} uppercase mb-3`}>
                Reserva {reservation.estado}
              </span>
              <p className="text-xs text-neutral-900 font-bold">Fecha de Emisión: {new Date(reservation.fechaRegistro).toLocaleDateString('es-ES')}</p>
              <p className="text-xs text-neutral-900 font-bold font-mono">2026-05-24T04:44:00Z</p>
            </div>
          </div>

          {/* Hotel & Guest metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-b border-neutral-200">
            <div>
              <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2">Establecimiento Receptor</p>
              <h4 className="font-bold text-neutral-950 text-base">{hotel?.nombre || 'Hotel Roomia'}</h4>
              <p className="text-sm text-neutral-900 font-semibold mt-1 leading-relaxed">{hotel?.ubicacion}</p>
              <p className="text-xs text-neutral-900 font-bold mt-2">Teléfono: {hotel?.contacto.telefono}</p>
              <p className="text-xs text-neutral-900 font-bold">E-mail: {hotel?.contacto.email}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2">Datos del Cliente Hospedado</p>
              <h4 className="font-bold text-neutral-950 text-base">{guest ? `${guest.nombre} ${guest.apellido}` : 'Invitado Particular'}</h4>
              <p className="text-sm text-neutral-900 font-semibold mt-1">E-mail: {guest?.email || 'cliente@roomia.com'}</p>
              <p className="text-sm text-neutral-900 font-semibold">Teléfono: {guest?.telefono || '+54 11 9876 5432'}</p>
              {guest?.documento && (
                <p className="text-xs text-neutral-900 font-bold font-mono mt-1">Documento / Pasaporte: {guest.documento}</p>
              )}
            </div>
          </div>

          {/* Stay Specifics details banner */}
          <div className="py-6 border-b border-neutral-200">
            <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-3">Detalle del Hospedaje</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
              <div>
                <span className="text-xs text-neutral-900 font-bold block">Habitación N°</span>
                <span className="font-bold text-neutral-950 font-mono text-sm">{room?.numero || 'S/N'}</span>
              </div>
              <div>
                <span className="text-xs text-neutral-900 font-bold block">Tipo Habitación</span>
                <span className="font-bold text-neutral-950 text-sm">{room?.tipo || 'Suite'}</span>
              </div>
              <div>
                <span className="text-xs text-neutral-900 font-bold block">Check-In</span>
                <span className="font-bold text-neutral-950 text-sm whitespace-nowrap">{reservation.fechaEntrada}</span>
              </div>
              <div>
                <span className="text-xs text-neutral-900 font-bold block">Check-Out</span>
                <span className="font-bold text-neutral-950 text-sm whitespace-nowrap">{reservation.fechaSalida}</span>
              </div>
            </div>
          </div>

          {/* Cost breakdown table */}
          <div className="py-4 overflow-x-auto w-full">
            <table className="w-full min-w-[500px] text-left text-sm text-neutral-950">
              <thead>
                <tr className="border-b border-neutral-300 text-neutral-950 text-xs font-bold uppercase">
                  <th className="py-2">Descripción del Servicio / Detalle</th>
                  <th className="py-2 text-right">Precio Unitario</th>
                  <th className="py-2 text-center">Unidad / Noches</th>
                  <th className="py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-150">
                {isAlquiler ? (
                  <>
                    {/* Alquiler Mensual Row */}
                    <tr>
                      <td className="py-3">
                        <span className="font-bold text-neutral-950 block">{room?.nombre || 'Alquiler Habitacional'}</span>
                        <span className="text-xs text-neutral-900 font-bold">Arrendamiento de Propiedad Completa ({hotel?.tipoEstablecimiento === 'casa' ? 'Casa' : 'Departamento'})</span>
                      </td>
                      <td className="py-3 text-right font-mono font-bold">${(room?.precio ?? (reservation.subtotal / 2)).toFixed(2)} USD</td>
                      <td className="py-3 text-center font-bold">1 mes</td>
                      <td className="py-3 text-right font-bold text-neutral-950 font-mono">${(room?.precio ?? (reservation.subtotal / 2)).toFixed(2)} USD</td>
                    </tr>
                    {/* Depósito de Garantía Row */}
                    <tr>
                      <td className="py-3">
                        <span className="font-bold text-neutral-950 block">Depósito de Garantía</span>
                        <span className="text-xs text-neutral-900 font-bold">Garantía reembolsable de conservación del inmueble</span>
                      </td>
                      <td className="py-3 text-right font-mono font-bold">${(room?.precio ?? (reservation.subtotal / 2)).toFixed(2)} USD</td>
                      <td className="py-3 text-center font-bold">1</td>
                      <td className="py-3 text-right font-bold text-neutral-950 font-mono">${(room?.precio ?? (reservation.subtotal / 2)).toFixed(2)} USD</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td className="py-3">
                      <span className="font-bold text-neutral-950 block">{room?.nombre || 'Hospedaje Standard'}</span>
                      <span className="text-xs text-neutral-900 font-bold">Capacidad máxima: {room?.capacidad} personas ({room?.camas} camas)</span>
                    </td>
                    <td className="py-3 text-right font-mono font-bold">${(room?.precio || reservation.subtotal).toFixed(2)} USD</td>
                    <td className="py-3 text-center font-bold">{getNights()} {getNights() > 1 ? 'noches' : 'noche'}</td>
                    <td className="py-3 text-right font-bold text-neutral-950 font-mono">${((room?.precio || 0) * getNights()).toFixed(2)} USD</td>
                  </tr>
                )}
                {reservation.serviciosAdicionales.map((service, idx) => {
                  let srvName = service;
                  let srvPrice = 15;
                  if (service.includes('($')) {
                     const match = service.match(/\(\$([0-9.]+)\)/);
                     if (match && match[1]) {
                       srvPrice = parseFloat(match[1]);
                     }
                  }
                  return (
                    <tr key={idx}>
                      <td className="py-3 text-neutral-950 font-bold">
                        <span>Adicional: {srvName}</span>
                      </td>
                      <td className="py-3 text-right font-mono font-bold">${srvPrice.toFixed(2)} USD</td>
                      <td className="py-3 text-center font-bold">Global</td>
                      <td className="py-3 text-right font-bold text-neutral-950 font-mono">${srvPrice.toFixed(2)} USD</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & QR Grid */}
          <div className="border-t border-neutral-200 pt-6 flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
            <div className="flex flex-col items-center md:items-start">
              <QRView value={reservation.qrCode} size={110} />
              <p className="text-[10px] text-neutral-950 font-bold mt-2 text-center md:text-left leading-relaxed">
                Escanee este código QR en el mostrador del hotel para procesar su Check-In instantáneo.
              </p>
            </div>

            <div className="w-full md:w-64">
              <div className="space-y-2 text-sm text-neutral-950 font-bold">
                <div className="flex justify-between">
                  <span>Subtotal Neto:</span>
                  <span className="font-mono font-bold text-neutral-950">${reservation.subtotal.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between">
                  <span>Impuestos (IVA 16%):</span>
                  <span className="font-mono text-neutral-950">${reservation.impuestos.toFixed(2)} USD</span>
                </div>
                <div className="h-[1px] bg-neutral-200 my-2" />
                <div className="flex justify-between text-base font-extrabold text-teal-700">
                  <span>Monto Total:</span>
                  <span className="font-mono">${reservation.total.toFixed(2)} USD</span>
                </div>
                {reservation.montoPagado !== undefined && reservation.montoPagado > 0 && (
                  <div className="flex justify-between text-xs text-emerald-700 font-semibold border-t border-dashed border-neutral-200 pt-1.5 mt-1.5">
                    <span>Monto Abonado:</span>
                    <span className="font-mono">-${reservation.montoPagado.toFixed(2)} USD</span>
                  </div>
                )}
                {reservation.montoPendiente !== undefined && reservation.montoPendiente > 0 ? (
                  <div className="flex justify-between text-xs text-red-600 font-bold bg-red-50 p-1.5 rounded border border-red-100 mt-1.5">
                    <span>Monto Pendiente:</span>
                    <span className="font-mono">${reservation.montoPendiente.toFixed(2)} USD</span>
                  </div>
                ) : reservation.montoPagado !== undefined && reservation.montoPagado >= reservation.total ? (
                  <div className="flex justify-between text-xs text-emerald-600 font-bold bg-emerald-50 p-1.5 rounded border border-emerald-100 mt-1.5">
                    <span>Saldo Pendiente:</span>
                    <span className="font-mono">$0.00 USD</span>
                  </div>
                ) : null}
              </div>

              {/* Status footer inside invoice */}
              <div className={`mt-4 p-3 rounded-xl text-center border text-xs ${
                reservation.estado === 'confirmada' && reservation.montoPendiente !== undefined && reservation.montoPendiente > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : reservation.estado === 'confirmada' || reservation.estado === 'ocupada' || reservation.estado === 'finalizada'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {reservation.estado === 'confirmada' && reservation.montoPendiente !== undefined && reservation.montoPendiente > 0 ? (
                  <div>
                    <span className="font-bold">✓ RESERVADA CON PAGO PARCIAL (20%) ⚠️</span>
                    <p className="text-[10px] text-amber-600 mt-0.5">Señal de reserva garantizada. Saldo pendiente (${reservation.montoPendiente.toFixed(2)} USD) pagadero al check-in.</p>
                  </div>
                ) : reservation.estado === 'confirmada' || reservation.estado === 'ocupada' || reservation.estado === 'finalizada' ? (
                  <div>
                    <span className="font-bold">✓ PAGADO Y CONFIRMADO POR ADMINISTRACIÓN 🛡️</span>
                    <p className="text-[10px] text-emerald-600 font-mono mt-0.5">Ref: ADM-REF-{reservation.id}</p>
                  </div>
                ) : (
                  <div>
                    <span className="font-bold">⚠️ PENDIENTE DE PAGO</span>
                    <p className="text-[10px] text-amber-600 mt-0.5">Por favor contacte a la administración o recepción para realizar su pago seguro.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Policies & legal terms */}
          <div className="mt-10 pt-6 border-t border-neutral-300 text-[10.5px] text-neutral-900 font-semibold leading-relaxed">
            <p className="font-bold mb-1">Políticas importantes del hotel:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Check-in formal requerido presentando Identificación Oficial (Cédula de identidad o pasaporte).</li>
              <li>Las cancelaciones deben procesarse con un mínimo de 24 horas antes del ingreso para evitar cargos de No-Show.</li>
              <li>Toda anomalía o daño físico en la estructura será cargado directamente al expediente de facturación finalizado.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
