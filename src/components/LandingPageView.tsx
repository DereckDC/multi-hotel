/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, Calendar, CheckCircle2, ChevronDown, Globe, Lock, Mail, MapPin,
  Menu, MessageCircle, AlertTriangle, MessagesSquare, ArrowUp, Clock, Building2, ChevronUp, QrCode, RefreshCw, ShieldCheck, TrendingUp, Users, X, Home, Wallet, BarChart3, Wrench, Gift, Receipt
} from 'lucide-react';
import {
  PLANS, TRIAL_DAYS, SETUP_FEE, ANNUAL_FREE_MONTHS, annualPrice, annualPerMonth, annualSavings, usd, usd2, type Plan
} from '../utils/plans';
import { LANDING_FAQ } from '../content/landingFaq';
import { BrandLogo } from './BrandLogo';
import { InteractiveContainer } from './InteractiveContainer';
import { GlobalTrailCursor } from './GlobalTrailCursor';
import { Button, BackButton, MenuItem, MenuToggle, OptionPicker } from './ui';

interface Props {
  onClose: () => void;
  onOpenLegal?: (type: 'terminos' | 'privacidad' | 'cancelaciones') => void;
}

const WHATSAPP = '593984056660';
const EMAIL = 'roomia.admincontact@gmail.com';

const NAV = [
  { id: 'problemas', label: 'Soluciones', icon: AlertTriangle },
  { id: 'como-funciona', label: 'Cómo funciona', icon: RefreshCw },
  { id: 'funciones', label: 'Funciones', icon: Wrench },
  { id: 'precios', label: 'Precios', icon: Wallet },
  { id: 'preguntas', label: 'Preguntas', icon: MessagesSquare }
];

const FAQ = LANDING_FAQ;

