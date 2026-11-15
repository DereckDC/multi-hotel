// Enlaces a https://www.roomiapms.site que Android abre dentro de la app (App Links).
// La app se sirve desde https://localhost: se lleva la misma ruta, búsqueda y hash a la app
// (el hash incluye los tokens del enlace de recuperar contraseña de Supabase).
import { App } from '@capacitor/app';
import { isNativeApp } from './platform';

const SITE_HOSTS = new Set(['www.roomiapms.site', 'roomiapms.site']);

function openInsideApp(rawUrl?: string) {
  if (!rawUrl) return;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  if (!SITE_HOSTS.has(url.hostname)) return;
  const target = `${url.pathname || '/'}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (target === current) return;
  window.location.replace(target);
}

export function initDeepLinks() {
  if (!isNativeApp()) return;
  // App abierta desde un enlace estando cerrada
  App.getLaunchUrl()
    .then(res => openInsideApp(res?.url))
    .catch(() => {});
  // App ya abierta (en segundo plano) y se toca un enlace
  App.addListener('appUrlOpen', ev => openInsideApp(ev.url)).catch(() => {});
}
