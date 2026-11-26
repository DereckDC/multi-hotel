import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import { buildClaveAcceso, isValidClaveAcceso, modulo11 } from '../supabase/functions/_shared/sri/claveAcceso.ts';
import { isValidCedula, isValidRuc, validarIdentificacion } from '../supabase/functions/_shared/sri/identificacion.ts';
import { buildFacturaXml, lineasDesdeImportes, validarFactura, type FacturaInput } from '../supabase/functions/_shared/sri/factura.ts';
import { firmarComprobante, NS_DS } from '../supabase/functions/_shared/sri/firma.ts';
import { cargarFirmanteP12 } from '../supabase/functions/_shared/sri/p12.ts';
import { envelopeRecepcion, parseAutorizacion, parseRecepcion } from '../supabase/functions/_shared/sri/soap.ts';
import { vistaPreviaFactura } from '../src/utils/sri.ts';
import { compradorDeHuesped, itemsDeReserva } from '../supabase/functions/_shared/sri/reserva.ts';
import { certificadoDelRuc } from '../supabase/functions/_shared/sri/p12.ts';
import { buildInvoiceData } from '../src/utils/invoiceData.ts';
import type { Hotel, Reservation, Room } from '../src/types.ts';

// ---------- Clave de acceso ----------

test('módulo 11: ejemplo de la ficha técnica del SRI', () => {
  assert.equal(modulo11('41261533'), 6);
  // Ejemplo de clave de acceso de la ficha técnica
  assert.ok(isValidClaveAcceso('0503201201176001321000110010030009900641234567814'));
  assert.ok(!isValidClaveAcceso('0503201201176001321000110010030009900641234567815'));
});

test('clave de acceso: 49 dígitos con cada parte en su sitio', () => {
  const clave = buildClaveAcceso({
    fechaEmision: '25/11/2026', tipoComprobante: '01', ruc: '1792146739001', ambiente: '1',
    estab: '001', ptoEmi: '002', secuencial: 15, codigoNumerico: '12345678'
  });
  assert.equal(clave.length, 49);
  assert.equal(clave.slice(0, 8), '25112026');
  assert.equal(clave.slice(8, 10), '01');
  assert.equal(clave.slice(10, 23), '1792146739001');
  assert.equal(clave[23], '1');
  assert.equal(clave.slice(24, 30), '001002');
  assert.equal(clave.slice(30, 39), '000000015');
  assert.equal(clave.slice(39, 47), '12345678');
  assert.equal(clave[47], '1');
  assert.ok(isValidClaveAcceso(clave));
  assert.throws(() => buildClaveAcceso({ fechaEmision: '2026-11-25', tipoComprobante: '01', ruc: '1792146739001', ambiente: '1', estab: '001', ptoEmi: '001', secuencial: 1, codigoNumerico: '12345678' }));
});

// ---------- Identificación ----------

test('cédula y RUC ecuatorianos', () => {
  assert.ok(isValidCedula('1710034065'));
  assert.ok(!isValidCedula('1710034066'));
  assert.ok(!isValidCedula('9910034065'));
  assert.ok(isValidRuc('1710034065001'));
  assert.ok(!isValidRuc('1710034065000'));
  assert.ok(isValidRuc('1792146739001')); // sociedad (tercer dígito 9)
  assert.equal(validarIdentificacion('07', '9999999999999'), null);
  assert.ok(validarIdentificacion('05', '123'));
});

// ---------- Factura ----------

const emisor: FacturaInput['emisor'] = {
  ambiente: '1', razonSocial: 'HOSTAL EL ÁRBOL & CÍA', nombreComercial: 'Hostal El Árbol', ruc: '1710034065001',
  estab: '001', ptoEmi: '001', dirMatriz: 'Av. Amazonas N23-45 y Veintimilla, Quito', obligadoContabilidad: false,
  regimen: 'rimpe_emprendedor'
};

const baseInput = (over: Partial<FacturaInput> = {}): FacturaInput => ({
  emisor,
  comprador: { tipoIdentificacion: '05', identificacion: '1710034065', razonSocial: 'Ana Pérez <Test>', email: 'ana@example.com' },
  fechaEmision: '25/11/2026',
  secuencial: 7,
  codigoNumerico: '87654321',
  lineas: lineasDesdeImportes([
    { codigo: 'HOSP', descripcion: 'Hospedaje · Suite', cantidad: 3, importe: 210 },
    { codigo: 'SERV1', descripcion: 'Desayuno', cantidad: 1, importe: 33.6 }
  ]),
  formaPago: '19',
  ...over
});