const DEMO_MESSAGE = 'Hola, quiero solicitar una demo por WhatsApp de Roomia PMS.';
const waHref = (message: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;

// Calendario de ejemplo del hero (días 1..30)
const DAY_STATE: Record<number, 'airbnb' | 'booking' | 'direct'> = {};
[3, 4, 5, 6].forEach(d => (DAY_STATE[d] = 'airbnb'));
[10, 11, 12, 13, 14].forEach(d => (DAY_STATE[d] = 'booking'));
[18, 19, 20].forEach(d => (DAY_STATE[d] = 'direct'));
[24, 25, 26, 27].forEach(d => (DAY_STATE[d] = 'airbnb'));
const STATE_STYLE = {
  airbnb: 'bg-danger-500/20 text-danger-200 border-danger-400/30',
  booking: 'bg-info-500/20 text-info-200 border-info-400/30',
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

  // Precios: mensual o anual, plan elegido para empezar la prueba y quién lo recomendó
  const [billing, setBilling] = useState<'mensual' | 'anual'>('mensual');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [referido, setReferido] = useState('');
  const annual = billing === 'anual';
  const shown = (monthly: number) => (annual ? annualPrice(monthly) : monthly);
  const per = annual ? '/ año' : '/ mes';

  React.useEffect(() => {
    if (!selectedPlan) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedPlan(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedPlan]);

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
      `Hola, soy ${form.nombre || 'un anfitrión'}. Administro: ${form.tipo}, ${form.unidades} unidad(es), uso ${form.plataformas}. Quisiera una demo de Roomia PMS.${referido.trim() ? ` Me recomendó ${referido.trim()}.` : ''}`
    );
  };

  // Empezar la prueba gratis del plan elegido: se abre WhatsApp con el resumen ya escrito
  const startTrial = () => {
    if (!selectedPlan) return;
    const periodo = annual
      ? `plan anual, ${usd(annualPrice(selectedPlan.price))} al año`
      : `plan mensual, ${usd(selectedPlan.price)} al mes`;
    openWhatsApp(
      `Hola, quiero empezar la prueba gratis de ${TRIAL_DAYS} días del plan ${selectedPlan.name} (${periodo}). ` +
      `Entiendo que incluye un pago único de ${usd(SETUP_FEE)} por la carga de mis unidades y la capacitación de mi personal.` +
      `${wantsInvoice ? ' Quiero que me avisen cuando esté la facturación electrónica del SRI.' : ''}` +
      `${referido.trim() ? ` Me recomendó ${referido.trim()}.` : ''}`
    );
    setSelectedPlan(null);
  };

  const field = 'w-full bg-slate-950 border border-slate-700 focus:border-brand-cyan focus:outline-none rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-slate-500';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      <GlobalTrailCursor />

      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <MenuToggle open={menuOpen} onClick={() => setMenuOpen(o => !o)} className="md:hidden -ml-2" />
            <BrandLogo size="lg" showText={true} lightText={true} />
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            {NAV.map(n => (
              <a key={n.id} href={`#${n.id}`} onClick={(e) => { e.preventDefault(); goTo(n.id); }} className="hover:text-brand-cyan transition-colors">{n.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2.5">

            <button
              onClick={() => openWhatsApp('Hola, quisiera solicitar una demostración por WhatsApp de Roomia PMS.')}
              className="hidden sm:flex px-4 py-2 bg-success-500 hover:bg-success-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-sm shadow-success-500/10 items-center gap-2 cursor-pointer active:scale-95"
            >
              <MessageCircle className="w-4 h-4 fill-slate-950" />
              <span>Solicitar Demo</span>
            </button>
            <BackButton onClick={onClose} />
          </div>
        </div>
      </nav>

      {/* Menú del teléfono: el mismo diseño que el menú de la app con sesión iniciada */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <div className="fixed inset-0 top-16 z-30 bg-neutral-950/50 backdrop-blur-xs md:hidden" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="fixed inset-x-0 top-16 z-40 flex flex-col overflow-hidden bg-neutral-950 shadow-xl md:hidden"
              id="landing-mobile-menu"
            >
              <div className="max-h-[70vh] space-y-1.5 overflow-y-auto overflow-x-hidden px-4 py-4">
                {NAV.map(n => (
                  <MenuItem key={n.id} icon={n.icon} label={n.label} onClick={() => goTo(n.id)} />
                ))}
              </div>
              <div className="space-y-1.5 bg-white/5 p-4">
                <MenuItem
                  icon={MessageCircle}
                  label="Solicitar demo por WhatsApp"
                  colorClass="text-success-400 hover:bg-white/5 hover:text-success-300"
                  onClick={() => { setMenuOpen(false); openWhatsApp('Hola, quisiera solicitar una demostración por WhatsApp de Roomia PMS.'); }}
                />
                <MenuItem icon={Home} label="Volver a Roomia" onClick={() => { setMenuOpen(false); onClose(); }} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* HERO */}
      <InteractiveContainer as="header" className="border-b border-slate-900">
        <div className="absolute -top-24 right-1/4 w-[520px] h-[520px] bg-brand-cyan/10 rounded-full blur-[110px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center relative">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-4xl md:text-6xl font-display font-black tracking-tight leading-[1.08] text-white">
              Un solo calendario para <span className="text-brand-cyan">Airbnb, Booking</span> y tus reservas directas
            </h1>
            <p className="text-base md:text-lg text-slate-400 max-w-xl leading-relaxed">
              Evita las dobles reservas, recibe huéspedes directamente sin pagar comisión por cada uno y mira cuánto gana realmente tu alojamiento, todo desde un panel hecho para anfitriones.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {/* Enlaces reales (href) para que los buscadores puedan seguirlos */}
              <a
                href={waHref(DEMO_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { e.preventDefault(); openWhatsApp(DEMO_MESSAGE); }}
                className="px-6 py-3.5 bg-success-500 hover:bg-success-400 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-xl shadow-success-500/20 hover:shadow-success-500/30 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex items-center gap-2.5"
              >
                <MessageCircle className="w-4 h-4 fill-slate-950" />
                <span>Solicitar demo por WhatsApp</span>
              </a>
              <a
                href="#precios"
                onClick={(e) => { e.preventDefault(); goTo('precios'); }}
                className="px-5 py-3.5 bg-brand-navy1 hover:bg-brand-navy-hover text-white font-bold text-xs md:text-sm rounded-xl border border-brand-cyan/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <span>Ver planes y precios</span>
                <ArrowRight className="w-4 h-4 text-brand-cyan" />
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              {['Demo de 15 minutos', 'Sin tarjeta ni contrato', 'Configuración con ayuda en español'].map(t => (
                <li key={t} className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success-400" />{t}</li>
              ))}
            </ul>
          </div>

          {/* Maqueta del dashboard con datos demo */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl space-y-3 text-left">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger-500" /><span className="w-2.5 h-2.5 rounded-full bg-warning-500" /><span className="w-2.5 h-2.5 rounded-full bg-success-500" />
                  <span className="text-micro text-slate-400 font-mono ml-2 uppercase tracking-wider whitespace-nowrap">Panel de control</span>
                </div>
                <div className="flex gap-1 text-micro font-semibold">
                  {['Hoy', '7 días', 'Este mes'].map((p, i) => (
                    <span key={p} className={`px-2 py-0.5 rounded-lg whitespace-nowrap ${i === 2 ? 'bg-brand-cyan text-slate-950' : 'bg-slate-800 text-slate-400'}`}>{p}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { l: 'Ocupación', v: '72%', d: '+8 pts', up: true, s: '4,6,5,7,8,7,9,10' },
                  { l: 'Ingresos', v: '$3.2k', d: '+14%', up: true, s: '3,5,4,6,8,7,9,11' },
                  { l: 'Por cobrar', v: '$180', d: '2 reservas', up: false, s: '4,4,5,5,4,4,5,5' },
                  { l: 'Canceladas', v: '4%', d: '-2 pts', up: true, s: '9,8,8,6,6,5,4,3' }
                ].map(k => (
                  <div key={k.l} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <p className="text-micro text-slate-500 font-bold uppercase tracking-wide truncate">{k.l}</p>
                    <p className="text-lg font-black text-white leading-tight">{k.v}</p>
                    <p className={`text-micro font-bold ${k.up ? 'text-success-400' : 'text-warning-400'}`}>{k.d}</p>
                    <svg viewBox="0 0 70 18" className="w-full h-4 mt-1" preserveAspectRatio="none">
                      <polyline fill="none" stroke={k.up ? '#2dd4bf' : '#fbbf24'} strokeWidth="1.6" points={k.s.split(',').map((v, i) => `${i * 10},${18 - Number(v) * 1.5}`).join(' ')} />
                    </svg>
                  </div>
                ))}
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-micro font-bold text-slate-200">Ocupación diaria y previsión</p>
                  <span className="text-micro text-slate-500 flex items-center gap-2"><i className="w-2 h-0.5 bg-teal-400 inline-block" />Real <i className="w-2 h-0.5 bg-teal-400/40 inline-block" />Prevista</span>
                </div>
                <svg viewBox="0 0 300 80" className="w-full h-16" preserveAspectRatio="none">
                  <path d="M0,50 L25,42 L50,46 L75,34 L100,38 L125,26 L150,30" fill="none" stroke="#2dd4bf" strokeWidth="2" />
                  <path d="M150,30 L175,36 L200,24 L225,28 L250,18 L275,22 L300,14" fill="none" stroke="#2dd4bf" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="4 3" />
                  <line x1="150" x2="150" y1="0" y2="80" stroke="#475569" strokeDasharray="2 3" />
                </svg>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <p className="text-micro font-bold text-slate-200">Origen de reservas</p>
                  {[['Directas', 46, 'bg-teal-400'], ['Airbnb', 38, 'bg-danger-400'], ['Booking', 16, 'bg-info-400']].map(([n, v, c]) => (
                    <div key={String(n)}>
                      <div className="flex justify-between text-micro text-slate-400"><span>{n}</span><span>{v}%</span></div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full ${c}`} style={{ width: `${v}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <p className="text-micro font-bold text-slate-200">Hoy</p>
                  <div className="grid grid-cols-2 gap-1 text-center">
                    {[['3', 'Llegadas'], ['2', 'Salidas'], ['5', 'En casa'], ['1', 'Mantenim.']].map(([v, l]) => (
                      <div key={l} className="bg-slate-900 rounded-lg py-1"><p className="text-sm font-black text-white leading-none">{v}</p><p className="text-micro text-slate-500">{l}</p></div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-micro text-slate-600 text-center">Datos de ejemplo</p>
            </div>
          </div>
        </div>
      </InteractiveContainer>

      {/* ¿QUÉ PROBLEMAS RESUELVE ROOMIA? + antes/después */}
      <InteractiveContainer id="problemas" className="py-16 px-4 md:px-6 border-b border-slate-900 scroll-mt-20">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-display font-black text-white">¿Qué problemas resuelve Roomia?</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Administrar a mano te cuesta reservas y dinero. Así elimina Roomia los cuellos de botella más comunes:</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { i: AlertTriangle, t: 'Reservas desordenadas entre Airbnb, Booking, WhatsApp y cuadernos', d: 'Centraliza toda la información en un solo calendario. Evita las dobles reservas, la pérdida de datos de huéspedes y el desgaste de coordinar varios canales a mano.', tile: 'bg-brand-cyan/10 text-brand-cyan', title: 'text-brand-cyan', hover: 'hover:border-brand-cyan/35' },
              { i: Clock, t: 'Recepción lenta y procesos manuales', d: 'Acelera la llegada de huéspedes con registro ágil y validación mediante código QR. Reduce las esperas a segundos y ofrece un servicio profesional.', tile: 'bg-info-500/10 text-info-400', title: 'text-info-300', hover: 'hover:border-info-500/35' },
              { i: Building2, t: 'Falta de control sobre habitaciones y limpieza', d: 'Mira al instante el estado de cada habitación: disponible, ocupada, en limpieza o en mantenimiento. Evita asignaciones incorrectas y mantén al equipo sincronizado.', tile: 'bg-success-500/10 text-success-400', title: 'text-success-300', hover: 'hover:border-success-500/35' },
              { i: TrendingUp, t: 'Cobros desorganizados y falta de reportes', d: 'Lleva el registro de cada abono, saldo pendiente e ingreso por reserva. Obtén ocupación, tarifa media y RevPAR en tiempo real para decidir mejor.', tile: 'bg-warning-500/10 text-warning-400', title: 'text-warning-300', hover: 'hover:border-warning-500/35' }
            ].map(p => (
              <div key={p.t} className={`p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 ${p.hover} rounded-2xl transition-all duration-300`}>
                <div className={`w-10 h-10 rounded-xl ${p.tile} flex items-center justify-center mb-4`}><p.i className="w-5 h-5" /></div>
                <h3 className={`text-sm md:text-base font-bold ${p.title} mb-2`}>{p.t}</h3>
                <p className="text-xs md:text-sm text-[#A8B2BD] leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-5 pt-2">
            <div className="rounded-2xl border border-danger-500/20 bg-danger-500/5 hover:bg-danger-500/10 hover:border-danger-500/40 p-6 space-y-4 transition-all duration-300">
              <h3 className="font-bold text-danger-300">Sin Roomia</h3>
              {[
                { i: MessagesSquare, t: 'Revisas Airbnb, Booking, WhatsApp y un cuaderno' },
                { i: AlertTriangle, t: 'Una reserva doble te obliga a cancelar a un huésped' },
                { i: TrendingUp, t: 'No sabes cuánto ganas realmente por noche' },
                { i: Wallet, t: 'Cobros y abonos anotados en distintos sitios' },
                { i: Wrench, t: 'Tu equipo pregunta por mensaje qué cuarto está listo' }
              ].map(({ i: Icon, t }) => (
                <div key={t} className="flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-xl bg-danger-500/10 text-danger-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Icon className="w-5 h-5" /></div>
                  <p className="text-sm text-slate-300 leading-snug">{t}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-success-500/25 bg-success-500/5 hover:bg-success-500/10 hover:border-success-500/45 p-6 space-y-4 transition-all duration-300">
              <h3 className="font-bold text-success-300">Con Roomia</h3>
              {[
                { i: Calendar, t: 'Un calendario con todas tus fechas ocupadas', c: 'bg-brand-cyan/10 text-brand-cyan' },
                { i: RefreshCw, t: 'Las fechas de Airbnb y Booking se bloquean solas', c: 'bg-info-500/10 text-info-400' },
                { i: BarChart3, t: 'Ocupación, tarifa media y RevPAR en tiempo real', c: 'bg-warning-500/10 text-warning-400' },
                { i: Wallet, t: 'Pagos y saldos pendientes por reserva', c: 'bg-success-500/10 text-success-400' },
                { i: Users, t: 'Estado de cada habitación visible para todo el equipo', c: 'bg-info-500/10 text-info-400' }
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
            <h2 className="text-3xl md:text-4xl font-display font-black text-white">Listo en tres pasos</h2>
            <p className="text-slate-400">Sin instalar nada. Te ayudamos a configurarlo.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: '1', t: 'Crea tu propiedad', d: 'Registra tu casa, departamento u hotel con sus habitaciones, fotos y tarifas.', c: 'text-brand-cyan bg-brand-cyan/10' },
              { n: '2', t: 'Conecta tus calendarios', d: 'Pega el enlace iCal de Airbnb y Booking. Las fechas ocupadas se bloquean automáticamente.', c: 'text-info-300 bg-info-500/10' },
              { n: '3', t: 'Recibe y controla', d: 'Acepta reservas directas, registra pagos y revisa tu rendimiento en el panel.', c: 'text-success-300 bg-success-500/10' }
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
            <h2 className="text-3xl md:text-4xl font-display font-black text-white">Todo lo que necesita un anfitrión</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Pensado para casas, departamentos, cabañas y hoteles pequeños.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { i: RefreshCw, t: 'Sincronización con Airbnb y Booking', d: 'Importa sus calendarios por propiedad y evita que dos huéspedes reserven la misma noche.', c: 'text-danger-300 bg-danger-500/10' },
              { i: Globe, t: 'Página de reservas directas', d: 'Tu propio enlace donde los huéspedes ven disponibilidad y precios y reservan sin comisión de terceros.', c: 'text-brand-cyan bg-brand-cyan/10' },
              { i: BarChart3, t: 'Panel con métricas claras', d: 'Ocupación, tarifa media, RevPAR, ingresos, cancelaciones y previsión de los próximos 30 días.', c: 'text-warning-300 bg-warning-500/10' },
              { i: Wallet, t: 'Pagos y saldos', d: 'Registra abonos, ve lo pendiente por cobrar y cobra con tarjeta en línea cuando lo necesites.', c: 'text-success-300 bg-success-500/10' },
              { i: QrCode, t: 'Check-in con QR', d: 'Cada reserva genera un código para validar la llegada del huésped en segundos.', c: 'text-info-300 bg-info-500/10' },
              { i: Wrench, t: 'Limpieza y mantenimiento', d: 'Marca habitaciones como disponibles, sucias o en mantenimiento y mantén al equipo sincronizado.', c: 'text-info-300 bg-info-500/10' },
              { i: Users, t: 'Equipo y recepción', d: 'Da acceso a recepcionistas con una vista simple, sin mostrarles tus finanzas.', c: 'text-teal-300 bg-teal-500/10' },
              { i: Home, t: 'Varias propiedades', d: 'Administra todas tus casas, departamentos y hoteles desde la misma cuenta.', c: 'text-info-300 bg-info-500/10' },
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
        <div className="max-w-6xl mx-auto rounded-2xl border border-brand-cyan/25 bg-gradient-to-br from-brand-navy1 via-slate-900 to-slate-950 p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <h2 className="text-2xl md:text-3xl font-display font-black text-white leading-tight">Cada reserva directa es dinero que no le dejas a una plataforma</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Las plataformas cobran comisión por cada reserva. Con tu propia página de reservas conectada a tu calendario, los huéspedes que ya te conocen reservan contigo y tú decides tus precios.
            </p>
            <ul className="space-y-3 text-sm text-slate-200">
              {['Tu enlace propio para compartir en redes y WhatsApp', 'Disponibilidad siempre al día con Airbnb y Booking', 'Tarifas por temporada y fin de semana', 'Políticas de cancelación y reembolso claras'].map(t => (
                <li key={t} className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-success-400 shrink-0" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-center space-y-5 bg-slate-950/70 p-6 md:p-7 rounded-2xl border border-brand-cyan/25 shadow-xl text-center lg:text-left">
            <div className="space-y-2.5">
              <h3 className="text-xl md:text-2xl font-display font-black text-white leading-tight">Prueba Roomia con tu propio alojamiento</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                En una demo de 15 minutos conectamos tu calendario de Airbnb o Booking y te mostramos el panel con tus habitaciones y tarifas reales. Sin tarjeta y sin compromiso.
              </p>
            </div>
            <a
              href={waHref(DEMO_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.preventDefault(); openWhatsApp(DEMO_MESSAGE); }}
              className="w-full py-3.5 px-6 bg-success-500 hover:bg-success-400 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-xl shadow-success-500/20 hover:shadow-success-500/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-2.5"
            >
              <MessageCircle className="w-5 h-5 fill-slate-950" />
              <span>Solicitar demo por WhatsApp</span>
            </a>
          </div>
        </div>
      </InteractiveContainer>

      {/* PRECIOS */}
      <InteractiveContainer id="precios" className="py-16 px-4 md:px-6 border-b border-slate-900 scroll-mt-20">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-5xl font-display font-black text-white">Planes y precios</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Todos los planes incluyen las mismas funciones. Cambian las propiedades, las unidades incluidas y el nivel de soporte.</p>
            <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-success-500/10 border border-success-400/30 text-success-300 text-xs font-bold">
              <Clock className="w-3.5 h-3.5" /> {TRIAL_DAYS} días de prueba gratis en cualquier plan
            </p>
          </div>

          {/* Mensual / Anual */}
          <div className="flex justify-center">
            <div role="group" aria-label="Periodo de facturación" className="inline-flex p-1 rounded-full bg-slate-900 border border-slate-800 text-sm font-bold">
              {([['mensual', 'Mensual'], ['anual', `Anual · ${ANNUAL_FREE_MONTHS} meses gratis`]] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setBilling(k)}
                  aria-pressed={billing === k}
                  className={`px-4 sm:px-5 py-2 rounded-full cursor-pointer transition ${billing === k ? 'bg-brand-cyan text-slate-950' : 'text-slate-300 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {PLANS.map(p => (
              <div key={p.id} className={`relative rounded-2xl p-7 flex flex-col justify-between gap-6 ${p.featured ? 'bg-slate-900 border-2 border-brand-cyan shadow-xl shadow-brand-cyan/10 md:-translate-y-2' : 'bg-slate-900/60 border border-slate-800'}`}>
                {p.featured && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-cyan text-slate-950 text-micro font-black uppercase tracking-wider px-3 py-1 rounded-full">Más elegido</span>}
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{p.props === 1 ? '1 propiedad' : `Hasta ${p.props} propiedades`}</p>
                  <h3 className="text-2xl font-black text-white">{p.name}</h3>
                  <p className="text-sm text-slate-400">{p.desc}</p>
                  <div className="border-t border-slate-800 pt-4">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-slate-500 line-through text-sm">{usd(shown(p.old))}</span>
                      <span className="text-4xl font-black text-brand-cyan">{usd(shown(p.price))}</span>
                      <span className="text-sm text-slate-400">{per}</span>
                    </div>
                    {annual && (
                      <p className="text-xs text-slate-300 mt-1">
                        Equivale a <strong className="text-white">{usd(annualPerMonth(p.price))} / mes</strong> · ahorras {usd(annualSavings(p.price))}
                      </p>
                    )}
                    <p className="text-xs text-success-400 font-semibold mt-1">Precio fundador, congelado de por vida</p>
                  </div>

                  {/* Límite de unidades y valor de cada unidad adicional */}
                  <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-slate-400">Unidades incluidas</span><span className="font-bold text-white">{p.units}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-400">Cada unidad adicional</span><span className="font-bold text-brand-cyan">{usd2(p.extraUnit)} / mes</span></div>
                  </div>

                  <ul className="space-y-2.5 text-sm text-slate-200 pt-1">
                    {[`Hasta ${p.units} unidades incluidas`, 'Reservas y huéspedes ilimitados', 'Sincronización con Airbnb y Booking', 'Página de reservas directas', 'Panel de métricas y reportes', 'Recepción y check-in con QR', p.soporte].map(t => (
                      <li key={t} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-success-400 shrink-0 mt-0.5" />{t}</li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => setSelectedPlan(p)}
                  className={`w-full py-3.5 rounded-xl text-sm font-extrabold cursor-pointer active:scale-95 transition ${p.featured ? 'bg-brand-cyan text-slate-950 hover:bg-brand-cyan-light' : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'}`}
                >
                  Probar {TRIAL_DAYS} días gratis
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-500 max-w-3xl mx-auto">
            Una unidad es una habitación o un departamento; una casa completa cuenta como 1 unidad. Si superas las unidades de tu plan se cobran las adicionales, y cuantas más tienes, más conviene el plan siguiente.
          </p>

          {/* Qué incluye empezar */}
          <div className="grid sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              { i: Clock, t: `${TRIAL_DAYS} días de prueba gratis`, d: 'Usa Roomia con todas sus funciones antes de pagar tu primera suscripción.', c: 'text-success-300 bg-success-500/10' },
              { i: Wrench, t: `Puesta en marcha: ${usd(SETUP_FEE)} único`, d: 'Cargamos la información de tus unidades en la plataforma y capacitamos a tu personal.', c: 'text-brand-cyan bg-brand-cyan/10' },
              { i: ShieldCheck, t: 'Sin comisión por reservas', d: 'Pagas solo tu suscripción: no cobramos un porcentaje de lo que reservan tus huéspedes.', c: 'text-warning-300 bg-warning-500/10' }
            ].map(({ i: Icon, t, d, c }) => (
              <div key={t} className="flex gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${c}`}><Icon className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm font-bold text-white">{t}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{d}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Complemento: facturación electrónica (próximamente) */}
          <div className="max-w-5xl mx-auto bg-slate-900/60 border border-info-400/30 rounded-2xl p-6 md:p-7 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-info-500/15 text-info-300 flex items-center justify-center"><Receipt className="w-5 h-5" /></div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-white">Facturación electrónica del SRI</h3>
                    <span className="px-2 py-0.5 rounded-lg bg-info-500/20 text-info-200 text-micro font-black uppercase tracking-wider">Próximamente</span>
                  </div>
                  <p className="text-sm text-slate-400 max-w-xl">Complemento opcional para emitir facturas electrónicas desde tus reservas, sin salir de Roomia. Hoy ya generas la pre-factura en PDF y en ticket para impresora.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openWhatsApp('Hola, quiero que me avisen cuando esté disponible la facturación electrónica del SRI en Roomia.')}
                className="shrink-0 px-5 py-3 rounded-xl bg-info-500/20 hover:bg-info-500/30 border border-info-400/40 text-info-100 text-sm font-bold cursor-pointer active:scale-95 transition"
              >
                Avísame cuando esté lista
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {PLANS.map(p => (
                <div key={p.id} className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 text-center">
                  <p className="text-micro text-slate-400 font-semibold">{p.name}</p>
                  <p className="text-lg font-black text-info-200">+{usd(shown(p.invoice))}<span className="text-micro font-semibold text-slate-400"> {per}</span></p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-slate-400">
            Sin comisión por tus reservas. El plan mensual no tiene contrato de permanencia.
          </p>

          {/* Programa de clientes fundadores (el original) */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-brand-cyan/35 rounded-2xl p-6 md:p-8 max-w-5xl mx-auto shadow-xl shadow-brand-cyan/10 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2 max-w-2xl">
                <h3 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>🚀 PROGRAMA DE CLIENTES FUNDADORES</span>
                </h3>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                  Los primeros 20 clientes obtienen hasta un <strong className="text-brand-cyan">22% de descuento permanente</strong> en su plan Roomia. Tu precio queda protegido mientras mantengas activa tu suscripción.
                </p>
              </div>
              <Button
                onClick={() => setShowAllTiers(!showAllTiers)}
                variant="accent" size="md" className="shrink-0"
              >
                <span>{showAllTiers ? 'Contraer franjas' : 'Ver todas las franjas'}</span>
                {showAllTiers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
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
                    <div className="p-4 md:p-5 bg-brand-cyan/10 border-2 border-brand-cyan/50 rounded-2xl flex flex-col justify-between gap-4 shadow-xl shadow-brand-cyan/10 relative overflow-hidden">
                      <div className="space-y-1.5 relative z-10">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-micro font-black text-brand-cyan uppercase font-mono tracking-wider">FRANJA 1 (ACTIVA)</span>
                          <span className="px-2 py-0.5 bg-brand-cyan text-slate-950 font-black text-micro rounded-lg uppercase tracking-wider animate-pulse">Cupos Abiertos</span>
                        </div>
                        <h4 className="text-base font-black text-white">Clientes 1 – 20</h4>
                        <p className="text-micro text-success-400 font-bold">Ahorro hasta 22% permanente</p>
                      </div>
                      <div className="pt-2.5 border-t border-brand-cyan/20 space-y-1.5 text-xs text-slate-200 font-mono relative z-10">
                        <div className="flex justify-between"><span className="text-slate-400">Roomia 1:</span><span className="font-bold text-white">$29 <span className="text-micro text-slate-400">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Roomia 3:</span><span className="font-bold text-brand-cyan">$69 <span className="text-micro text-slate-400">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Roomia 5:</span><span className="font-bold text-white">$109 <span className="text-micro text-slate-400">/mes</span></span></div>
                      </div>
                    </div>

                    <div className="p-4 md:p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4 opacity-85">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-micro font-bold text-slate-400 uppercase font-mono tracking-wider">FRANJA 2 (Siguiente)</span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 font-bold text-micro rounded-lg uppercase">Próxima</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-200">Clientes 21 – 50</h4>
                        <p className="text-micro text-slate-400">Ahorro hasta 12% permanente</p>
                      </div>
                      <div className="pt-2.5 border-t border-slate-800 space-y-1.5 text-xs text-slate-300 font-mono">
                        <div className="flex justify-between"><span className="text-slate-500">Roomia 1:</span><span className="font-semibold text-slate-200">$34 <span className="text-micro text-slate-500">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Roomia 3:</span><span className="font-semibold text-slate-200">$79 <span className="text-micro text-slate-500">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Roomia 5:</span><span className="font-semibold text-slate-200">$124 <span className="text-micro text-slate-500">/mes</span></span></div>
                      </div>
                    </div>

                    <div className="p-4 md:p-5 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex flex-col justify-between gap-4 opacity-65">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-micro font-bold text-slate-500 uppercase font-mono tracking-wider">FRANJA 3 (Tarifa Final)</span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-500 font-bold text-micro rounded-lg uppercase">Precio Oficial</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-300">Clientes 51+</h4>
                        <p className="text-micro text-slate-500">Tarifa regular de mercado</p>
                      </div>
                      <div className="pt-2.5 border-t border-slate-800 space-y-1.5 text-xs text-slate-400 font-mono">
                        <div className="flex justify-between"><span className="text-slate-600">Roomia 1:</span><span className="text-slate-300">$39 <span className="text-micro text-slate-600">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Roomia 3:</span><span className="text-slate-300">$89 <span className="text-micro text-slate-600">/mes</span></span></div>
                        <div className="flex justify-between"><span className="text-slate-600">Roomia 5:</span><span className="text-slate-300">$139 <span className="text-micro text-slate-600">/mes</span></span></div>
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

          {/* Programa de referidos */}
          <div id="referidos" className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-success-400/30 rounded-2xl p-6 md:p-8 max-w-5xl mx-auto shadow-xl shadow-success-500/5 scroll-mt-24">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <h3 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                  <Gift className="w-6 h-6 text-success-300 shrink-0" />
                  <span>PROGRAMA DE REFERIDOS</span>
                </h3>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                  Recomienda Roomia a otro anfitrión. Cuando se suscribe y menciona tu nombre, <strong className="text-success-300">tú ganas 1 mes gratis</strong> de tu plan y <strong className="text-success-300">él no paga los {usd(SETUP_FEE)} de puesta en marcha</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openWhatsApp('Hola, quiero referir a un anfitrión a Roomia. ¿Cómo funciona el programa de referidos?')}
                className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-success-500 hover:bg-success-400 text-slate-950 font-extrabold text-xs md:text-sm tracking-wide transition-all cursor-pointer shrink-0 active:scale-95 shadow-xl shadow-success-500/20"
              >
                <MessageCircle className="w-4 h-4" /> Quiero referir a alguien
              </button>
            </div>
            <ol className="grid sm:grid-cols-3 gap-3 mt-6">
              {[
                ['1', 'Recomiendas', 'Le hablas de Roomia a otro anfitrión.'],
                ['2', 'Se suscribe', 'Pide su prueba gratis y dice que va de tu parte.'],
                ['3', 'Ambos ganan', 'Tú, 1 mes gratis; él, sin el pago de puesta en marcha.']
              ].map(([n, t, d]) => (
                <li key={n} className="flex gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                  <span className="w-8 h-8 shrink-0 rounded-lg bg-success-500/15 text-success-300 font-mono font-black flex items-center justify-center">{n}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{t}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </InteractiveContainer>

      {/* PREGUNTAS */}
      <InteractiveContainer id="preguntas" className="py-16 px-4 md:px-6 border-b border-slate-900 scroll-mt-20">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-4xl font-display font-black text-white text-center">Preguntas frecuentes</h2>
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
            <h2 className="text-3xl md:text-4xl font-display font-black text-white leading-tight">Cuéntanos de tu alojamiento y te mostramos cómo se vería en Roomia</h2>
            <p className="text-slate-400 text-sm leading-relaxed">En 15 minutos te enseñamos el panel con tu caso, sin compromiso. Al enviar el formulario se abre WhatsApp con tus datos ya escritos.</p>
            <div className="space-y-3 text-sm text-slate-300">
              <p className="flex items-center gap-3"><MessageCircle className="w-4 h-4 text-success-400" /> +593 98 405 6660</p>
              <a href={`mailto:${EMAIL}`} className="flex items-center gap-3 hover:text-brand-cyan"><Mail className="w-4 h-4 text-brand-cyan" /> {EMAIL}</a>
              <p className="flex items-center gap-3"><MapPin className="w-4 h-4 text-info-300" /> Hecho en Santa Elena, Ecuador</p>
            </div>
          </div>

          <form onSubmit={submitDemo} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-left">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-400">Tu nombre</span>
              <input className={field} placeholder="Ej. María Pérez" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-400">Tipo de alojamiento</span>
                <OptionPicker
                  tone="dark"
                  hideLabel
                  label="Tipo de alojamiento"
                  value={form.tipo}
                  options={['Casa o departamento', 'Cabaña o glamping', 'Hotel u hostal', 'Varios tipos'].map(o => ({ value: o, label: o }))}
                  onChange={v => setForm({ ...form, tipo: v })}
                />
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-400">N.º de unidades</span>
                <input type="number" min={1} className={field} value={form.unidades} onChange={e => setForm({ ...form, unidades: e.target.value })} />
              </label>
            </div>
            <div className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-400">¿Dónde publicas hoy?</span>
              <OptionPicker
                tone="dark"
                hideLabel
                label="¿Dónde publicas hoy?"
                value={form.plataformas}
                options={['Airbnb', 'Booking', 'Airbnb y Booking', 'Solo reservas directas'].map(o => ({ value: o, label: o }))}
                onChange={v => setForm({ ...form, plataformas: v })}
              />
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-400">¿Te recomendó alguien? (opcional)</span>
              <input className={field} placeholder="Nombre de quien te recomendó" value={referido} onChange={e => setReferido(e.target.value)} />
            </label>
            <button type="submit" className="w-full py-3.5 bg-success-500 hover:bg-success-400 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 transition">
              <MessageCircle className="w-5 h-5" /> Pedir demo por WhatsApp
            </button>
          </form>
        </div>
      </InteractiveContainer>

      {/* Resumen del plan elegido: prueba gratis y puesta en marcha */}
      <AnimatePresence>
        {selectedPlan && (
          <motion.div
            className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPlan(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="plan-dialog-title"
              className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-success-300">Prueba gratis de {TRIAL_DAYS} días</p>
                  <h3 id="plan-dialog-title" className="text-2xl font-black text-white mt-1">{selectedPlan.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedPlan.props === 1 ? '1 propiedad' : `Hasta ${selectedPlan.props} propiedades`} · {selectedPlan.units} unidades incluidas
                  </p>
                </div>
                <Button type="button" onClick={() => setSelectedPlan(null)} aria-label="Cerrar" variant="icon">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-800 divide-y divide-slate-800 text-sm">
                <div className="flex justify-between gap-4 p-3.5">
                  <span className="text-slate-300">Prueba gratis</span>
                  <span className="font-bold text-success-300">{TRIAL_DAYS} días</span>
                </div>
                <div className="flex justify-between gap-4 p-3.5">
                  <span className="text-slate-300">Después de la prueba</span>
                  <span className="font-bold text-white text-right">
                    {usd(shown(selectedPlan.price))} {per}
                    {annual && <span className="block text-micro font-medium text-slate-400">equivale a {usd(annualPerMonth(selectedPlan.price))} / mes</span>}
                  </span>
                </div>
                <div className="p-3.5 bg-brand-cyan/5">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-100 font-semibold">Puesta en marcha (pago único)</span>
                    <span className="font-black text-brand-cyan">{usd(SETUP_FEE)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">Incluye subir y cargar la información de tus unidades a la plataforma y capacitar a tu personal.</p>
                </div>
                <div className="flex justify-between gap-4 p-3.5">
                  <span className="text-slate-300">Cada unidad adicional</span>
                  <span className="font-bold text-white">{usd2(selectedPlan.extraUnit)} / mes</span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                <input type="checkbox" checked={wantsInvoice} onChange={e => setWantsInvoice(e.target.checked)} className="mt-0.5 w-4 h-4 accent-violet-400 cursor-pointer" />
                <span>Avísame cuando esté la <strong className="text-white">facturación electrónica del SRI</strong> (próximamente, +{usd(shown(selectedPlan.invoice))} {per}).</span>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-400">¿Te recomendó alguien? (opcional)</span>
                <input className={field} placeholder="Nombre de quien te recomendó" value={referido} onChange={e => setReferido(e.target.value)} />
              </label>

              <button
                type="button"
                onClick={startTrial}
                className="w-full py-3.5 bg-success-500 hover:bg-success-400 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 transition"
              >
                <MessageCircle className="w-5 h-5" /> Continuar por WhatsApp
              </button>
              <p className="text-micro text-slate-500 text-center">Te escribimos para coordinar la puesta en marcha y el inicio de tu prueba.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón para volver arriba (aparece al hacer scroll) */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Volver arriba"
        title="Volver arriba"
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-brand-cyan text-slate-950 shadow-xl shadow-brand-cyan/30 flex items-center justify-center cursor-pointer hover:bg-brand-cyan-light active:scale-90 transition-all duration-300 ${showTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
}
