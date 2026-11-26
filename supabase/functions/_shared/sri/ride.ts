/**
 * RIDE (Representación Impresa del Documento Electrónico) de la factura: PDF A4 con el formato
 * habitual del SRI y el código de barras Code 128 de la clave de acceso.
 *
 * Se dibuja a partir del XML firmado o autorizado (lo mismo que se envió al SRI) con pdf-lib, que
 * funciona igual en el navegador y en la función del servidor (Deno). El servidor lo adjunta al
 * correo; el navegador lo usa para "Descargar RIDE".
 */
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { code128Widths } from './codigoBarras.ts';
import { leerFactura } from './leerXml.ts';
import { FORMAS_PAGO, TARIFAS_IVA } from './factura.ts';
import { TIPOS_IDENTIFICACION } from './identificacion.ts';

export interface RideInput {
  /** XML firmado o XML de autorización */
  xml: string;
  autorizado: boolean;
  numeroAutorizacion?: string | null;
  /** ISO 8601 */
  fechaAutorizacion?: string | null;
  /** Nombre de la marca en el pie */
  generadoPor?: string;
}

const NEGRO = rgb(0.03, 0.09, 0.15);
const GRIS = rgb(0.37, 0.4, 0.44);
const BORDE = rgb(0.75, 0.78, 0.82);
const SUAVE = rgb(0.93, 0.95, 0.97);
const A4: [number, number] = [595.28, 841.89];
const M = 28;

const d2 = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const dN = (n: number) => {
  const s = (Number(n) || 0).toFixed(6).replace(/0+$/, '');
  return s.endsWith('.') ? `${s}00` : s.split('.')[1].length < 2 ? `${s}0` : s;
};

/** Solo caracteres que la fuente estándar (WinAnsi) puede dibujar */
function t(s: unknown): string {
  return String(s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '');
}