test('líneas con IVA 15 % incluido: base + IVA = lo cobrado, al centavo', () => {
  for (const importes of [[210, 33.6], [100], [99.99, 0.01, 12.34], [57.5, 57.5, 57.5]]) {
    const lineas = lineasDesdeImportes(importes.map((importe, i) => ({ codigo: `C${i}`, descripcion: 'x', cantidad: 1, importe })));
    const total = Math.round(importes.reduce((s, n) => s + n, 0) * 100) / 100;
    const suma = Math.round(lineas.reduce((s, l) => s + l.base + l.iva, 0) * 100) / 100;
    assert.equal(suma, total, `importes ${importes}`);
    for (const l of lineas) assert.equal(l.iva, Math.round(l.base * 15) / 100, 'IVA de cada línea = 15 % de su base');
  }
  const cero = lineasDesdeImportes([{ codigo: 'A', descripcion: 'Arriendo', cantidad: 1, importe: 300 }], '0');
  assert.deepEqual([cero[0].base, cero[0].iva, cero[0].tarifa], [300, 0, 0]);
});

test('XML de la factura 1.1.0: estructura, orden y totales', () => {
  const { xml, claveAcceso, totalSinImpuestos, totalIva, importeTotal } = buildFacturaXml(baseInput());
  assert.ok(xml.startsWith('<factura id="comprobante" version="1.1.0"><infoTributaria><ambiente>1</ambiente><tipoEmision>1</tipoEmision>'));
  assert.ok(!/>\s+</.test(xml), 'sin espacios entre etiquetas');
  assert.ok(!/\/>/.test(xml), 'sin etiquetas abreviadas');
  assert.ok(xml.includes(`<claveAcceso>${claveAcceso}</claveAcceso><codDoc>01</codDoc><estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000007</secuencial>`));
  assert.ok(xml.includes('<razonSocial>HOSTAL EL ÁRBOL &amp; CÍA</razonSocial>'));
  assert.ok(xml.includes('<razonSocialComprador>Ana Pérez &lt;Test&gt;</razonSocialComprador>'));
  assert.ok(xml.includes('<contribuyenteRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</contribuyenteRimpe></infoTributaria>'));
  assert.ok(xml.includes('<obligadoContabilidad>NO</obligadoContabilidad><tipoIdentificacionComprador>05</tipoIdentificacionComprador>'));
  assert.ok(xml.includes('<moneda>DOLAR</moneda><pagos><pago><formaPago>19</formaPago>'));
  assert.ok(xml.includes('<cantidad>3.000000</cantidad>'));
  assert.ok(xml.includes('<campoAdicional nombre="Email">ana@example.com</campoAdicional>'));
  assert.equal(importeTotal, 243.6);
  assert.equal(Math.round((totalSinImpuestos + totalIva) * 100) / 100, 243.6);
  assert.ok(xml.includes(`<totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje><baseImponible>${totalSinImpuestos.toFixed(2)}</baseImponible><valor>${totalIva.toFixed(2)}</valor></totalImpuesto>`));
  // Orden de infoFactura según la ficha técnica
  const orden = ['fechaEmision', 'obligadoContabilidad', 'tipoIdentificacionComprador', 'razonSocialComprador', 'identificacionComprador', 'totalSinImpuestos', 'totalDescuento', 'totalConImpuestos', 'propina', 'importeTotal', 'moneda', 'pagos'];
  const pos = orden.map(t => xml.indexOf(`<${t}>`));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos);
  assert.ok(isValidClaveAcceso(claveAcceso));
});

test('texto del XML sin emojis ni símbolos que el SRI rechaza (error 39)', () => {
  const { xml } = buildFacturaXml(baseInput({
    emisor: { ...emisor, nombreComercial: 'Eco Glamping 🍃', dirMatriz: 'Baños “centro” – Ñuñoa ☀️' }
  }));
  assert.ok(xml.includes('<nombreComercial>Eco Glamping</nombreComercial>'));
  assert.ok(xml.includes('<dirMatriz>Baños "centro" - Ñuñoa</dirMatriz>'));
  assert.ok([...xml].every(ch => ch.codePointAt(0)! <= 0x17f || ch === '·'), 'solo caracteres latinos');
});

