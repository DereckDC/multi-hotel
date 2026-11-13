// Detección de la app nativa (Capacitor/WebView) frente al navegador.
// Con `androidScheme: 'https'` el origen dentro de la app es https://localhost, por eso no basta con mirar el esquema.
export const PRODUCTION_ORIGIN = 'https://roomiapms.site';

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
  const origin = window.location?.origin || '';
  return origin.startsWith('capacitor:') || origin.startsWith('file:');
}
