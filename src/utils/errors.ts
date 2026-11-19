/**
 * Mensajes de error para las personas que usan Roomia.
 *
 * Los errores de las librerías llegan en inglés y con términos técnicos ("Invalid login credentials",
 * "violates row-level security policy", "Failed to fetch"…). Esta capa los traduce a español claro y
 * NUNCA deja pasar nombres de servicios o términos técnicos (Supabase, base de datos, SMTP, token, etc.).
 *
 *   notify.error(friendlyError(error, 'login'));
 */

export type ErrorContext =
  | 'login' | 'registro' | 'recuperar' | 'correo' | 'contrasena'
  | 'verificacion' | 'guardar' | 'cargar' | 'pdf' | 'calendario' | 'imagen' | 'pago' | 'general';

/** Mensaje de respaldo según lo que la persona estaba haciendo */
const FALLBACK: Record<ErrorContext, string> = {
  login: 'No pudimos iniciar sesión. Inténtalo de nuevo en unos minutos.',
  registro: 'No pudimos crear tu cuenta. Inténtalo de nuevo en unos minutos.',
  recuperar: 'No pudimos enviar el correo de recuperación. Inténtalo de nuevo.',
  correo: 'No pudimos cambiar el correo. Inténtalo de nuevo.',
  verificacion: 'No pudimos verificar tu correo. Revisa que hayas abierto el enlace e inténtalo de nuevo.',
  contrasena: 'No pudimos cambiar la contraseña. Inténtalo de nuevo.',
  guardar: 'No pudimos guardar los cambios. Inténtalo de nuevo.',
  cargar: 'No pudimos cargar la información. Inténtalo de nuevo.',
  pdf: 'No pudimos generar el documento. Inténtalo de nuevo.',
  calendario: 'No pudimos sincronizar el calendario. Revisa el enlace e inténtalo de nuevo.',
  imagen: 'No pudimos procesar la imagen. Prueba con otra.',
  pago: 'No pudimos procesar el pago. Inténtalo de nuevo.',
  general: 'Algo salió mal. Inténtalo de nuevo.'
};

/** Términos que una persona usuaria nunca debe leer en un aviso */
const TECHNICAL_TERMS =
  /supabase|postgres|postgrest|edge function|\brls\b|row[- ]level|\bsmtp\b|vercel|\bjwt\b|\bsql\b|stack trace|relation "|violates|constraint|base de datos|\bapi\b|\btoken\b|\bserver\b|servidor|backend|undefined|\bnull\b|\[object/i;

/** Traducciones de los errores más comunes (el orden importa: el primero que coincide gana) */
const KNOWN: Array<[RegExp, string | ((context: ErrorContext) => string)]> = [
  [/invalid login credentials|invalid_credentials/i, 'El correo o la contraseña no son correctos. Revísalos e inténtalo de nuevo.'],
  [/email not confirmed|not confirmed/i, 'Aún no confirmas tu correo. Abre el enlace que te enviamos y vuelve a intentarlo.'],
  [/already registered|already been registered|already exists|duplicate key|unique constraint|23505/i,
    context => (context === 'correo' ? 'Ese correo ya pertenece a otra cuenta.' : 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.')],
  [/same password|different from the old|should be different/i, 'La nueva contraseña debe ser diferente a la actual.'],
  [/password should be at least|weak password|password is too short|at least \d+ characters/i, 'La contraseña es muy corta o débil. Usa al menos 6 caracteres.'],
  [/unable to validate email|invalid email|email address.*invalid|email.*format/i, 'Escribe un correo válido.'],
  [/rate limit|too many requests|over_email_send_rate_limit|for security purposes/i, 'Hiciste demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
  [/signups? (are )?disabled|signup_disabled/i, 'El registro de cuentas no está disponible por ahora.'],
  [/failed to fetch|fetch failed|load failed|networkerror|network request failed|err_internet|timed? ?out|timeout|offline/i,
    'No pudimos conectarnos. Revisa tu conexión a internet e inténtalo de nuevo.'],
  [/jwt|refresh_token|session (expired|missing|not found)|token.*(expired|invalid)|not authenticated|auth session missing/i,
    'Tu sesión expiró. Inicia sesión nuevamente para continuar.'],
  [/permission denied|row[- ]level security|not authorized|unauthorized|forbidden|42501|\b403\b/i, 'No tienes permiso para realizar esta acción.'],
  [/overlap|exclusion|23P01|conflicting/i, 'Esas fechas ya no están disponibles. Elige otro rango.'],
  [/too large|payload|exceeds|file size|entity too large/i, 'El archivo es muy pesado. Prueba con uno más liviano.']
];

/** ¿El texto parece estar ya en español claro? (acentos o varias palabras comunes) */
const looksSpanish = (text: string): boolean =>
  /[áéíóúñ¿¡]/i.test(text) ||
  (text.toLowerCase().match(/\b(el|la|los|las|tu|tus|no|se|de|que|por|para|con|una|un|ya|ha|pudimos|puedes)\b/g) || []).length >= 2;

/** Extrae el texto de un error de cualquier tipo (Error, objeto de la librería, texto) */
export function errorText(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const e = error as { message?: unknown; error_description?: unknown; error?: unknown; details?: unknown };
  for (const value of [e.message, e.error_description, e.error, e.details]) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

/** ¿El texto menciona algo técnico que no debe verse en pantalla? */
export const hasTechnicalTerms = (text: string): boolean => TECHNICAL_TERMS.test(text);

/**
 * Devuelve un mensaje en español, claro y sin términos técnicos.
 * Si el error ya es un mensaje nuestro en español, lo respeta; si no, lo traduce o usa el respaldo.
 */
export function friendlyError(error: unknown, context: ErrorContext = 'general'): string {
  const raw = errorText(error).trim();
  if (!raw) return FALLBACK[context];

  for (const [pattern, message] of KNOWN) {
    if (pattern.test(raw)) return typeof message === 'function' ? message(context) : message;
  }
  if (!hasTechnicalTerms(raw) && looksSpanish(raw) && raw.length <= 220) return raw;
  return FALLBACK[context];
}
