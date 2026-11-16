import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BOT_UA_REGEX, PAGES, SEO_END, SEO_START, buildHead, clip, hotelMeta, injectPage, isBot,
  renderHomePage, renderHotelPage, renderSitemap, slugify, type SeoHotel
} from '../api/seo.ts';
import { LANDING_H1, LANDING_SECTIONS, renderStaticPages, staticPages } from '../src/seo/landingStatic.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const UAS = {
  bots: [
    'WhatsApp/2.23.20.0 A',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'Twitterbot/1.0',
    'TelegramBot (like TwitterBot)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
  ],
  people: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'
  ]
};

const hotel: SeoHotel = {
  id: 'h1', nombre: 'Eco Glamping 🍃 ', descripcion: 'Domos frente al mar con desayuno <incluido>.', ubicacion: 'Vía a Punta Blanca',
  ciudad: 'Santa Elena', provincia: 'Santa Elena', imagenes: ['data:image/jpeg;base64,AAA', 'https://example.com/foto.jpg'], estado: 'activo', tipo: 'hotel'
};
const casa: SeoHotel = { id: 'c1', nombre: 'Suite Amoblada', descripcion: '', ciudad: 'Salinas', provincia: 'Santa Elena', imagenes: ['data:image/png;base64,AAA'], estado: 'activo', tipo: 'casa', finalidad: 'alquiler', precio: '244' };

test('slugify es el mismo que usa la app (src/App.tsx)', () => {
  const app = read('src/App.tsx');
  const body = (src: string) => {
    const m = /const slugify = \(text: string\): string => \{([\s\S]*?)\n\};/.exec(src) || /export function slugify\(text: string\): string \{([\s\S]*?)\n\}/.exec(src);
    return (m?.[1] || '').replace(/\/\/.*$/gm, '').replace(/\s+/g, '');
  };
  assert.equal(body(read('api/seo.ts')), body(app));
  assert.equal(slugify('Eco Glamping 🍃 '), 'eco-glamping');
  assert.equal(slugify('Suite Amoblada'), 'suite-amoblada');
  assert.equal(slugify('Hostal Ñandú & Café'), 'hostal-nandu-cafe');
});

test('isBot: bots de buscadores y vistas previas sí, navegadores no', () => {
  UAS.bots.forEach(ua => assert.equal(isBot(ua), true, ua));
  UAS.people.forEach(ua => assert.equal(isBot(ua), false, ua));
});

test('la regla de vercel.json reconoce lo mismo que isBot', () => {
  const cfg = JSON.parse(read('vercel.json'));
  // La portada "/" la sirve Vercel desde dist/index.html antes de las reglas; solo /:slug pasa por la función
  const rules = cfg.rewrites.filter((r: any) => r.has);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, '/:slug');
  for (const rule of rules) {
    const re = new RegExp(`^${rule.has[0].value}$`);
    UAS.bots.forEach(ua => assert.equal(re.test(ua), true, `vercel.json no reconoce: ${ua}`));
    UAS.people.forEach(ua => assert.equal(re.test(ua), false, `vercel.json confunde con bot: ${ua}`));
  }
  // el catch-all de la SPA va al final, después de las reglas de bots
  assert.equal(cfg.rewrites[cfg.rewrites.length - 1].destination, '/index.html');
  assert.ok(BOT_UA_REGEX.flags.includes('i'));
});

test('clip recorta sin cortar palabras', () => {
  assert.equal(clip('corto'), 'corto');
  const long = 'palabra '.repeat(40);
  const out = clip(long, 50);
  assert.ok(out.length <= 50);
  assert.ok(out.endsWith('…'));
});

