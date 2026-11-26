/**
 * Factura electrónica del SRI, formato XML versión 1.1.0 (ficha técnica offline v2.32, anexo 3).
 * Arma el XML ya en forma canónica (sin espacios entre etiquetas, atributos en orden, sin
 * etiquetas vacías abreviadas) porque la firma XAdES-BES se calcula sobre este mismo texto.
 *
 * Módulo puro, sin dependencias.
 */
import { buildClaveAcceso, randomCodigoNumerico, type Ambiente } from './claveAcceso.ts';
import { CONSUMIDOR_FINAL, MAX_CONSUMIDOR_FINAL, type TipoIdentificacion, validarIdentificacion } from './identificacion.ts';
import { round2 } from '../tax.ts';

/** Tabla 17: código del porcentaje de IVA y su tarifa */
export const TARIFAS_IVA: Record<string, number> = { '0': 0, '2': 12, '3': 14, '4': 15, '5': 5, '6': 0, '7': 0, '10': 13 };

/** Tabla 24: formas de pago */
export const FORMAS_PAGO: Array<{ value: string; label: string }> = [
  { value: '01', label: 'Sin utilización del sistema financiero (efectivo)' },
  { value: '16', label: 'Tarjeta de débito' },
  { value: '19', label: 'Tarjeta de crédito' },
  { value: '20', label: 'Otros con utilización del sistema financiero (transferencia)' },
  { value: '17', label: 'Dinero electrónico' },
  { value: '18', label: 'Tarjeta prepago' },
  { value: '15', label: 'Compensación de deudas' },
  { value: '21', label: 'Endoso de títulos' }
];

export type Regimen = 'general' | 'rimpe_emprendedor' | 'rimpe_negocio_popular';

export interface Emisor {
  ambiente: Ambiente;
  razonSocial: string;
  nombreComercial?: string;
  ruc: string;
  /** Código de establecimiento (3 dígitos) */
  estab: string;
  /** Punto de emisión (3 dígitos) */
  ptoEmi: string;
  dirMatriz: string;
  dirEstablecimiento?: string;
  obligadoContabilidad: boolean;
  /** Número de resolución de contribuyente especial */
  contribuyenteEspecial?: string;
  /** Número de resolución de agente de retención, sin ceros a la izquierda (anexo 21) */
  agenteRetencion?: string;
  regimen?: Regimen;
}

export interface Comprador {
  tipoIdentificacion: TipoIdentificacion;
  identificacion: string;
  razonSocial: string;
  direccion?: string;
  email?: string;
  telefono?: string;
}

export interface LineaFactura {
  codigo: string;
  descripcion: string;
  cantidad: number;
  /** Precio unitario sin IVA (hasta 6 decimales) */
  precioUnitario: number;
  descuento: number;
  /** Total de la línea sin IVA (2 decimales) */
  base: number;
  /** codigoPorcentaje del IVA (tabla 17) */
  codigoPorcentaje: string;
  tarifa: number;
  iva: number;
}

export interface FacturaInput {
  emisor: Emisor;
  comprador: Comprador;
  /** dd/mm/aaaa */
  fechaEmision: string;
  secuencial: number;
  codigoNumerico?: string;
  lineas: LineaFactura[];
  formaPago: string;
  /** Hasta 15 campos de hasta 300 caracteres */
  infoAdicional?: Array<[string, string]>;
}

export interface FacturaResult {
  claveAcceso: string;
  /** XML del comprobante sin declaración, listo para firmar */
  xml: string;
  totalSinImpuestos: number;
  totalIva: number;
  importeTotal: number;
}

const money = (n: number) => round2(n).toFixed(2);
/** Cantidad y precio unitario: hasta 6 decimales en la versión 1.1.0 */
const decimal6 = (n: number) => (Math.round((Number(n) || 0) * 1_000_000) / 1_000_000).toFixed(6);

/**
 * Solo caracteres que el SRI procesa bien: letras latinas con tildes y ñ, números y puntuación.
 * Los emojis y otros símbolos (caracteres de 4 bytes en UTF-8) hacen que el SRI relea el texto
 * distinto a lo firmado y rechace la factura con "firma inválida" (error 39).
 */
export function textoSri(value: unknown): string {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—‒−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•·]/g, '·')
    .replace(/[^\t\n\r\x20-\x7e\xa0-\xffĀ-ſ]/g, '');
}

