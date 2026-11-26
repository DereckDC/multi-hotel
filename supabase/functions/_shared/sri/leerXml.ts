/**
 * Lectura del XML de una factura electrónica (versión 1.1.0) para dibujar el RIDE.
 * El XML firmado es la fuente de verdad: lo que se imprime es exactamente lo que se envió al SRI.
 * Módulo puro (expresiones regulares, sin DOM): se prueba con `node --test`.
 */
import { decodeEntities } from './soap.ts';

export interface FacturaLeida {
  ambiente: string;
  razonSocial: string;
  nombreComercial?: string;
  ruc: string;
  claveAcceso: string;
  estab: string;
  ptoEmi: string;
  secuencial: string;
  dirMatriz: string;
  dirEstablecimiento?: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad?: string;
  agenteRetencion?: string;
  contribuyenteRimpe?: string;
  fechaEmision: string;
  tipoIdentificacionComprador: string;
  razonSocialComprador: string;
  identificacionComprador: string;
  direccionComprador?: string;
  totalSinImpuestos: number;
  totalDescuento: number;
  impuestos: Array<{ codigoPorcentaje: string; baseImponible: number; valor: number }>;
  propina: number;
  importeTotal: number;
  pagos: Array<{ formaPago: string; total: number }>;
  detalles: Array<{
    codigoPrincipal: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    precioTotalSinImpuesto: number;
  }>;
  infoAdicional: Array<[string, string]>;
}

const get = (xml: string, name: string): string | undefined => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decodeEntities(m[1]) : undefined;
};
const num = (xml: string, name: string) => Number(get(xml, name) ?? 0);
const blocks = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map(m => m[1]);

/** Acepta el XML firmado o el XML de autorización (con el comprobante en CDATA) */
export function leerFactura(xml: string): FacturaLeida {
  const cdata = /<comprobante><!\[CDATA\[([\s\S]*?)\]\]><\/comprobante>/.exec(xml);
  const source = cdata ? cdata[1] : xml;
  // Fuera la firma: no interesa y es lo más pesado
  const doc = source.replace(/<ds:Signature[\s\S]*<\/ds:Signature>/, '');
  const trib = blocks(doc, 'infoTributaria')[0] ?? '';
  const info = blocks(doc, 'infoFactura')[0] ?? '';
  if (!trib || !info) throw new Error('El XML no es una factura electrónica.');
  const totales = blocks(info, 'totalConImpuestos')[0] ?? '';

  return {
    ambiente: get(trib, 'ambiente') ?? '',
    razonSocial: get(trib, 'razonSocial') ?? '',
    nombreComercial: get(trib, 'nombreComercial'),
    ruc: get(trib, 'ruc') ?? '',
    claveAcceso: get(trib, 'claveAcceso') ?? '',
    estab: get(trib, 'estab') ?? '',
    ptoEmi: get(trib, 'ptoEmi') ?? '',
    secuencial: get(trib, 'secuencial') ?? '',
    dirMatriz: get(trib, 'dirMatriz') ?? '',
    agenteRetencion: get(trib, 'agenteRetencion'),
    contribuyenteRimpe: get(trib, 'contribuyenteRimpe'),
    fechaEmision: get(info, 'fechaEmision') ?? '',
    dirEstablecimiento: get(info, 'dirEstablecimiento'),
    contribuyenteEspecial: get(info, 'contribuyenteEspecial'),
    obligadoContabilidad: get(info, 'obligadoContabilidad'),
    tipoIdentificacionComprador: get(info, 'tipoIdentificacionComprador') ?? '',
    razonSocialComprador: get(info, 'razonSocialComprador') ?? '',
    identificacionComprador: get(info, 'identificacionComprador') ?? '',
    direccionComprador: get(info, 'direccionComprador'),
    totalSinImpuestos: num(info, 'totalSinImpuestos'),
    totalDescuento: num(info, 'totalDescuento'),
    impuestos: blocks(totales, 'totalImpuesto').map(t => ({
      codigoPorcentaje: get(t, 'codigoPorcentaje') ?? '',
      baseImponible: num(t, 'baseImponible'),
      valor: num(t, 'valor')
    })),
    propina: num(info, 'propina'),
    importeTotal: num(info, 'importeTotal'),
    pagos: blocks(info, 'pago').map(p => ({ formaPago: get(p, 'formaPago') ?? '', total: num(p, 'total') })),
    detalles: blocks(doc, 'detalle').map(d => ({
      codigoPrincipal: get(d, 'codigoPrincipal') ?? '',
      descripcion: get(d, 'descripcion') ?? '',
      cantidad: num(d, 'cantidad'),
      precioUnitario: num(d, 'precioUnitario'),
      descuento: num(d, 'descuento'),
      precioTotalSinImpuesto: num(d, 'precioTotalSinImpuesto')
    })),
    infoAdicional: [...doc.matchAll(/<campoAdicional nombre="([^"]*)">([\s\S]*?)<\/campoAdicional>/g)].map(
      m => [decodeEntities(m[1]), decodeEntities(m[2])] as [string, string]
    )
  };
}
