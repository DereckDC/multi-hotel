/**
 * Lectura del archivo de firma electrónica (.p12 / PKCS#12) del emisor con node-forge.
 * El módulo de forge llega por parámetro: en la función del servidor es `npm:node-forge` y en
 * las pruebas `node-forge`.
 *
 * Algunos .p12 de entidades ecuatorianas traen varias llaves y certificados (cadena de la
 * entidad, llave de cifrado y de firma): se usa el certificado cuya llave pública coincide con
 * una llave privada del archivo y que permite firmar, el de vigencia más larga si hay varios.
 */
import type { Firmante } from './firma.ts';

export interface CertificadoInfo {
  /** Nombre del titular (CN) */
  titular: string;
  /** Sujeto completo, p. ej. "CN=...,O=...,C=EC" */
  sujeto: string;
  emisor: string;
  serie: string;
  validoDesde: string;
  validoHasta: string;
}

export interface FirmanteP12 extends Firmante {
  info: CertificadoInfo;
  /** Cédulas o RUC que aparecen en el certificado */
  identificaciones: string[];
}

/**
 * Cédulas o RUC presentes en el certificado. Las entidades ecuatorianas los guardan en distintos
 * lugares (serialNumber del sujeto o extensiones propias), así que se revisan todos.
 */
function identificacionesDe(cert: Forge): string[] {
  const textos: string[] = [];
  for (const a of cert.subject.attributes ?? []) textos.push(String(a.value ?? ''));
  for (const ext of cert.extensions ?? []) {
    if (typeof ext.value === 'string') textos.push(ext.value.replace(/[^\x20-\x7e]/g, ' '));
  }
  const encontrados = new Set<string>();
  for (const t of textos) for (const m of t.match(/\d{10}(?:\d{3})?/g) ?? []) encontrados.add(m);
  return [...encontrados];
}

/** El certificado pertenece al RUC (o a la cédula del titular de un RUC de persona natural) */
export function certificadoDelRuc(f: Pick<FirmanteP12, 'identificaciones'>, ruc: string): boolean {
  return f.identificaciones.some(x => x === ruc || x === ruc.slice(0, 10));
}

// deno-lint-ignore no-explicit-any
type Forge = any;

function hexToBase64(forge: Forge, hex: string): string {
  const clean = hex.length % 2 ? `0${hex}` : hex;
  return forge.util.encode64(forge.util.hexToBytes(clean));
}

/** Atributos del nombre en el orden de RFC 2253 (del más específico al más general) */
function distinguishedName(attributes: Array<{ shortName?: string; name?: string; type: string; value: string }>): string {
  return [...attributes]
    .reverse()
    .map(a => `${a.shortName || a.name || a.type}=${String(a.value).replace(/([,+"\\<>;])/g, '\\$1')}`)
    .join(',');
}

export function cargarFirmanteP12(forge: Forge, p12Base64: string, password: string): FirmanteP12 {
  let p12: Forge;
  try {
    const der = forge.util.decode64(p12Base64.replace(/\s+/g, ''));
    const asn1 = forge.asn1.fromDer(der);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch (error) {
    const message = String((error as Error)?.message || error);
    if (/mac|password|decrypt|invalid/i.test(message)) throw new Error('La contraseña de la firma electrónica no es correcta.');
    throw new Error('El archivo no es una firma electrónica .p12 válida.');
  }

  const keys: Forge[] = [];
  for (const type of [forge.pki.oids.pkcs8ShroudedKeyBag, forge.pki.oids.keyBag]) {
    for (const bag of p12.getBags({ bagType: type })[type] ?? []) if (bag.key) keys.push(bag.key);
  }
  const certs: Forge[] = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [])
    .map((bag: Forge) => bag.cert)
    .filter(Boolean);
  if (!keys.length) throw new Error('El archivo de firma no contiene la llave privada.');
  if (!certs.length) throw new Error('El archivo de firma no contiene el certificado.');

  const candidates: Array<{ key: Forge; cert: Forge }> = [];
  for (const cert of certs) {
    const key = keys.find(k => k.n && cert.publicKey?.n && k.n.equals(cert.publicKey.n));
    if (!key) continue;
    const usage = cert.getExtension?.('keyUsage');
    if (usage && usage.digitalSignature === false && usage.nonRepudiation === false) continue;
    candidates.push({ key, cert });
  }
  if (!candidates.length) throw new Error('No se encontró un certificado de firma que corresponda a la llave del archivo.');
  candidates.sort((a, b) => b.cert.validity.notAfter.getTime() - a.cert.validity.notAfter.getTime());
  const { key, cert } = candidates[0];

  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const sha1 = (bytes: string) => {
    const md = forge.md.sha1.create();
    md.update(bytes);
    return md.digest().getBytes();
  };
  const cn = cert.subject.getField('CN')?.value ?? '';

  return {
    sha1Base64: (text: string) => forge.util.encode64(sha1(forge.util.encodeUtf8(text))),
    signBase64: (text: string) => {
      const md = forge.md.sha1.create();
      md.update(text, 'utf8');
      return forge.util.encode64(key.sign(md));
    },
    certificateBase64: forge.util.encode64(certDer),
    certificateDigestBase64: forge.util.encode64(sha1(certDer)),
    issuerName: distinguishedName(cert.issuer.attributes),
    serialNumber: BigInt(`0x${cert.serialNumber}`).toString(10),
    modulusBase64: hexToBase64(forge, key.n.toString(16)),
    exponentBase64: hexToBase64(forge, key.e.toString(16)),
    identificaciones: identificacionesDe(cert),
    info: {
      titular: String(cn),
      sujeto: distinguishedName(cert.subject.attributes),
      emisor: distinguishedName(cert.issuer.attributes),
      serie: BigInt(`0x${cert.serialNumber}`).toString(10),
      validoDesde: cert.validity.notBefore.toISOString(),
      validoHasta: cert.validity.notAfter.toISOString()
    }
  };
}