function partir(texto: string, fuente: PDFFont, tam: number, ancho: number): string[] {
  const palabras = t(texto).split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (fuente.widthOfTextAtSize(prueba, tam) <= ancho) actual = prueba;
    else {
      if (actual) lineas.push(actual);
      let resto = p;
      while (fuente.widthOfTextAtSize(resto, tam) > ancho) {
        let n = resto.length;
        while (n > 1 && fuente.widthOfTextAtSize(resto.slice(0, n), tam) > ancho) n--;
        lineas.push(resto.slice(0, n));
        resto = resto.slice(n);
      }
      actual = resto;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [''];
}

/** dd/mm/aaaa hh:mm:ss en hora de Ecuador */
export function fechaHoraEcuador(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 19)}`;
}

function codigoBarras(page: PDFPage, clave: string, x: number, y: number, ancho: number, alto: number) {
  const anchos = code128Widths(clave);
  const quiet = 10;
  const modulo = ancho / (anchos.reduce((s, v) => s + v, 0) + 2 * quiet);
  let cx = x + quiet * modulo;
  anchos.forEach((v, i) => {
    if (i % 2 === 0) page.drawRectangle({ x: cx, y, width: v * modulo, height: alto, color: rgb(0, 0, 0) });
    cx += v * modulo;
  });
}

export async function generarRide(input: RideInput): Promise<Uint8Array> {
  const c = leerFactura(input.xml);
  const numero = `${c.estab}-${c.ptoEmi}-${c.secuencial}`;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Factura ${numero}`);
  pdf.setProducer(input.generadoPor ?? 'Roomia PMS');
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const fb = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage(A4);
  const W = A4[0] - 2 * M;

  const texto = (p: PDFPage, s: string, x: number, y: number, tam = 8, negrita = false, color = NEGRO) =>
    p.drawText(t(s), { x, y, size: tam, font: negrita ? fb : f, color });
  const caja = (p: PDFPage, x: number, y: number, w: number, h: number) =>
    p.drawRectangle({ x, y, width: w, height: h, borderColor: BORDE, borderWidth: 0.8 });
  const derecha = (p: PDFPage, s: string, xDer: number, y: number, tam = 8, negrita = false) => {
    const fuente = negrita ? fb : f;
    p.drawText(t(s), { x: xDer - fuente.widthOfTextAtSize(t(s), tam), y, size: tam, font: fuente, color: NEGRO });
  };

  const top = A4[1] - M;
  const colIzq = W * 0.48;
  const colDer = W - colIzq - 10;

  // ---------- Emisor (izquierda) ----------
  const altoEmisor = 190;
  const yCaja = top - altoEmisor;
  caja(page, M, yCaja, colIzq, altoEmisor);
  let ye = top - 18;
  for (const l of partir(c.nombreComercial || c.razonSocial, fb, 11, colIzq - 16)) {
    texto(page, l, M + 8, ye, 11, true);
    ye -= 14;
  }
  if (c.nombreComercial && c.nombreComercial !== c.razonSocial) {
    for (const l of partir(c.razonSocial, f, 8.5, colIzq - 16)) {
      texto(page, l, M + 8, ye, 8.5);
      ye -= 11;
    }
  }
  ye -= 4;
  const filaEmisor = (rotulo: string, valor: string) => {
    texto(page, rotulo, M + 8, ye, 7, true, GRIS);
    ye -= 10;
    for (const l of partir(valor, f, 8, colIzq - 16)) {
      texto(page, l, M + 8, ye, 8);
      ye -= 10;
    }
    ye -= 2;
  };
  filaEmisor('Dirección matriz:', c.dirMatriz);
  if (c.dirEstablecimiento && c.dirEstablecimiento !== c.dirMatriz) filaEmisor('Dirección establecimiento:', c.dirEstablecimiento);
  if (c.contribuyenteEspecial) {
    texto(page, `Contribuyente especial Nro.: ${c.contribuyenteEspecial}`, M + 8, ye, 7.5);
    ye -= 11;
  }
  texto(page, `OBLIGADO A LLEVAR CONTABILIDAD: ${c.obligadoContabilidad || 'NO'}`, M + 8, ye, 7.5, true);
  ye -= 11;
  if (c.contribuyenteRimpe) {
    texto(page, c.contribuyenteRimpe, M + 8, ye, 7.5, true);
    ye -= 11;
  }
  if (c.agenteRetencion) texto(page, `Agente de retención Resolución No. ${c.agenteRetencion}`, M + 8, ye, 7.5);

  // ---------- Comprobante (derecha) ----------
  const xD = M + colIzq + 10;
  caja(page, xD, yCaja, colDer, altoEmisor);
  let yd = top - 18;
  texto(page, `R.U.C.: ${c.ruc}`, xD + 10, yd, 11, true);
  yd -= 18;
  texto(page, 'FACTURA', xD + 10, yd, 13, true);
  yd -= 15;
  texto(page, `No. ${numero}`, xD + 10, yd, 10, true);
  yd -= 16;
  texto(page, 'NÚMERO DE AUTORIZACIÓN', xD + 10, yd, 7.5, true, GRIS);
  yd -= 11;
  texto(page, input.numeroAutorizacion || 'PENDIENTE DE AUTORIZACIÓN', xD + 10, yd, 7.2);
  yd -= 14;
  texto(page, 'FECHA Y HORA DE AUTORIZACIÓN', xD + 10, yd, 7.5, true, GRIS);
  texto(page, input.fechaAutorizacion ? fechaHoraEcuador(input.fechaAutorizacion) : '-', xD + 150, yd, 8);
  yd -= 13;
  texto(page, 'AMBIENTE', xD + 10, yd, 7.5, true, GRIS);
  texto(page, c.ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS', xD + 150, yd, 8);
  yd -= 13;
  texto(page, 'EMISIÓN', xD + 10, yd, 7.5, true, GRIS);
  texto(page, 'NORMAL', xD + 150, yd, 8);
  yd -= 14;
  texto(page, 'CLAVE DE ACCESO', xD + 10, yd, 7.5, true, GRIS);
  const altoBarras = 34;
  yd -= altoBarras + 4;
  codigoBarras(page, c.claveAcceso, xD + 6, yd, colDer - 12, altoBarras);
  yd -= 10;
  texto(page, c.claveAcceso, xD + (colDer - f.widthOfTextAtSize(c.claveAcceso, 7.2)) / 2, yd, 7.2);

  // ---------- Comprador ----------
  const tipoId = TIPOS_IDENTIFICACION.find(x => x.value === c.tipoIdentificacionComprador)?.label;
  const filas: Array<[string, string]> = [
    ['Razón social / Nombres y apellidos:', c.razonSocialComprador],
    [`Identificación${tipoId ? ` (${tipoId})` : ''}:`, c.identificacionComprador],
    ['Fecha de emisión:', c.fechaEmision]
  ];
  if (c.direccionComprador) filas.push(['Dirección:', c.direccionComprador]);
  const altoComp = 10 + filas.length * 12;
  const yc = yCaja - 8 - altoComp;
  caja(page, M, yc, W, altoComp);
  let yy = yc + altoComp - 14;
  for (const [r, v] of filas) {
    texto(page, r, M + 8, yy, 7.5, true, GRIS);
    texto(page, partir(v, f, 8, W - 200)[0], M + 180, yy, 8);
    yy -= 12;
  }

  // ---------- Detalle ----------
  const cols = [
    { titulo: 'Cód. principal', ancho: 64, der: false },
    { titulo: 'Cant.', ancho: 40, der: true },
    { titulo: 'Descripción', ancho: W - 64 - 40 - 70 - 54 - 66, der: false },
    { titulo: 'Precio unitario', ancho: 70, der: true },
    { titulo: 'Descuento', ancho: 54, der: true },
    { titulo: 'Precio total', ancho: 66, der: true }
  ];
  const encabezado = (p: PDFPage, yTop: number) => {
    p.drawRectangle({ x: M, y: yTop - 16, width: W, height: 16, color: SUAVE });
    let x = M;
    for (const col of cols) {
      if (col.der) derecha(p, col.titulo, x + col.ancho - 4, yTop - 11, 7, true);
      else texto(p, col.titulo, x + 4, yTop - 11, 7, true);
      x += col.ancho;
    }
    return yTop - 16;
  };
  let yt = encabezado(page, yc - 8);
  for (const l of c.detalles) {
    const desc = partir(l.descripcion, f, 7.5, cols[2].ancho - 8);
    const alto = 6 + desc.length * 9;
    if (yt - alto < 200) {
      page = pdf.addPage(A4);
      yt = encabezado(page, A4[1] - M);
    }
    const yl = yt - 10;
    let x = M;
    texto(page, l.codigoPrincipal, x + 4, yl, 7.5);
    x += cols[0].ancho;
    derecha(page, dN(l.cantidad), x + cols[1].ancho - 4, yl, 7.5);
    x += cols[1].ancho;
    desc.forEach((d, i) => texto(page, d, x + 4, yl - i * 9, 7.5));
    x += cols[2].ancho;
    derecha(page, dN(l.precioUnitario), x + cols[3].ancho - 4, yl, 7.5);
    x += cols[3].ancho;
    derecha(page, d2(l.descuento), x + cols[4].ancho - 4, yl, 7.5);
    x += cols[4].ancho;
    derecha(page, d2(l.precioTotalSinImpuesto), x + cols[5].ancho - 4, yl, 7.5);
    yt -= alto;
    page.drawLine({ start: { x: M, y: yt }, end: { x: M + W, y: yt }, thickness: 0.4, color: BORDE });
  }

  // ---------- Información adicional, forma de pago y totales ----------
  if (yt < 220) {
    page = pdf.addPage(A4);
    yt = A4[1] - M;
  }
  const yPie = yt - 10;
  const anchoTot = 210;
  const xTot = M + W - anchoTot;
  const base = (cods: string[]) => c.impuestos.filter(i => cods.includes(i.codigoPorcentaje)).reduce((s, i) => s + i.baseImponible, 0);
  const gravados = c.impuestos.filter(i => (TARIFAS_IVA[i.codigoPorcentaje] ?? 0) > 0);
  const tarifas = [...new Set(gravados.map(i => TARIFAS_IVA[i.codigoPorcentaje]))];
  const porTarifa = (tf: number) => gravados.filter(i => TARIFAS_IVA[i.codigoPorcentaje] === tf);
  const filasTot: Array<[string, string]> = [];
  for (const tf of tarifas) filasTot.push([`SUBTOTAL ${tf}%`, d2(porTarifa(tf).reduce((s, i) => s + i.baseImponible, 0))]);
  filasTot.push(['SUBTOTAL 0%', d2(base(['0']))]);
  filasTot.push(['SUBTOTAL NO OBJETO DE IVA', d2(base(['6']))]);
  filasTot.push(['SUBTOTAL EXENTO DE IVA', d2(base(['7']))]);
  filasTot.push(['SUBTOTAL SIN IMPUESTOS', d2(c.totalSinImpuestos)]);
  filasTot.push(['TOTAL DESCUENTO', d2(c.totalDescuento)]);
  for (const tf of tarifas) filasTot.push([`IVA ${tf}%`, d2(porTarifa(tf).reduce((s, i) => s + i.valor, 0))]);
  filasTot.push(['PROPINA', d2(c.propina)]);
  filasTot.push(['VALOR TOTAL', d2(c.importeTotal)]);
  const altoTot = filasTot.length * 13 + 6;
  caja(page, xTot, yPie - altoTot, anchoTot, altoTot);
  let ytt = yPie - 13;
  filasTot.forEach(([r, v], i) => {
    const ultima = i === filasTot.length - 1;
    texto(page, r, xTot + 6, ytt, 7.5, ultima);
    derecha(page, v, xTot + anchoTot - 6, ytt, 8, ultima);
    ytt -= 13;
  });

  const anchoInfo = W - anchoTot - 10;
  let yi = yPie;
  if (c.infoAdicional.length) {
    const lineas = c.infoAdicional.flatMap(([k, v]) => partir(`${k}: ${v}`, f, 7.5, anchoInfo - 16));
    const alto = 20 + lineas.length * 10;
    caja(page, M, yi - alto, anchoInfo, alto);
    texto(page, 'Información adicional', M + 8, yi - 13, 8, true);
    lineas.forEach((l, i) => texto(page, l, M + 8, yi - 26 - i * 10, 7.5));
    yi -= alto + 8;
  }
  if (c.pagos.length) {
    const alto = 24 + c.pagos.length * 11;
    caja(page, M, yi - alto, anchoInfo, alto);
    texto(page, 'Forma de pago', M + 8, yi - 13, 8, true);
    derecha(page, 'Valor', M + anchoInfo - 8, yi - 13, 8, true);
    c.pagos.forEach((p, i) => {
      const nombre = FORMAS_PAGO.find(x => x.value === p.formaPago)?.label ?? 'Otros';
      texto(page, partir(`${p.formaPago} - ${nombre}`, f, 7, anchoInfo - 70)[0], M + 8, yi - 26 - i * 11, 7);
      derecha(page, d2(p.total), M + anchoInfo - 8, yi - 26 - i * 11, 7.5);
    });
  }

  // Marca de agua y pie en todas las hojas
  const paginas = pdf.getPages();
  const marca = c.ambiente !== '2' ? 'SIN VALIDEZ TRIBUTARIA' : !input.autorizado ? 'NO AUTORIZADA' : '';
  paginas.forEach((p, i) => {
    if (marca) {
      p.drawText(marca, { x: 120, y: 260, size: 40, font: fb, color: rgb(0.8, 0.83, 0.87), rotate: degrees(30), opacity: 0.35 });
    }
    p.drawText(t(`Documento generado por ${input.generadoPor ?? 'Roomia PMS'} · Consulte su validez en www.sri.gob.ec · Página ${i + 1} de ${paginas.length}`), {
      x: M,
      y: 16,
      size: 6.5,
      font: f,
      color: GRIS
    });
  });
  return await pdf.save();
}
