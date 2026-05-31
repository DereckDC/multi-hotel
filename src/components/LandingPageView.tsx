/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
  Check
} from 'lucide-react';

interface LandingPageViewProps {
  onClose: () => void;
}

export default function LandingPageView({ onClose }: LandingPageViewProps) {
  const [copiedEmail, setCopiedEmail] = React.useState(false);
  const [numHabitaciones, setNumHabitaciones] = React.useState(35);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('roomia.admincontact@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans animate-fade-in">
      
      {/* Dynamic Floating Navbar of the Landing Page */}
      <nav className="bg-slate-900/95 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-550 text-slate-950 flex items-center justify-center font-display font-black text-lg shadow-md">
              R
            </div>
            <span className="font-bold text-white text-base tracking-tight">
              Roomia <span className="text-teal-400 font-medium">SaaS</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-teal-400" />
            <span>Volver al Acceso 🔑</span>
          </button>
        </div>
      </nav>

      {/* Hero Header Marketing Section */}
      <header className="relative bg-slate-950 overflow-hidden py-24 md:py-32 px-6 border-b border-slate-900">
        {/* Futuristic Grid Overlay & Glow Effects */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-10 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column Text copy & CTA */}
            <div className="lg:col-span-7 space-y-8 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 text-teal-300 rounded-full text-xs font-bold ring-1 ring-teal-500/20">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>La Evolución Definitiva de la Hotelería Inteligente</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
                Gestione sus Hoteles y Reservas con <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-300 to-indigo-400">Poder Absoluto</span>
              </h1>

              <p className="text-sm md:text-base text-slate-300 max-w-xl leading-relaxed">
                Roomia PMS es la suite premium en la nube diseñada para maximizar ingresos, automatizar la facturación de huéspedes, habilitar Check-Ins rápidos con códigos QR y blindar sus operaciones con auditorías de seguridad en tiempo real.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={onClose}
                  className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs md:text-sm rounded-2xl shadow-xl shadow-teal-500/20 hover:shadow-teal-500/30 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex items-center gap-2.5"
                >
                  <span>Iniciar Mi Prueba Gratis</span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-slate-950" />
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-4 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs md:text-sm rounded-2xl border border-slate-800 hover:border-slate-705 transition-all active:scale-95 cursor-pointer"
                >
                  Ver Demo Operacional 💻
                </button>
              </div>

              {/* Direct Metrics Trust Badge */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/85 max-w-lg text-slate-400 font-sans">
                <div>
                  <span className="block text-xl font-extrabold text-white">100%</span>
                  <span className="text-[10px] uppercase font-mono tracking-wider">Infraestructura Cloud</span>
                </div>
                <div>
                  <span className="block text-xl font-extrabold text-teal-400">⚡ Supabase</span>
                  <span className="text-[10px] uppercase font-mono tracking-wider">Resguardo de Datos</span>
                </div>
                <div>
                  <span className="block text-xl font-extrabold text-white">99.9%</span>
                  <span className="text-[10px] uppercase font-mono tracking-wider">Uptime Garantizado</span>
                </div>
              </div>
            </div>

            {/* Right Column Product visual Mockup */}
            <div className="lg:col-span-12 xl:col-span-5 relative group">
              {/* Outer glow aura */}
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-indigo-500/20 rounded-3xl blur-2xl group-hover:scale-105 transition-transform duration-500" />
              
              {/* Interactive Mockup Container */}
              <div className="relative bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
                <div className="flex justify-between items-center border-b border-slate-850 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="text-[10px] text-slate-500 font-mono ml-2 uppercase tracking-widest">LIVE_DASHBOARD_PREVIEW</span>
                  </div>
                  <div className="px-2 py-0.5 bg-teal-400/10 text-teal-300 rounded text-[9px] font-bold tracking-wider font-mono">
                    SUPER_ADMIN_MODE
                  </div>
                </div>

                {/* Simulated Interactive Room Grid components */}
                <div className="space-y-4">
                  
                  {/* Mock Hotel Select Indicator */}
                  <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-teal-400 font-mono uppercase tracking-widest">Sede Seleccionada</span>
                      <span className="text-[10px] text-slate-500 font-mono uppercase">24 Activas</span>
                    </div>
                    <p className="text-xs font-bold text-white flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-teal-500" />
                      <span>Hotel Grand Plaza Imperial Resort & Spa</span>
                    </p>
                  </div>

                  {/* Room status mockup grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    
                    {/* Room 1 */}
                    <div className="p-3 bg-slate-950 border border-emerald-500/20 rounded-xl flex flex-col justify-between space-y-1 hover:border-emerald-500/45 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-200">Cuarto 101</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">Doble Luxury</p>
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded mr-auto uppercase tracking-wide">Disponible</span>
                    </div>

                    {/* Room 2 */}
                    <div className="p-3 bg-slate-950 border border-indigo-500/20 rounded-xl flex flex-col justify-between space-y-1 hover:border-indigo-500/45 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-200">Cuarto 102</span>
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">Suite Ejecutiva VIP</p>
                      <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded mr-auto uppercase tracking-wide">Ocupada</span>
                    </div>

                    {/* Room 3 */}
                    <div className="p-3 bg-slate-950 border border-amber-500/20 rounded-xl flex flex-col justify-between space-y-1 hover:border-amber-500/45 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-200">Cuarto 103</span>
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">Familiar Master</p>
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded mr-auto uppercase tracking-wide">Mantenimiento</span>
                    </div>

                    {/* Room 4 */}
                    <div className="p-3 bg-slate-950 border border-rose-500/20 rounded-xl flex flex-col justify-between space-y-1 hover:border-rose-500/45 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-200">Cuarto 104</span>
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">Boutique Single</p>
                      <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded mr-auto uppercase tracking-wide">Sucia / Limpieza</span>
                    </div>

                  </div>

                  {/* Real-time sync timeline notification ticker */}
                  <div className="bg-[#1E2E3E]/30 border border-teal-500/20 rounded-xl p-3 flex gap-2.5 items-start">
                    <CheckCircle className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-white leading-tight">MÓDULO DE RECUPERACIÓN / QR INTEGRADO</p>
                      <p className="text-[10px] text-slate-400 leading-normal">Códigos QR generados de manera automatizada para acelerar el arribo del huésped.</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Core Advantages Bento Grid */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Beneficios Exclusivos de Roomia PMS
          </h2>
          <p className="text-xs md:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            Nuestra plataforma provee ventajas inmediatas para fidelizar huéspedes, optimizar la carga del personal y aumentar sus ingresos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Card 1: Multi-Hotel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm md:text-base">Control Multihotel Centralizado</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Enlace múltiples hoteles y propiedades en una única consola unificada. El Super Administrador puede supervisar métricas cruzadas, delegar sedes y auditar personal en segundos.
              </p>
            </div>
            <span className="text-[10px] text-teal-600 font-bold mt-4 block uppercase tracking-wider">★ CONTROL ABSOLUTO</span>
          </div>

          {/* Card 2: QR Check-In */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm md:text-base">Check-In Express con Códigos QR</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Expida códigos QR automatizados para sus huéspedes de forma inmediata al confirmarse sus reservas. El personal de recepción podrá validar accesos escaneando el código al instante.
              </p>
            </div>
            <span className="text-[10px] text-indigo-600 font-bold mt-4 block uppercase tracking-wider">★ CERO FILAS</span>
          </div>

          {/* Card 3: Presential Logins & Walk-Ins */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm md:text-base">Mantenimiento de Reservas Presenciales</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Perfecto para huéspedes que llegan sin cita previa. La recepción puede registrar datos completos sobre la marcha (Cédula, correo, teléfono) y subir la reservación directo al ecosistema digital.
              </p>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold mt-4 block uppercase tracking-wider">★ COMPATIBILIDAD PLENA</span>
          </div>

          {/* Card 4: Live Analytics */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm md:text-base">Métricas Financieras en Tiempo Real</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Visualice cuadros gráficos de ingresos consolidados, tasas de ocupación promedio, noches arrendadas, y distribución de reservas por hotel o sucursal desde tableros interactivos.
              </p>
            </div>
            <span className="text-[10px] text-amber-600 font-bold mt-4 block uppercase tracking-wider">★ INTELIGENCIA ADRENAL</span>
          </div>

          {/* Card 5: Real-time logs timeline */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm md:text-base">Canal de Auditoría Antifraude</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Cada evento es monitoreado: inicio de sesión, cambios de precio, registros de entrada de recepcionistas y cancelaciones son reportados al instante previniendo incidencias.
              </p>
            </div>
            <span className="text-[10px] text-rose-600 font-bold mt-4 block uppercase tracking-wider">★ SEGURIDAD ZERO-TRUST</span>
          </div>

          {/* Card 6: Modular Scalability */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-650 flex items-center justify-center">
                <Workflow className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm md:text-base">Escalabilidad de Infraestructura</h3>
              <p className="text-xs text-slate-500 leading-normal">
                Plataforma full-stack conectada con Supabase y Node para garantizar velocidad de respuesta relámpago y sincronización simultánea en múltiples pantallas a la vez.
              </p>
            </div>
            <span className="text-[10px] text-teal-650 font-bold mt-4 block uppercase tracking-wider">★ SLA DE OPERACIONES</span>
          </div>

        </div>
      </section>

      {/* Featured Core System Capabilities */}
      <section className="bg-white py-16 px-6 border-y border-slate-100">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-5">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-widest font-mono">PANEL DE OPERACIONES</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
              ¿Por qué los hoteles eligen Roomia PMS SaaS?
            </h3>
            
            <div className="space-y-3.5 pt-2">
              <div className="flex gap-2.5 items-start">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  <strong>Facilidad de Uso Extrema:</strong> Menos clics para habilitar habitaciones, registrar cobros boutique o liquidar saldos de salida.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  <strong>Comunicación Automatizada por Correo:</strong> Envío inmediato de confirmaciones y recuperación de contraseñas de manera automatizada.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  <strong>Control de Incidencias Operativas:</strong> Los recepcionistas publican reportes de daños gatillando el estado de mantenimiento del cuarto al instante.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  <strong>Poderoso Calendario de Reservas:</strong> Vista interactiva del mapa mensual de ocupación y arribos.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white space-y-6 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-lg" />
            
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center text-[10px] text-slate-400 font-mono">
              <span>PLANES DE LICENCIAMIENTO SAAS</span>
              <span className="text-emerald-400 font-bold font-sans">PRUEBA GRATUITA DISPONIBLE</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    Tamaño de su Operación:
                  </span>
                  <span className="text-teal-400 font-sans font-extrabold text-xs bg-teal-400/10 px-2 py-0.5 rounded-md border border-teal-500/15">
                    {numHabitaciones} Habitaciones
                  </span>
                </div>
                <input 
                  type="range"
                  min="10"
                  max="200"
                  value={numHabitaciones}
                  onChange={(e) => setNumHabitaciones(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-450 mt-1"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1 uppercase tracking-tight">
                  <span>10 Cuartos</span>
                  <span>100 Cuartos</span>
                  <span>200+ Ilimitado</span>
                </div>
              </div>

              {/* Plans Selection List inside the Card */}
              <div className="space-y-3 pt-1">
                
                {/* Boutique */}
                <div className="p-3 bg-slate-950/60 border border-slate-850 hover:border-slate-800 rounded-xl transition-all flex justify-between items-center gap-3">
                  <div>
                    <span className="text-[8px] font-extrabold text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">Boutique Core</span>
                    <h4 className="text-xs font-bold text-slate-200 mt-1">Plan Boutique</h4>
                    <p className="text-[10px] text-slate-400">1 Hotel • Recepción Básica y QR</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-sm font-extrabold text-teal-400">${Math.max(50, Math.round(numHabitaciones * 5.00))}<span className="text-[9px] text-slate-450 font-normal">/mes</span></span>
                    <span className="text-[8px] text-slate-500 block font-mono">$5.00/cuarto (mín. $50)</span>
                  </div>
                </div>

                {/* Premium */}
                <div className="p-3 bg-teal-500/5 border border-teal-500/25 hover:border-teal-400/40 rounded-xl transition-all flex justify-between items-center gap-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-teal-500 text-slate-950 font-black text-[7px] tracking-wider uppercase py-0.5 px-2 rounded-bl-lg font-mono">
                    Popular
                  </div>
                  <div>
                    <span className="text-[8px] font-extrabold text-[#2DD4BF] bg-teal-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">Multi-Hotel Pro</span>
                    <h4 className="text-xs font-bold text-white mt-1">Plan Premium</h4>
                    <p className="text-[10px] text-slate-300">Hasta 3 Hoteles • Analíticas Live</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-sm font-extrabold text-teal-300">${Math.max(80, Math.round(numHabitaciones * 8.00))}<span className="text-[9px] text-slate-350 font-normal">/mes</span></span>
                    <span className="text-[8px] text-teal-400/70 block font-mono">$8.00/cuarto (mín. $80)</span>
                  </div>
                </div>

                {/* Elite */}
                <div className="p-3 bg-slate-950/60 border border-slate-850 hover:border-slate-800 rounded-xl transition-all flex justify-between items-center gap-3">
                  <div>
                    <span className="text-[8px] font-extrabold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">SaaS Elite</span>
                    <h4 className="text-xs font-bold text-slate-200 mt-1">Plan Elite Premium</h4>
                    <p className="text-[10px] text-slate-400">Hoteles Ilimitados • Auditorías</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-sm font-extrabold text-indigo-400">${Math.max(120, Math.round(numHabitaciones * 12.00))}<span className="text-[9px] text-slate-450 font-normal">/mes</span></span>
                    <span className="text-[8px] text-slate-500 block font-mono">$12.00/cuarto (mín. $120)</span>
                  </div>
                </div>

              </div>

              {/* Call to Action to close and begin */}
              <button
                onClick={onClose}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer text-center"
              >
                Comenzar con la Prueba Gratuita 🚀
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* Compact Elegant Dark Modern Footer with Direct Contact Information */}
      <footer className="py-20 px-6 bg-slate-950 text-white relative overflow-hidden border-t border-slate-800 space-y-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(13,148,136,0.05),transparent)] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-4">
          <h2 className="text-xl md:text-3xl font-black text-white">¿Listo para modernizar la gestión de su propiedad?</h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Consiga licenciamiento definitivo o resuelva dudas técnicas conectando de inmediato con nuestra mesa de ingeniería.
          </p>
        </div>

        {/* Contact info cards grid */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 text-left">
          
          {/* Card WhatsApp */}
          <a 
            href="https://wa.me/593984056660" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-slate-905 hover:bg-slate-900 border border-slate-850 hover:border-teal-500/30 p-5 rounded-2xl transition-all group flex items-start gap-4 shadow-sm"
          >
            <div className="w-10 h-10 bg-teal-500/10 text-teal-400 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300 animate-pulse">
              <Phone className="w-5 h-5" />
            </div>
            <div className="space-y-1 select-none">
              <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider font-mono">WhatsApp Directo</span>
              <span className="text-white group-hover:text-teal-400 font-extrabold text-xs md:text-sm tracking-wide transition-colors block">
                +593 98 405 6660
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">Atención comercial inmediata.</p>
            </div>
          </a>

          {/* Card Email with copy option */}
          <div className="bg-slate-905 border border-slate-850 p-5 rounded-2xl flex items-start gap-4 shadow-sm relative group">
            <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Correo Administrativo</span>
              <a 
                href="mailto:roomia.admincontact@gmail.com"
                className="text-white hover:text-indigo-400 font-bold text-[11px] md:text-xs tracking-tight transition-colors block truncate"
              >
                roomia.admincontact@gmail.com
              </a>
              <button 
                onClick={handleCopyEmail}
                className="px-2 py-0.5 bg-white/5 hover:bg-teal-500/10 active:bg-teal-500/20 border border-white/10 text-[9px] text-slate-350 font-semibold rounded transition-colors cursor-pointer mt-1 flex items-center gap-1.5"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-2.5 h-2.5 text-emerald-450 animate-bounce" />
                    <span className="text-emerald-450 font-bold">¡Copiado!</span>
                  </>
                ) : (
                  <span>Copiar Dirección</span>
                )}
              </button>
            </div>
          </div>

          {/* Card Matrix Location */}
          <div className="bg-slate-905 border border-slate-850 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Matriz de Operaciones</span>
              <span className="text-white font-extrabold text-xs md:text-sm block leading-tight">
                Santa Elena - Ecuador
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">Licenciamiento SaaS cloud global.</p>
            </div>
          </div>

        </div>

        <div className="max-w-4xl mx-auto pt-6 border-t border-slate-900/60 flex flex-col md:flex-row justify-between items-center text-slate-500 text-[10px] font-mono gap-4 relative z-10 w-full">
          <p>
            <a 
              href="https://homedc-sas.web.app" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-teal-400 hover:text-teal-350 hover:underline transition-all font-bold tracking-wide"
            >
              en convenio con HomeDC°
            </a>
          </p>
          <div className="flex gap-4">
            <button onClick={onClose} className="hover:text-teal-400 transition-colors cursor-pointer text-[10px] font-extrabold flex items-center gap-1 bg-slate-900/60 hover:bg-slate-900 px-3.5 py-1.5 rounded-lg border border-slate-850">
              <ArrowLeft className="w-3 h-3 text-teal-400" />
              <span>Volver al Acceso🔑</span>
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