test('consumidor final: hasta $50 y con los datos genéricos', () => {
  const lineas = lineasDesdeImportes([{ codigo: 'HOSP', descripcion: 'Hospedaje', cantidad: 1, importe: 45 }]);
  const cf = baseInput({ lineas, comprador: { tipoIdentificacion: '07', identificacion: '9999999999999', razonSocial: 'cualquiera' } });
  const { xml } = buildFacturaXml(cf);
  assert.ok(xml.includes('<razonSocialComprador>CONSUMIDOR FINAL</razonSocialComprador><identificacionComprador>9999999999999</identificacionComprador>'));
  const caro = { ...cf, lineas: lineasDesdeImportes([{ codigo: 'HOSP', descripcion: 'Hospedaje', cantidad: 1, importe: 50.01 }]) };
  assert.ok(validarFactura(caro).some(e => e.includes('consumidor final')));
  assert.throws(() => buildFacturaXml(caro));
});

// ---------- Firma XAdES-BES ----------

function p12DePrueba(password: string) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = forge.pki.privateKeyFromPem(privateKey.export({ type: 'pkcs1', format: 'pem' }) as string);
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.setRsaPublicKey(key.n, key.e);
  cert.serialNumber = '0a1b2c3d';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2028-01-01T00:00:00Z');
  const attrs = [{ shortName: 'C', value: 'EC' }, { shortName: 'O', value: 'ROOMIA PRUEBAS' }, { shortName: 'CN', value: 'ANA PEREZ' }];
  cert.setSubject(attrs);
  cert.setIssuer([{ shortName: 'C', value: 'EC' }, { shortName: 'O', value: 'ENTIDAD DE PRUEBA' }, { shortName: 'CN', value: 'AC PRUEBA' }]);
  cert.setExtensions([{ name: 'keyUsage', digitalSignature: true, nonRepudiation: true }]);
  cert.sign(key, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], password, { algorithm: '3des' });
  return { p12: forge.util.encode64(forge.asn1.toDer(asn1).getBytes()), certPem: forge.pki.certificateToPem(cert) };
}

const { p12, certPem } = p12DePrueba('clave-de-prueba');

function verificar(xml: string): { ok: boolean; errors: string[] } {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const node = doc.getElementsByTagNameNS(NS_DS, 'Signature')[0];
  const sig = new SignedXml({ publicCert: certPem });
  sig.loadSignature(node as unknown as Node);
  try {
    const ok = sig.checkSignature(xml);
    return { ok, errors: [] };
  } catch (error) {
    return { ok: false, errors: [String((error as Error).message)] };
  }
}

test('.p12: carga el certificado y rechaza una contraseña incorrecta', () => {
  const firmante = cargarFirmanteP12(forge, p12, 'clave-de-prueba');
  assert.equal(firmante.info.titular, 'ANA PEREZ');
  assert.equal(firmante.issuerName, 'CN=AC PRUEBA,O=ENTIDAD DE PRUEBA,C=EC');
  assert.equal(firmante.serialNumber, String(0x0a1b2c3d));
  assert.equal(firmante.exponentBase64, 'AQAB');
  assert.throws(() => cargarFirmanteP12(forge, p12, 'otra'), /contraseña/);
});

test('firma XAdES-BES: la valida una librería independiente (xml-crypto, C14N inclusiva)', () => {
  const firmante = cargarFirmanteP12(forge, p12, 'clave-de-prueba');
  const { xml } = buildFacturaXml(baseInput());
  const firmado = firmarComprobante(xml, firmante, { signingTime: new Date('2026-11-25T15:30:00Z') });
  assert.ok(firmado.startsWith('<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0">'));
  assert.ok(firmado.endsWith('</ds:Signature></factura>'));
  assert.ok(firmado.includes('<etsi:SigningTime>2026-11-25T10:30:00-05:00</etsi:SigningTime>'));
  assert.ok(firmado.includes('<ds:Reference Id="') && firmado.includes('URI="#comprobante"'));
  const r = verificar(firmado);
  assert.ok(r.ok, r.errors.join(' '));

  // Si se cambia un valor del comprobante después de firmar, la firma deja de valer
  const alterado = firmado.replace('<importeTotal>243.60</importeTotal>', '<importeTotal>243.61</importeTotal>');
  assert.notEqual(alterado, firmado);
  assert.equal(verificar(alterado).ok, false);
  // Lo mismo con las propiedades firmadas (hora de la firma) y con el certificado incluido
  assert.equal(verificar(firmado.replace('10:30:00-05:00', '10:31:00-05:00')).ok, false);
  assert.equal(verificar(firmado.replace('<ds:Exponent>AQAB</ds:Exponent>', '<ds:Exponent>AQAC</ds:Exponent>')).ok, false);
});

