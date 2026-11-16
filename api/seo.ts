import type { VercelRequest, VercelResponse } from '@vercel/node';

// -----------------------------------------------------------------------------
// SEO de Roomia.
//
// Roomia es una SPA: el index.html llega con <div id="root"></div> vacío y el
// contenido se dibuja con JavaScript. Los bots de WhatsApp, Facebook, LinkedIn, X…
// no ejecutan JavaScript y Google lo hace tarde. Por eso:
//  · La landing y las páginas legales se generan como HTML estático en el build
//    (plugin de vite.config.ts, que usa las funciones de este archivo).
//  · La portada y la página de cada hotel/propiedad (/<slug>) las sirve esta función,
//    pero SOLO a bots (regla `has: user-agent` en vercel.json). Las personas siguen
//    recibiendo la SPA normal.
//  · /sitemap.xml se genera aquí con todos los hoteles activos.
//
// El archivo es autónomo a propósito (sin importar módulos vecinos), igual que
// send-email.ts, para que el despliegue en Vercel no dependa de cómo empaqueta los
// imports. Las funciones puras se exportan para las pruebas, el build y la app.
// -----------------------------------------------------------------------------

export const SITE = 'https://www.roomiapms.site';
export const DEFAULT_OG_IMAGE = `${SITE}/og-roomia.png`;
export const SEO_START = '<!--seo:start-->';
export const SEO_END = '<!--seo:end-->';

export interface PageMeta {
  title: string;
  description: string;
  /** Ruta absoluta dentro del sitio, ej. "/landingpage" */
  path: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  type?: 'website' | 'article';
  noindex?: boolean;
  jsonLd?: object[];
}

/** Páginas fijas del sitio. La app usa estos mismos textos al cambiar de ruta. */
export const PAGES: Record<'home' | 'landing' | 'terminos' | 'privacidad' | 'cancelaciones', PageMeta> = {
  home: {
    title: 'Roomia PMS – Hoteles, casas y departamentos con reserva directa',
    description: 'Reserva directo con hoteles, casas y departamentos en Ecuador, sin comisiones de intermediarios. Roomia PMS es la plataforma de gestión y reservas para anfitriones.',
    path: '/'
  },
  landing: {
    title: 'Roomia PMS | Software para anfitriones: calendario de Airbnb, Booking y reservas directas',
    description: 'Un solo calendario para Airbnb, Booking y tus reservas directas. Evita dobles reservas, cobra sin comisión por reserva y mide la ocupación de tu alojamiento. 15 días de prueba gratis.',
    path: '/landingpage'
  },
  terminos: {
    title: 'Términos y Condiciones | Roomia PMS',
    description: 'Términos y condiciones generales de uso de Roomia PMS, la plataforma de gestión y reservas para hoteles, casas y departamentos.',
    path: '/terminos-y-condiciones'
  },
  privacidad: {
    title: 'Política de Privacidad | Roomia PMS',
    description: 'Cómo Roomia PMS recopila, usa y protege los datos personales de anfitriones y huéspedes.',
    path: '/politica-de-privacidad'
  },
  cancelaciones: {
    title: 'Política de Cancelaciones y Reembolsos | Roomia PMS',
    description: 'Condiciones de cancelación, modificación y reembolso de las reservas realizadas a través de Roomia PMS.',
    path: '/politica-de-cancelaciones-y-reembolsos'
  }
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Igual que slugify en src/App.tsx: así la URL del bot coincide con la de la app. */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/** Bots de buscadores y de vistas previas de enlaces. Debe coincidir con la regla de vercel.json. */
export const BOT_UA_REGEX = /bot|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|linkedin|twitter|pinterest|embedly|skypeuripreview|vkshare|applebot|google-inspectiontool|bingpreview|yandex|baidu|duckduck/i;

export const isBot = (userAgent?: string | null): boolean => BOT_UA_REGEX.test(userAgent || '');

/** Texto plano recortado a `max` caracteres sin cortar palabras */
export function clip(text: string, max = 155): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

const absolute = (path: string) => (path.startsWith('http') ? path : `${SITE}${path === '/' ? '/' : path}`);

/** Etiquetas del <head> de una página */
export function buildHead(meta: PageMeta): string {
  const url = absolute(meta.path);
  const image = meta.image || DEFAULT_OG_IMAGE;
  const isDefaultImage = image === DEFAULT_OG_IMAGE;
  const width = meta.imageWidth ?? (isDefaultImage ? 1200 : undefined);
  const height = meta.imageHeight ?? (isDefaultImage ? 630 : undefined);
  const alt = meta.imageAlt || (isDefaultImage ? 'Roomia PMS – gestión de reservas para anfitriones' : meta.title);
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const lines = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex, follow" />' : '<meta name="robots" content="index, follow, max-image-preview:large" />',
    `<meta property="og:type" content="${meta.type || 'website'}" />`,
    '<meta property="og:site_name" content="Roomia PMS" />',
    '<meta property="og:locale" content="es_EC" />',
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    width ? `<meta property="og:image:width" content="${width}" />` : '',
    height ? `<meta property="og:image:height" content="${height}" />` : '',
    `<meta property="og:image:alt" content="${escapeHtml(alt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    ...(meta.jsonLd || []).map(obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`)
  ];
  return lines.filter(Boolean).map(l => `    ${l}`).join('\n');
}

