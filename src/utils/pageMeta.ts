// Título, descripción y URL canónica de la página actual. Google ejecuta JavaScript al
// indexar, así que cada ruta de la SPA queda con sus propios datos.
import type { PageMeta } from '../../api/seo.ts';
import { SITE } from '../../api/seo.ts';

function setMetaContent(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

export function setPageMeta(meta: Pick<PageMeta, 'title' | 'description' | 'path'>): void {
  if (typeof document === 'undefined') return;
  const url = `${SITE}${meta.path === '/' ? '/' : meta.path}`;
  document.title = meta.title;
  setMetaContent('meta[name="description"]', 'name', 'description', meta.description);
  setMetaContent('meta[property="og:title"]', 'property', 'og:title', meta.title);
  setMetaContent('meta[property="og:description"]', 'property', 'og:description', meta.description);
  setMetaContent('meta[property="og:url"]', 'property', 'og:url', url);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}
