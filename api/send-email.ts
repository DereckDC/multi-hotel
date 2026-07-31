import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

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
    const { to, subject, html, text } = req.body || {};

    if (!to || !subject) {
      return res.status(400).json({ error: 'Faltan datos obligatorios (destinatario to, asunto subject).' });
    }

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
          <div style="line-height: 1.6; white-space: pre-wrap;">${text}</div>
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