test('buildHead escapa el texto y pone canonical, Open Graph y Twitter', () => {
  const head = buildHead({ title: 'A "B" <C>', description: 'd & e', path: '/x' });
  assert.match(head, /<title>A &quot;B&quot; &lt;C&gt;<\/title>/);
  assert.match(head, /<link rel="canonical" href="https:\/\/www\.roomiapms\.site\/x" \/>/);
  assert.match(head, /og:image" content="https:\/\/www\.roomiapms\.site\/og-roomia\.png"/);
  assert.match(head, /og:image:width" content="1200"/);
  assert.match(head, /twitter:card" content="summary_large_image"/);
  assert.match(head, /d &amp; e/);
});

test('injectPage reemplaza el bloque entre marcadores y pone el contenido en #root', () => {
  const index = `<html><head><meta charset="UTF-8" />\n${SEO_START}<title>viejo</title>${SEO_END}\n<link rel="stylesheet" href="/a.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
  const html = injectPage(index, { head: '<title>nuevo</title>', body: '<h1>Hola</h1>' });
  assert.ok(!html.includes('viejo'));
  assert.ok(html.includes('<title>nuevo</title>'));
  assert.ok(html.includes('<div id="root"><div class="seo-static"><h1>Hola</h1></div></div>'));
  assert.ok(html.includes('/app.js') && html.includes('/a.css'));
  assert.ok(html.includes(SEO_START) && html.includes(SEO_END));
  assert.ok(html.includes('.js .seo-static{display:none}'));
});

test('injectPage sin marcadores quita las etiquetas viejas en vez de duplicarlas', () => {
  const old = '<html><head><meta charset="UTF-8" /><title>Viejo</title><meta name="description" content="viejo" /><meta property="og:title" content="viejo" /><meta name="twitter:card" content="summary" /><meta name="theme-color" content="#071726" /><script type="application/ld+json">{"a":1}</script><link rel="icon" href="/f.png" /></head><body><div id="root"></div></body></html>';
  const html = injectPage(old, { head: buildHead({ title: 'Nuevo', description: 'nuevo', path: '/n' }) });
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.ok(html.includes('<title>Nuevo</title>'));
  assert.ok(!html.includes('viejo') && !html.includes('{"a":1}'));
  assert.ok(html.includes('theme-color') && html.includes('rel="icon"') && html.includes('charset="UTF-8"'));
});

test('página de hotel: título, imagen https, texto escapado y nada privado', () => {
  const page = renderHotelPage(hotel, [{ nombre: 'Domo Suite', tipo: 'Suite', precio: 70, capacidad: 2 }, { nombre: 'Domo Familiar', tipo: 'Doble', precio: '95', capacidad: 4 }]);
  assert.match(page.head, /<title>Eco Glamping 🍃 – Santa Elena \| Reserva directa en Roomia<\/title>/);
  assert.match(hotelMeta(casa).title, /^Suite Amoblada – Salinas, Santa Elena \|/);
  assert.match(page.head, /og:image" content="https:\/\/example\.com\/foto\.jpg"/);
  assert.match(page.head, /canonical" href="https:\/\/www\.roomiapms\.site\/eco-glamping"/);
  assert.match(page.head, /"@type":"LodgingBusiness"/);
  assert.ok(page.body.includes('<h1>Eco Glamping 🍃</h1>'));
  assert.ok(page.body.includes('&lt;incluido&gt;'));
  assert.ok(page.body.includes('Desde $70 USD por noche'));
  assert.ok(page.body.includes('href="https://www.roomiapms.site/eco-glamping"'));
  assert.equal(page.noindex, false);
  assert.ok(!/propietario|documento|@gmail/i.test(page.head + page.body));
});

test('casa en alquiler: precio mensual e imagen por defecto si solo hay fotos subidas en base64', () => {
  const meta = hotelMeta(casa);
  assert.match(meta.description, /Alquiler desde \$244 USD al mes/);
  assert.equal(meta.image, undefined);
  const page = renderHotelPage(casa);
  assert.match(page.head, /og-roomia\.png/);
  assert.match(page.head, /"@type":"Accommodation"/);
});

test('hotel inactivo: noindex', () => {
  const page = renderHotelPage({ ...hotel, estado: 'inactivo' });
  assert.equal(page.noindex, true);
  assert.match(page.head, /noindex/);
});

test('portada para bots: h1 y enlaces a cada hotel activo', () => {
  const page = renderHomePage([hotel, casa, { ...hotel, id: 'x', nombre: 'Cerrado', estado: 'inactivo' }]);
  assert.equal((page.body.match(/<h1>/g) || []).length, 1);
  assert.ok(page.body.includes('href="/eco-glamping"'));
  assert.ok(page.body.includes('href="/suite-amoblada"'));
  assert.ok(!page.body.includes('/cerrado'));
});

test('sitemap: portada, landing, legales y hoteles activos', () => {
  const xml = renderSitemap([hotel, casa, { ...hotel, nombre: 'Cerrado', estado: 'inactivo' }], '2026-11-16');
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  for (const p of ['/', '/landingpage', '/eco-glamping', '/suite-amoblada', '/terminos-y-condiciones', '/politica-de-privacidad', '/politica-de-cancelaciones-y-reembolsos']) {
    assert.ok(xml.includes(`<loc>https://www.roomiapms.site${p}</loc>`), p);
  }
  assert.ok(!xml.includes('cerrado'));
  assert.ok(!xml.includes('?tab='));
});

test('el HTML estático de la landing usa los mismos títulos que LandingPageView', () => {
  const view = read('src/components/LandingPageView.tsx').replace(/<span[^>]*>|<\/span>/g, '');
  const plain = (s: string) => s.replace(/\s+/g, ' ');
  assert.ok(plain(view).includes(LANDING_H1), 'h1');
  for (const s of LANDING_SECTIONS) {
    assert.ok(view.includes(s.h2), `h2: ${s.h2}`);
    s.items.forEach(i => assert.ok(view.includes(i.h3), `h3: ${i.h3}`));
  }
  assert.ok(view.includes('Planes y precios') && view.includes('Preguntas frecuentes'));
});

test('páginas estáticas: un solo h1, su título y su canonical', () => {
  const index = read('index.html');
  assert.ok(index.includes(SEO_START) && index.includes(SEO_END));
  assert.ok(index.includes(`<title>${PAGES.home.title}</title>`), 'index.html desincronizado con PAGES.home');
  const pages = renderStaticPages(index);
  assert.deepEqual(pages.map(p => p.file), staticPages().map(p => p.file));
  for (const p of pages) {
    const root = p.html.slice(p.html.indexOf('<div id="root">'));
    assert.equal((root.match(/<h1>/g) || []).length, 1, p.file);
    assert.equal((p.html.match(/<title>/g) || []).length, 1, p.file);
    assert.equal((p.html.match(/rel="canonical"/g) || []).length, 1, p.file);
  }
  const landing = pages.find(p => p.file === 'landingpage.html')!.html;
  assert.ok(landing.includes(`<title>${PAGES.landing.title}</title>`));
  assert.ok(landing.includes('"@type":"FAQPage"'));
  assert.ok(landing.includes('https://wa.me/593984056660'));
});
