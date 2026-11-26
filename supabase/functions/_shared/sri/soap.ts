/**
 * Servicios web del SRI para comprobantes electrónicos, esquema offline (ficha técnica v2.32,
 * numeral 5): recepción (validarComprobante) y autorización (autorizacionComprobante).
 *
 * Uso asíncrono recomendado por el SRI: enviar → si queda RECIBIDA, esperar unos segundos y
 * consultar la autorización; si aún no hay respuesta, volver a consultar más tarde (el SRI tiene
 * hasta 24 horas). Nunca reenviar un comprobante "en procesamiento" (error 70).
 */
import type { Ambiente } from './claveAcceso.ts';

const HOSTS: Record<Ambiente, string> = {
  '1': 'https://celcer.sri.gob.ec',
  '2': 'https://cel.sri.gob.ec'
};

export const endpoints = (ambiente: Ambiente) => ({
  recepcion: `${HOSTS[ambiente]}/comprobantes-electronicos-ws/RecepcionComprobantesOffline`,
  autorizacion: `${HOSTS[ambiente]}/comprobantes-electronicos-ws/AutorizacionComprobantesOffline`
});

export interface MensajeSri {
  identificador: string;
  mensaje: string;
  informacionAdicional?: string;
  /** ERROR · ADVERTENCIA · INFORMATIVO */
  tipo: string;
}

export interface RespuestaRecepcion {
  /** RECIBIDA · DEVUELTA */
  estado: string;
  mensajes: MensajeSri[];
}

export interface RespuestaAutorizacion {
  /** AUTORIZADO · NO AUTORIZADO · RECHAZADO · EN PROCESO · NO ENCONTRADO */
  estado: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ambiente?: string;
  /** Comprobante autorizado (XML firmado) devuelto por el SRI */
  comprobante?: string;
  mensajes: MensajeSri[];
}

/** XML en UTF-8 a base64 (funciona en Deno y en Node) */
export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function envelopeRecepcion(xmlFirmado: string): string {
  return (
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">' +
    '<soapenv:Header/><soapenv:Body><ec:validarComprobante>' +
    `<xml>${utf8ToBase64(xmlFirmado)}</xml>` +
    '</ec:validarComprobante></soapenv:Body></soapenv:Envelope>'
  );
}

export function envelopeAutorizacion(claveAcceso: string): string {
  return (
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">' +
    '<soapenv:Header/><soapenv:Body><ec:autorizacionComprobante>' +
    `<claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>` +
    '</ec:autorizacionComprobante></soapenv:Body></soapenv:Envelope>'
  );
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

/** Contenido de la primera etiqueta con ese nombre (con o sin prefijo de espacio de nombres) */
function field(xml: string, name: string): string | undefined {
  const m = new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml);
  return m ? decodeEntities(m[1].trim()) : undefined;
}

/** Mensajes del SRI: cada uno trae identificador, mensaje, informacionAdicional y tipo */
export function parseMensajes(xml: string): MensajeSri[] {
  const parts = xml.split(/<(?:\w+:)?identificador>/).slice(1);
  return parts.map(part => {
    const identificador = decodeEntities((part.split(/<\/(?:\w+:)?identificador>/)[0] || '').trim());
    return {
      identificador,
      mensaje: field(part, 'mensaje') ?? '',
      informacionAdicional: field(part, 'informacionAdicional'),
      tipo: field(part, 'tipo') ?? ''
    };
  });
}

function soapFault(xml: string): string | null {
  if (!/<(?:\w+:)?Fault>/.test(xml)) return null;
  return field(xml, 'faultstring') ?? 'El servicio del SRI respondió con un error.';
}

export function parseRecepcion(xml: string): RespuestaRecepcion {
  const fault = soapFault(xml);
  if (fault) throw new Error(`SRI: ${fault}`);
  const estado = field(xml, 'estado');
  if (!estado) throw new Error('Respuesta de recepción del SRI no reconocida.');
  return { estado, mensajes: parseMensajes(xml) };
}

export function parseAutorizacion(xml: string): RespuestaAutorizacion {
  const fault = soapFault(xml);
  if (fault) throw new Error(`SRI: ${fault}`);
  const blocks = [...xml.matchAll(/<(?:\w+:)?autorizacion>([\s\S]*?)<\/(?:\w+:)?autorizacion>/g)].map(m => m[1]);
  if (!blocks.length) {
    const numero = Number(field(xml, 'numeroComprobantes') ?? '0');
    return { estado: numero > 0 ? 'EN PROCESO' : 'NO ENCONTRADO', mensajes: [] };
  }
  const parsed = blocks.map(block => {
    // El comprobante puede venir en CDATA o con entidades; se separa antes de leer el resto
    let comprobante: string | undefined;
    const rest = block.replace(/<(?:\w+:)?comprobante>([\s\S]*?)<\/(?:\w+:)?comprobante>/, (_, inner: string) => {
      const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(inner);
      comprobante = cdata ? cdata[1] : decodeEntities(inner.trim());
      return '';
    });
    return {
      estado: field(rest, 'estado') ?? 'EN PROCESO',
      numeroAutorizacion: field(rest, 'numeroAutorizacion'),
      fechaAutorizacion: field(rest, 'fechaAutorizacion'),
      ambiente: field(rest, 'ambiente'),
      comprobante,
      mensajes: parseMensajes(rest)
    } as RespuestaAutorizacion;
  });
  // Si el comprobante se reenvió hay varias respuestas: manda la autorizada
  return parsed.find(p => p.estado === 'AUTORIZADO') ?? parsed[0];
}

/** XML que se entrega al cliente: el comprobante autorizado con los datos de la autorización */
export function xmlAutorizado(r: RespuestaAutorizacion): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?><autorizacion>' +
    `<estado>${r.estado}</estado>` +
    `<numeroAutorizacion>${r.numeroAutorizacion ?? ''}</numeroAutorizacion>` +
    `<fechaAutorizacion>${r.fechaAutorizacion ?? ''}</fechaAutorizacion>` +
    `<ambiente>${r.ambiente ?? ''}</ambiente>` +
    `<comprobante><![CDATA[${r.comprobante ?? ''}]]></comprobante>` +
    '</autorizacion>'
  );
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

async function post(url: string, body: string, fetchImpl: FetchLike, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      body,
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok && !/<(?:\w+:)?Fault>/.test(text)) throw new Error(`El SRI respondió ${res.status}. Intenta más tarde.`);
    return text;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw new Error('El SRI no respondió a tiempo. Intenta más tarde.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function enviarComprobante(
  xmlFirmado: string,
  ambiente: Ambiente,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 30000
): Promise<RespuestaRecepcion> {
  return parseRecepcion(await post(endpoints(ambiente).recepcion, envelopeRecepcion(xmlFirmado), fetchImpl, timeoutMs));
}

export async function consultarAutorizacion(
  claveAcceso: string,
  ambiente: Ambiente,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 30000
): Promise<RespuestaAutorizacion> {
  return parseAutorizacion(await post(endpoints(ambiente).autorizacion, envelopeAutorizacion(claveAcceso), fetchImpl, timeoutMs));
}

/** Mensajes en una línea legible para mostrar al usuario */
export function describirMensajes(mensajes: MensajeSri[]): string {
  return mensajes
    .map(m => `${m.identificador ? `[${m.identificador}] ` : ''}${m.mensaje}${m.informacionAdicional ? `: ${m.informacionAdicional}` : ''}`)
    .join(' · ');
}
