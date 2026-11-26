/**
 * Firma XAdES-BES (v1.3.2) de comprobantes electrónicos, como pide el SRI (ficha técnica offline
 * v2.32, numeral 6 y anexo 14): firma envuelta (enveloped) dentro del comprobante, RSA-SHA1,
 * resúmenes SHA1 y el certificado incluido y firmado en KeyInfo.
 *
 * Todo el XML se escribe directamente en forma canónica (C14N inclusiva 1.0): sin espacios
 * entre etiquetas, sin etiquetas vacías abreviadas y con los atributos ordenados. Así el texto
 * que se resume es idéntico al que el SRI canoniza al validar.
 *
 * Las operaciones criptográficas llegan por parámetro (`Firmante`) para que este módulo sirva
 * igual en la función del servidor (Deno) y en las pruebas (Node).
 */

export const NS_DS = 'http://www.w3.org/2000/09/xmldsig#';
export const NS_ETSI = 'http://uri.etsi.org/01903/v1.3.2#';
const ALG_C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ALG_RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const ALG_SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const ALG_ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

export interface Firmante {
  /** SHA1 del texto en UTF-8, en base64 */
  sha1Base64(text: string): string;
  /** Firma RSA-SHA1 del texto en UTF-8, en base64 */
  signBase64(text: string): string;
  /** Certificado del firmante (DER) en base64 */
  certificateBase64: string;
  /** SHA1 del certificado DER, en base64 */
  certificateDigestBase64: string;
  /** Emisor del certificado, p. ej. "CN=AC ...,OU=...,O=...,C=EC" */
  issuerName: string;
  /** Número de serie del certificado en decimal */
  serialNumber: string;
  modulusBase64: string;
  exponentBase64: string;
}

export interface FirmaOptions {
  /** Hora de la firma; por defecto ahora */
  signingTime?: Date;
  /** Generador de números para los identificadores; por defecto Math.random */
  random?: () => number;
}

const DS_ATTRS = `xmlns:ds="${NS_DS}" xmlns:etsi="${NS_ETSI}"`;

