/**
 * Descarga del RIDE (PDF) y del XML de una factura electrónica, en la web y en el APK.
 * El RIDE se dibuja con el mismo módulo que usa el servidor para el correo.
 */
import { generarRide } from '../../supabase/functions/_shared/sri/ride.ts';
import { numeroFactura } from './sri';
import type { SriComprobante } from './sriApi';
import { isNativeApp } from './platform';
import { savePdfNative } from './nativeFiles';

export const nombreArchivo = (c: Pick<SriComprobante, 'estab' | 'ptoEmi' | 'secuencial'>, ext: 'pdf' | 'xml') =>
  `Factura ${numeroFactura(c.estab, c.ptoEmi, c.secuencial)}.${ext}`;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function guardar(bytes: Uint8Array, fileName: string, mime: string) {
  if (isNativeApp()) {
    await savePdfNative(bytesToBase64(bytes), fileName, fileName);
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function descargarRide(c: SriComprobante) {
  const xml = c.xmlAutorizado || c.xmlFirmado;
  if (!xml) throw new Error('La factura aún no tiene XML: espera a que se envíe al SRI.');
  const pdf = await generarRide({
    xml,
    autorizado: c.estado === 'autorizado',
    numeroAutorizacion: c.numeroAutorizacion,
    fechaAutorizacion: c.fechaAutorizacion
  });
  await guardar(pdf, nombreArchivo(c, 'pdf'), 'application/pdf');
}

export async function descargarXml(c: SriComprobante) {
  const xml = c.xmlAutorizado || c.xmlFirmado;
  if (!xml) throw new Error('La factura aún no tiene XML: espera a que se envíe al SRI.');
  await guardar(new TextEncoder().encode(xml), nombreArchivo(c, 'xml'), 'application/xml');
}
