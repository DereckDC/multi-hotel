var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_nodemailer = __toESM(require("nodemailer"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
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
      if (!smtpUser || !smtpPass) {
        console.warn("[MAIL WARNING] SMTP credentials are not configured in environment secrets.");
        console.log(`[SIMULATED MAIL SEND] To: ${to} | Subject: ${subject}`);
        console.log(`Body: ${text || html}`);
        return res.json({
          success: true,
          simulated: true,
          message: "El servidor recibi\xF3 la solicitud, pero no hay credenciales SMTP de producci\xF3n (usuario/contrase\xF1a) configuradas en variables de entorno. Puedes agregar estas variables para enviar el correo real."
        });
      }
      const transporter = import_nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        // true for 465, false for 587 or others
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
            <p style="font-size: 12px; color: #64748b;">Este correo fue generado autom\xE1ticamente por Roomia PMS Server.</p>
          </div>
        ` : void 0)
      });
      console.log(`[SMTP MAIL SENT] Mail dispatched successfully to: ${to} | Msg ID: ${info.messageId}`);
      return res.json({
        success: true,
        messageId: info.messageId
      });
    } catch (error) {
      console.error("[SMTP MAIL ERROR] Failed to dispatch real email:", error);
      return res.status(500).json({ error: error.message || "Error al despachar el correo electr\xF3nico." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
