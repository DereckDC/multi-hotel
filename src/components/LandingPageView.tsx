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
  Check,
  LogIn,
  AlertTriangle,
  Play,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ListChecks,
  Settings,
  Layers,
  Calendar,
  CheckSquare,
  HelpCircle
} from 'lucide-react';
import { InteractiveContainer } from './InteractiveContainer';
import { GlobalTrailCursor } from './GlobalTrailCursor';
import { BrandLogo } from './BrandLogo';

interface LandingPageViewProps {
  onClose: () => void;
  onOpenLegal?: (type: 'terminos' | 'privacidad' | 'cancelaciones') => void;
}

export default function LandingPageView({ onClose, onOpenLegal }: LandingPageViewProps) {
  const [copiedEmail, setCopiedEmail] = React.useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('roomia.admincontact@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans animate-fade-in relative">
      <GlobalTrailCursor />
      
      {/* Dynamic Floating Navbar of the Landing Page */}
      <nav className="bg-slate-950/95 border-b border-slate-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="lg" showText={true} lightText={true} />
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0E2A47] hover:bg-[#133A62] border border-brand-cyan/30 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-brand-cyan/5 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-brand-cyan" />
            <span>Volver</span>
          </button>
        </div>
      </nav>

      {/* Hero Header Marketing Section */}
      <InteractiveContainer as="header" className="bg-slate-950 py-10 md:py-20 px-4 md:px-6 border-b border-slate-900">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-brand-cyan/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-10 w-[300px] h-[300px] bg-brand-cyan/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
                      {/* Left Column Text copy & CTA */}
            <div className="lg:col-span-7 space-y-4 md:space-y-6 text-left font-sans">
              <h1 className="text-3xl md:text-6xl lg:text-6.5xl font-serif font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#23B4E6] to-white leading-tight pr-2">
                Administre reservas, habitaciones, huéspedes e ingresos desde un solo lugar
              </h1>

              <p className="text-xs md:text-sm text-[#A8B2BD] max-w-xl leading-relaxed">
                Roomia PMS es la suite premium en la nube diseñada para maximizar ingresos en cualquier tipo de propiedad (hoteles, hostales, departamentos, cabañas, glampings y más). Automatice la facturación de huéspedes, habilite Check-Ins rápidos con códigos QR y blinde sus operaciones en tiempo real con auditorías avanzadas.
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={() => document.getElementById('contacto-directo')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-6 py-3 bg-[#23B4E6] hover:bg-[#3fc2f0] text-[#071726] font-extrabold text-xs md:text-sm rounded-xl shadow-xl shadow-brand-cyan/20 hover:shadow-brand-cyan/30 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <span>Solicitar una demostración</span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-[#071726]" />
                </button>
                <button
                  onClick={() => document.getElementById('beneficios')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-5 py-3 bg-[#0E2A47] hover:bg-[#133A62] text-white font-bold text-xs md:text-sm rounded-xl border border-brand-cyan/20 transition-all active:scale-95 cursor-pointer"
                >
                  Explorar plataforma 💻
                </button>
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
                    <span className="text-[10px] text-slate-550 font-mono ml-2 uppercase tracking-widest">vista previa del panel</span>
                  </div>
                  <div className="px-2 py-0.5 bg-teal-400/10 text-teal-300 rounded text-[9px] font-bold tracking-wider font-mono">
                    panel administrativo
                  </div>
                </div>

                {/* Simulated Interactive Room Grid components */}
                <div className="space-y-4">
                  
                  {/* Mock Hotel Select Indicator */}
                  <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-teal-400 font-mono uppercase tracking-widest">Propiedad Seleccionada</span>
                      <span className="text-[10px] text-slate-550 font-mono uppercase">24 Activas</span>
                    </div>
                    <p className="text-xs font-bold text-white flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-teal-500" />
                      <span>Suite Imperial & Grand Plaza Resort</span>
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
                      <p className="text-[11px] font-bold text-white leading-tight">Check-in con QR</p>
                      <p className="text-[10px] text-slate-400 leading-normal">Genere un código QR por reserva para agilizar la llegada del huésped y validar su ingreso en segundos</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </InteractiveContainer>

      {/* Sección 1: Problemas que resolvemos */}
      <InteractiveContainer className="bg-slate-950 text-white py-14 px-6 border-b border-slate-900">
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-2xl md:text-4xl font-serif font-black tracking-tight text-white">
              ¿Qué problemas resuelve Roomia PMS?
            </h2>
            <p className="text-xs md:text-sm text-[#A8B2BD] max-w-lg mx-auto">
              La administración de un hospedaje es compleja. Así es como Roomia PMS soluciona los cuellos de botella más comunes en su operación diaria:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Problema 1 */}
            <div className="p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/35 rounded-2xl transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4">
                <AlertTriangle className="w-5 h-5 pointer-events-none" />
              </div>
              <h4 className="text-sm font-bold text-brand-cyan mb-2">Reservas desordenadas entre WhatsApp, cuadernos y Excel</h4>
              <p className="text-xs text-[#A8B2BD] leading-relaxed">
                Centralice toda la información en un solo lugar. Evite la duplicidad de reservas, la pérdida de datos y el desgaste de coordinar múltiples canales de forma manual.
              </p>
            </div>

            {/* Problema 2 */}
            <div className="p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/35 rounded-2xl transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4">
                <Clock className="w-5 h-5 pointer-events-none" />
              </div>
              <h4 className="text-sm font-bold text-brand-cyan mb-2">Recepción lenta y procesos manuales</h4>
              <p className="text-xs text-[#A8B2BD] leading-relaxed">
                Acelere la llegada de huéspedes con fichas automatizadas y escaneo de códigos QR. Reduzca las filas de espera a segundos y brinde un servicio de nivel corporativo.
              </p>
            </div>

            {/* Problema 3 */}
            <div className="p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/35 rounded-2xl transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5 pointer-events-none" />
              </div>
              <h4 className="text-sm font-bold text-brand-cyan mb-2">Falta de control sobre habitaciones disponibles, ocupadas o en limpieza</h4>
              <p className="text-xs text-[#A8B2BD] leading-relaxed">
                Monitoree al instante el estado del inventario. Sepa qué suite necesita limpieza, cuál está en mantenimiento y evite asignaciones incorrectas desde el panel de recepción.
              </p>
            </div>

            {/* Problema 4 */}
            <div className="p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/35 rounded-2xl transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 pointer-events-none" />
              </div>
              <h4 className="text-sm font-bold text-brand-cyan mb-2">Cobros y pagos poco organizados</h4>
              <p className="text-xs text-[#A8B2BD] leading-relaxed">
                Lleve un registro riguroso de cada abono, saldo pendiente de pago, impuestos correspondientes y transacciones financieras por cada reserva para evitar fugas de capital.
              </p>
            </div>

            {/* Problema 5 */}
            <div className="p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/35 rounded-2xl transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4">
                <Layers className="w-5 h-5 pointer-events-none" />
              </div>
              <h4 className="text-sm font-bold text-brand-cyan mb-2">Dificultad para administrar varias propiedades</h4>
              <p className="text-xs text-[#A8B2BD] leading-relaxed">
                Cambie de establecimiento de forma instantánea. Controle inventarios, personal y tarifas de múltiples sucursales con total tranquilidad desde una sola cuenta administrativa.
              </p>
            </div>

            {/* Problema 6 */}
            <div className="p-6 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/35 rounded-2xl transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4">
                <Calendar className="w-5 h-5 pointer-events-none" />
              </div>
              <h4 className="text-sm font-bold text-brand-cyan mb-2">Reportes poco claros para tomar decisiones</h4>
              <p className="text-xs text-[#A8B2BD] leading-relaxed">
                Consiga métricas consolidadas en tiempo real. Analice tasa de ocupación, noches reservadas e ingresos mensuales de forma visual con gráficos limpios e integrales.
              </p>
            </div>

          </div>
        </div>
      </InteractiveContainer>

      {/* Core Advantages Bento Grid */}
      <InteractiveContainer id="beneficios" className="py-8 md:py-14 px-4 md:px-6 border-b border-slate-900/40">
        <div className="max-w-7xl mx-auto w-full space-y-6 md:space-y-10">
          <div className="text-center space-y-1 md:space-y-2">
            <h2 className="text-3xl font-black tracking-tight text-white">
              Funciones clave para una operación más rápida, ordenada y rentable
            </h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Roomia PMS le ayuda a organizar reservas, acelerar la recepción, controlar habitaciones, registrar cobros y visualizar el estado de su propiedad en tiempo real
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
          
          {/* Card 1: Multi-Propiedad */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between hover:border-teal-500/35 hover:bg-slate-900 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Gestión multi-propiedad desde un solo panel</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Administre uno o varios hospedajes desde la misma cuenta. Configure habitaciones, tarifas, temporadas, disponibilidad y datos de cada propiedad sin saltar entre sistemas o archivos dispersos.
              </p>
            </div>
            <span className="text-[10px] text-teal-400 font-bold mt-4 block uppercase tracking-wider font-mono">★ CONTROL CENTRALIZADO</span>
          </div>

          {/* Card 2: QR Check-In */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between hover:border-indigo-500/35 hover:bg-slate-900 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Check-in más ágil con código QR</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Genere un código QR por reserva para validar la llegada del huésped en segundos. Reduzca tiempos en recepción, evite búsquedas manuales y agilice el proceso de ingreso.
              </p>
            </div>
            <span className="text-[10px] text-indigo-400 font-bold mt-4 block uppercase tracking-wider font-mono">★ RECEPCIÓN MÁS RÁPIDA</span>
          </div>

          {/* Card 3: Presential Logins & Walk-Ins */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between hover:border-emerald-500/35 hover:bg-slate-900 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Recepción y registro de huéspedes en un solo flujo</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Permita que su equipo registre huéspedes, asigne habitaciones, cargue datos de contacto, gestione ingresos sin reserva previa y registre pagos desde un mismo panel.
              </p>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold mt-4 block uppercase tracking-wider font-mono">★ RECEPCIÓN OPERATIVA</span>
          </div>

          {/* Card 4: Live Analytics */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between hover:border-amber-500/35 hover:bg-slate-900 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Reportes de ocupación, ingresos y rendimiento</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Consulte en tiempo real la ocupación, las noches reservadas, los ingresos por propiedad y el rendimiento general de su operación con reportes claros y fáciles de interpretar.
              </p>
            </div>
            <span className="text-[10px] text-amber-400 font-bold mt-4 block uppercase tracking-wider font-mono">★ VISIBILIDAD DEL NEGOCIO</span>
          </div>

          {/* Card 5: Real-time logs timeline */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between hover:border-rose-500/35 hover:bg-slate-900 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Incidencias, limpieza y mantenimiento bajo control</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Reporte daños, novedades operativas y tareas de mantenimiento en tiempo real. Cambie el estado de una habitación a sucia, en limpieza o en mantenimiento para evitar asignaciones equivocadas y mantener la operación sincronizada.
              </p>
            </div>
            <span className="text-[10px] text-rose-400 font-bold mt-4 block uppercase tracking-wider font-mono">★ MENOS ERRORES OPERATIVOS</span>
          </div>

          {/* Card 6: Interactive Calendars */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between hover:border-teal-500/35 hover:bg-slate-900 transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <Workflow className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Calendario visual de reservas y ocupación</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Visualice la ocupación por fechas, las entradas y salidas programadas, el estado de las habitaciones y la carga operativa de cada propiedad en una sola vista.
              </p>
            </div>
            <span className="text-[10px] text-teal-400 font-bold mt-4 block uppercase tracking-wider font-mono">★ PLANIFICACIÓN MÁS SIMPLE</span>
          </div>

        </div>
      </div>
      </InteractiveContainer>

      {/* Sección 2: Cómo funciona */}
      <InteractiveContainer className="bg-slate-950 py-14 px-6 border-b border-slate-900/60">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-black tracking-tight text-white">
              ¿Cómo funciona?
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              Modernice la administración de su propiedad en tres sencillos pasos integrados en un solo flujo de trabajo diario:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            
            {/* Step 1 */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-teal-500/35 transition-all flex flex-col space-y-4 shadow-xl relative z-10">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center shadow-sm">
                <Settings className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Configure su propiedad</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Habitaciones, tipos de alojamiento, tarifas, datos y disponibilidad.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/35 transition-all flex flex-col space-y-4 shadow-xl relative z-10">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shadow-sm">
                <Workflow className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Gestione reservas y operación diaria</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Check-ins, huéspedes, cobros, estados de habitaciones, incidencias y calendario.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/35 transition-all flex flex-col space-y-4 shadow-xl relative z-10">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shadow-sm">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm md:text-base">Controle su negocio con reportes</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Ocupación, ingresos, rendimiento por propiedad y visibilidad de la operación.
              </p>
            </div>

          </div>
        </div>
      </InteractiveContainer>

      {/* Sección 3: Para quién es Roomia */}
      <InteractiveContainer className="bg-slate-950 text-white py-14 px-6 border-b border-slate-900">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              ¿Para quién es Roomia?
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              No listamos únicamente tipos de alojamiento; adaptamos nuestro PMS a cada perfil de administración y estructura operativa:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center space-y-3 hover:border-teal-550/35 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-teal-505/10 text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <Building2 className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-xs text-slate-250 leading-snug">Hoteles y hostales</h4>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center space-y-3 hover:border-indigo-500/35 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-indigo-505/10 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-xs text-slate-250 leading-snug">Glampings y cabañas</h4>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center space-y-3 hover:border-rose-500/35 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-rose-505/10 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <MapPin className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-xs text-slate-250 leading-snug">Suites y departamentos turísticos</h4>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center space-y-3 hover:border-emerald-500/35 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-emerald-505/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-xs text-slate-250 leading-snug">Negocios con una o varias propiedades</h4>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center space-y-3 hover:border-amber-500/35 transition-colors group sm:col-span-2 lg:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-amber-505/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-xs text-slate-250 leading-snug">Administradores que necesitan ordenar su operación</h4>
            </div>

          </div>
        </div>
      </InteractiveContainer>

      {/* Sección 4: Qué incluye la demo */}
      <InteractiveContainer className="bg-slate-950 py-14 px-6 border-b border-slate-900">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          
          <div className="md:col-span-5 relative">
            <div className="absolute inset-0 bg-teal-500/10 rounded-3xl blur-2xl" />
            <div className="relative bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <span>Demo Garantizada</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nuestras demostraciones son interactivas, personalizadas y enfocadas en resolver los problemas particulares de su modelo de alojamiento.
              </p>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <span>DURACIÓN: ~15 MINS</span>
                <span className="text-emerald-400 font-bold">GRATIS</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 space-y-5">
            <h3 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
              ¿Qué incluye la demo?
            </h3>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
              En la demo le mostramos paso a paso cómo Roomia PMS se convierte en el motor operativo de su negocio de hospedaje:
            </p>

            <div className="space-y-3 pt-2">
              
              <div className="flex gap-3 items-start p-3 hover:bg-slate-900/50 rounded-xl transition-colors border border-transparent hover:border-slate-800">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-xs md:text-sm">cómo registrar reservas y huéspedes</h4>
                  <p className="text-xs text-slate-400 leading-normal">Asigne habitaciones, configure cargos adicionales y guarde un historial de forma automática.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-3 hover:bg-slate-900/50 rounded-xl transition-colors border border-transparent hover:border-slate-800">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-xs md:text-sm">cómo controlar habitaciones y estados</h4>
                  <p className="text-xs text-slate-400 leading-normal">Cambie el estado de la propiedad (limpieza, mantenimiento, ocupada) en tiempo real.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-3 hover:bg-slate-900/50 rounded-xl transition-colors border border-transparent hover:border-slate-800">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-xs md:text-sm">cómo funciona el check-in con QR</h4>
                  <p className="text-xs text-slate-400 leading-normal">Genere vouchers interactivos autogestionables y realice el ingreso manual en segundos.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start p-3 hover:bg-slate-900/50 rounded-xl transition-colors border border-transparent hover:border-slate-800">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-xs md:text-sm">cómo ver ocupación e ingresos</h4>
                  <p className="text-xs text-slate-400 leading-normal">Acceda a reportes financieros unificados por cada establecimiento operativo.</p>
                </div>
              </div>

              <div className="flex gap-1.5 items-start p-3 hover:bg-slate-900/50 rounded-xl transition-colors border border-transparent hover:border-slate-800">
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-xs md:text-sm">cómo adaptar Roomia a su tipo de hospedaje</h4>
                  <p className="text-xs text-slate-400 leading-normal">Modelamos el sistema según sea hotel tradicional, cabañas, glampings, hostal o dptos.</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </InteractiveContainer>

      {/* Featured Core System Capabilities */}
      <InteractiveContainer className="bg-slate-950 py-10 md:py-16 px-4 md:px-6 border-b border-slate-900">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="space-y-5">
            <h3 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
              ¿Por qué los propietarios y administradores eligen Roomia PMS?
            </h3>
            
            <div className="space-y-3.5 pt-2">
              <div className="flex gap-2.5 items-start">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-305 leading-relaxed font-medium">
                  <strong>Fácil de usar, sin capacitaciones largas:</strong> Diseño intuitivo pensado para que usted y su equipo puedan registrar huéspedes, cobrar y ver el estado de sus propiedades en minutos, sin flujos complejos.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-305 leading-relaxed font-medium">
                  <strong>Operación 100% en tiempo real:</strong> Sincronización instantánea de estados de habitaciones, reservas y cobros. Todo su equipo trabaja sobre la misma información al instante.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-305 leading-relaxed font-medium">
                  <strong>Sin cobros sorpresivos ni de comisiones ocultas:</strong> Licenciamiento definitivo, transparente y adaptable al tamaño de su modelo de alojamiento. Pague únicamente por lo que necesita.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-305 leading-relaxed font-medium">
                  <strong>Soporte en español y atención directa:</strong> Mesa de ayuda y asesoría técnica en su mismo idioma, lista para acompañarle y resolver inquietudes operativas rápidamente.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white space-y-6 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[450px]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-lg" />
            
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center text-[10px] text-slate-400 font-mono">
              <span>SOPORTE MULTI-PROPIEDAD</span>
              <span className="text-teal-400 font-bold font-sans">DEMO PERSONALIZADA</span>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-bold text-white">Un PMS flexible para distintos tipos de hospedaje</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Nuestra plataforma se adapta a las dimensiones de su negocio. Ya sea que administre un hotel tradicional, un complejo de cabañas, departamentos vacacionales, glampings o hostales, Roomia PMS centraliza todas sus operaciones.
              </p>

              <div className="space-y-2.5 pt-2 font-medium">
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  <span>Hoteles, Moteles y Resorts de cualquier escala</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  <span>Departamentos, Villas y Alquileres Temporales</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  <span>Hostales, Albergues y Casas de Huéspedes</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  <span>Glampings, Cabañas, Sitios Ecológicos y más</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="https://wa.me/593984056660?text=Hola,%20quisiera%20solicitar%20una%20demostración%20e%20información%20personalizada%20de%20Roomia%20PMS%20para%20mis%20propiedades."
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (typeof window !== 'undefined' && (window as any).Capacitor) {
                    e.preventDefault();
                    window.open("https://wa.me/593984056660?text=Hola,%20quisiera%20solicitar%20una%20demostración%20e%20información%20personalizada%20de%20Roomia%20PMS%20para%20mis%20propiedades.", "_system");
                  }
                }}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold py-3 rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer text-center block decoration-none"
              >
                Solicitar demo por WhatsApp 💬
              </a>
            </div>
          </div>

        </div>
      </InteractiveContainer>

      {/* Compact Elegant Dark Modern Footer with Direct Contact Information */}
      <InteractiveContainer as="footer" id="contacto-directo" className="py-10 md:py-16 px-4 md:px-6 bg-slate-950 text-white border-t border-slate-900 space-y-6 md:space-y-10">
        
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-4">
          <h2 className="text-xl md:text-3xl font-black text-white">¿Listo para modernizar la gestión de su propiedad?</h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Consiga licenciamiento definitivo o resuelva dudas técnicas conectando de inmediato con nuestra mesa de ingeniería.
          </p>
        </div>

        {/* Contact info cards grid */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 text-left mt-12 md:mt-20">
          
          {/* Card WhatsApp */}
          <a 
            href="https://wa.me/593984056660" 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => {
              if (typeof window !== 'undefined' && (window as any).Capacitor) {
                e.preventDefault();
                window.open("https://wa.me/593984056660", "_system");
              }
            }}
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

          {/* Card Email with direct link */}
          <a 
            href="mailto:roomia.admincontact@gmail.com"
            onClick={(e) => {
              if (typeof window !== 'undefined' && (window as any).Capacitor) {
                e.preventDefault();
                window.open("mailto:roomia.admincontact@gmail.com", "_system");
              }
            }}
            className="bg-slate-905 hover:bg-slate-900 border border-slate-850 hover:border-indigo-500/30 p-5 rounded-2xl transition-all group flex items-start gap-4 shadow-sm"
          >
            <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
              <Mail className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Correo Administrativo</span>
              <span className="text-white group-hover:text-indigo-400 font-bold text-[11px] md:text-xs tracking-tight transition-colors block truncate">
                roomia.admincontact@gmail.com
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">Consulte precios y solicite soporte inmediato.</p>
            </div>
          </a>

          {/* Card Matrix Location */}
          <a 
            href="https://www.google.com/maps/place/Playa+de+San+Lorenzo/@-2.202538,-81.0186842,13z/data=!4m6!3m5!1s0x902e0e0e37032d23:0xaf778b30ad8848d1!8m2!3d-2.2025425!4d-80.9750194!16s%2Fg%2F1hc160w_p?entry=ttu&g_ep=EgoyMDI2MDYyMy4wIKXMDSoASAFQAw%3D%3D"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (typeof window !== 'undefined' && (window as any).Capacitor) {
                e.preventDefault();
                window.open("https://www.google.com/maps/place/Playa+de+San+Lorenzo/@-2.202538,-81.0186842,13z/data=!4m6!3m5!1s0x902e0e0e37032d23:0xaf778b30ad8848d1!8m2!3d-2.2025425!4d-80.9750194!16s%2Fg%2F1hc160w_p?entry=ttu&g_ep=EgoyMDI2MDYyMy4wIKXMDSoASAFQAw%3D%3D", "_system");
              }
            }}
            className="bg-slate-905 hover:bg-slate-900 border border-slate-850 hover:border-emerald-500/30 p-5 rounded-2xl transition-all group flex items-start gap-4 shadow-sm"
          >
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider font-mono">Matriz de Operaciones</span>
              <span className="text-white group-hover:text-emerald-400 font-extrabold text-xs md:text-sm block leading-tight transition-colors">
                Santa Elena - Ecuador
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">SaaS cloud global desde la costa.</p>
            </div>
          </a>

        </div>

      </InteractiveContainer>

    </div>
  );
}
