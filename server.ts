import express from "express";
import path from "path";
import { createServer as createHttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

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

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Real-time WebSocket connection listener for Live Chat
  io.on("connection", (socket) => {
    console.log(`[WebSocket Server] Cliente conectado al chat en vivo: ${socket.id}`);

    // Receive chat message and broadcast immediately to all clients in real-time
    socket.on("chat:message", (msg) => {
      console.log(`[WebSocket Server] Difundiendo mensaje de chat ID: ${msg?.id}`);
      io.emit("chat:message", msg);
    });

    // Receive read status update and broadcast
    socket.on("chat:read", (payload) => {
      io.emit("chat:read", payload);
    });

    socket.on("disconnect", () => {
      console.log(`[WebSocket Server] Cliente desconectado del chat: ${socket.id}`);
    });
  });

  // Use JSON middleware to parse requests
  app.use(express.json());

  // Dynamic Supabase Configuration endpoint to bypass static bundler caching
  app.get("/supabase-env.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");

    // Read credentials strictly from host process environment variables loaded via .env
    const supabaseUrl = cleanEnvVal(process.env.VITE_SUPABASE_URL);
    const supabaseKey = cleanEnvVal(process.env.VITE_SUPABASE_ANON_KEY);

    const config = {
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: supabaseKey
    };
    res.send(`window.__SUPABASE_ENV__ = ${JSON.stringify(config)};`);
  });

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

      const smtpHost = cleanEnvVal(process.env.SMTP_HOST) || "smtp.gmail.com";
      const smtpPort = parseInt(cleanEnvVal(process.env.SMTP_PORT) || "587", 10);
      const smtpUser = cleanEnvVal(process.env.SMTP_USER);
      const smtpPass = cleanEnvVal(process.env.SMTP_PASS);
      const smtpFrom = cleanEnvVal(process.env.SMTP_FROM) || (smtpUser ? `Roomia PMS <${smtpUser}>` : "Roomia PMS <noreply@roomia.com>");

      // Graceful handling if SMTP credentials are missing
      if (!smtpUser || !smtpPass) {
        console.warn("[MAIL WARNING] SMTP credentials are not configured in environment variables.");
        console.log(`[SIMULATED MAIL SEND] To: ${to} | Subject: ${subject}`);
        return res.json({
          success: true,
          simulated: true,
          message: "Servidor sin credenciales SMTP configuradas. Correo procesado en modo simulación local."
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
      console.error("[SMTP MAIL ERROR] Failed to send email through SMTP server:", error?.message || error);
      return res.status(500).json({
        success: false,
        error: "Error al enviar correo por el servidor SMTP.",
        details: error?.message || String(error)
      });
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server & WebSocket running on http://localhost:${PORT}`);
  });
}

startServer();
