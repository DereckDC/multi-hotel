/**
 * Validaciones del envío de correo para el servidor Express (server.ts).
 *
 * La función serverless de Vercel (api/send-email.ts) aplica las MISMAS reglas, pero
 * las lleva copiadas dentro del propio archivo a propósito: así no depende de importar
 * módulos vecinos, que es una causa habitual de fallos al desplegar en Vercel.
 * Si cambias una regla aquí, cámbiala también allí.
 *
 * El endpoint tiene que seguir aceptando llamadas sin sesión (correo de bienvenida al
 * registrarse, aviso de cambio de contraseña), así que no se puede exigir login. Lo que
 * sí se limita es para qué se puede usar: un único destinatario válido por llamada,
 * tamaños acotados y un tope de envíos por IP.
 */

const EMAIL_REGEX = /^[^\s@<>,;:"'()\[\]\\]+@[^\s@<>,;:"'()\[\]\\]+\.[^\s@<>,;:"'()\[\]\\]{2,}$/;

const MAX_SUBJECT_LENGTH = 250;
const MAX_TEXT_LENGTH = 20_000;
const MAX_HTML_LENGTH = 500_000;

export interface ValidEmailRequest {
  ok: true;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface InvalidEmailRequest {
  ok: false;
  error: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateEmailRequest(body: any): ValidEmailRequest | InvalidEmailRequest {
  const { to, subject, html, text } = body || {};

  if (typeof to !== 'string' || !to.trim()) {
    return { ok: false, error: 'Faltan datos obligatorios (destinatario, asunto)' };
  }

  // Un solo destinatario por llamada: impide usar el servidor para envíos masivos
  const recipient = to.trim();
  if (recipient.length > 254 || !EMAIL_REGEX.test(recipient)) {
    return { ok: false, error: 'El destinatario no es una dirección de correo válida.' };
  }

  if (subject !== undefined && typeof subject !== 'string') {
    return { ok: false, error: 'El asunto del correo no es válido.' };
  }
  if (text !== undefined && text !== null && typeof text !== 'string') {
    return { ok: false, error: 'El cuerpo de texto del correo no es válido.' };
  }
  if (html !== undefined && html !== null && typeof html !== 'string') {
    return { ok: false, error: 'El cuerpo HTML del correo no es válido.' };
  }

  if (!subject && !text && !html) {
    return { ok: false, error: 'Faltan datos obligatorios (destinatario, asunto)' };
  }

  if ((text || '').length > MAX_TEXT_LENGTH || (html || '').length > MAX_HTML_LENGTH) {
    return { ok: false, error: 'El contenido del correo excede el tamaño permitido.' };
  }

  // Sin saltos de línea en el asunto: evita inyectar cabeceras adicionales
  const cleanSubject = String(subject || 'Roomia PMS')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, MAX_SUBJECT_LENGTH);

  return {
    ok: true,
    to: recipient,
    subject: cleanSubject,
    text: text || undefined,
    html: html || undefined
  };
}

/** Plantilla usada cuando la llamada trae solo texto plano. El texto se escapa. */
export function buildFallbackHtml(text: string, footer: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b;">
      <h2 style="color: #0f172a; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Roomia PMS</h2>
      <div style="line-height: 1.6; white-space: pre-wrap;">${escapeHtml(text)}</div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #64748b;">${escapeHtml(footer)}</p>
    </div>
  `;
}

/**
 * Límite de envíos por IP en memoria (ventana fija).
 * En serverless cada instancia tiene su propio contador, así que ahí es una protección
 * parcial; aun así frena el abuso más simple desde una sola máquina.
 */
export function createRateLimiter(maxAllowed: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetTime: number }>();

  return function isRateLimited(key: string): boolean {
    const now = Date.now();

    if (hits.size > 5000) {
      for (const [k, record] of hits) {
        if (now > record.resetTime) hits.delete(k);
      }
    }

    const record = hits.get(key);
    if (!record || now > record.resetTime) {
      hits.set(key, { count: 1, resetTime: now + windowMs });
      return false;
    }
    if (record.count >= maxAllowed) {
      return true;
    }
    record.count += 1;
    return false;
  };
}