/** Evita que la persona vea un parpadeo del HTML estático antes de que React lo reemplace */
const STATIC_GUARD = [
  '    <script>document.documentElement.classList.add("js")</script>',
  '    <style>.js .seo-static{display:none}.seo-static{max-width:960px;margin:0 auto;padding:24px 16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55;color:#0f172a}.seo-static img{max-width:100%;height:auto}</style>'
].join('\n');

/**
 * Inserta las etiquetas de la página en el index.html compilado (entre los marcadores
 * <!--seo:start--> y <!--seo:end-->) y, si hay cuerpo, lo pone dentro de #root.
 */
export function injectPage(indexHtml: string, page: { head: string; body?: string }): string {
  let html = indexHtml;
  const start = html.indexOf(SEO_START);
  const end = html.indexOf(SEO_END);
  if (start >= 0 && end > start) {
    html = `${html.slice(0, start + SEO_START.length)}\n${page.head}\n    ${html.slice(end)}`;
  } else {
    // index.html sin marcadores (versión anterior): se quitan las etiquetas de la página antes de poner las nuevas
    html = html
      .replace(/\s*<title>[\s\S]*?<\/title>/gi, '')
      .replace(/\s*<meta\s+(?:name="(?:description|robots|twitter:[^"]*)"|property="og:[^"]*")[^>]*>/gi, '')
      .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, '')
      .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
      .replace('</head>', `${page.head}\n  </head>`);
  }
  if (page.body) {
    html = html.replace('</head>', `${STATIC_GUARD}\n  </head>`);
    html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root"><div class="seo-static">${page.body}</div></div>`);
  }
  return html;
}

// -----------------------------------------------------------------------------
// Hoteles y propiedades
// -----------------------------------------------------------------------------

/** Solo campos públicos. Nunca se piden datos del propietario. */
export interface SeoHotel {
  id: string;
  nombre: string;
  descripcion?: string | null;
  ubicacion?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  imagenes?: string[] | null;
  estado?: string | null;
  tipo?: string | null;
  finalidad?: string | null;
  precio?: number | string | null;
}

export interface SeoRoom {
  nombre: string;
  tipo?: string | null;
  precio?: number | string | null;
  capacidad?: number | null;
  estado?: string | null;
}

const isPropertyType = (tipo?: string | null) => tipo === 'casa' || tipo === 'departamento';

