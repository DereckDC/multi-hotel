/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Building2, 
  CheckCircle, 
  MapPin, 
  Phone, 
  Mail, 
  ArrowLeft, 
  Shield, 
  QrCode, 
  Sparkles, 
  Calendar, 
  TrendingUp, 
  Clock, 
  Workflow, 
  Users 
} from 'lucide-react';

interface LandingPageViewProps {
  onClose: () => void;
}

export default function LandingPageView({ onClose }: LandingPageViewProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans animate-fade-in">
      
      {/* Dynamic Floating Navbar of the Landing Page */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-[#1E2E3E] text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Acceso 🔑</span>
          </button>
        </div>
      </nav>

      {/* Hero Header Marketing Section */}
      <header className="bg-gradient-to-b from-white via-teal-50/10 to-slate-50 py-16 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-200/10 rounded-full blur-3xl transform translate-x-12 -translate-y-12" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-100/10 rounded-full blur-3xl transform -translate-x-12 translate-y-12" />
        
        <div className="max-w-4xl mx-auto text-center space-y-6 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-800 rounded-full text-xs font-bold ring-1 ring-teal-600/10 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>La evolución definitiva de la hotelería inteligente</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Gestione sus Hoteles, Habitaciones y Reservas con <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-indigo-700">Cero Fricción</span>
          </h1>

          <p className="text-sm md:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Roomia PMS es una suite SaaS en la nube de alta fidelidad diseñada para modernizar operaciones hoteleras, automatizar la facturación, simplificar check-ins mediante códigos QR y brindar auditorías en tiempo real.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              Iniciar Prueba / Acceso al Sistema 🚀
            </button>
            <a
              href="#contacto"
              className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-sm"
            >
              Contactar Asesoría Comercial 📞
            </a>
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

          <div className="bg-slate-900 rounded-3xl p-8 text-white space-y-6 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-lg" />
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center text-xs text-slate-400 font-mono">
              <span>DEMO RECIENTE DE INTERFAZ</span>
              <span className="text-emerald-400 font-bold font-sans">99.8% DISPONIBILIDAD</span>
            </div>
            <div className="space-y-3 font-sans text-xs">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[10px] text-teal-400 font-mono">CHECK-IN CONFIRMADO ✅</span>
                <p className="font-bold text-white leading-none">Reserva N° RES-83921</p>
                <p className="text-[11px] text-slate-400">Cliente Juan Castro ingresando hoy al Cuarto 104 Suite Boutique</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <span className="text-[10px] text-indigo-400 font-mono">REGISTRO PRESENCIAL (WALK-IN) 📝</span>
                <p className="font-bold text-white leading-none">Huésped Express Agendado</p>
                <p className="text-[11px] text-slate-400">Creado por Recepcionista. Sincronizado a Supabase con éxito.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-inner"
            >
              Comenzar Ahora Mismo
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Contact & Hiring Section */}
      <section id="contacto" className="py-16 px-6 bg-slate-900 text-white relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(13,148,136,0.08),transparent)]" />
        
        <div className="max-w-4xl mx-auto space-y-10 relative">
          
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-teal-400 uppercase tracking-widest font-mono">¿Listo para Impulsar su Hotel?</span>
            <h2 className="text-2xl md:text-3.5xl font-extrabold tracking-tight">Hablemos y Habilite su Suscripción</h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Solicite una demostración guiada sin compromisos, cotice tarifas de instalación exclusivas para su hotel, o comuníquese con nuestro departamento de soporte principal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            
            {/* Teléfono */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center space-y-3">
              <div className="w-10 h-10 bg-teal-500/10 text-teal-400 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400 font-bold block uppercase tracking-wider font-mono">Llamadas o WhatsApp</p>
              <a 
                href="https://wa.me/593984056660" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-white hover:text-teal-450 font-bold text-sm tracking-wide transition-colors"
              >
                +593 98 405 6660
              </a>
            </div>

            {/* Correo */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center space-y-3">
              <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400 font-bold block uppercase tracking-wider font-mono">Correo Electrónico</p>
              <a 
                href="mailto:roomia.admincontact@gmail.com" 
                className="text-white hover:text-indigo-400 font-bold text-xs tracking-tight transition-colors break-all"
              >
                roomia.admincontact@gmail.com
              </a>
            </div>

            {/* Dirección */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center space-y-3">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400 font-bold block uppercase tracking-wider font-mono">Matriz de Soporte</p>
              <span className="text-white font-bold text-sm leading-tight">
                Santa Elena - Ecuador
              </span>
            </div>

          </div>

          <div className="text-center pt-4">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Acceder Inmediatamente al Software</span>
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
          
        </div>
      </section>

      {/* Landing Footer */}
      <footer className="bg-slate-950 text-slate-450 py-10 px-6 border-t border-slate-900 text-xs mt-auto font-mono">
        <div className="max-w-7xl mx-auto flex justify-center items-center gap-4 text-center">
          <p className="text-slate-500 font-sans">
            &copy; 2026 Roomia PMS SaaS. Todos los derechos reservados de software | en convenio con{' '}
            <a 
              href="https://homedc-sas.web.app/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[#6ECCAF] hover:text-teal-400 font-bold underline transition-colors"
            >
              HomeDC
            </a>
          </p>
        </div>
      </footer>

    </div>
  );
}
