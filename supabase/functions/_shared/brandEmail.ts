// Plantilla única de correos de Roomia PMS (sin dependencias). La usan la app (src/store.ts) y las
// funciones Edge (por ejemplo `payphone` para el comprobante de pago), para que todos los correos de
// la marca se vean iguales: cabecera azul marino con el logo, estado destacado, bloques de datos,
// resumen de montos, botón y pie.
//
// HTML pensado para clientes de correo: tablas, estilos en línea y sin CSS externo.

export const BRAND = {
  navy: "#0E2A47",
  navyDark: "#071726",
  cyan: "#23B4E6",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  soft: "#F8FAFB",
  page: "#EEF2F6",
  site: "https://www.roomiapms.site",
  logo: "https://www.roomiapms.site/RoomiaPMSLogoSinFondo.png",
};

export type EmailTone = "success" | "warning" | "info" | "danger";

const TONES: Record<EmailTone, { bg: string; border: string; text: string }> = {
  success: { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" },
  warning: { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  info: { bg: "#EFF9FE", border: "#BAE6FD", text: "#0369A1" },
  danger: { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
};

export interface BrandEmailSection {
  title: string;
  rows: Array<[string, string | number | null | undefined]>;
}

export interface BrandEmail {
  /** Texto corto que algunos clientes muestran junto al asunto */
  preheader?: string;
  /** Etiqueta pequeña sobre el título (p. ej. "COMPROBANTE DE PAGO") */
  eyebrow: string;
  title: string;
  greeting?: string;
  /** Párrafos. **texto** se muestra en negrita; todo lo demás se escapa */
  paragraphs?: string[];
  status?: { label: string; value: string; tone: EmailTone; reference?: string };
  sections?: BrandEmailSection[];
  amounts?: { title?: string; rows: Array<[string, string]>; total?: [string, string] };
  cta?: { label: string; url: string };
  /** Aviso destacado al final del cuerpo */
  note?: { text: string; tone?: EmailTone };
  /** Línea de contacto en el pie (p. ej. teléfono y correo del establecimiento) */
  contact?: string;
}

export const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

/** Escapa y convierte **negrita** */
const rich = (text: string): string =>
  escapeHtml(text).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${BRAND.text};">$1</strong>`);

const plain = (text: string): string => text.replace(/\*\*(.+?)\*\*/g, "$1");

const hasValue = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

const safeUrl = (url: string): string => (/^https?:\/\//i.test(url) ? url : BRAND.site);

export function renderBrandEmail(e: BrandEmail): string {
  const font = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const status = e.status
    ? (() => {
        const t = TONES[e.status!.tone];
        return `
        <tr><td style="padding:4px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.bg};border:1px solid ${t.border};border-radius:12px;">
            <tr><td align="center" style="padding:14px 16px;font-family:${font};">
              <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;color:${BRAND.muted};">${escapeHtml(e.status!.label)}</div>
              <div style="font-size:17px;font-weight:800;color:${t.text};margin-top:4px;">${escapeHtml(e.status!.value)}</div>
              ${e.status!.reference ? `<div style="font-size:11px;color:${BRAND.muted};margin-top:4px;font-family:Consolas,Menlo,monospace;">${escapeHtml(e.status!.reference)}</div>` : ""}
            </td></tr>
          </table>
        </td></tr>`;
      })()
    : "";

  const sections = (e.sections ?? [])
    .map((s) => {
      const rows = s.rows.filter(([, v]) => hasValue(v));
      if (!rows.length) return "";
      return `
        <tr><td style="padding:18px 32px 0;font-family:${font};">
          <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;color:${BRAND.navy};border-bottom:2px solid ${BRAND.cyan};padding-bottom:6px;display:inline-block;">${escapeHtml(s.title)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;font-size:14px;">
            ${rows
              .map(
                ([k, v]) => `<tr>
              <td style="padding:7px 12px 7px 0;color:${BRAND.muted};width:42%;vertical-align:top;border-bottom:1px solid ${BRAND.border};">${escapeHtml(k)}</td>
              <td style="padding:7px 0;color:${BRAND.text};font-weight:600;vertical-align:top;border-bottom:1px solid ${BRAND.border};">${escapeHtml(v)}</td>
            </tr>`
              )
              .join("")}
          </table>
        </td></tr>`;
    })
    .join("");

  const amounts = e.amounts
    ? `
        <tr><td style="padding:20px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.soft};border:1px solid ${BRAND.border};border-radius:12px;font-family:${font};font-size:14px;">
            ${e.amounts.title ? `<tr><td colspan="2" style="padding:14px 18px 4px;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;color:${BRAND.navy};">${escapeHtml(e.amounts.title)}</td></tr>` : ""}
            ${e.amounts.rows
              .map(
                ([k, v]) => `<tr>
              <td style="padding:6px 18px;color:${BRAND.muted};">${escapeHtml(k)}</td>
              <td align="right" style="padding:6px 18px;color:${BRAND.text};font-weight:600;white-space:nowrap;">${escapeHtml(v)}</td>
            </tr>`
              )
              .join("")}
            ${e.amounts.total
              ? `<tr>
              <td style="padding:12px 18px 14px;border-top:1px solid ${BRAND.border};color:${BRAND.navy};font-weight:800;font-size:15px;">${escapeHtml(e.amounts.total[0])}</td>
              <td align="right" style="padding:12px 18px 14px;border-top:1px solid ${BRAND.border};color:${BRAND.navy};font-weight:800;font-size:18px;white-space:nowrap;">${escapeHtml(e.amounts.total[1])}</td>
            </tr>`
              : ""}
          </table>
        </td></tr>`
    : "";

  const cta = e.cta
    ? `
        <tr><td align="center" style="padding:28px 32px 4px;">
          <a href="${escapeHtml(safeUrl(e.cta.url))}" style="display:inline-block;background:${BRAND.cyan};color:${BRAND.navyDark};font-family:${font};font-size:15px;font-weight:800;text-decoration:none;padding:14px 30px;border-radius:10px;">${escapeHtml(e.cta.label)}</a>
        </td></tr>`
    : "";

  const note = e.note
    ? (() => {
        const t = TONES[e.note!.tone ?? "info"];
        return `
        <tr><td style="padding:20px 32px 0;">
          <div style="background:${t.bg};border-left:4px solid ${t.text};border-radius:8px;padding:12px 14px;font-family:${font};font-size:13px;line-height:1.55;color:${BRAND.text};">${rich(e.note!.text)}</div>
        </td></tr>`;
      })()
    : "";

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(e.title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.page};">
  ${e.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(e.preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border};">
        <tr><td align="center" style="background:${BRAND.navy};padding:28px 32px 26px;font-family:${font};">
          <img src="${BRAND.logo}" width="56" height="56" alt="Roomia PMS" style="display:block;border:0;width:56px;height:56px;margin:0 auto 8px;">
          <div style="font-size:13px;font-weight:800;letter-spacing:3px;color:#ffffff;">ROOMIA PMS</div>
          <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${BRAND.cyan};margin-top:18px;">${escapeHtml(e.eyebrow)}</div>
          <div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:6px;line-height:1.3;">${escapeHtml(e.title)}</div>
        </td></tr>
        <tr><td style="padding:26px 32px 6px;font-family:${font};font-size:15px;line-height:1.6;color:#334155;">
          ${e.greeting ? `<p style="margin:0 0 12px;color:${BRAND.text};font-weight:600;">${escapeHtml(e.greeting)}</p>` : ""}
          ${(e.paragraphs ?? []).map((p) => `<p style="margin:0 0 12px;">${rich(p)}</p>`).join("")}
        </td></tr>
        ${status}
        ${sections}
        ${amounts}
        ${note}
        ${cta}
        <tr><td style="padding:28px 32px 26px;font-family:${font};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.border};">
            <tr><td align="center" style="padding-top:16px;font-size:12px;line-height:1.6;color:${BRAND.muted};">
              ${e.contact ? `<div style="margin-bottom:6px;">${escapeHtml(e.contact)}</div>` : ""}
              <div><a href="${BRAND.site}" style="color:${BRAND.navy};font-weight:700;text-decoration:none;">roomiapms.site</a> · Gestión hotelera y reservas directas</div>
              <div style="font-size:11px;color:#94A3B8;margin-top:4px;">Correo automático de Roomia PMS. No respondas a este mensaje.</div>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Versión en texto plano del mismo correo */
export function renderBrandText(e: BrandEmail): string {
  const lines: string[] = [`ROOMIA PMS · ${e.eyebrow}`, e.title, ""];
  if (e.greeting) lines.push(e.greeting, "");
  for (const p of e.paragraphs ?? []) lines.push(plain(p), "");
  if (e.status) lines.push(`${e.status.label}: ${e.status.value}${e.status.reference ? ` (${e.status.reference})` : ""}`, "");
  for (const s of e.sections ?? []) {
    const rows = s.rows.filter(([, v]) => hasValue(v));
    if (!rows.length) continue;
    lines.push(s.title.toUpperCase());
    for (const [k, v] of rows) lines.push(`- ${k}: ${v}`);
    lines.push("");
  }
  if (e.amounts) {
    if (e.amounts.title) lines.push(e.amounts.title.toUpperCase());
    for (const [k, v] of e.amounts.rows) lines.push(`- ${k}: ${v}`);
    if (e.amounts.total) lines.push(`${e.amounts.total[0]}: ${e.amounts.total[1]}`);
    lines.push("");
  }
  if (e.note) lines.push(plain(e.note.text), "");
  if (e.cta) lines.push(`${e.cta.label}: ${safeUrl(e.cta.url)}`, "");
  if (e.contact) lines.push(e.contact);
  lines.push("Roomia PMS · https://www.roomiapms.site");
  return lines.join("\n");
}