/** "Salinas, Santa Elena"; si ciudad y provincia son iguales, solo una vez */
const placeOf = (h: SeoHotel) =>
  [...new Set([h.ciudad, h.provincia].map(s => (s || '').trim()).filter(Boolean))].join(', ');
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

function hotelFacts(hotel: SeoHotel, rooms: SeoRoom[]) {
  const property = isPropertyType(hotel.tipo);
  const tipoLabel = hotel.tipo === 'casa' ? 'Casa' : hotel.tipo === 'departamento' ? 'Departamento' : 'Hotel';
  const place = placeOf(hotel) || hotel.ubicacion || 'Ecuador';
  const propPrice = Number(hotel.precio) || 0;
  const roomPrices = rooms.map(r => Number(r.precio)).filter(n => n > 0);
  let priceText = '';
  if (property && propPrice > 0) {
    priceText = hotel.finalidad === 'venta' ? `En venta por ${money(propPrice)} USD` : `Alquiler desde ${money(propPrice)} USD al mes`;
  } else if (roomPrices.length) {
    priceText = `Desde ${money(Math.min(...roomPrices))} USD por noche`;
  }
  const image = (hotel.imagenes || []).find(src => typeof src === 'string' && /^https:\/\//i.test(src));
  return { property, tipoLabel, place, priceText, image };
}

export function hotelMeta(hotel: SeoHotel, rooms: SeoRoom[] = []): PageMeta {
  const { property, tipoLabel, place, priceText, image } = hotelFacts(hotel, rooms);
  const path = `/${slugify(hotel.nombre)}`;
  const name = hotel.nombre.trim();
  const base = hotel.descripcion?.trim() || `${tipoLabel} en ${place}.`;
  const description = clip(priceText ? `${clip(base, 150 - priceText.length)} ${priceText}.` : base);
  return {
    title: `${name} – ${place} | Reserva directa en Roomia`,
    description,
    path,
    image,
    imageAlt: image ? `${name} – ${tipoLabel.toLowerCase()} en ${place}` : undefined,
    noindex: hotel.estado ? hotel.estado !== 'activo' : false,
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': property ? 'Accommodation' : 'LodgingBusiness',
      name,
      description: clip(hotel.descripcion || base, 300),
      url: absolute(path),
      ...(image ? { image } : {}),
      address: {
        '@type': 'PostalAddress',
        ...(hotel.ubicacion ? { streetAddress: hotel.ubicacion } : {}),
        ...(hotel.ciudad ? { addressLocality: hotel.ciudad } : {}),
        ...(hotel.provincia ? { addressRegion: hotel.provincia } : {}),
        addressCountry: 'EC'
      }
    }]
  };
}

export function renderHotelPage(hotel: SeoHotel, rooms: SeoRoom[] = []) {
  const meta = hotelMeta(hotel, rooms);
  const { tipoLabel, place, priceText, image } = hotelFacts(hotel, rooms);
  const url = absolute(meta.path);
  const roomItems = rooms
    .filter(r => r.nombre)
    .map(r => {
      const parts = [r.tipo, Number(r.precio) > 0 ? `${money(Number(r.precio))} USD por noche` : '', r.capacidad ? `hasta ${r.capacidad} personas` : '']
        .filter(Boolean).join(' · ');
      return `<li><strong>${escapeHtml(r.nombre)}</strong>${parts ? ` – ${escapeHtml(parts)}` : ''}</li>`;
    })
    .join('');
  const body = [
    '<header><a href="/">Roomia</a></header>',
    '<main>',
    `<h1>${escapeHtml(hotel.nombre.trim())}</h1>`,
    `<p>${escapeHtml(tipoLabel)} en ${escapeHtml(place)}</p>`,
    image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(meta.imageAlt || hotel.nombre)}" width="1200" loading="lazy" />` : '',
    hotel.descripcion ? `<p>${escapeHtml(hotel.descripcion.trim())}</p>` : '',
    priceText ? `<p><strong>${escapeHtml(priceText)}</strong></p>` : '',
    roomItems ? `<h2>Habitaciones</h2><ul>${roomItems}</ul>` : '',
    `<p><a href="${escapeHtml(url)}">Ver disponibilidad y reservar sin comisiones en Roomia</a></p>`,
    '</main>',
    '<footer><a href="/landingpage">¿Eres anfitrión? Conoce Roomia PMS</a></footer>'
  ].filter(Boolean).join('');
  return { head: buildHead(meta), body, noindex: !!meta.noindex };
}

