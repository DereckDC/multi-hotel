/**
 * Preguntas frecuentes de la landing. Las usa LandingPageView y el HTML estático para buscadores
 * (src/seo/landingStatic.ts), así ambos muestran exactamente el mismo texto.
 */
import { ANNUAL_FREE_MONTHS, PLANS, SETUP_FEE, TRIAL_DAYS, usd, usd2 } from '../utils/plans.ts';

export interface FaqItem {
  q: string;
  a: string;
}

export const LANDING_FAQ: FaqItem[] = [
  { q: '¿Cómo se conecta con Airbnb y Booking?', a: 'Pegas el enlace de calendario (iCal) que te da cada plataforma, por cada propiedad. Roomia lo lee de forma periódica y bloquea esas fechas en tu calendario y en tu página de reservas directas. No necesitas dar tu contraseña de Airbnb ni de Booking.' },
  { q: '¿Se pueden dar dobles reservas?', a: 'Roomia bloquea las fechas ocupadas en otras plataformas y avisa si detecta un cruce. Como iCal se actualiza cada cierto tiempo y no es instantáneo, recomendamos mantener también tus calendarios de Airbnb/Booking importando el de Roomia.' },
  { q: '¿Qué es una "propiedad" y qué es una "unidad"?', a: 'Una propiedad es un establecimiento: un hotel, una casa o un edificio de departamentos. Una unidad es cada habitación o departamento que alquilas dentro de ella; una casa completa cuenta como 1 unidad. Cada plan incluye un número de propiedades y de unidades.' },
  { q: '¿Cómo cobro las reservas directas?', a: 'Puedes registrar pagos en efectivo o transferencia desde el panel, y cobrar con tarjeta en línea. Roomia no cobra comisión por tus reservas: pagas solo la suscripción, que es fija. Si usas una pasarela de pago con tarjeta, esa pasarela puede aplicar su propia tarifa.' },
  { q: '¿Necesito instalar algo o capacitar a mi equipo?', a: 'No. Funciona desde el navegador, en computadora o celular. Tu personal de recepción tiene su propia vista, simple, para check-in y registro de huéspedes.' },
  { q: '¿Cómo funciona la prueba gratis de 15 días?', a: `Usas Roomia con todas sus funciones durante ${TRIAL_DAYS} días, antes de pagar tu primera suscripción. Para empezar, la puesta en marcha tiene un pago único de ${usd(SETUP_FEE)}: cargamos la información de tus unidades en la plataforma y capacitamos a tu personal.` },
  { q: '¿Qué pasa si tengo más unidades de las que incluye mi plan?', a: `Cada unidad adicional se cobra aparte, por mes: ${usd2(PLANS[0].extraUnit)} en ${PLANS[0].name}, ${usd2(PLANS[1].extraUnit)} en ${PLANS[1].name} y ${usd2(PLANS[2].extraUnit)} en ${PLANS[2].name}. Cuantas más unidades tienes, más conviene pasar al plan siguiente.` },
  { q: '¿Puedo cancelar cuando quiera?', a: `Sí. El plan mensual no tiene contrato de permanencia y el precio fundador se mantiene mientras tu suscripción siga activa. El plan anual se paga por adelantado y te ahorra ${ANNUAL_FREE_MONTHS} meses.` },
  { q: '¿Emiten facturas electrónicas del SRI?', a: 'Todavía no. Hoy Roomia genera una pre-factura informativa en PDF y en ticket para impresora. La emisión de facturas electrónicas del SRI será un complemento opcional que estamos preparando; escríbenos y te avisamos cuando esté lista.' },
  { q: '¿Cómo funciona el programa de referidos?', a: `Recomiendas Roomia a otro anfitrión. Cuando se suscribe y menciona tu nombre, tú ganas 1 mes gratis de tu plan y él no paga los ${usd(SETUP_FEE)} de puesta en marcha.` }
];