/** Texto para el XML: sin saltos de línea ni espacios dobles, escapado como en XML canónico */
export function xmlText(value: unknown, max = 300): string {
  const clean = textoSri(value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
  return clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Valor de atributo en XML canónico (comillas dobles; en C14N el ">" de un atributo va sin escapar) */
export function xmlAttr(value: unknown, max = 300): string {
  return xmlText(value, max).replace(/&gt;/g, '>').replace(/"/g, '&quot;');
}

const tag = (name: string, value: string) => `<${name}>${value}</${name}>`;

/**
 * Líneas de la factura a partir de los importes cobrados, con el IVA incluido en el precio.
 * El importe total de la factura es exactamente la suma cobrada: la base se reparte entre las
 * líneas en proporción a su importe y la última línea absorbe el redondeo.
 */
export function lineasDesdeImportes(
  items: Array<{ codigo: string; descripcion: string; cantidad: number; importe: number }>,
  codigoPorcentaje = '4'
): LineaFactura[] {
  const tarifa = TARIFAS_IVA[codigoPorcentaje];
  if (tarifa === undefined) throw new Error(`Código de IVA desconocido: ${codigoPorcentaje}`);
  const valid = items.filter(i => round2(i.importe) > 0);
  if (!valid.length) throw new Error('La factura no tiene valores que facturar.');
  const totalCobrado = round2(valid.reduce((s, i) => s + i.importe, 0));
  const factor = 1 + tarifa / 100;

  const lineas: LineaFactura[] = valid.map(item => {
    const base = round2(item.importe / factor);
    const cantidad = item.cantidad > 0 ? item.cantidad : 1;
    return {
      codigo: item.codigo,
      descripcion: item.descripcion,
      cantidad,
      precioUnitario: base / cantidad,
      descuento: 0,
      base,
      codigoPorcentaje,
      tarifa,
      iva: round2((base * tarifa) / 100)
    };
  });

  // Ajuste de centavos en la última línea para que base + IVA = total cobrado
  const last = lineas[lineas.length - 1];
  for (let i = 0; i < 6; i++) {
    const suma = round2(lineas.reduce((s, l) => s + l.base + l.iva, 0));
    const diff = round2(totalCobrado - suma);
    if (diff === 0) break;
    last.base = round2(last.base + (diff > 0 ? 0.01 : -0.01));
    last.iva = round2((last.base * tarifa) / 100);
    last.precioUnitario = last.base / last.cantidad;
  }
  return lineas;
}

const LEYENDA_RIMPE: Record<Regimen, string | null> = {
  general: null,
  rimpe_emprendedor: 'CONTRIBUYENTE RÉGIMEN RIMPE',
  rimpe_negocio_popular: 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE'
};

export function validarFactura(input: FacturaInput): string[] {
  const errors: string[] = [];
  const { emisor, comprador } = input;
  if (!/^\d{13}$/.test(emisor.ruc)) errors.push('El RUC del emisor debe tener 13 dígitos.');
  if (!emisor.razonSocial?.trim()) errors.push('Falta la razón social del emisor.');
  if (!emisor.dirMatriz?.trim()) errors.push('Falta la dirección matriz del emisor.');
  if (!/^\d{3}$/.test(emisor.estab) || !/^\d{3}$/.test(emisor.ptoEmi)) errors.push('Establecimiento y punto de emisión deben tener 3 dígitos.');
  const idError = validarIdentificacion(comprador.tipoIdentificacion, comprador.identificacion);
  if (idError) errors.push(idError);
  if (!comprador.razonSocial?.trim()) errors.push('Falta el nombre o razón social del comprador.');
  if (!input.lineas.length) errors.push('La factura no tiene líneas.');
  const total = round2(input.lineas.reduce((s, l) => s + l.base + l.iva, 0));
  if (comprador.tipoIdentificacion === '07' && total > MAX_CONSUMIDOR_FINAL) {
    errors.push(`Una factura a consumidor final no puede superar $${MAX_CONSUMIDOR_FINAL}. Pide los datos del cliente.`);
  }
  if (input.infoAdicional && input.infoAdicional.length > 15) errors.push('Máximo 15 campos adicionales.');
  return errors;
}

export function buildFacturaXml(input: FacturaInput): FacturaResult {
  const errors = validarFactura(input);
  if (errors.length) throw new Error(errors.join(' '));
  const { emisor, comprador, lineas } = input;

  const claveAcceso = buildClaveAcceso({
    fechaEmision: input.fechaEmision,
    tipoComprobante: '01',
    ruc: emisor.ruc,
    ambiente: emisor.ambiente,
    estab: emisor.estab,
    ptoEmi: emisor.ptoEmi,
    secuencial: input.secuencial,
    codigoNumerico: input.codigoNumerico ?? randomCodigoNumerico()
  });

  const totalSinImpuestos = round2(lineas.reduce((s, l) => s + l.base, 0));
  const totalDescuento = round2(lineas.reduce((s, l) => s + l.descuento, 0));

  // Totales por código de IVA
  const porCodigo = new Map<string, { base: number; valor: number }>();
  for (const l of lineas) {
    const acc = porCodigo.get(l.codigoPorcentaje) ?? { base: 0, valor: 0 };
    acc.base = round2(acc.base + l.base);
    acc.valor = round2(acc.valor + l.iva);
    porCodigo.set(l.codigoPorcentaje, acc);
  }
  const totalIva = round2([...porCodigo.values()].reduce((s, t) => s + t.valor, 0));
  const importeTotal = round2(totalSinImpuestos + totalIva);

  const leyendaRimpe = LEYENDA_RIMPE[emisor.regimen ?? 'general'];
  const infoTributaria =
    '<infoTributaria>' +
    tag('ambiente', emisor.ambiente) +
    tag('tipoEmision', '1') +
    tag('razonSocial', xmlText(emisor.razonSocial)) +
    (emisor.nombreComercial?.trim() ? tag('nombreComercial', xmlText(emisor.nombreComercial)) : '') +
    tag('ruc', emisor.ruc) +
    tag('claveAcceso', claveAcceso) +
    tag('codDoc', '01') +
    tag('estab', emisor.estab) +
    tag('ptoEmi', emisor.ptoEmi) +
    tag('secuencial', String(input.secuencial).padStart(9, '0')) +
    tag('dirMatriz', xmlText(emisor.dirMatriz)) +
    (emisor.agenteRetencion?.trim() ? tag('agenteRetencion', String(Number(emisor.agenteRetencion))) : '') +
    (leyendaRimpe ? tag('contribuyenteRimpe', leyendaRimpe) : '') +
    '</infoTributaria>';

  const esConsumidorFinal = comprador.tipoIdentificacion === '07';
  const infoFactura =
    '<infoFactura>' +
    tag('fechaEmision', input.fechaEmision) +
    (emisor.dirEstablecimiento?.trim() ? tag('dirEstablecimiento', xmlText(emisor.dirEstablecimiento)) : '') +
    (emisor.contribuyenteEspecial?.trim() ? tag('contribuyenteEspecial', xmlText(emisor.contribuyenteEspecial, 13)) : '') +
    tag('obligadoContabilidad', emisor.obligadoContabilidad ? 'SI' : 'NO') +
    tag('tipoIdentificacionComprador', comprador.tipoIdentificacion) +
    tag('razonSocialComprador', xmlText(esConsumidorFinal ? CONSUMIDOR_FINAL.razonSocial : comprador.razonSocial)) +
    tag('identificacionComprador', xmlText(esConsumidorFinal ? CONSUMIDOR_FINAL.identificacion : comprador.identificacion, 20)) +
    (comprador.direccion?.trim() ? tag('direccionComprador', xmlText(comprador.direccion)) : '') +
    tag('totalSinImpuestos', money(totalSinImpuestos)) +
    tag('totalDescuento', money(totalDescuento)) +
    '<totalConImpuestos>' +
    [...porCodigo.entries()]
      .map(([codigo, t]) =>
        '<totalImpuesto>' +
        tag('codigo', '2') +
        tag('codigoPorcentaje', codigo) +
        tag('baseImponible', money(t.base)) +
        tag('valor', money(t.valor)) +
        '</totalImpuesto>'
      )
      .join('') +
    '</totalConImpuestos>' +
    tag('propina', '0.00') +
    tag('importeTotal', money(importeTotal)) +
    tag('moneda', 'DOLAR') +
    '<pagos><pago>' +
    tag('formaPago', input.formaPago) +
    tag('total', money(importeTotal)) +
    '</pago></pagos>' +
    '</infoFactura>';

  const detalles =
    '<detalles>' +
    lineas
      .map(l =>
        '<detalle>' +
        tag('codigoPrincipal', xmlText(l.codigo, 25)) +
        tag('descripcion', xmlText(l.descripcion)) +
        tag('cantidad', decimal6(l.cantidad)) +
        tag('precioUnitario', decimal6(l.precioUnitario)) +
        tag('descuento', money(l.descuento)) +
        tag('precioTotalSinImpuesto', money(l.base)) +
        '<impuestos><impuesto>' +
        tag('codigo', '2') +
        tag('codigoPorcentaje', l.codigoPorcentaje) +
        tag('tarifa', String(l.tarifa)) +
        tag('baseImponible', money(l.base)) +
        tag('valor', money(l.iva)) +
        '</impuesto></impuestos>' +
        '</detalle>'
      )
      .join('') +
    '</detalles>';

  const extras: Array<[string, string]> = [];
  if (comprador.email?.trim()) extras.push(['Email', comprador.email.trim()]);
  if (comprador.telefono?.trim()) extras.push(['Teléfono', comprador.telefono.trim()]);
  for (const pair of input.infoAdicional ?? []) extras.push(pair);
  const infoAdicional = extras.length
    ? '<infoAdicional>' +
      extras
        .slice(0, 15)
        .filter(([, v]) => String(v ?? '').trim())
        .map(([k, v]) => `<campoAdicional nombre="${xmlAttr(k)}">${xmlText(v)}</campoAdicional>`)
        .join('') +
      '</infoAdicional>'
    : '';

  const xml = `<factura id="comprobante" version="1.1.0">${infoTributaria}${infoFactura}${detalles}${infoAdicional}</factura>`;
  return { claveAcceso, xml, totalSinImpuestos, totalIva, importeTotal };
}

/** Fecha de hoy en Ecuador (UTC-5) como dd/mm/aaaa */
export function fechaEcuador(now: number = Date.now()): string {
  const d = new Date(now - 5 * 60 * 60 * 1000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}