export function renderHomePage(hotels: SeoHotel[]) {
  const active = hotels.filter(h => (h.estado || 'activo') === 'activo');
  const link = (h: SeoHotel) => {
    const place = placeOf(h);
    return `<li><a href="/${escapeHtml(slugify(h.nombre))}">${escapeHtml(h.nombre.trim())}</a>${place ? ` – ${escapeHtml(place)}` : ''}</li>`;
  };
  const hoteles = active.filter(h => !isPropertyType(h.tipo));
  const propiedades = active.filter(h => isPropertyType(h.tipo));
  const body = [
    '<main>',
    '<h1>Descubre estadías extraordinarias</h1>',
    `<p>${escapeHtml(PAGES.home.description)}</p>`,
    hoteles.length ? `<h2>Hoteles</h2><ul>${hoteles.map(link).join('')}</ul>` : '',
    propiedades.length ? `<h2>Casas y departamentos</h2><ul>${propiedades.map(link).join('')}</ul>` : '',
    '</main>',
    '<footer><a href="/landingpage">¿Eres anfitrión? Conoce Roomia PMS</a> · <a href="/terminos-y-condiciones">Términos</a> · <a href="/politica-de-privacidad">Privacidad</a></footer>'
  ].filter(Boolean).join('');
  return { head: buildHead({ ...PAGES.home, jsonLd: HOME_JSON_LD }), body };
}

export const HOME_JSON_LD: object[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Roomia PMS',
    url: SITE,
    logo: `${SITE}/RoomiaPMSLogoSinFondo.png`,
    email: 'roomia.admincontact@gmail.com',
    telephone: '+593984056660',
    address: { '@type': 'PostalAddress', addressRegion: 'Santa Elena', addressCountry: 'EC' }
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Roomia PMS',
    url: SITE,
    inLanguage: 'es'
  }
];

export function renderSitemap(hotels: SeoHotel[], today: string): string {
  const entries: Array<[string, string, string]> = [
    ['/', 'daily', '1.0'],
    [PAGES.landing.path, 'weekly', '0.9'],
    ...hotels
      .filter(h => (h.estado || 'activo') === 'activo' && slugify(h.nombre))
      .map(h => [`/${slugify(h.nombre)}`, 'daily', '0.8'] as [string, string, string]),
    [PAGES.terminos.path, 'yearly', '0.3'],
    [PAGES.privacidad.path, 'yearly', '0.3'],
    [PAGES.cancelaciones.path, 'yearly', '0.3']
  ];
  const urls = entries
    .map(([path, freq, prio]) => `  <url><loc>${escapeHtml(absolute(path))}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// -----------------------------------------------------------------------------
// Función de Vercel
// -----------------------------------------------------------------------------

// Clave anónima pública (la misma que ya está en public/supabase-env.js). Las políticas
// de la base de datos solo permiten leer hoteles y habitaciones.
const FALLBACK_SUPABASE_URL = 'https://fyreapnukipdvcebvokj.supabase.co';
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmVhcG51a2lwZHZjZWJ2b2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1OTcwMTIsImV4cCI6MjEwMDE3MzAxMn0.diZTbHx-8jDDGSJEG34ae1-HD-i_PLY-RWsCQUxlNAU';

const cleanBase = (url: string) => url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

/**
 * Primero las mismas credenciales que usa la app en el navegador (public/supabase-env.js);
 * las variables de entorno de Vercel solo si esas fallan.
 */
function credentials(): Array<{ url: string; key: string }> {
  const list = [{ url: FALLBACK_SUPABASE_URL, key: FALLBACK_ANON_KEY }];
  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
    list.push({ url: cleanBase(process.env.VITE_SUPABASE_URL), key: process.env.VITE_SUPABASE_ANON_KEY });
  }
  return list.filter((c, i, all) => all.findIndex(o => o.url === c.url && o.key === c.key) === i);
}

async function supabaseGet<T>(query: string): Promise<T> {
  let lastError = '';
  for (const { url, key } of credentials()) {
    try {
      const res = await fetch(`${cleanBase(url)}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (res.ok) return (await res.json()) as T;
      lastError = `Supabase ${res.status} en ${url}: ${(await res.text()).slice(0, 200)}`;
    } catch (err: any) {
      lastError = `Supabase sin conexión en ${url}: ${err?.message || err}`;
    }
  }
  throw new Error(lastError);
}

