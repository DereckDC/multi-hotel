import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// -----------------------------------------------------------------------------
// Validaciones del envío. Son las mismas reglas que emailGuard.ts (servidor Express),
// copiadas aquí a propósito para que esta función no dependa de importar módulos
// vecinos al desplegarse en Vercel. Si cambias una regla, cámbiala en ambos sitios.
//
// El endpoint debe aceptar llamadas sin sesión (bienvenida al registrarse, aviso de
// cambio de contraseña), así que no se exige login; se limita su uso: un único
// destinatario válido por llamada, tamaños acotados y un tope de envíos por IP.
// -----------------------------------------------------------------------------
const EMAIL_REGEX = /^[^\s@<>,;:"'()\[\]\\]+@[^\s@<>,;:"'()\[\]\\]+\.[^\s@<>,;:"'()\[\]\\]{2,}$/;
const MAX_SUBJECT_LENGTH = 250;
const MAX_TEXT_LENGTH = 20_000;
const MAX_HTML_LENGTH = 500_000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type EmailValidation =
  | { ok: true; to: string; subject: string; text?: string; html?: string }
  | { ok: false; error: string };

function validateEmailRequest(body: any): EmailValidation {
  const { to, subject, html, text } = body || {};

  if (typeof to !== 'string' || !to.trim() || !subject) {
    return { ok: false, error: 'Faltan datos obligatorios (destinatario to, asunto subject).' };
  }
  const recipient = to.trim();
  if (recipient.length > 254 || !EMAIL_REGEX.test(recipient)) {
    return { ok: false, error: 'El destinatario no es una dirección de correo válida.' };
  }
  if (typeof subject !== 'string') {
    return { ok: false, error: 'El asunto del correo no es válido.' };
  }
  if (text !== undefined && text !== null && typeof text !== 'string') {
    return { ok: false, error: 'El cuerpo de texto del correo no es válido.' };
  }
  if (html !== undefined && html !== null && typeof html !== 'string') {
    return { ok: false, error: 'El cuerpo HTML del correo no es válido.' };
  }
  if ((text || '').length > MAX_TEXT_LENGTH || (html || '').length > MAX_HTML_LENGTH) {
    return { ok: false, error: 'El contenido del correo excede el tamaño permitido.' };
  }

  return {
    ok: true,
    to: recipient,
    subject: subject.replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_SUBJECT_LENGTH),
    text: text || undefined,
    html: html || undefined
  };
}

// Límite por IP en memoria. En serverless cada instancia lleva su propio contador,
// así que es una protección parcial: frena el abuso simple desde una sola máquina.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const rateLimitHits = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimitHits.size > 5000) {
    for (const [key, record] of rateLimitHits) {
      if (now > record.resetTime) rateLimitHits.delete(key);
    }
  }
  const record = rateLimitHits.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitHits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (record.count >= RATE_LIMIT_MAX) return true;
  record.count += 1;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers for WebViews, APKs, and cross-origin clients
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  try {
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || '')
      .split(',')[0]
      .trim() || req.socket?.remoteAddress || 'unknown';

    if (isRateLimited(clientIp)) {
      console.warn(`[SECURITY WARN VERCEL] Límite de envío de correo alcanzado para IP: ${clientIp}`);
      return res.status(429).json({
        error: 'Límite de solicitudes de correo alcanzado. Inténtalo de nuevo en unos minutos.'
      });
    }

    const validated = validateEmailRequest(req.body);
    if (validated.ok === false) {
      return res.status(400).json({ error: validated.error });
    }
    const { to, subject, html, text } = validated;

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const smtpFrom = process.env.SMTP_FROM || `Roomia PMS <${smtpUser || 'noreply@roomia.com'}>`;

    // Graceful notice if SMTP credentials are missing in Vercel environment variables
    if (!smtpUser || !smtpPass) {
      console.warn('[SMTP WARNING VERCEL] SMTP_USER or SMTP_PASS environment variables are missing on Vercel.');
      return res.status(200).json({
        success: true,
        simulated: true,
        message: 'Servidor Vercel recibió la solicitud, pero no se configuraron credenciales SMTP (SMTP_USER/SMTP_PASS) en las Variables de Entorno de Vercel.',
        details: 'Agrega SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT en Vercel -> Settings -> Environment Variables y vuelve a desplegar (Redeploy).'
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: smtpFrom,
      to,
      subject,
      text,
      html: html || (text ? `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b;">
          <h2 style="color: #0f172a; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Roomia PMS</h2>
          <div style="line-height: 1.6; white-space: pre-wrap;">${escapeHtml(text)}</div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #64748b;">Este correo fue generado automáticamente por Roomia PMS.</p>
        </div>
      ` : undefined)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP MAIL SENT VERCEL] Dispatched to ${to} | ID: ${info.messageId}`);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: 'Correo despachado con éxito vía SMTP.'
    });

  } catch (error: any) {
    console.error('[SMTP VERCEL ERROR]', error);
    return res.status(500).json({
      success: false,
      error: 'Error al comunicarse con el servidor SMTP para enviar el correo.',
      details: error?.message || String(error)
    });
  }
}
