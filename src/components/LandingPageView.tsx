/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, Calendar, CheckCircle2, ChevronDown, Globe, Lock, Mail, MapPin,
  Menu, MessageCircle, AlertTriangle, MessagesSquare, ArrowUp, Clock, Building2, ChevronUp, QrCode, RefreshCw, ShieldCheck, TrendingUp, Users, X, Home, Wallet, BarChart3, Wrench
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { InteractiveContainer } from './InteractiveContainer';
import { GlobalTrailCursor } from './GlobalTrailCursor';

interface Props {
  onClose: () => void;
  onOpenLegal?: (type: 'terminos' | 'privacidad' | 'cancelaciones') => void;
}

const WHATSAPP = '593984056660';
const EMAIL = 'roomia.admincontact@gmail.com';

const NAV = [
  { id: 'problemas', label: 'Soluciones' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'funciones', label: 'Funciones' },
  { id: 'precios', label: 'Precios' },
  { id: 'preguntas', label: 'Preguntas' }
];

const FAQ = [
  { q: '¿Cómo se conecta con Airbnb y Booking?', a: 'Pegas el enlace de calendario (iCal) que te da cada plataforma, por cada propiedad. Roomia lo lee de forma periódica y bloquea esas fechas en tu calendario y en tu página de reservas directas. No necesitas dar tu contraseña de Airbnb ni de Booking.' },
  { q: '¿Se pueden dar dobles reservas?', a: 'Roomia bloquea las fechas ocupadas en otras plataformas y avisa si detecta un cruce. Como iCal se actualiza cada cierto tiempo y no es instantáneo, recomendamos mantener también tus calendarios de Airbnb/Booking importando el de Roomia.' },
  { q: '¿Qué es una "propiedad" en los planes?', a: 'Una propiedad es un establecimiento: un hotel, una casa o un edificio de departamentos. Dentro de ella puedes crear todas las habitaciones o unidades que necesites.' },
  { q: '¿Cómo cobro las reservas directas?', a: 'Puedes registrar pagos en efectivo o transferencia desde el panel, y cobrar con tarjeta en línea. Solo en los pagos con tarjeta se aplica una tarifa del 5 %; la suscripción es fija.' },
  { q: '¿Necesito instalar algo o capacitar a mi equipo?', a: 'No. Funciona desde el navegador, en computadora o celular. Tu personal de recepción tiene su propia vista, simple, para check-in y registro de huéspedes.' },
  { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. La suscripción es mensual, sin contratos de permanencia. El precio fundador se mantiene mientras tu suscripción siga activa.' }
];

// Calendario de ejemplo del hero (días 1..30)
const DAY_STATE: Record<number, 'airbnb' | 'booking' | 'direct'> = {};
[3, 4, 5, 6].forEach(d => (DAY_STATE[d] = 'airbnb'));
[10, 11, 12, 13, 14].forEach(d => (DAY_STATE[d] = 'booking'));
[18, 19, 20].forEach(d => (DAY_STATE[d] = 'direct'));
[24, 25, 26, 27].forEach(d => (DAY_STATE[d] = 'airbnb'));
const STATE_STYLE = {
  airbnb: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
  booking: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
  direct: 'bg-teal-500/25 text-teal-100 border-teal-400/40'
};

export default function LandingPageView({ onClose, onOpenLegal }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllTiers, setShowAllTiers] = useState(false);
  const [showTop, setShowTop] = useState(false);
  React.useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [form, setForm] = useState({ nombre: '', tipo: 'Casa o departamento', unidades: '1', plataformas: 'Airbnb' });

  const openWhatsApp = (message: string) => {
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
    if (typeof window !== 'undefined' && (window as any).Capacitor) window.open(url, '_system');
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const goTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const submitDemo = (e: React.FormEvent) => {
    e.preventDefault();
    openWhatsApp(
      `Hola, soy ${form.nombre || 'un anfitrión'}. Administro: ${form.tipo}, ${form.unidades} unidad(es), uso ${form.plataformas}. Quisiera una demo de Roomia PMS.`
    );
  };

  const field = 'w-full bg-slate-950 border border-slate-700 focus:border-brand-cyan focus:outline-none rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-slate-500';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative">
      <GlobalTrailCursor />

      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLogo size="lg" showText={true} lightText={true} />
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            {NAV.map(n => (
              <a key={n.id} href={`#${n.id}`} onClick={(e) => { e.preventDefault(); goTo(n.id); }} className="hover:text-brand-cyan transition-colors">{n.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={onClose} className="hidden sm:block px-4 py-2 text-sm font-semibold text-slate-200 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl cursor-pointer">
              Ingresar
            </button>
            <button
              onClick={() => openWhatsApp('Hola, quisiera solicitar una demostración por WhatsApp de Roomia PMS.')}
              className="hidden sm:flex px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md shadow-emerald-500/10 items-center gap-2 cursor-pointer active:scale-95"
            >
              <MessageCircle className="w-4 h-4 fill-slate-950" />
              <span>Solicitar Demo</span>
            </button>
            <button onClick={() => setMenuOpen(o => !o)} className="md:hidden p-2 text-slate-200 cursor-pointer" aria-label="Menú">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-slate-900 bg-slate-950 px-4 py-3 space-y-1">
            {NAV.map(n => (
              <a key={n.id} href={`#${n.id}`} onClick={(e) => { e.preventDefault(); goTo(n.id); }} className="block py-2.5 text-sm font-medium text-slate-200">{n.label}</a>
            ))}
            <button onClick={onClose} className="block w-full text-left py-2.5 text-sm font-medium text-brand-cyan cursor-pointer">Ingresar a mi cuenta</button>
          </div>
        )}
      </nav>

      {/* HERO */}
      <InteractiveContainer as="header" className="border-b border-slate-900">
        <div className="absolute -top-24 right-1/4 w-[520px] h-[520px] bg-brand-cyan/10 rounded-full blur-[110px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-20 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center relative">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-4xl md:text-6xl font-serif font-black tracking-tight leading-[1.08] text-white">
              Un solo calendario para <span className="text-brand-cyan">Airbnb, Booking</span> y tus reservas directas
            </h1>
            <p className="text-base md:text-lg text-slate-400 max-w-xl leading-relaxed">
              Evita las dobles reservas, recibe huéspedes directamente sin pagar comisión por cada uno y mira cuánto gana realmente tu alojamiento, todo desde un panel hecho para anfitriones.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => openWhatsApp('Hola, quiero solicitar una demo por WhatsApp de Roomia PMS.')}
                className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex items-center gap-2.5"
              >
                <MessageCircle className="w-4 h-4 fill-slate-950" />
                <span>Solicitar demo por WhatsApp</span>
              </button>
              <button
                onClick={() => goTo('precios')}
                className="px-5 py-3.5 bg-[#0E2A47] hover:bg-[#133A62] text-white font-bold text-xs md:text-sm rounded-xl border border-brand-cyan/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <span>Ver planes y precios</span>
                <ArrowRight className="w-4 h-4 text-brand-cyan" />
              </button>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              {['Demo de 15 minutos', 'Sin tarjeta ni contrato', 'Configuración con ayuda en español'].map(t => (
                <li key={t} className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{t}</li>
              ))}
            </ul>
          </div>

          {/* Maqueta del dashboard con datos demo */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-[10px] text-slate-400 font-mono ml-2 uppercase tracking-wider">Panel de control</span>
                </div>
                <div className="flex gap-1 text-[10px] font-semibold">
                  {['Hoy', '7 días', 'Este mes'].map((p, i) => (
                    <span key={p} className={`px-2 py-0.5 rounded-md ${i === 2 ? 'bg-brand-cyan text-slate-950' : 'bg-slate-800 text-slate-400'}`}>{p}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: 'Ocupación', v: '72%', d: '+8 pts', up: true, s: '4,6,5,7,8,7,9,10' },
                  { l: 'Ingresos', v: '$3.2k', d: '+14%', up: true, s: '3,5,4,6,8,7,9,11' },
                  { l: 'Por cobrar', v: '$180', d: '2 reservas', up: false, s: '4,4,5,5,4,4,5,5' },
                  { l: 'Canceladas', v: '4%', d: '-2 pts', up: true, s: '9,8,8,6,6,5,4,3' }
                ].map(k => (
                  <div key={k.l} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">{k.l}</p>
                    <p className="text-lg font-black text-white leading-tight">{k.v}</p>
                    <p className={`text-[10px] font-bold ${k.up ? 'text-emerald-400' : 'text-amber-400'}`}>{k.d}</p>
                    <svg viewBox="0 0 70 18" className="w-full h-4 mt-1" preserveAspectRatio="none">
                      <polyline fill="none" stroke={k.up ? '#2dd4bf' : '#fbbf24'} strokeWidth="1.6" points={k.s.split(',').map((v, i) => `${i * 10},${18 - Number(v) * 1.5}`).join(' ')} />
                    </svg>
                  </div>
                ))}
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-[11px] font-bold text-slate-200">Ocupación diaria y previsión</p>
                  <span className="text-[9px] text-slate-500 flex items-center gap-2"><i className="w-2 h-0.5 bg-teal-400 inline-block" />Real <i className="w-2 h-0.5 bg-teal-400/40 inline-block" />Prevista</span>
                </div>
                <svg viewBox="0 0 300 80" className="w-full h-16" preserveAspectRatio="none">
                  <path d="M0,50 L25,42 L50,46 L75,34 L100,38 L125,26 L150,30" fill="none" stroke="#2dd4bf" strokeWidth="2" />
                  <path d="M150,30 L175,36 L200,24 L225,28 L250,18 L275,22 L300,14" fill="none" stroke="#2dd4bf" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="4 3" />
                  <line x1="150" x2="150" y1="0" y2="80" stroke="#475569" strokeDasharray="2 3" />
                </svg>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-200">Origen de reservas</p>
                  {[['Directas', 46, 'bg-teal-400'], ['Airbnb', 38, 'bg-rose-400'], ['Booking', 16, 'bg-blue-400']].map(([n, v, c]) => (
                    <div key={String(n)}>
                      <div className="flex justify-between text-[9px] text-slate-400"><span>{n}</span><span>{v}%</span></div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${c}`} style={{ width: `${v}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-200">Hoy</p>
                  <div className="grid grid-cols-2 gap-1 text-center">
                    {[['3', 'Llegadas'], ['2', 'Salidas'], ['5', 'En casa'], ['1', 'Mantenim.']].map(([v, l]) => (
                      <div key={l} className="bg-slate-900 rounded-md py-1"><p className="text-sm font-black text-white leading-none">{v}</p><p className="text-[8px] text-slate-500">{l}</p></div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-600 text-center">Datos de ejemplo</p>
            </div>
          </div>
        </div>
      </InteractiveContainer>

      {/* ¿QUÉ PROBLEMAS RESUELVE ROOMIA? + antes/después */}
      <InteractiveContainer id="problemas" className="py-16 px-4 md:px-6 border-b border-slate-900 scroll-mt-20">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-serif font-black text-white">¿Qué problemas resuelve Roomia?</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Administrar a mano te cuesta reservas y dinero. Así elimina Roomia los cuellos de botella más comunes:</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { i: AlertTriangle, t: 'Reservas desordenadas entre Airbnb, Booking, WhatsApp y cuadernos', d: 'Centraliza toda la información en un solo calendario. Evita las dobles reservas, la pérdida de datos de huéspedes y el desgaste de coordinar varios canales a mano.', tile: 'bg-brand-cyan/10 text-brand-cyan', title: 'text-brand-cyan', hover: 'hover:border-brand-cyan/35' },
              { i: Clock, t: 'Recepción lenta y procesos manuales', d: 'Acelera la llegada de huéspedes con registro ágil y validación mediante código QR. Reduce las esperas a segundos y ofrece un servicio profesional.', tile: 'bg-indigo-500/10 text-indigo-400', title: 'text-indigo-300', hover: 'hover:border-indigo-500/35' },
              { i: Building2, t: 'Falta de control sobre habitaciones y limpieza', d: 'Mira al instante el estado de cada habitación: disponible, ocupada, en limpieza o en mantenimiento. Evita asignaciones incorrectas y mantén al equipo sincronizado.', tile: 'bg-emerald-500/10 text-emerald-400', title: 'text-emerald-300', hover: 'hover:border-emerald-500/35' },
              { i: TrendingUp, t: 'Cobros desorganizados y falta de reportes', d: 'Lleva el registro de cada abono, saldo pendiente e ingreso por reserva. Obtén ocupación, tarifa media y RevPAR en tiempo real para decidir mejor.', tile: 'bg-amber-500/10 text-amber-400', title: 'text-amber-300', hover: 'hover:border-amber-500/35' }
            ].map(p => (
              <div key={p.t} className={`p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 ${p.hover} rounded-2xl transition-all duration-300`}>
                <div className={`w-10 h-10 rounded-xl ${p.tile} flex items-center justify-center mb-4`}><p.i className="w-5 h-5" /></div>
                <h3 className={`text-sm md:text-base font-bold ${p.title} mb-2`}>{p.t}</h3>
                <p className="text-xs md:text-sm text-[#A8B2BD] leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-5 pt-2">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 p-6 space-y-4 transition-all duration-300">
              <h3 className="font-bold text-rose-300">Sin Roomia</h3>
              {[
                { i: MessagesSquare, t: 'Revisas Airbnb, Booking, WhatsApp y un cuaderno' },
                { i: AlertTriangle, t: 'Una reserva doble te obliga a cancelar a un huésped' },
                { i: TrendingUp, t: 'No sabes cuánto ganas realmente por noche' },
                { i: Wallet, t: 'Cobros y abonos anotados en distintos sitios' },
                { i: Wrench, t: 'Tu equipo pregunta por mensaje qué cuarto está listo' }
              ].map(({ i: Icon, t }) => (
                <div key={t} className="flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Icon className="w-5 h-5" /></div>
                  <p className="text-sm text-slate-300 leading-snug">{t}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/45 p-6 space-y-4 transition-all duration-300">
              <h3 className="font-bold text-emerald-300">Con Roomia</h3>
              {[
                { i: Calendar, t: 'Un calendario con todas tus fechas ocupadas', c: 'bg-brand-cyan/10 text-brand-cyan' },
                { i: RefreshCw, t: 'Las fechas de Airbnb y Booking se bloquean solas', c: 'bg-indigo-500/10 text-indigo-400' },
                { i: BarChart3, t: 'Ocupación, tarifa media y RevPAR en tiempo real', c: 'bg-amber-500/10 text-amber-400' },
                { i: Wallet, t: 'Pagos y saldos pendientes por reserva', c: 'bg-emerald-500/10 text-emerald-400' },
                { i: Users, t: 'Estado de cada habitación visible para todo el equipo', c: 'bg-sky-500/10 text-sky-400' }
              ].map(({ i: Icon, t, c }) => (
                <div key={t} className="flex items-center gap-3 group">
                  <div className={`w-10 h-10 rounded-xl ${c} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}><Icon className="w-5 h-5" /></div>
                  <p className="text-sm text-slate-200 leading-snug">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </InteractiveContainer>

      {/* CÓMO FUNCIONA */}
      <InteractiveContainer id="como-funciona" className="py-16 px-4 md:px-6 border-b border-slate-900 scroll-mt-20">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-serif font-black text-white">Listo en tres pasos</h2>
            <p className="text-slate-400">Sin instalar nada. Te ayudamos a configurarlo.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: '1', t: 'Crea tu propiedad', d: 'Registra tu casa, departamento u hotel con sus habitaciones, fotos y tarifas.', c: 'text-brand-cyan bg-brand-cyan/10' },
              { n: '2', t: 'Conecta tus calendarios', d: 'Pega el enlace iCal de Airbnb y Booking. Las fechas ocupadas se bloquean automáticamente.', c: 'text-indigo-300 bg-indigo-500/10' },
              { n: '3', t: 'Recibe y controla', d: 'Acepta reservas directas, registra pagos y revisa tu rendimiento en el panel.', c: 'text-emerald-300 bg-emerald-500/10' }
            ].map(s => (
              <div key={s.n} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono font-black text-lg ${s.c}`}>{s.n}</div>
                <h3 className="font-bold text-white">{s.t}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </InteractiveContainer>

      {/* FUNCIONES */}
      <InteractiveContainer id="funciones" className="py-16 px-4 md:px-6 border-b border-slate-900 scroll-mt-20">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-serif font-black text-white">Todo lo que necesita un anfitrión</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Pensado para casas, departamentos, cabañas y hoteles pequeños.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { i: RefreshCw, t: 'Sincronización con Airbnb y Booking', d: 'Importa sus calendarios por propiedad y evita que dos huéspedes reserven la misma noche.', c: 'text-rose-300 bg-rose-500/10' },
              { i: Globe, t: 'Página de reservas directas', d: 'Tu propio enlace donde los huéspedes ven disponibilidad y precios y reservan sin comisión de terceros.', c: 'text-brand-cyan bg-brand-cyan/10' },
              { i: BarChart3, t: 'Panel con métricas claras', d: 'Ocupación, tarifa media, RevPAR, ingresos, cancelaciones y previsión de los próximos 30 días.', c: 'text-amber-300 bg-amber-500/10' },
              { i: Wallet, t: 'Pagos y saldos', d: 'Registra abonos, ve lo pendiente por cobrar y cobra con tarjeta en línea cuando lo necesites.', c: 'text-emerald-300 bg-emerald-500/10' },
              { i: QrCode, t: 'Check-in con QR', d: 'Cada reserva genera un código para validar la llegada del huésped en segundos.', c: 'text-indigo-300 bg-indigo-500/10' },
              { i: Wrench, t: 'Limpieza y mantenimiento', d: 'Marca habitaciones como disponibles, sucias o en mantenimiento y mantén al equipo sincronizado.', c: 'text-sky-300 bg-sky-500/10' },
              { i: Users, t: 'Equipo y recepción', d: 'Da acceso a recepcionistas con una vista simple, sin mostrarles tus finanzas.', c: 'text-teal-300 bg-teal-500/10' },
              { i: Home, t: 'Varias propiedades', d: 'Administra todas tus casas, departamentos y hoteles desde la misma cuenta.', c: 'text-violet-300 bg-violet-500/10' },
              { i: ShieldCheck, t: 'Datos protegidos', d: 'Información respaldada en la nube con acceso por roles y soporte técnico en español.', c: 'text-lime-300 bg-lime-500/10' }
            ].map(f => (
              <div key={f.t} className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 space-y-3 transition-colors">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${f.c}`}><f.i className="w-5 h-5" /></div>
                <h3 className="font-bold text-white">{f.t}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </InteractiveContainer>

      {/* RESERVAS DIRECTAS + CTA */}
      <InteractiveContainer className="py-16 px-4 md:px-6 border-b border-slate-900">
        <div className="max-w-6xl mx-auto rounded-3xl border border-brand-cyan/25 bg-gradient-to-br from-[#0E2A47] via-slate-900 to-slate-950 p-6 md:p-10 grid lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <h2 className="text-2xl md:text-3xl font-serif font-black text-white leading-tight">Cada reserva directa es dinero que no le dejas a una plataforma</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Las plataformas cobran comisión por cada reserva. Con tu propia página de reservas conectada a tu calendario, los huéspedes que ya te conocen reservan contigo y tú decides tus precios.
            </p>
            <ul className="space-y-3 text-sm text-slate-200">
              {['Tu enlace propio para compartir en redes y WhatsApp', 'Disponibilidad siempre al día con Airbnb y Booking', 'Tarifas por temporada y fin de semana', 'Políticas de cancelación y reembolso claras'].map(t => (
                <li key={t} className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-center space-y-5 bg-slate-950/70 p-6 md:p-7 rounded-2xl border border-brand-cyan/25 shadow-xl text-center lg:text-left">
            <div className="space-y-2.5">
              <h3 className="text-xl md:text-2xl font-serif font-black text-white leading-tight">Prueba Roomia con tu propio alojamiento</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                En una demo de 15 minutos conectamos tu calendario de Airbnb o Booking y te mostramos el panel con tus habitaciones y tarifas reales. Sin tarjeta y sin compromiso.
              </p>
            </div>
            <button
              onClick={() => openWhatsApp('Hola, quiero solicitar una demo por WhatsApp de Roomia PMS.')}
              className="w-full py-3.5 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2.5"
            >
              <MessageCircle className="w-5 h-5 fill-slate-950" />
              <span>Solicitar demo por WhatsApp</span>
            </button>
          </div>
        </div>
      </InteractiveContainer>

      {/* PRECIOS */}
      <InteractiveContainer id="precios" className="py-16 px-4 md:px-6 border-b border-slate-900 scroll-mt-20">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-5xl font-serif font-black text-white">Planes y precios</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Todos los planes incluyen las mismas funciones. Solo cambia la cantidad de propiedades y el nivel de soporte.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {[
              { name: 'Roomia 1', props: '1 propiedad', price: 29, old: 39, desc: 'Para una casa, departamento o hotel independiente.', soporte: 'Soporte en español', featured: false },
              { name: 'Roomia 3', props: 'Hasta 3 propiedades', price: 69, old: 89, desc: 'Para anfitriones que ya manejan varias propiedades.', soporte: 'Soporte prioritario', featured: true },
              { name: 'Roomia 5', props: 'Hasta 5 propiedades', price: 109, old: 139, desc: 'Para redes de departamentos o gestores turísticos.', soporte: 'Asesoría personalizada', featured: false }
            ].map(p => (
              <div key={p.name} className={`relative rounded-3xl p-7 flex flex-col justify-between gap-6 ${p.featured ? 'bg-slate-900 border-2 border-brand-cyan shadow-2xl shadow-brand-cyan/10 md:-translate-y-2' : 'bg-slate-900/60 border border-slate-800'}`}>
                {p.featured && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-cyan text-slate-950 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full">Más elegido</span>}
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{p.props}</p>
                  <h3 className="text-2xl font-black text-white">{p.name}</h3>
                  <p className="text-sm text-slate-400">{p.desc}</p>
                  <div className="border-t border-slate-800 pt-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-slate-500 line-through text-sm">${p.old}</span>
                      <span className="text-4xl font-black text-brand-cyan">${p.price}</span>
                      <span className="text-sm text-slate-400">/ mes</span>
                    </div>
                    <p className="text-xs text-emerald-400 font-semibold mt-1">Precio fundador, congelado de por vida</p>
                  </div>
                  <ul className="space-y-2.5 text-sm text-slate-200 pt-1">
                    {['Habitaciones, reservas y huéspedes ilimitados', 'Sincronización con Airbnb y Booking', 'Página de reservas directas', 'Panel de métricas y reportes', 'Recepción y check-in con QR', p.soporte].map(t => (
                      <li key={t} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{t}</li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => openWhatsApp(`Hola, me interesa el plan ${p.name} ($${p.price}/mes).`)}
                  className={`w-full py-3.5 rounded-xl text-sm font-extrabold cursor-pointer active:scale-95 transition ${p.featured ? 'bg-brand-cyan text-slate-950 hover:bg-[#3fc2f0]' : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'}`}
                >
                  Elegir {p.name}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-slate-400">
            Suscripción mensual fija, sin contrato de permanencia. Tarifa del 5 % solo en pagos con tarjeta en línea.
          </p>

          {/* Programa de clientes fundadores (el original) */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-brand-cyan/35 rounded-3xl p-6 md:p-8 max-w-5xl mx-auto shadow-2xl shadow-brand-cyan/10 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2 max-w-2xl">
                <h3 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>🚀 PROGRAMA DE CLIENTES FUNDADORES</span>
                </h3>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                  Los primeros 20 clientes obtienen hasta un <strong className="text-brand-cyan">22% de descuento permanente</strong> en su plan Roomia. Tu precio queda protegido mientras mantengas activa tu suscripción.
                </p>
              </div>
              <button
                onClick={() => setShowAllTiers(!showAllTiers)}
                className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-brand-cyan text-slate-950 hover:bg-[#3fc2f0] font-extrabold text-xs md:text-sm tracking-wide transition-all cursor-pointer shrink-0 active:scale-95 shadow-lg shadow-brand-cyan/20"
              >
                <span>{showAllTiers ? 'Contraer franjas' : 'Ver todas las franjas'}</span>
                {showAllTiers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <AnimatePresence>
              {showAllTiers && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="pt-6 border-t border-slate-800/80 space-y-5 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 md:p-5 bg-brand-cyan/10 border-2 border-brand-cyan/50 rounded-2xl flex flex-col justify-between gap-4 shadow-lg shadow-brand-cyan/10 relative overflow-hidden">
                      <div className="space-y-1.5 relative z-10">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-brand-cyan uppercase font-mono tracking-wider">FRANJA 1 (ACTIVA)</span>
                          <span className="px-2 py-0.5 bg-brand-cyan text-slate-950 font-black text-[9px] rounded-md uppercase tracking-wider animate-pulse">Cupos Abiertos</span>
                        </div>
                        <h4 className="text-base font-black text-white">Clientes 1 – 20</h4>
                        <p className="text-[11px] text-emerald-400 font-bold">Ahorro hasta 22% permanente</p>
                      </div>
                      <div className="pt-2.5 border-t border-brand-cyan/20 space-y-1.5 text-xs text-slate-200 font-mono relative z-10">
                        <div className="flex justify-between"><span className="text-slate-400">Roomia 1:</span><span className="font-bold text-white">$29 <span className="text-[10px] text-slate-400">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Roomia 3:</span><span className="font-bold text-brand-cyan">$69 <span className="text-[10px] text-slate-400">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Roomia 5:</span><span className="font-bold text-white">$109 <span className="text-[10px] text-slate-400">/mes</span></span></div>
                      </div>
                    </div>

                    <div className="p-4 md:p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4 opacity-85">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">FRANJA 2 (Siguiente)</span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 font-bold text-[9px] rounded-md uppercase">Próxima</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-200">Clientes 21 – 50</h4>
                        <p className="text-[11px] text-slate-400">Ahorro hasta 12% permanente</p>
                      </div>
                      <div className="pt-2.5 border-t border-slate-800 space-y-1.5 text-xs text-slate-300 font-mono">
                        <div className="flex justify-between"><span className="text-slate-500">Roomia 1:</span><span className="font-semibold text-slate-200">$34 <span className="text-[10px] text-slate-500">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Roomia 3:</span><span className="font-semibold text-slate-200">$79 <span className="text-[10px] text-slate-500">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Roomia 5:</span><span className="font-semibold text-slate-200">$124 <span className="text-[10px] text-slate-500">/mes</span></span></div>
                      </div>
                    </div>

                    <div className="p-4 md:p-5 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex flex-col justify-between gap-4 opacity-65">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">FRANJA 3 (Tarifa Final)</span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-500 font-bold text-[9px] rounded-md uppercase">Precio Oficial</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-300">Clientes 51+</h4>
                        <p className="text-[11px] text-slate-500">Tarifa regular de mercado</p>
                      </div>
                      <div className="pt-2.5 border-t border-slate-800 space-y-1.5 text-xs text-slate-400 font-mono">
                        <div className="flex justify-between"><span className="text-slate-600">Roomia 1:</span><span className="text-slate-300">$39 <span className="text-[10px] text-slate-600">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Roomia 3:</span><span className="text-slate-300">$89 <span className="text-[10px] text-slate-600">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Roomia 5:</span><span className="text-slate-300">$139 <span className="text-[10px] text-slate-600">/mes</span></span></div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-brand-cyan/10 border border-brand-cyan/20 rounded-2xl flex items-center justify-center gap-2 text-center">
                    <Lock className="w-4 h-4 text-brand-cyan shrink-0" />
                    <p className="text-xs md:text-sm font-bold text-brand-cyan leading-relaxed">
                      Una vez cerrado tu cupo, tu precio queda 100% congelado de por vida mientras mantengas activa tu suscripción.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </InteractiveContainer>

      {/* PREGUNTAS */}
      <InteractiveContainer id="preguntas" className="py-16 px-4 md:px-6 border-b border-slate-900 scroll-mt-20">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-4xl font-serif font-black text-white text-center">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={item.q} className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 cursor-pointer" aria-expanded={openFaq === i}>
                  <span className="font-semibold text-white text-sm md:text-base">{item.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <p className="px-5 pb-5 text-sm text-slate-400 leading-relaxed">{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </InteractiveContainer>

      {/* DEMO / CONTACTO */}
      <InteractiveContainer id="demo" className="py-16 px-4 md:px-6 scroll-mt-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-start">
          <div className="space-y-5">
            <h2 className="text-3xl md:text-4xl font-serif font-black text-white leading-tight">Cuéntanos de tu alojamiento y te mostramos cómo se vería en Roomia</h2>
            <p className="text-slate-400 text-sm leading-relaxed">En 15 minutos te enseñamos el panel con tu caso, sin compromiso. Al enviar el formulario se abre WhatsApp con tus datos ya escritos.</p>
            <div className="space-y-3 text-sm text-slate-300">
              <p className="flex items-center gap-3"><MessageCircle className="w-4 h-4 text-emerald-400" /> +593 98 405 6660</p>
              <a href={`mailto:${EMAIL}`} className="flex items-center gap-3 hover:text-brand-cyan"><Mail className="w-4 h-4 text-brand-cyan" /> {EMAIL}</a>
              <p className="flex items-center gap-3"><MapPin className="w-4 h-4 text-indigo-300" /> Hecho en Santa Elena, Ecuador</p>
            </div>
          </div>

          <form onSubmit={submitDemo} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-400">Tu nombre</span>
              <input className={field} placeholder="Ej. María Pérez" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-400">Tipo de alojamiento</span>
                <select className={field} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                  {['Casa o departamento', 'Cabaña o glamping', 'Hotel u hostal', 'Varios tipos'].map(o => <option key={o}>{o}</option>)}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-400">N.º de unidades</span>
                <input type="number" min={1} className={field} value={form.unidades} onChange={e => setForm({ ...form, unidades: e.target.value })} />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-400">¿Dónde publicas hoy?</span>
              <select className={field} value={form.plataformas} onChange={e => setForm({ ...form, plataformas: e.target.value })}>
                {['Airbnb', 'Booking', 'Airbnb y Booking', 'Solo reservas directas'].map(o => <option key={o}>{o}</option>)}
              </select>
            </label>
            <button type="submit" className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 transition">
              <MessageCircle className="w-5 h-5" /> Pedir demo por WhatsApp
            </button>
          </form>
        </div>
      </InteractiveContainer>

      {/* Botón para volver arriba (aparece al hacer scroll) */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Volver arriba"
        title="Volver arriba"
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-brand-cyan text-slate-950 shadow-xl shadow-brand-cyan/30 flex items-center justify-center cursor-pointer hover:bg-[#3fc2f0] active:scale-90 transition-all duration-300 ${showTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
}