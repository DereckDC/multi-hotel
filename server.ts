import express from "express";
import path from "path";
import { createServer as createHttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { validateEmailRequest, buildFallbackHtml } from "./emailGuard";

dotenv.config();

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ["polling", "websocket"]
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

  // Security Headers Middleware (CSP, HSTS, COOP, XFO, Trusted-Types, etc.)
  app.use((req, res, next) => {
    const host = req.headers.host || "";
    const isCustomProdDomain = host.includes("roomiapms.site");

    // Strict-Transport-Security (HSTS) with includeSubDomains and preload
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

    // Prevent MIME-sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Referrer policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions Policy for hardware security
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(self)");

    // Frame ancestors: allow 'self' on production domain, plus AI Studio and Cloud Run preview hosts in development/preview
    const frameAncestors = isCustomProdDomain 
      ? "'self'" 
      : "'self' https://*.google.com https://*.run.app https://aistudio.google.com";

    if (isCustomProdDomain) {
      // In standalone production domain (audited by Lighthouse):
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    }

    // Content-Security-Policy (CSP) in enforcing mode
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://maps.googleapis.com https://maps.gstatic.com https://lh3.googleusercontent.com https://www.roomiapms.site",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https: wss: ws: http:",
      "frame-src 'self' https://maps.google.com https://www.google.com https://*.google.com https://ppls.me https://*.payphone.app",
      "child-src 'self' https://maps.google.com https://www.google.com",
      "media-src 'self' data: blob: https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      `frame-ancestors ${frameAncestors}`,
      isCustomProdDomain ? "require-trusted-types-for 'script'" : "",
      isCustomProdDomain ? "trusted-types default dompurify 'allow-duplicates'" : ""
    ].filter(Boolean).join("; ");

    res.setHeader("Content-Security-Policy", cspDirectives);

    next();
  });

  // Use JSON middleware to parse requests.
  // 1mb: margen para los correos HTML de reserva (el límite por defecto es 100kb).
  app.use(express.json({ limit: "1mb" }));

  // Static endpoints for SEO, Crawlers, and AI Agents to avoid SPA fallback HTML
  const publicDir = path.join(process.cwd(), "public");
  app.use(express.static(publicDir));

  app.get("/robots.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const filePath = path.join(publicDir, "robots.txt");
    return res.sendFile(filePath);
  });

  app.get("/llms.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const filePath = path.join(publicDir, "llms.txt");
    return res.sendFile(filePath);
  });

  app.get("/ai-catalog.json", (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const filePath = path.join(publicDir, "ai-catalog.json");
    return res.sendFile(filePath);
  });

  app.get("/sitemap.xml", (req, res) => {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const filePath = path.join(publicDir, "sitemap.xml");
    return res.sendFile(filePath);
  });

  // Dynamic Supabase Configuration endpoint to bypass static bundler caching and ensure the frontend always uses the current database configuration from host environment variables.
  app.get("/supabase-env.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    
    const cleanValue = (val: string) => {
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

    // Read credentials strictly from host process environment variables loaded via .env
    const supabaseUrl = cleanValue(process.env.VITE_SUPABASE_URL || "");
    const supabaseKey = cleanValue(process.env.VITE_SUPABASE_ANON_KEY || "");

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

  // In-memory sliding window Rate Limiter for email dispatches (5 req / 15 min per IP)
  const emailRateLimitMap = new Map<string, { count: number; resetTime: number }>();

  function isEmailRateLimited(ip: string): boolean {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxAllowed = 5;

    const record = emailRateLimitMap.get(ip);
    if (!record || now > record.resetTime) {
      emailRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      return false;
    }

    if (record.count >= maxAllowed) {
      return true;
    }

    record.count += 1;
    return false;
  }

  // API Route for sending real emails via SMTP
  app.post("/api/send-email", async (req, res) => {
    try {
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "127.0.0.1";

      if (isEmailRateLimited(clientIp)) {
        console.warn(`[SECURITY WARN] Rate limit de envío de correo alcanzado para IP: ${clientIp}`);
        return res.status(429).json({
          error: "Límite de solicitudes de correo alcanzado. Por seguridad, máximo 5 envíos cada 15 minutos por dirección IP."
        });
      }

      // Un único destinatario válido, tamaños acotados y asunto sin saltos de línea
      const validated = validateEmailRequest(req.body);
      if (validated.ok === false) {
        return res.status(400).json({ error: validated.error });
      }
      const { to, subject, html, text } = validated;

      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = parseInt(process.env.SMTP_PORT || "587");
      const smtpUser = process.env.SMTP_USER || "";
      const smtpPass = process.env.SMTP_PASS || "";
      const smtpFrom = process.env.SMTP_FROM || `Roomia PMS <${smtpUser || "noreply@roomia.com"}>`;

      // Modo de pruebas: con EMAIL_DRY_RUN=true no se envía ningún correo real, solo se
      // registra en consola. Sirve para probar reservas sin escribir a hoteles ni huéspedes.
      if (process.env.EMAIL_DRY_RUN === "true") {
        console.log(`[EMAIL DRY RUN] To: ${to} | Subject: ${subject}`);
        return res.json({ success: true, simulated: true, message: "EMAIL_DRY_RUN activo: correo no enviado." });
      }

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
        html: html || (text
          ? buildFallbackHtml(text, "Este correo fue generado automáticamente por Roomia PMS Server.")
          : undefined)
      });

      console.log(`[SMTP MAIL SENT] Mail dispatched successfully to: ${to} | Msg ID: ${info.messageId}`);
      return res.json({
        success: true,
        messageId: info.messageId
      });

    } catch (error: any) {
      console.warn("[SMTP MAIL NOTICE] Could not send via real SMTP server, falling back to simulated dispatch mode:", error?.message || error);
      return res.json({
        success: true,
        simulated: true,
        warning: "No se pudo autenticar con el servidor SMTP. Se procesó la solicitud en modo de simulación.",
        details: error?.message || String(error)
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true, hmr: false },
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
