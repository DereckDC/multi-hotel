// Detección de la app nativa (Capacitor/WebView) frente al navegador.
// Con `androidScheme: 'https'` el origen dentro de la app es https://localhost, por eso no basta con mirar el esquema.
// Debe ser el dominio con www: roomiapms.site responde 308 y el WebView no sigue redirecciones en el preflight CORS
export const PRODUCTION_ORIGIN = 'https://www.roomiapms.site';

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
  const origin = window.location?.origin || '';
  return origin.startsWith('capacitor:') || origin.startsWith('file:');
}

/**
 * Dirección pública de Roomia para enlaces que salen de la app (correos, recuperar contraseña).
 * En el APK el origen es https://localhost, que no sirve fuera del teléfono; se usa el dominio real.
 * Android abre estos enlaces en la app si está instalada (App Links) y si no, en el navegador.
 */
export function getPublicOrigin(): string {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;
  if (isNativeApp()) return PRODUCTION_ORIGIN;
  return window.location?.origin || PRODUCTION_ORIGIN;
}
