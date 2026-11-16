/**
 * HTML estático de la landing y de las páginas legales, para buscadores y vistas previas
 * de enlaces (WhatsApp, Facebook, LinkedIn…), que no ejecutan JavaScript.
 *
 * Lo usa el build (plugin de vite.config.ts): genera dist/landingpage.html y los legales
 * a partir del index.html compilado. Al cargar la página, React reemplaza este contenido
 * por la landing real, así que el texto debe ser el mismo que muestra LandingPageView.tsx
 * (tests/seo.test.ts comprueba que los títulos coinciden).
 */
import { PAGES, buildHead, escapeHtml, injectPage, type PageMeta } from '../../api/seo.ts';
import { LANDING_FAQ } from '../content/landingFaq.ts';
import { ANNUAL_FREE_MONTHS, PLANS, SETUP_FEE, TRIAL_DAYS, annualPrice, usd, usd2 } from '../utils/plans.ts';

const WHATSAPP_DEMO = `https://wa.me/593984056660?text=${encodeURIComponent('Hola, quiero solicitar una demo por WhatsApp de Roomia PMS.')}`;

export const LANDING_H1 = 'Un solo calendario para Airbnb, Booking y tus reservas directas';

export const LANDING_SECTIONS: Array<{ h2: string; intro?: string; items: Array<{ h3: string; p: string }> }> = [
  {
    h2: '¿Qué problemas resuelve Roomia?',
    intro: 'Administrar a mano te cuesta reservas y dinero. Así elimina Roomia los cuellos de botella más comunes:',
    items: [
      { h3: 'Reservas desordenadas entre Airbnb, Booking, WhatsApp y cuadernos', p: 'Centraliza toda la información en un solo calendario. Evita las dobles reservas, la pérdida de datos de huéspedes y el desgaste de coordinar varios canales a mano.' },
      { h3: 'Recepción lenta y procesos manuales', p: 'Acelera la llegada de huéspedes con registro ágil y validación mediante código QR. Reduce las esperas a segundos y ofrece un servicio profesional.' },
      { h3: 'Falta de control sobre habitaciones y limpieza', p: 'Mira al instante el estado de cada habitación: disponible, ocupada, en limpieza o en mantenimiento. Evita asignaciones incorrectas y mantén al equipo sincronizado.' },
      { h3: 'Cobros desorganizados y falta de reportes', p: 'Lleva el registro de cada abono, saldo pendiente e ingreso por reserva. Obtén ocupación, tarifa media y RevPAR en tiempo real para decidir mejor.' }
    ]
  },
  {
    h2: 'Listo en tres pasos',
    intro: 'Sin instalar nada. Te ayudamos a configurarlo.',
    items: [
      { h3: 'Crea tu propiedad', p: 'Registra tu casa, departamento u hotel con sus habitaciones, fotos y tarifas.' },
      { h3: 'Conecta tus calendarios', p: 'Pega el enlace iCal de Airbnb y Booking. Las fechas ocupadas se bloquean automáticamente.' },
      { h3: 'Recibe y controla', p: 'Acepta reservas directas, registra pagos y revisa tu rendimiento en el panel.' }
    ]
  },
  {
    h2: 'Todo lo que necesita un anfitrión',
    intro: 'Pensado para casas, departamentos, cabañas y hoteles pequeños.',
    items: [
      { h3: 'Sincronización con Airbnb y Booking', p: 'Importa sus calendarios por propiedad y evita que dos huéspedes reserven la misma noche.' },
      { h3: 'Página de reservas directas', p: 'Tu propio enlace donde los huéspedes ven disponibilidad y precios y reservan sin comisión de terceros.' },
      { h3: 'Panel con métricas claras', p: 'Ocupación, tarifa media, RevPAR, ingresos, cancelaciones y previsión de los próximos 30 días.' },
      { h3: 'Pagos y saldos', p: 'Registra abonos, ve lo pendiente por cobrar y cobra con tarjeta en línea cuando lo necesites.' },
      { h3: 'Check-in con QR', p: 'Cada reserva genera un código para validar la llegada del huésped en segundos.' },
      { h3: 'Limpieza y mantenimiento', p: 'Marca habitaciones como disponibles, sucias o en mantenimiento y mantén al equipo sincronizado.' },
      { h3: 'Equipo y recepción', p: 'Da acceso a recepcionistas con una vista simple, sin mostrarles tus finanzas.' },
      { h3: 'Varias propiedades', p: 'Administra todas tus casas, departamentos y hoteles desde la misma cuenta.' },
      { h3: 'Datos protegidos', p: 'Información respaldada en la nube con acceso por roles y soporte técnico en español.' }
    ]
  },
  {
    h2: 'Cada reserva directa es dinero que no le dejas a una plataforma',
    intro: 'Las plataformas cobran comisión por cada reserva. Con tu propia página de reservas conectada a tu calendario, los huéspedes que ya te conocen reservan contigo y tú decides tus precios.',
    items: []
  }
];

