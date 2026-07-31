import nodemailer from "nodemailer";

const cleanEnvVal = (val: string | undefined): string => {
  if (!val) return "";
  let s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  if (s === 'undefined' || s === 'null' || s === '' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') {
    return "";
  }
  return s;
};

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido. Utilice POST." });
  }

  try {
    const { to, subject, html, text } = req.body || {};
    if (!to || !subject) {
      return res.status(400).json({ error: "Faltan datos obligatorios (destinatario, asunto)" });
    }

    const smtpHost = cleanEnvVal(process.env.SMTP_HOST) || "smtp.gmail.com";
    const smtpPort = parseInt(cleanEnvVal(process.env.SMTP_PORT) || "587", 10);
    const smtpUser = cleanEnvVal(process.env.SMTP_USER);
    const smtpPass = cleanEnvVal(process.env.SMTP_PASS);
    const smtpFrom = cleanEnvVal(process.env.SMTP_FROM) || (smtpUser ? `Roomia PMS <${smtpUser}>` : "Roomia PMS <noreply@roomia.com>");

    if (!smtpUser || !smtpPass) {
      console.warn("[MAIL WARNING] SMTP credentials are not configured in Vercel environment variables.");
      return res.status(200).json({
        success: true,
        simulated: true,
        message: "No se encontraron credenciales SMTP (SMTP_USER/SMTP_PASS) en las Variables de Entorno de Vercel. Correo procesado en modo simulación."
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
      },
      connectionTimeout: 10000,
      greetingTimeout: 8000
    });

    const info = await transporter.sendMail({
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
    });

    console.log(`[SMTP MAIL SENT] Correo enviado vía Vercel Serverless a: ${to} | Msg ID: ${info.messageId}`);
    return res.status(200).json({
      success: true,
      messageId: info.messageId
    });

  } catch (error: any) {
    console.error("[SMTP MAIL ERROR] Error enviando correo desde Vercel Serverless:", error?.message || error);
    return res.status(500).json({
      success: false,
      error: "Error al enviar correo por el servidor SMTP.",
      details: error?.message || String(error)
    });
  }
}