// ---------- Servicios web ----------

test('SOAP: sobre de recepción con el XML en base64 UTF-8', () => {
  const env = envelopeRecepcion('<a>ñ</a>');
  assert.ok(env.includes('<ec:validarComprobante><xml>PGE+w7E8L2E+</xml></ec:validarComprobante>'));
});

test('SOAP: respuestas de recepción y autorización', () => {
  const devuelta = parseRecepcion(
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>DEVUELTA</estado><comprobantes><comprobante><claveAcceso>123</claveAcceso><mensajes><mensaje><identificador>43</identificador><mensaje>CLAVE ACCESO REGISTRADA</mensaje><informacionAdicional>La clave ya fue registrada</informacionAdicional><tipo>ERROR</tipo></mensaje></mensajes></comprobante></comprobantes></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse></soap:Body></soap:Envelope>'
  );
  assert.equal(devuelta.estado, 'DEVUELTA');
  assert.deepEqual(devuelta.mensajes, [{ identificador: '43', mensaje: 'CLAVE ACCESO REGISTRADA', informacionAdicional: 'La clave ya fue registrada', tipo: 'ERROR' }]);

  const autorizado = parseAutorizacion(
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>123</claveAccesoConsultada><numeroComprobantes>1</numeroComprobantes><autorizaciones><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>2511202601171003406500110010010000000078765432112</numeroAutorizacion><fechaAutorizacion>2026-11-25T10:31:02-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante><![CDATA[<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante"><estado>x</estado></factura>]]></comprobante><mensajes><mensaje><identificador>60</identificador><mensaje>ESTE PROCESO FUE REALIZADO EN EL AMBIENTE DE PRUEBAS</mensaje><tipo>ADVERTENCIA</tipo></mensaje></mensajes></autorizacion></autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>'
  );
  assert.equal(autorizado.estado, 'AUTORIZADO');
  assert.equal(autorizado.ambiente, 'PRUEBAS');
  assert.ok(autorizado.comprobante?.startsWith('<?xml'));
  assert.equal(autorizado.mensajes[0].identificador, '60');

  const conEntidades = parseAutorizacion('<autorizaciones><autorizacion><estado>NO AUTORIZADO</estado><comprobante>&lt;factura&gt;&lt;/factura&gt;</comprobante><mensajes><mensaje><identificador>39</identificador><mensaje>FIRMA INVALIDA</mensaje><tipo>ERROR</tipo></mensaje></mensajes></autorizacion></autorizaciones>');
  assert.equal(conEntidades.estado, 'NO AUTORIZADO');
  assert.equal(conEntidades.comprobante, '<factura></factura>');
  assert.equal(conEntidades.mensajes[0].mensaje, 'FIRMA INVALIDA');

  assert.equal(parseAutorizacion('<RespuestaAutorizacionComprobante><numeroComprobantes>0</numeroComprobantes><autorizaciones></autorizaciones></RespuestaAutorizacionComprobante>').estado, 'NO ENCONTRADO');
  assert.throws(() => parseRecepcion('<soap:Fault><faultstring>Error interno</faultstring></soap:Fault>'), /Error interno/);
});

// ---------- Reserva → factura ----------

test('reserva → líneas facturables (sin la garantía del alquiler)', () => {
  const hotel = { id: 'h1', nombre: 'Hostal', tipoEstablecimiento: 'hotel' } as unknown as Hotel;
  const room = { id: 'r1', numero: '101', nombre: 'Suite', tipo: 'Suite' } as unknown as Room;
  const reserva = {
    id: 'R1', hotelId: 'h1', roomId: 'r1', guestId: 'u1', fechaEntrada: '2026-11-20', fechaSalida: '2026-11-23',
    serviciosAdicionales: ['Desayuno (2 pers x 3 días - $30.00)'], subtotal: 211.83, impuestos: 31.77, total: 243.6, estado: 'confirmada'
  } as unknown as Reservation;
  const r = vistaPreviaFactura(reserva, hotel, room);
  assert.equal(r.total, 243.6);
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].codigo, 'HOSP');
  assert.equal(r.items[0].cantidad, 3);
  assert.equal(r.items[0].descripcion, 'Hospedaje · Suite · Hab. 101 · 3 noches');
  assert.equal(Math.round(r.items.reduce((s, i) => s + i.importe, 0) * 100) / 100, 243.6);
  // El mismo cálculo con los datos tal como los lee el servidor de la base
  const servidor = itemsDeReserva({ id: 'R1', total: 243.6, subtotal: 211.83, impuestos: 31.77, noches: 3, servicios: reserva.serviciosAdicionales!, esAlquiler: false, habitacion: 'Suite · Hab. 101' });
  assert.deepEqual(servidor.items, r.items);

  const casa = { id: 'c1', nombre: 'Casa', tipoEstablecimiento: 'casa', finalidad: 'alquiler', detallesInmueble: { precio: 400 } } as unknown as Hotel;
  const alquiler = { ...reserva, hotelId: 'c1', roomId: '', fechaSalida: '2027-05-20', serviciosAdicionales: [], subtotal: 800, impuestos: 60, total: 860 } as unknown as Reservation;
  const a = vistaPreviaFactura(alquiler, casa);
  assert.equal(a.garantia, 400);
  assert.equal(a.total, 460);
  assert.deepEqual(a.items.map(i => i.codigo), ['ALQ']);
  // La prefactura deduce la misma garantía
  assert.equal(buildInvoiceData(alquiler, casa).lineas[1].importe, 400);
});

