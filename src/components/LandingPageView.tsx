/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Building2, 
  CheckCircle, 
  ArrowLeft, 
  QrCode, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Workflow, 
  Users,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Settings,
  Layers,
  Calendar,
  ChevronDown,
  ChevronUp,
  Star,
  Lock,
  MessageCircle
} from 'lucide-react';
import { InteractiveContainer } from './InteractiveContainer';
import { GlobalTrailCursor } from './GlobalTrailCursor';
import { BrandLogo } from './BrandLogo';

interface LandingPageViewProps {
  onClose: () => void;
  onOpenLegal?: (type: 'terminos' | 'privacidad' | 'cancelaciones') => void;
}

export default function LandingPageView({ onClose, onOpenLegal }: LandingPageViewProps) {
  const [showAllTiers, setShowAllTiers] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const openWhatsApp = (customMessage?: string) => {
    const text = encodeURIComponent(
      customMessage || "Hola, quisiera solicitar una demostración e información personalizada de Roomia PMS para mis propiedades."
    );
    const url = `https://wa.me/593984056660?text=${text}`;
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      window.open(url, "_system");
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('roomia.admincontact@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans animate-fade-in relative">
      <GlobalTrailCursor />
      
      {/* Sticky Top Navbar */}
      <nav className="bg-slate-950/95 border-b border-slate-900 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="lg" showText={true} lightText={true} />
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <button 
              onClick={() => document.getElementById('problemas')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-brand-cyan transition-colors cursor-pointer"
            >
              Soluciones
            </button>
            <button 
              onClick={() => document.getElementById('funciones')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-brand-cyan transition-colors cursor-pointer"
            >
              Funciones
            </button>
            <button 
              onClick={() => document.getElementById('para-quien')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-brand-cyan transition-colors cursor-pointer"
            >
              ¿Para quién?
            </button>
            <button 
              onClick={() => document.getElementById('precios')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-brand-cyan transition-colors cursor-pointer text-brand-cyan font-bold"
            >
              Precios y Planes
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openWhatsApp("Hola, quisiera solicitar una demostración por WhatsApp de Roomia PMS.")}
              className="hidden sm:flex px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md shadow-emerald-500/10 items-center gap-2 cursor-pointer active:scale-95"
            >
              <MessageCircle className="w-4 h-4 fill-slate-950" />
              <span>Solicitar Demo</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#0E2A47] hover:bg-[#133A62] border border-brand-cyan/30 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-brand-cyan/5 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-brand-cyan" />
              <span>Volver</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 1. HERO SECTION */}
      <InteractiveContainer as="header" className="bg-slate-950 py-10 md:py-20 px-4 md:px-6 border-b border-slate-900">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-brand-cyan/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-10 w-[300px] h-[300px] bg-brand-cyan/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
            
            {/* Left Column Text & Immediate CTA */}
            <div className="lg:col-span-7 space-y-4 md:space-y-6 text-left font-sans">
              <h1 className="text-3xl md:text-5.5xl lg:text-6xl font-serif font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#23B4E6] via-white to-slate-200 leading-[1.1] pr-2">
                Deja de perder reservas en WhatsApp, cuadernos y Excel
              </h1>

              <p className="text-xs md:text-base text-[#A8B2BD] max-w-xl leading-relaxed">
                Roomia es la plataforma integral en la nube para administrar reservas, habitaciones, huéspedes e ingresos en tiempo real. Automatice su recepción y tome el control total de su hospedaje desde cualquier dispositivo.
              </p>

              {/* Action Buttons - CTA #1 visible without scroll */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={() => openWhatsApp("Hola, quiero solicitar una demo por WhatsApp de Roomia PMS.")}
                  className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex items-center gap-2.5"
                >
                  <MessageCircle className="w-4 h-4 fill-slate-950" />
                  <span>Solicitar demo por WhatsApp</span>
                </button>

                <button
                  onClick={() => document.getElementById('precios')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-5 py-3.5 bg-[#0E2A47] hover:bg-[#133A62] text-white font-bold text-xs md:text-sm rounded-xl border border-brand-cyan/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <span>Ver planes y precios</span>
                  <ArrowRight className="w-4 h-4 text-brand-cyan" />
                </button>
              </div>

              <div className="pt-2 flex items-center gap-4 text-[11px] text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Demo rápida de 15 min
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Sin compromisos ni tarjetas
                </span>
              </div>
            </div>

            {/* Right Column Product Visual Mockup */}
            <div className="lg:col-span-5 relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-brand-cyan/20 to-indigo-500/20 rounded-3xl blur-2xl group-hover:scale-105 transition-transform duration-500" />
              
              <div className="relative bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-md">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="text-[10px] text-slate-400 font-mono ml-2 uppercase tracking-wider">PANEL EN TIEMPO REAL</span>
                  </div>
                  <div className="px-2 py-0.5 bg-brand-cyan/10 text-brand-cyan rounded text-[9px] font-bold tracking-wider font-mono">
                    ROOMIA PMS
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-brand-cyan font-mono uppercase tracking-wider">Propiedad Activa</span>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase">Sincronizado</span>
                    </div>
                    <p className="text-xs font-bold text-white flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-brand-cyan" />
                      <span>Hotel Vista Mar & Resort</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-950 border border-emerald-500/20 rounded-xl flex flex-col space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">Cuarto 101</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">Doble Luxury</p>
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded mr-auto uppercase">Disponible</span>
                    </div>

                    <div className="p-2.5 bg-slate-950 border border-indigo-500/20 rounded-xl flex flex-col space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">Cuarto 102</span>
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">Suite VIP</p>
                      <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded mr-auto uppercase">Ocupada</span>
                    </div>

                    <div className="p-2.5 bg-slate-950 border border-amber-500/20 rounded-xl flex flex-col space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">Cuarto 103</span>
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">Familiar Sea View</p>
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded mr-auto uppercase">Mantenimiento</span>
                    </div>

                    <div className="p-2.5 bg-slate-950 border border-rose-500/20 rounded-xl flex flex-col space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">Cuarto 104</span>
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">Boutique Single</p>
                      <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded mr-auto uppercase">Limpieza</span>
                    </div>
                  </div>

                  <div className="bg-[#1E2E3E]/40 border border-brand-cyan/20 rounded-xl p-3 flex gap-2.5 items-start">
                    <QrCode className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-white leading-tight">Check-in rápido con QR</p>
                      <p className="text-[10px] text-slate-400 leading-normal">Valide el ingreso del huésped en segundos escaneando su voucher digital.</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </InteractiveContainer>

      {/* 2. ¿QUÉ PROBLEMAS RESUELVE ROOMIA? (Exactamente 4 tarjetas) */}
      <InteractiveContainer id="problemas" className="bg-slate-950 text-white py-14 px-4 md:px-6 border-b border-slate-900">
        <div className="max-w-5xl mx-auto relative z-10 space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-4xl font-serif font-black tracking-tight text-white">
              ¿Qué problemas resuelve Roomia?
            </h2>
            <p className="text-xs md:text-sm text-[#A8B2BD] max-w-xl mx-auto leading-relaxed">
              La administración de un hospedaje no tiene por qué ser compleja ni desordenada. Así es como Roomia elimina los cuellos de botella más comunes:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Problema 1 */}
            <div className="p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-brand-cyan/35 rounded-2xl transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4">
                <AlertTriangle className="w-5 h-5 pointer-events-none" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-brand-cyan mb-2">
                Reservas desordenadas entre WhatsApp, cuadernos y Excel
              </h3>
              <p className="text-xs text-[#A8B2BD] leading-relaxed">
                Centralice toda la información en un solo lugar. Evite la duplicidad de reservas, la pérdida de datos de huéspedes y el desgaste de coordinar múltiples canales de forma manual.
              </p>
            </div>

            {/* Problema 2 */}
            <div className="p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-brand-cyan/35 rounded-2xl transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4">
                <Clock className="w-5 h-5 pointer-events-none" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-brand-cyan mb-2">
                Recepción lenta y procesos manuales
              </h3>
              <p className="text-xs text-[#A8B2BD] leading-relaxed">
                Acelere la llegada de huéspedes con registro ágil de datos y validación rápida mediante código QR. Reduzca las filas de espera a segundos y brinde un servicio profesional.
              </p>
            </div>

            {/* Problema 3 */}
            <div className="p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-brand-cyan/35 rounded-2xl transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5 pointer-events-none" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-brand-cyan mb-2">
                Falta de control sobre habitaciones y limpieza
              </h3>
              <p className="text-xs text-[#A8B2BD] leading-relaxed">
                Monitoree al instante el estado de cada habitación: disponible, ocupada, en limpieza o en mantenimiento. Evite asignaciones incorrectas y mantenga al equipo sincronizado.
              </p>
            </div>

            {/* Problema 4 */}
            <div className="p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-brand-cyan/35 rounded-2xl transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 pointer-events-none" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-brand-cyan mb-2">
                Cobros desorganizados y falta de reportes
              </h3>
              <p className="text-xs text-[#A8B2BD] leading-relaxed">
                Lleve un registro riguroso de cada abono, saldo pendiente e ingresos por reserva. Obtenga métricas consolidadas en tiempo real con reportes claros para tomar mejores decisiones.
              </p>
            </div>

          </div>
        </div>
      </InteractiveContainer>

      {/* 3. ¿CÓMO FUNCIONA? (3 pasos) */}
      <InteractiveContainer className="bg-slate-950 py-14 px-4 md:px-6 border-b border-slate-900">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-4xl font-serif font-black tracking-tight text-white">
              ¿Cómo funciona?
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              Modernice la administración de su propiedad en tres sencillos pasos:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            
            {/* Step 1 */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-brand-cyan/35 transition-all flex flex-col space-y-4 shadow-xl relative z-10">
              <div className="w-12 h-12 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center shadow-sm font-bold text-lg font-mono">
                1
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Configure su propiedad</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Registre sus habitaciones, tipos de alojamiento, tarifas por temporada y datos principales en pocos minutos.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/35 transition-all flex flex-col space-y-4 shadow-xl relative z-10">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shadow-sm font-bold text-lg font-mono">
                2
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Gestione reservas y operación diaria</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Realice check-ins con QR, registre huéspedes, controle cobros, estados de habitaciones y calendario de ocupación.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/35 transition-all flex flex-col space-y-4 shadow-xl relative z-10">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shadow-sm font-bold text-lg font-mono">
                3
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Controle su negocio con reportes</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Consulte la ocupación, los ingresos acumulados, noches vendidas y el rendimiento general con gráficos en tiempo real.
              </p>
            </div>

          </div>
        </div>
      </InteractiveContainer>

      {/* 4. FUNCIONES CLAVE (Fusionada con "por qué eligen Roomia PMS") */}
      <InteractiveContainer id="funciones" className="py-14 px-4 md:px-6 border-b border-slate-900">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-4xl font-serif font-black tracking-tight text-white">
              Funciones clave para una operación más rápida, ordenada y rentable
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Todo lo que su hospedaje necesita para ahorrar tiempo, evitar errores operativos y maximizar ingresos en un solo sistema:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-brand-cyan/35 hover:bg-slate-900 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm md:text-base">Gestión multi-propiedad centralizada</h3>
                <p className="text-xs text-slate-400 leading-normal">
                  Administre uno o varios hospedajes desde la misma cuenta. Configure habitaciones, tarifas y disponibilidad sin cambiar de sistema.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/35 hover:bg-slate-900 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm md:text-base">Check-in más ágil con código QR</h3>
                <p className="text-xs text-slate-400 leading-normal">
                  Genere un código QR por reserva para validar la llegada del huésped en segundos. Reduzca filas y agilice el ingreso.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/35 hover:bg-slate-900 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm md:text-base">Recepción y registro en un solo flujo</h3>
                <p className="text-xs text-slate-400 leading-normal">
                  Registre huéspedes, walk-ins sin reserva previa, asigne habitaciones y cargue pagos desde un panel unificado.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-amber-500/35 hover:bg-slate-900 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm md:text-base">Reportes de ocupación e ingresos</h3>
                <p className="text-xs text-slate-400 leading-normal">
                  Consulte en tiempo real la ocupación, noches reservadas, ingresos por propiedad y analítica de rendimiento clara.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-rose-500/35 hover:bg-slate-900 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm md:text-base">Control de limpieza y mantenimiento</h3>
                <p className="text-xs text-slate-400 leading-normal">
                  Cambie estados de habitaciones a sucia, en limpieza o mantenimiento en tiempo real para evitar errores de asignación.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-brand-cyan/35 hover:bg-slate-900 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm md:text-base">Calendario visual de reservas</h3>
                <p className="text-xs text-slate-400 leading-normal">
                  Visualice la ocupación por fechas, check-ins, check-outs y carga operativa de cada propiedad en una sola vista.
                </p>
              </div>
            </div>

          </div>

          {/* Destacados clave por los que eligen Roomia */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-4 mt-8">
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>¿Por qué los propietarios eligen Roomia?</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Fácil e intuitivo:</strong> Diseñado para operar desde el primer día sin capacitaciones largas ni complicaciones.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>100% en tiempo real:</strong> Sincronización instantánea de reservas, habitaciones y cobros para todo el equipo.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Transparente y sin sorpresas:</strong> Suscripción mensual fija según su plan. Tarifa del 5% solo al procesar cobros con tarjeta en línea (cubre la pasarela y la dispersión del dinero).</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Seguridad y respaldo:</strong> Datos respaldados en la nube con acceso protegido y soporte técnico en español.</span>
              </div>
            </div>
          </div>

        </div>
      </InteractiveContainer>

      {/* 5. CTA INTERMEDIO (Botón CTA #2 "Solicitar demo por WhatsApp") */}
      <InteractiveContainer className="bg-slate-950 py-12 px-4 md:px-6 border-b border-slate-900">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-[#0E2A47] via-slate-900 to-[#0E2A47] border border-brand-cyan/30 rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="space-y-3 relative z-10">
            <h2 className="text-2xl md:text-3.5xl font-serif font-black text-white">
              ¿Listo para transformar la gestión de su negocio?
            </h2>
            <p className="text-xs md:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              Solicite una demostración personalizada de 15 minutos y descubra cómo Roomia se adapta exactamente a su tipo de propiedad.
            </p>
          </div>

          <div className="pt-2 relative z-10 flex justify-center">
            <button
              onClick={() => openWhatsApp("Hola, quiero solicitar una demo por WhatsApp de Roomia PMS.")}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex items-center gap-3"
            >
              <MessageCircle className="w-5 h-5 fill-slate-950" />
              <span>Solicitar demo por WhatsApp</span>
            </button>
          </div>
        </div>
      </InteractiveContainer>

      {/* 6. ¿PARA QUIÉN ES ROOMIA? (Una sola vez: fusión completa) */}
      <InteractiveContainer id="para-quien" className="bg-slate-950 text-white py-14 px-4 md:px-6 border-b border-slate-900">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-4xl font-serif font-black tracking-tight text-white">
              ¿Para quién es Roomia?
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Un PMS flexible diseñado para adaptarse a las dimensiones y necesidades específicas de cada tipo de hospedaje:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center space-y-3 hover:border-brand-cyan/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-xs text-slate-200 leading-snug">Hoteles y hostales</h3>
              <p className="text-[11px] text-slate-400">Establecimientos boutique, urbanos o albergues.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center space-y-3 hover:border-indigo-500/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-xs text-slate-200 leading-snug">Glampings y cabañas</h3>
              <p className="text-[11px] text-slate-400">Sitios ecológicos y experiencias al aire libre.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center space-y-3 hover:border-rose-500/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-xs text-slate-200 leading-snug">Suites y departamentos</h3>
              <p className="text-[11px] text-slate-400">Alquileres temporales, departamentos y villas.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center space-y-3 hover:border-emerald-500/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-xs text-slate-200 leading-snug">Una o varias propiedades</h3>
              <p className="text-[11px] text-slate-400">Negocios con 1 sede o múltiples propiedades.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center space-y-3 hover:border-amber-500/40 transition-colors group sm:col-span-2 lg:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-xs text-slate-200 leading-snug">Administradores</h3>
              <p className="text-[11px] text-slate-400">Que necesitan profesionalizar su recepción.</p>
            </div>

          </div>
        </div>
      </InteractiveContainer>

      {/* 7. SECCIÓN DE PRECIOS Y PLANES (NUEVA) */}
      <InteractiveContainer id="precios" className="bg-slate-950 py-16 px-4 md:px-6 border-b border-slate-900">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight text-white">
              Planes y Precios
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Elija el plan adecuado según la cantidad de propiedades que administra. Todos los planes incluyen el 100% de las funciones de Roomia.
            </p>
          </div>

          {/* Pricing Grid - 3 Plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            
            {/* Plan 1: Roomia 1 */}
            <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-6 transition-all">
              <div className="space-y-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">1 PROPIEDAD</span>
                <h3 className="text-2xl font-black text-white">Roomia 1</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ideal para hoteles, hostales o cabañas independientes que buscan profesionalizar su recepción.
                </p>

                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-baseline gap-2">
                    <span className="text-slate-500 line-through text-sm font-semibold">$39/mes</span>
                    <span className="text-3xl font-black text-brand-cyan">$29</span>
                    <span className="text-xs text-slate-400 font-medium">/ mes</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold block mt-1">✓ Precio Fundador Congelado</span>
                </div>

                <ul className="space-y-2.5 pt-4 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>1 Propiedad</strong> registrada</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Reservas y huéspedes ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Módulo de recepción y Check-in QR</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Calendario e inventario de cuartos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Reportes de ocupación e ingresos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Soporte directo en español</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => openWhatsApp("Hola, me interesa el Plan Roomia 1 ($29/mes) para 1 propiedad.")}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center block border border-slate-700 active:scale-95"
              >
                Solicitar Plan Roomia 1
              </button>
            </div>

            {/* Plan 2: Roomia 3 (Destacado "Más Elegido") */}
            <div className="bg-slate-900 border-2 border-brand-cyan rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-6 shadow-2xl shadow-brand-cyan/10 relative transform md:-translate-y-2 transition-all">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-cyan text-slate-950 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                MÁS ELEGIDO
              </div>

              <div className="space-y-4">
                <span className="text-[11px] font-bold text-brand-cyan uppercase tracking-wider font-mono">3 PROPIEDADES</span>
                <h3 className="text-2xl font-black text-white">Roomia 3</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Perfecto para administradores con hasta 3 sedes o complejos turísticos en expansión.
                </p>

                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-baseline gap-2">
                    <span className="text-slate-500 line-through text-sm font-semibold">$89/mes</span>
                    <span className="text-3xl font-black text-brand-cyan">$69</span>
                    <span className="text-xs text-slate-400 font-medium">/ mes</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold block mt-1">✓ Precio Fundador Congelado</span>
                </div>

                <ul className="space-y-2.5 pt-4 text-xs text-slate-200">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-brand-cyan shrink-0" />
                    <span><strong>Hasta 3 Propiedades</strong> o sedes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-brand-cyan shrink-0" />
                    <span>Gestión multi-propiedad centralizada</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-brand-cyan shrink-0" />
                    <span>Reservas y huéspedes ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-brand-cyan shrink-0" />
                    <span>Módulo de recepción y Check-in QR</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-brand-cyan shrink-0" />
                    <span>Reportes consolidados por propiedad</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-brand-cyan shrink-0" />
                    <span>Soporte prioritario en español</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => openWhatsApp("Hola, me interesa el Plan Roomia 3 ($69/mes) para 3 propiedades.")}
                className="w-full py-3.5 bg-brand-cyan hover:bg-[#3fc2f0] text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer text-center block shadow-lg shadow-brand-cyan/20 active:scale-95"
              >
                Solicitar Plan Roomia 3
              </button>
            </div>

            {/* Plan 3: Roomia 5 */}
            <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-6 transition-all">
              <div className="space-y-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">5 PROPIEDADES</span>
                <h3 className="text-2xl font-black text-white">Roomia 5</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Diseñado para grupos hoteleros, redes de departamentos o empresas de gestión turística.
                </p>

                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-baseline gap-2">
                    <span className="text-slate-500 line-through text-sm font-semibold">$139/mes</span>
                    <span className="text-3xl font-black text-brand-cyan">$109</span>
                    <span className="text-xs text-slate-400 font-medium">/ mes</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold block mt-1">✓ Precio Fundador Congelado</span>
                </div>

                <ul className="space-y-2.5 pt-4 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Hasta 5 Propiedades</strong> o sedes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Gestión multi-propiedad avanzada</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Reservas y huéspedes ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Módulo de recepción y Check-in QR</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Reportes financieros consolidados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Asesoría y soporte personalizado</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => openWhatsApp("Hola, me interesa el Plan Roomia 5 ($109/mes) para 5 propiedades.")}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center block border border-slate-700 active:scale-95"
              >
                Solicitar Plan Roomia 5
              </button>
            </div>

          </div>

          {/* Texto Aclaratorio Requerido */}
          <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 text-center max-w-3xl mx-auto">
            <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed">
              "Todo Roomia para administrar 1 propiedad — no es una versión limitada. Más propiedades, mayor capacidad, nunca menos funciones."
            </p>
          </div>

          {/* Bloque: Programa de Clientes Fundadores (Colapsable) */}
          <div className="bg-slate-900/90 border border-brand-cyan/30 rounded-3xl p-6 md:p-8 space-y-6 max-w-3xl mx-auto shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-bold text-white">Programa de Clientes Fundadores</h3>
                  <p className="text-xs text-slate-400">Precios promocionales por cupos limitados de lanzamiento.</p>
                </div>
              </div>
            </div>

            {/* Always Visible: Franja Activa Default */}
            <div className="space-y-3">
              <div className="p-4 bg-brand-cyan/10 border border-brand-cyan/30 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-brand-cyan uppercase font-mono tracking-wider block">FRANJA 1 (ACTIVA AHORA)</span>
                  <h4 className="text-sm font-extrabold text-white">Clientes 1 – 20</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Roomia 1: $29/mes | Roomia 3: $69/mes | Roomia 5: $109/mes</p>
                </div>
                <span className="px-2.5 py-1 bg-brand-cyan text-slate-950 font-black text-[10px] rounded-lg uppercase tracking-wide">
                  Cupos Abiertos
                </span>
              </div>

              {/* Collapsible Section for Tiers 2 & 3 */}
              {showAllTiers && (
                <div className="space-y-3 pt-1 animate-fade-in">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 opacity-80">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider block">FRANJA 2 (Siguiente)</span>
                      <h4 className="text-sm font-bold text-slate-200">Clientes 21 – 50</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Roomia 1: $34/mes | Roomia 3: $79/mes | Roomia 5: $124/mes</p>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-800 text-slate-400 font-bold text-[10px] rounded-lg uppercase">
                      Próxima Franja
                    </span>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 opacity-60">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider block">FRANJA 3 (Precio Oficial)</span>
                      <h4 className="text-sm font-bold text-slate-300">Clientes 51+</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Roomia 1: $39/mes | Roomia 3: $89/mes | Roomia 5: $139/mes</p>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-800 text-slate-500 font-bold text-[10px] rounded-lg uppercase">
                      Precio Oficial
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowAllTiers(!showAllTiers)}
                className="w-full py-2 text-xs font-bold text-brand-cyan hover:text-[#3fc2f0] transition-colors flex items-center justify-center gap-1 cursor-pointer pt-1"
              >
                <span>{showAllTiers ? "Ocultar franjas futuras" : "Ver todas las franjas de precio (3 franjas)"}</span>
                {showAllTiers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Frase Obligatoria Resaltada */}
            <div className="p-4 bg-brand-cyan/10 border border-brand-cyan/20 rounded-2xl text-center">
              <p className="text-xs md:text-sm font-bold text-brand-cyan leading-relaxed">
                "Una vez cerrado tu cupo, tu precio queda congelado — sin importar cuántas franjas suban después."
              </p>
            </div>
          </div>

        </div>
      </InteractiveContainer>

      {/* 8. CONTACTO / CTA FINAL */}
      <InteractiveContainer as="footer" id="contacto" className="py-14 px-4 md:px-6 bg-slate-950 text-white border-t border-slate-900 space-y-10">
        
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-4">
          <h2 className="text-2xl md:text-4xl font-serif font-black text-white">
            ¿Listo para modernizar la gestión de su propiedad?
          </h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Consiga su cupo fundador o resuelva dudas conectando de inmediato con nuestro equipo.
          </p>

          {/* CTA #3 */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={() => openWhatsApp("Hola, quisiera solicitar información y demostración de Roomia PMS.")}
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex items-center gap-3"
            >
              <MessageCircle className="w-5 h-5 fill-slate-950" />
              <span>Solicitar demo por WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Contact Info Cards */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 text-left pt-6">
          
          {/* Card WhatsApp */}
          <button 
            onClick={() => openWhatsApp()}
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/30 p-5 rounded-2xl transition-all group flex items-start gap-4 text-left cursor-pointer w-full"
          >
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Phone className="w-5 h-5" />
            </div>
            <div className="space-y-1 select-none">
              <span className="text-[10px] font-bold text-slate-500 block uppercase font-mono">WhatsApp Directo</span>
              <span className="text-white group-hover:text-emerald-400 font-extrabold text-xs md:text-sm tracking-wide block">
                +593 98 405 6660
              </span>
              <p className="text-[10px] text-slate-400">Atención comercial inmediata.</p>
            </div>
          </button>

          {/* Card Email */}
          <a 
            href="mailto:roomia.admincontact@gmail.com"
            onClick={(e) => {
              if (typeof window !== 'undefined' && (window as any).Capacitor) {
                e.preventDefault();
                window.open("mailto:roomia.admincontact@gmail.com", "_system");
              }
            }}
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-brand-cyan/30 p-5 rounded-2xl transition-all group flex items-start gap-4 w-full"
          >
            <div className="w-10 h-10 bg-brand-cyan/10 text-brand-cyan rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Mail className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-500 block uppercase font-mono">Correo Administrativo</span>
              <span className="text-white group-hover:text-brand-cyan font-bold text-[11px] md:text-xs block truncate">
                roomia.admincontact@gmail.com
              </span>
              <p className="text-[10px] text-slate-400">Soporte y cotizaciones.</p>
            </div>
          </a>

          {/* Card Location */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-start gap-4 w-full">
            <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 block uppercase font-mono">Matriz de Operaciones</span>
              <span className="text-white font-extrabold text-xs md:text-sm block">
                Santa Elena - Ecuador
              </span>
              <p className="text-[10px] text-slate-400">SaaS cloud con acceso global.</p>
            </div>
          </div>

        </div>

        {/* Short Security Note */}
        <div className="text-center pt-2">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-brand-cyan" />
            <span>Datos respaldados en la nube con acceso protegido</span>
          </p>
        </div>

      </InteractiveContainer>

    </div>
  );
}