const HOTEL_FIELDS = 'id,nombre,descripcion,ubicacion,ciudad,provincia,estado,tipo:contacto->>tipoEstablecimiento,finalidad:contacto->>finalidad,precio:contacto->detallesInmueble->>precio';

async function loadIndexHtml(req: VercelRequest): Promise<string> {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const origin = host ? `https://${host}` : SITE;
  try {
    const res = await fetch(`${origin}/index.html`);
    if (res.ok) return await res.text();
  } catch {
    // se usa la página mínima de abajo
  }
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />${SEO_START}${SEO_END}</head><body><div id="root"></div></body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Permite comprobar desde fuera que la regla de bots de vercel.json llegó a esta función
  res.setHeader('X-Roomia-Seo', 'bot');
  try {
    if (req.query.kind === 'sitemap') {
      const hotels = await supabaseGet<SeoHotel[]>(`hotels?select=${HOTEL_FIELDS}`);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).send(renderSitemap(hotels, new Date().toISOString().slice(0, 10)));
    }

    const rawPath = String(req.query.path || '/');
    const slug = decodeURIComponent(rawPath).replace(/^\/+|\/+$/g, '');
    const indexHtml = await loadIndexHtml(req);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');

    const hotels = await supabaseGet<SeoHotel[]>(`hotels?select=${HOTEL_FIELDS}`);
    if (!slug) return res.status(200).send(injectPage(indexHtml, renderHomePage(hotels)));

    const hotel = hotels.find(h => slugify(h.nombre) === slug.toLowerCase());
    if (!hotel) {
      const notFound = buildHead({ ...PAGES.home, title: 'Página no encontrada | Roomia PMS', path: `/${slug}`, noindex: true });
      return res.status(404).send(injectPage(indexHtml, { head: notFound, body: '<main><h1>Página no encontrada</h1><p><a href="/">Ver hoteles y propiedades en Roomia</a></p></main>' }));
    }

    const id = encodeURIComponent(hotel.id);
    const [extra, rooms] = await Promise.all([
      supabaseGet<Array<{ imagenes: string[] | null }>>(`hotels?select=imagenes&id=eq.${id}`),
      supabaseGet<SeoRoom[]>(`rooms?select=nombre,tipo,precio,capacidad,estado&hotelid=eq.${id}&order=precio.asc`)
    ]);
    const page = renderHotelPage({ ...hotel, imagenes: extra[0]?.imagenes || [] }, rooms);
    return res.status(200).send(injectPage(indexHtml, page));
  } catch (err: any) {
    // Si falla la base de datos, el bot recibe la página normal en lugar de un error
    console.error('SEO error:', err?.message || err);
    res.setHeader('X-Roomia-Seo-Error', String(err?.message || err).replace(/[^\x20-\x7E]/g, '').slice(0, 200));
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    if (req.query.kind === 'sitemap') {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.status(200).send(renderSitemap([], new Date().toISOString().slice(0, 10)));
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(await loadIndexHtml(req));
  }
}