test('cliente de la factura a partir del huésped', () => {
  assert.equal(compradorDeHuesped({ nombre: 'Ana', apellido: 'Pérez', documento: '1710034065', email: 'a@x.com' }, 200).tipoIdentificacion, '05');
  assert.equal(compradorDeHuesped({ nombre: 'Hotel', apellido: 'SA', documento: '1792146739001' }, 200).tipoIdentificacion, '04');
  assert.equal(compradorDeHuesped({ nombre: 'John', apellido: 'Doe', documento: 'X1234567' }, 200).tipoIdentificacion, '06');
  const cf = compradorDeHuesped({ nombre: 'Sin', apellido: 'Documento', email: 'c@x.com' }, 30);
  assert.deepEqual([cf.tipoIdentificacion, cf.identificacion, cf.razonSocial, cf.email], ['07', '9999999999999', 'CONSUMIDOR FINAL', 'c@x.com']);
  // Sin documento y más de $50: queda con los datos incompletos para que el personal los complete
  const falta = compradorDeHuesped({ nombre: 'Sin', apellido: 'Documento' }, 80);
  assert.ok(validarIdentificacion(falta.tipoIdentificacion, falta.identificacion));
});

test('firma: comprueba que pertenece al RUC del emisor', () => {
  assert.ok(certificadoDelRuc({ identificaciones: ['1710034065'] }, '1710034065001'));
  assert.ok(certificadoDelRuc({ identificaciones: ['1792146739001'] }, '1792146739001'));
  assert.ok(!certificadoDelRuc({ identificaciones: ['0912345678'] }, '1710034065001'));
  const firmante = cargarFirmanteP12(forge, p12, 'clave-de-prueba');
  assert.deepEqual(firmante.identificaciones, []); // el certificado de prueba no trae cédula
});

// ---------- RIDE: código de barras, lectura del XML y PDF ----------

import { CODE128_PATTERNS, code128Checksum, code128Values, code128Widths } from '../supabase/functions/_shared/sri/codigoBarras.ts';
import { leerFactura } from '../supabase/functions/_shared/sri/leerXml.ts';
import { generarRide } from '../supabase/functions/_shared/sri/ride.ts';
import { PDFDocument } from 'pdf-lib';
import { validateAttachments } from '../emailGuard.ts';

