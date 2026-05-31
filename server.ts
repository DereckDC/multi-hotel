import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware to parse requests
  app.use(express.json());

  // Enable CORS manually to support APK WebViews safely (capacitor://, file://, etc.)
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API Route for sending real emails via SMTP
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html, text } = req.body;
      if (!to || !subject) {
        return res.status(400).json({ error: "Faltan datos obligatorios (destinatario, asunto)" });
      }

      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");
      const smtpUser = process.env.SMTP_USER || "";
      const smtpPass = process.env.SMTP_PASS || "";
      const smtpFrom = process.env.SMTP_FROM || `Roomia PMS <${smtpUser || "noreply@roomia.com"}>`;

      // Self-healing / graceful logging if SMTP is missing
      if (!smtpUser || !smtpPass) {
        console.warn("[MAIL WARNING] SMTP credentials are not configured in environment secrets.");
        console.log(`[SIMULATED MAIL SEND] To: ${to} | Subject: ${subject}`);
        console.log(`Body: ${text || html}`);
        return res.json({
          success: true,
          simulated: true,
          message: "El servidor recibió la solicitud, pero no hay credenciales SMTP de producción (usuario/contraseña) configuradas en variables de entorno. Puedes agregar estas variables para enviar el correo real."
        });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for 587 or others
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        tls: {
          rejectUnauthorized: false
        }
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
            <p style="font-size: 12px; color: #64748b;">Este correo fue generado automáticamente por Roomia PMS Server.</p>
          </div>
        ` : undefined)
      });

      console.log(`[SMTP MAIL SENT] Mail dispatched successfully to: ${to} | Msg ID: ${info.messageId}`);
      return res.json({
        success: true,
        messageId: info.messageId
      });

    } catch (error: any) {
      console.error("[SMTP MAIL ERROR] Failed to dispatch real email:", error);
      return res.status(500).json({ error: error.message || "Error al despachar el correo electrónico." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