/** Fecha y hora de Ecuador (UTC-5) en formato xsd:dateTime con zona */
export function signingTimeEcuador(date: Date): string {
  const d = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}-05:00`
  );
}

const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Firma el comprobante. `xml` es el elemento raíz (sin declaración XML) en forma canónica, con
 * id="comprobante", tal como lo arma `buildFacturaXml`. Devuelve el documento firmado con la
 * declaración XML.
 */
export function firmarComprobante(xml: string, firmante: Firmante, options: FirmaOptions = {}): string {
  const rootMatch = /^<([A-Za-z]+)\s[^>]*id="comprobante"[^>]*>/.exec(xml);
  if (!rootMatch) throw new Error('El comprobante debe empezar con su elemento raíz con id="comprobante".');
  const rootName = rootMatch[1];
  const closing = `</${rootName}>`;
  if (!xml.endsWith(closing)) throw new Error('El comprobante no termina con su etiqueta de cierre.');

  const random = options.random ?? Math.random;
  const id = () => String(Math.floor(random() * 900000) + 100000);
  const signatureId = `Signature${id()}`;
  const signedInfoId = `Signature-SignedInfo${id()}`;
  const signedPropertiesId = `${signatureId}-SignedProperties${id()}`;
  const signedPropertiesRefId = `SignedPropertiesID${id()}`;
  const certificateId = `Certificate${id()}`;
  const referenceId = `Reference-ID-${id()}`;
  const signatureValueId = `SignatureValue${id()}`;
  const objectId = `${signatureId}-Object${id()}`;

  // 1. Resumen del comprobante (la transformación enveloped quita la firma, que aún no está)
  const comprobanteDigest = firmante.sha1Base64(xml);

  // 2. Propiedades firmadas (XAdES-BES)
  const signedPropertiesInner =
    '<etsi:SignedSignatureProperties>' +
    `<etsi:SigningTime>${signingTimeEcuador(options.signingTime ?? new Date())}</etsi:SigningTime>` +
    '<etsi:SigningCertificate><etsi:Cert><etsi:CertDigest>' +
    `<ds:DigestMethod Algorithm="${ALG_SHA1}"></ds:DigestMethod>` +
    `<ds:DigestValue>${firmante.certificateDigestBase64}</ds:DigestValue>` +
    '</etsi:CertDigest><etsi:IssuerSerial>' +
    `<ds:X509IssuerName>${escapeText(firmante.issuerName)}</ds:X509IssuerName>` +
    `<ds:X509SerialNumber>${firmante.serialNumber}</ds:X509SerialNumber>` +
    '</etsi:IssuerSerial></etsi:Cert></etsi:SigningCertificate>' +
    '</etsi:SignedSignatureProperties>' +
    '<etsi:SignedDataObjectProperties>' +
    `<etsi:DataObjectFormat ObjectReference="#${referenceId}">` +
    '<etsi:Description>contenido comprobante</etsi:Description>' +
    '<etsi:MimeType>text/xml</etsi:MimeType>' +
    '</etsi:DataObjectFormat>' +
    '</etsi:SignedDataObjectProperties>';
  const signedProperties = `<etsi:SignedProperties Id="${signedPropertiesId}">${signedPropertiesInner}</etsi:SignedProperties>`;
  // Canónico: el subconjunto hereda las declaraciones de espacio de nombres de ds:Signature
  const signedPropertiesDigest = firmante.sha1Base64(
    `<etsi:SignedProperties ${DS_ATTRS} Id="${signedPropertiesId}">${signedPropertiesInner}</etsi:SignedProperties>`
  );

  // 3. KeyInfo con el certificado (también firmado)
  const keyInfoInner =
    `<ds:X509Data><ds:X509Certificate>${firmante.certificateBase64}</ds:X509Certificate></ds:X509Data>` +
    '<ds:KeyValue><ds:RSAKeyValue>' +
    `<ds:Modulus>${firmante.modulusBase64}</ds:Modulus>` +
    `<ds:Exponent>${firmante.exponentBase64}</ds:Exponent>` +
    '</ds:RSAKeyValue></ds:KeyValue>';
  const keyInfo = `<ds:KeyInfo Id="${certificateId}">${keyInfoInner}</ds:KeyInfo>`;
  const keyInfoDigest = firmante.sha1Base64(`<ds:KeyInfo ${DS_ATTRS} Id="${certificateId}">${keyInfoInner}</ds:KeyInfo>`);

  // 4. SignedInfo con las tres referencias
  const signedInfoInner =
    `<ds:CanonicalizationMethod Algorithm="${ALG_C14N}"></ds:CanonicalizationMethod>` +
    `<ds:SignatureMethod Algorithm="${ALG_RSA_SHA1}"></ds:SignatureMethod>` +
    `<ds:Reference Id="${signedPropertiesRefId}" Type="http://uri.etsi.org/01903#SignedProperties" URI="#${signedPropertiesId}">` +
    `<ds:DigestMethod Algorithm="${ALG_SHA1}"></ds:DigestMethod>` +
    `<ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue>` +
    '</ds:Reference>' +
    `<ds:Reference URI="#${certificateId}">` +
    `<ds:DigestMethod Algorithm="${ALG_SHA1}"></ds:DigestMethod>` +
    `<ds:DigestValue>${keyInfoDigest}</ds:DigestValue>` +
    '</ds:Reference>' +
    `<ds:Reference Id="${referenceId}" URI="#comprobante">` +
    `<ds:Transforms><ds:Transform Algorithm="${ALG_ENVELOPED}"></ds:Transform></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="${ALG_SHA1}"></ds:DigestMethod>` +
    `<ds:DigestValue>${comprobanteDigest}</ds:DigestValue>` +
    '</ds:Reference>';
  const signedInfo = `<ds:SignedInfo Id="${signedInfoId}">${signedInfoInner}</ds:SignedInfo>`;

  // 5. Valor de la firma sobre SignedInfo canonizado
  const signatureValue = firmante.signBase64(`<ds:SignedInfo ${DS_ATTRS} Id="${signedInfoId}">${signedInfoInner}</ds:SignedInfo>`);

  const signature =
    `<ds:Signature ${DS_ATTRS} Id="${signatureId}">` +
    signedInfo +
    `<ds:SignatureValue Id="${signatureValueId}">${signatureValue}</ds:SignatureValue>` +
    keyInfo +
    `<ds:Object Id="${objectId}"><etsi:QualifyingProperties Target="#${signatureId}">${signedProperties}</etsi:QualifyingProperties></ds:Object>` +
    '</ds:Signature>';

  return `<?xml version="1.0" encoding="UTF-8"?>${xml.slice(0, -closing.length)}${signature}${closing}`;
}