test('Code 128: tabla completa y clave de 49 dígitos', () => {
  assert.equal(CODE128_PATTERNS.length, 107);
  CODE128_PATTERNS.forEach((p, i) => assert.equal([...p].reduce((s, d) => s + Number(d), 0), i === 106 ? 13 : 11, `símbolo ${i}`));
  const clave = '0503201201176001321000110010030009900641234567814';
  const values = code128Values(clave);
  assert.equal(values[0], 105); // inicio juego C
  assert.equal(values.length, 1 + 24 + 2); // 24 pares + cambio a B + último dígito
  assert.deepEqual(values.slice(-2), [100, 20]); // juego B, "4"
  assert.equal(code128Checksum([105, 12, 34]), (105 + 12 + 34 * 2) % 103);
  const widths = code128Widths(clave);
  assert.equal(widths.reduce((s, w) => s + w, 0), 11 * (values.length + 1) + 13);
});

test('RIDE: lee del XML firmado lo que se imprime', () => {
  const firmante = cargarFirmanteP12(forge, p12, 'clave-de-prueba');
  const { xml } = buildFacturaXml(baseInput());
  const f = leerFactura(firmarComprobante(xml, firmante));
  assert.equal(f.razonSocial, 'HOSTAL EL ÁRBOL & CÍA');
  assert.equal(f.razonSocialComprador, 'Ana Pérez <Test>');
  assert.equal(f.secuencial, '000000007');
  assert.equal(f.importeTotal, 243.6);
  assert.equal(f.detalles.length, 2);
  assert.equal(f.detalles[0].cantidad, 3);
  assert.deepEqual(f.pagos, [{ formaPago: '19', total: 243.6 }]);
  assert.deepEqual(f.infoAdicional[0], ['Email', 'ana@example.com']);
  assert.equal(f.impuestos[0].codigoPorcentaje, '4');
  // También desde el XML de autorización (comprobante en CDATA)
  const aut = `<?xml version="1.0" encoding="UTF-8"?><autorizacion><estado>AUTORIZADO</estado><comprobante><![CDATA[${xml}]]></comprobante></autorizacion>`;
  assert.equal(leerFactura(aut).claveAcceso, f.claveAcceso);
});

test('RIDE en PDF (pdf-lib, el mismo en navegador y servidor)', async () => {
  const firmante = cargarFirmanteP12(forge, p12, 'clave-de-prueba');
  const firmado = firmarComprobante(buildFacturaXml(baseInput()).xml, firmante);
  const bytes = await generarRide({ xml: firmado, autorizado: true, numeroAutorizacion: '1'.repeat(49), fechaAutorizacion: '2026-11-25T15:30:00Z' });
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('latin1'), '%PDF-');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(pdf.getTitle()?.startsWith('Factura 001-001-000000007'));
  // Muchas líneas: pasa a una segunda hoja sin romperse
  const largas = baseInput({ lineas: lineasDesdeImportes(Array.from({ length: 60 }, (_, i) => ({ codigo: `S${i}`, descripcion: `Servicio adicional número ${i} con una descripción larga para probar el corte de líneas`, cantidad: 1, importe: 1.5 }))) });
  const largo = await generarRide({ xml: firmarComprobante(buildFacturaXml(largas).xml, firmante), autorizado: false });
  assert.ok((await PDFDocument.load(largo)).getPageCount() >= 2);
});

test('correo: adjuntos solo XML o PDF de verdad y con tamaño acotado', () => {
  const b64 = (s: string) => Buffer.from(s).toString('base64');
  const ok = validateAttachments([{ filename: 'Factura 001-001-000000007.xml', content: b64('<?xml version="1.0"?><a/>') }, { filename: 'Factura.pdf', content: b64('%PDF-1.4 ...') }]);
  assert.equal(ok.ok, true);
  assert.equal(validateAttachments(undefined).ok, true);
  assert.equal(validateAttachments([{ filename: 'virus.exe', content: b64('MZ') }]).ok, false);
  assert.equal(validateAttachments([{ filename: 'falso.pdf', content: b64('<html>') }]).ok, false);
  assert.equal(validateAttachments(new Array(4).fill({ filename: 'a.xml', content: b64('<a/>') })).ok, false);
  assert.equal(validateAttachments([{ filename: 'grande.pdf', content: Buffer.alloc(2_100_000, 37).toString('base64') }]).ok, false);
});