const e = escapeHtml;

function landingBody(): string {
  const sections = LANDING_SECTIONS.map(s => [
    '<section>',
    `<h2>${e(s.h2)}</h2>`,
    s.intro ? `<p>${e(s.intro)}</p>` : '',
    ...s.items.map(i => `<h3>${e(i.h3)}</h3><p>${e(i.p)}</p>`),
    '</section>'
  ].join('')).join('');

  const plans = PLANS.map(p => [
    '<li>',
    `<h3>${e(p.name)}</h3>`,
    `<p>${e(p.desc)} ${p.props === 1 ? '1 propiedad' : `Hasta ${p.props} propiedades`}, ${p.units} unidades incluidas.</p>`,
    `<p>${usd(p.price)} USD al mes (precio fundador; oficial ${usd(p.old)}) o ${usd(annualPrice(p.price))} USD al año. Cada unidad adicional: ${usd2(p.extraUnit)} al mes.</p>`,
    '</li>'
  ].join('')).join('');

  const faq = LANDING_FAQ.map(f => `<h3>${e(f.q)}</h3><p>${e(f.a)}</p>`).join('');

  return [
    '<header><a href="/">Roomia PMS</a> · <a href="#precios">Precios</a> · <a href="#preguntas">Preguntas</a></header>',
    '<main>',
    `<h1>${e(LANDING_H1)}</h1>`,
    '<p>Evita las dobles reservas, recibe huéspedes directamente sin pagar comisión por cada uno y mira cuánto gana realmente tu alojamiento, todo desde un panel hecho para anfitriones.</p>',
    `<p><a href="${e(WHATSAPP_DEMO)}">Solicitar demo por WhatsApp</a> · <a href="#precios">Ver planes y precios</a></p>`,
    sections,
    '<section id="precios">',
    '<h2>Planes y precios</h2>',
    `<p>Todos los planes incluyen las mismas funciones. ${TRIAL_DAYS} días de prueba gratis, plan anual con ${ANNUAL_FREE_MONTHS} meses gratis y puesta en marcha de ${usd(SETUP_FEE)} (pago único: cargamos tus unidades y capacitamos a tu personal). Sin comisión por tus reservas.</p>`,
    `<ul>${plans}</ul>`,
    '</section>',
    '<section id="preguntas">',
    '<h2>Preguntas frecuentes</h2>',
    faq,
    '</section>',
    '</main>',
    '<footer><a href="/terminos-y-condiciones">Términos y Condiciones</a> · <a href="/politica-de-privacidad">Política de Privacidad</a> · <a href="/politica-de-cancelaciones-y-reembolsos">Política de Cancelación y Reembolsos</a></footer>'
  ].join('');
}

/** Datos estructurados de la landing: el software, con sus planes, y las preguntas frecuentes */
function landingJsonLd(): object[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Roomia PMS',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android',
      url: 'https://www.roomiapms.site/landingpage',
      description: PAGES.landing.description,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: Math.min(...PLANS.map(p => p.price)),
        highPrice: Math.max(...PLANS.map(p => p.price)),
        offerCount: PLANS.length
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: LANDING_FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    }
  ];
}

const LEGAL: Array<{ key: 'terminos' | 'privacidad' | 'cancelaciones'; h1: string }> = [
  { key: 'terminos', h1: 'Términos y Condiciones Generales de Uso' },
  { key: 'privacidad', h1: 'Política de Privacidad y Tratamiento de Datos Personales' },
  { key: 'cancelaciones', h1: 'Política de Cancelaciones, Modificaciones y Reembolsos' }
];

export interface StaticPage {
  /** Archivo dentro de dist/ */
  file: string;
  meta: PageMeta;
  body: string;
}

export function staticPages(): StaticPage[] {
  return [
    { file: 'landingpage.html', meta: { ...PAGES.landing, jsonLd: landingJsonLd() }, body: landingBody() },
    ...LEGAL.map(l => ({
      file: `${PAGES[l.key].path.slice(1)}.html`,
      meta: PAGES[l.key],
      body: `<header><a href="/">Roomia PMS</a></header><main><h1>${e(l.h1)}</h1><p>${e(PAGES[l.key].description)}</p></main><footer><a href="/landingpage">Conoce Roomia PMS</a></footer>`
    }))
  ];
}

/** HTML final de cada página estática a partir del index.html compilado */
export function renderStaticPages(indexHtml: string): Array<{ file: string; html: string }> {
  return staticPages().map(p => ({ file: p.file, html: injectPage(indexHtml, { head: buildHead(p.meta), body: p.body }) }));
}
