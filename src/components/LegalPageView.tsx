/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrandLogo } from './BrandLogo';
import { 
  Building2, 
  ArrowLeft, 
  MapPin, 
  Mail, 
  Phone, 
  FileText, 
  ShieldCheck, 
  CalendarClock,
  HeartHandshake,
  CheckCircle2,
  AlertTriangle,
  Scale
} from 'lucide-react';

export type LegalDocType = 'terminos' | 'privacidad' | 'cancelaciones';

interface LegalPageViewProps {
  documentType: LegalDocType;
  onClose: () => void;
  onSelectDoc: (type: LegalDocType) => void;
}

export default function LegalPageView({ documentType, onClose, onSelectDoc }: LegalPageViewProps) {
  React.useEffect(() => {
    // Scroll to top on load
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [documentType]);

  // Keep path synced with the visual state
  React.useEffect(() => {
    let newPath = '/';
    if (documentType === 'terminos') newPath = '/terminos-y-condiciones';
    else if (documentType === 'privacidad') newPath = '/politica-de-privacidad';
    else if (documentType === 'cancelaciones') newPath = '/politica-de-cancelaciones-y-reembolsos';

    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  }, [documentType]);

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-800 flex flex-col font-sans animate-fade-in" id="legal-page-container">
      
      {/* Upper Navigation Header aligned with the branding */}
      <nav className="bg-slate-950/95 border-b border-slate-900 sticky top-0 z-50 shadow-md" id="legal-navbar">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="lg" showText={true} lightText={true} />
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand-navy1 hover:bg-[#133A62] border border-brand-cyan/30 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-brand-cyan/5 flex items-center gap-2 cursor-pointer active:scale-95"
            id="back-to-home-btn"
          >
            <ArrowLeft className="w-4 h-4 text-brand-cyan" />
            <span>Volver</span>
          </button>
        </div>
      </nav>

      {/* Main Container - Legal structure split */}
      <div className="max-w-6xl mx-auto px-6 py-12 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-8" id="legal-main-layout">
        
        {/* Left Column Sidebar selector */}
        <aside className="lg:col-span-4 space-y-6" id="legal-sidebar">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm sticky top-24 space-y-5">
            <div>
              <h3 className="font-bold text-base text-neutral-800">Centro de Transparencia</h3>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => onSelectDoc('terminos')}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer ${
                  documentType === 'terminos'
                    ? 'bg-teal-50 border-teal-200 text-teal-850 shadow-sm font-bold'
                    : 'bg-white border-neutral-150 hover:bg-neutral-50 text-neutral-600'
                }`}
                id="doc-selector-terminos"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  documentType === 'terminos' ? 'bg-teal-555 text-teal-850' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  <Scale className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block leading-tight">Términos y Condiciones</span>
                  <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">Actualizado: Jun 2026</span>
                </div>
              </button>

              <button
                onClick={() => onSelectDoc('privacidad')}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer ${
                  documentType === 'privacidad'
                    ? 'bg-teal-50 border-teal-200 text-teal-850 shadow-sm font-bold'
                    : 'bg-white border-neutral-150 hover:bg-neutral-50 text-neutral-600'
                }`}
                id="doc-selector-privacidad"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  documentType === 'privacidad' ? 'bg-teal-555 text-teal-850' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block leading-tight">Política de Privacidad</span>
                  <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">Actualizado: Jun 2026</span>
                </div>
              </button>

              <button
                onClick={() => onSelectDoc('cancelaciones')}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer ${
                  documentType === 'cancelaciones'
                    ? 'bg-teal-50 border-teal-200 text-teal-850 shadow-sm font-bold'
                    : 'bg-white border-neutral-150 hover:bg-neutral-50 text-neutral-600'
                }`}
                id="doc-selector-cancelaciones"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  documentType === 'cancelaciones' ? 'bg-teal-555 text-teal-850' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block leading-tight">Cancelaciones y Reembolsos</span>
                  <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">Actualizado: Jun 2026</span>
                </div>
              </button>
            </div>


          </div>
        </aside>

        {/* Right Column Content Panel */}
        <section className="lg:col-span-8 bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-8" id="legal-content-panel">
          
          {/* HEADER SECTOR */}
          <div className="border-b border-neutral-150 pb-6 space-y-3">
            <span className="text-[10px] text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono font-bold inline-block">
              DOCUMENTO LEGAL OFICIAL
            </span>
            
            <h1 className="text-2xl md:text-3.5xl font-extrabold text-neutral-900 tracking-tight leading-tight">
              {documentType === 'terminos' && 'Términos y Condiciones Generales de Uso'}
              {documentType === 'privacidad' && 'Política de Privacidad y Tratamiento de Datos Personales'}
              {documentType === 'cancelaciones' && 'Política de Cancelaciones, Modificaciones y Reembolsos'}
            </h1>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5 font-mono">
                <FileText className="w-3.5 h-3.5 text-neutral-450" />
                Identificador: ROOMIA-{documentType === 'terminos' ? 'TC' : documentType === 'privacidad' ? 'PP' : 'CR'}-2026
              </span>
              <span className="flex items-center gap-1.5 font-mono font-bold text-teal-600">
                <CalendarClock className="w-3.5 h-3.5" />
                Última actualización: 28 de Junio de 2026
              </span>
            </div>
          </div>

          {/* DYNAMIC COMPLIANCE REDACTION FOR ROOMIA */}
          <div className="prose prose-sm prose-teal max-w-none text-neutral-650 leading-relaxed space-y-6 text-xs md:text-sm">
            
            {/* TERMINOS Y CONDICIONES */}
            {documentType === 'terminos' && (
              <div className="space-y-6" id="legal-content-terminos">
                
                {/* Intro Section */}
                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-150 flex items-start gap-3 animate-fade-in">
                  <Scale className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-teal-900 font-semibold leading-normal">
                    Al acceder o utilizar los servicios de Roomia, el usuario acepta los presentes Términos y Condiciones de Uso. Si no está de acuerdo con alguna de sus disposiciones, deberá abstenerse de utilizar la plataforma.
                  </p>
                </div>

                {/* Sección 1: Sobre Roomia */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    1. Sobre Roomia
                  </h4>
                  <p>
                    Roomia es una plataforma tecnológica operada bajo el modelo Software como Servicio (SaaS) que ofrece herramientas digitales para la gestión de establecimientos de hospedaje y la publicación de anuncios relacionados con propiedades de alojamiento e inmuebles.
                  </p>
                  <p>
                    La plataforma está dirigida principalmente a propietarios, administradores y empresas del sector hotelero que desean administrar sus operaciones desde un único sistema, así como a huéspedes interesados en consultar disponibilidad y realizar solicitudes de reserva.
                  </p>
                </div>

                {/* Sección 2: Cómo funciona nuestro servicio */}
                <div className="space-y-4 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    2. Cómo funciona nuestro servicio
                  </h4>
                  
                  <div className="space-y-2 pl-4 border-l-2 border-neutral-200">
                    <h5 className="font-bold text-neutral-800 text-xs md:text-sm">Para propietarios y administradores</h5>
                    <p>
                      Los establecimientos interesados pueden registrarse en Roomia creando una cuenta empresarial y proporcionando la información solicitada para la administración de su negocio.
                    </p>
                    <p>
                      Una vez registrado, el establecimiento podrá utilizar las funciones disponibles según el plan contratado, incluyendo, entre otras:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Administración de habitaciones o unidades.</li>
                      <li>Gestión de reservas.</li>
                      <li>Registro de huéspedes.</li>
                      <li>Control operativo del establecimiento.</li>
                      <li>Publicación de disponibilidad.</li>
                      <li>Herramientas administrativas y reportes.</li>
                    </ul>
                    <p>
                      Cada establecimiento es responsable de configurar correctamente su información, tarifas, disponibilidad y políticas internas.
                    </p>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-950 font-medium">
                      ⚠️ <strong>TARIFA OPERATIVA DE LA PLATAFORMA:</strong> Roomia cobrará una tarifa del <strong>10%</strong> de la tarifa total de cada transacción. Esta tarifa se deduce de forma automática del cobro del anfitrión por cada reserva o alquiler procesado.
                    </div>
                  </div>

                  <div className="space-y-2 pl-4 border-l-2 border-neutral-200">
                    <h5 className="font-bold text-neutral-800 text-xs md:text-sm">Para huéspedes</h5>
                    <p>
                      Los huéspedes pueden consultar la disponibilidad publicada por los establecimientos registrados y realizar solicitudes o reservas mediante la información proporcionada por la plataforma.
                    </p>
                    <p>
                      La confirmación de una reserva genera una relación directa entre el huésped y el establecimiento correspondiente. Roomia actúa únicamente como proveedor de la plataforma tecnológica que facilita dicha interacción y no como operador del servicio de hospedaje.
                    </p>
                  </div>

                  <div className="space-y-2 pl-4 border-l-2 border-neutral-200">
                    <h5 className="font-bold text-neutral-800 text-xs md:text-sm">Publicación de inmuebles en venta o alquiler</h5>
                    <p>
                      Roomia también permite la publicación de anuncios relacionados con bienes inmuebles destinados al alquiler o venta.
                    </p>
                    <p>
                      Estos anuncios tienen un carácter exclusivamente informativo. Las negociaciones, visitas, contratos, pagos y cualquier acuerdo comercial derivado de dichos anuncios serán realizados directamente entre las partes involucradas, sin intervención de Roomia.
                    </p>
                  </div>
                </div>

                {/* Sección 3: Contratación del servicio */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    3. Contratación del servicio
                  </h4>
                  <p>
                    Los servicios de gestión para establecimientos funcionan mediante suscripción bajo modalidad SaaS.
                  </p>
                  <p>
                    Cada establecimiento podrá contratar el plan que mejor se adapte a sus necesidades, accediendo únicamente a las funcionalidades incluidas dentro del plan seleccionado.
                  </p>
                  <p>
                    La contratación podrá realizarse directamente desde la plataforma o mediante los canales comerciales oficiales de Roomia.
                  </p>
                </div>

                {/* Sección 4: Responsabilidad de la información publicada */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    4. Responsabilidad de la información publicada
                  </h4>
                  <p>
                    Cada establecimiento es responsable de mantener actualizada la información publicada dentro de la plataforma, incluyendo:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>disponibilidad;</li>
                    <li>tarifas;</li>
                    <li>fotografías;</li>
                    <li>servicios;</li>
                    <li>horarios;</li>
                    <li>políticas internas;</li>
                    <li>condiciones de hospedaje.</li>
                  </ul>
                  <p>
                    Roomia no modifica ni valida el contenido publicado por los establecimientos, por lo que cualquier inexactitud será responsabilidad exclusiva del propietario o administrador correspondiente.
                  </p>
                </div>

                {/* Sección 5: Pagos */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    5. Pagos
                  </h4>
                  <p>
                    Cuando un establecimiento utilice pasarelas de pago integradas, las transacciones serán procesadas por proveedores externos especializados.
                  </p>
                  <p>
                    Roomia no almacena información confidencial de tarjetas bancarias como números completos, códigos CVV u otros datos sensibles de pago.
                  </p>
                  <p>
                    Las condiciones específicas de procesamiento estarán sujetas también a los términos establecidos por cada proveedor de pagos.
                  </p>
                  <div className="bg-teal-50 p-4 rounded-xl border border-teal-150 text-xs text-teal-950 font-medium">
                    📌 <strong>Deducción del 10%:</strong> El cobro procesado por concepto de reserva o alquiler tendrá una deducción del 10% que Roomia retendrá automáticamente como comisión por uso de la plataforma tecnológica y pasarela, liquidando el saldo restante al anfitrión.
                  </div>
                </div>

                {/* Sección 6: Uso adecuado de la plataforma */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    6. Uso adecuado de la plataforma
                  </h4>
                  <p>
                    Los usuarios se comprometen a utilizar Roomia de forma responsable y conforme a la legislación aplicable.
                  </p>
                  <p>
                    Queda prohibido, entre otros:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>acceder sin autorización a información de terceros;</li>
                    <li>realizar ingeniería inversa del software o clonar sus algoritmos de distribución;</li>
                    <li>ejecutar ataques informáticos o inyecciones de código;</li>
                    <li>utilizar herramientas automatizadas para extraer información de la plataforma sin autorización (scraping);</li>
                    <li>manipular precios, reservas o disponibilidad mediante medios fraudulentos;</li>
                    <li>utilizar identidades falsas o información de perfil fraudulenta.</li>
                  </ul>
                </div>

                {/* Sección 7: Suspensión de cuentas */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    7. Suspensión de cuentas
                  </h4>
                  <p>
                    Roomia podrá suspender temporalmente o cancelar una cuenta cuando existan evidencias razonables de:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>fraude;</li>
                    <li>uso indebido de la plataforma;</li>
                    <li>incumplimiento de estos términos;</li>
                    <li>actividades que comprometan la seguridad del sistema o de otros usuarios.</li>
                  </ul>
                  <p>
                    Cuando sea posible, el usuario será informado sobre la medida adoptada y podrá presentar las aclaraciones correspondientes.
                  </p>
                </div>

                {/* Sección 8: Limitación de responsabilidad */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    8. Limitación de responsabilidad
                  </h4>
                  <p>
                    Roomia proporciona la infraestructura tecnológica que facilita la gestión y publicación de información.
                  </p>
                  <p>
                    No somos propietarios de los establecimientos publicados ni participamos como parte en los contratos de hospedaje o en las operaciones de compraventa inmobiliaria realizadas entre usuarios.
                  </p>
                  <p>
                    En consecuencia, Roomia no garantiza la calidad de los servicios prestados por terceros ni será responsable por incumplimientos derivados de la relación contractual existente entre huéspedes, propietarios, compradores o vendedores.
                  </p>
                </div>

                {/* Sección 9: Modificaciones */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    9. Modificaciones
                  </h4>
                  <p>
                    Roomia podrá actualizar estos Términos y Condiciones cuando resulte necesario por cambios legales, técnicos o funcionales.
                  </p>
                  <p>
                    La versión vigente estará siempre disponible dentro de la plataforma indicando su fecha de actualización.
                  </p>
                </div>

                {/* Sección 10: Contacto */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    10. Contacto
                  </h4>
                  <p>
                    Para consultas relacionadas con estos Términos y Condiciones puede comunicarse mediante los canales oficiales de Roomia:
                  </p>
                  
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-150 space-y-2.5 mt-2">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-400 block">Oficina Legal y Consultas de Cumplimiento</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-teal-600" />
                        <span>roomia.admincontact@gmail.com</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-teal-600" />
                        <span>+593 98 405 6660 (Matriz Ecuador)</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* POLITICA DE PRIVACIDAD */}
            {documentType === 'privacidad' && (
              <div className="space-y-6" id="legal-content-privacidad">
                
                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-150 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-teal-750 shrink-0 mt-0.5" />
                  <p className="text-xs text-teal-900 font-semibold leading-normal">
                    En <strong>Roomia</strong> nos comprometemos a proteger la privacidad y la información personal de nuestros usuarios. Esta Política de Privacidad explica qué información recopilamos, cómo la utilizamos, con quién puede compartirse, cómo la protegemos y cuáles son sus derechos al utilizar nuestros servicios.
                  </p>
                </div>

                <p className="text-xs text-neutral-600">
                  Al registrarse o utilizar la plataforma, el usuario acepta el tratamiento de sus datos conforme a lo establecido en esta política.
                </p>

                {/* 1. Información que recopilamos */}
                <div className="space-y-4">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    1. Información que recopilamos
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Dependiendo de los servicios utilizados, Roomia podrá recopilar la siguiente información:
                  </p>

                  <div className="space-y-3 pl-4 border-l border-neutral-200">
                    <div>
                      <h5 className="font-bold text-neutral-850 text-xs">Datos de identificación</h5>
                      <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1 mt-1">
                        <li>Nombre y apellidos.</li>
                        <li>Correo electrónico.</li>
                        <li>Número de teléfono.</li>
                        <li>Documento de identidad o pasaporte cuando sea requerido por obligaciones legales o por el establecimiento de hospedaje.</li>
                      </ul>
                    </div>

                    <div>
                      <h5 className="font-bold text-neutral-855 text-xs">Datos de autenticación</h5>
                      <p className="text-xs text-neutral-600 mt-1">
                        Para proteger las cuentas de nuestros usuarios recopilamos la información necesaria para verificar su identidad y mantener sesiones seguras, incluyendo registros relacionados con el acceso a la plataforma.
                      </p>
                    </div>

                    <div>
                      <h5 className="font-bold text-neutral-855 text-xs">Información de reservas y hospedaje</h5>
                      <p className="text-xs text-neutral-600 mt-1">
                        Podremos almacenar información relacionada con:
                      </p>
                      <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1 mt-1">
                        <li>Reservas realizadas.</li>
                        <li>Fechas de ingreso y salida.</li>
                        <li>Habitaciones o unidades reservadas.</li>
                        <li>Historial de estadías.</li>
                        <li>Información necesaria para la administración del servicio.</li>
                      </ul>
                    </div>

                    <div>
                      <h5 className="font-bold text-neutral-855 text-xs">Información de establecimientos</h5>
                      <p className="text-xs text-neutral-600 mt-1">
                        Cuando un propietario o administrador registra un establecimiento, podremos recopilar información como:
                      </p>
                      <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1 mt-1">
                        <li>Nombre comercial.</li>
                        <li>Dirección.</li>
                        <li>Fotografías.</li>
                        <li>Servicios ofrecidos.</li>
                        <li>Disponibilidad.</li>
                        <li>Tarifas.</li>
                        <li>Información operativa necesaria para el funcionamiento del sistema.</li>
                      </ul>
                    </div>

                    <div>
                      <h5 className="font-bold text-neutral-855 text-xs">Información técnica</h5>
                      <p className="text-xs text-neutral-600 mt-1">
                        Con el objetivo de garantizar la seguridad y el correcto funcionamiento de la plataforma, podremos registrar información técnica como:
                      </p>
                      <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1 mt-1">
                        <li>Dirección IP.</li>
                        <li>Tipo de navegador.</li>
                        <li>Sistema operativo.</li>
                        <li>Fecha y hora de acceso.</li>
                        <li>Registros de actividad.</li>
                        <li>Eventos relacionados con la seguridad de la cuenta.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 2. Finalidad del tratamiento de los datos */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    2. Finalidad del tratamiento de los datos
                  </h4>
                  <p className="text-xs text-neutral-600">
                    La información recopilada es utilizada únicamente para fines relacionados con la prestación de nuestros servicios, entre ellos:
                  </p>
                  <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1.5">
                    <li>Crear y administrar cuentas de usuario.</li>
                    <li>Verificar la identidad durante el proceso de autenticación.</li>
                    <li>Gestionar reservas y operaciones de hospedaje.</li>
                    <li>Administrar establecimientos registrados.</li>
                    <li>Procesar pagos mediante proveedores autorizados cuando corresponda.</li>
                    <li>Enviar confirmaciones de reservas y notificaciones relacionadas con la plataforma.</li>
                    <li>Recuperar cuentas y restablecer contraseñas.</li>
                    <li>Mejorar la seguridad de nuestros sistemas.</li>
                    <li>Detectar actividades fraudulentas o accesos no autorizados.</li>
                    <li>Cumplir obligaciones legales, regulatorias o tributarias cuando sean aplicables.</li>
                    <li>Mejorar continuamente nuestros servicios y la experiencia del usuario.</li>
                  </ul>
                  <p className="text-xs text-neutral-600 italic">
                    Roomia recopila únicamente la información necesaria para prestar sus servicios y evita solicitar datos que no sean pertinentes para el funcionamiento de la plataforma.
                  </p>
                </div>

                {/* 3. Permisos y funcionalidades del dispositivo */}
                <div className="space-y-3">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    3. Permisos y funcionalidades del dispositivo
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Con el fin de ofrecer determinadas funcionalidades, Roomia podrá solicitar acceso a recursos específicos del dispositivo del usuario.
                  </p>
                  
                  <div className="space-y-2 pl-4 border-l border-neutral-200">
                    <div>
                      <h5 className="font-bold text-neutral-850 text-xs">Cámara</h5>
                      <p className="text-xs text-neutral-600 mt-1">
                        Roomia podrá solicitar acceso a la cámara únicamente para la lectura de códigos QR utilizados dentro de los procesos operativos del establecimiento. Esta funcionalidad está disponible exclusivamente para usuarios con los roles de <strong>Administrador</strong> y <strong>Recepcionista</strong>.
                      </p>
                      <p className="text-xs text-neutral-600 font-semibold mt-1">
                        Roomia no utiliza la cámara para grabar videos, capturar fotografías ni almacenar imágenes del dispositivo. El acceso se limita exclusivamente al escaneo del código QR necesario para la funcionalidad correspondiente.
                      </p>
                    </div>

                    <div>
                      <h5 className="font-bold text-neutral-850 text-xs mt-2">Almacenamiento local</h5>
                      <p className="text-xs text-neutral-600 mt-1">
                        La plataforma utiliza cookies, almacenamiento local del navegador y tecnologías similares para mantener la sesión iniciada, recordar preferencias del usuario y garantizar el correcto funcionamiento del sistema.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Comunicaciones electrónicas */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    4. Comunicaciones electrónicas
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Roomia podrá enviar correos electrónicos relacionados con la prestación del servicio, incluyendo:
                  </p>
                  <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1">
                    <li>Verificación de cuentas.</li>
                    <li>Recuperación de contraseña.</li>
                    <li>Confirmación de reservas.</li>
                    <li>Notificaciones importantes del sistema.</li>
                    <li>Alertas de seguridad.</li>
                    <li>Comunicaciones necesarias para el funcionamiento de la plataforma.</li>
                  </ul>
                  <p className="text-xs text-neutral-600 font-medium">
                    Estas comunicaciones forman parte del servicio y no constituyen publicidad no solicitada.
                  </p>
                </div>

                {/* 5. Compartición de información */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    5. Compartición de información
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Roomia no vende, alquila ni comercializa información personal de sus usuarios.
                  </p>
                  <p className="text-xs text-neutral-600">
                    La información únicamente podrá compartirse cuando sea necesario para la prestación de los servicios, incluyendo proveedores especializados en:
                  </p>
                  <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1">
                    <li>autenticación de usuarios;</li>
                    <li>procesamiento de pagos;</li>
                    <li>envío de correos electrónicos;</li>
                    <li>infraestructura y almacenamiento tecnológico;</li>
                    <li>soporte técnico y mantenimiento de la plataforma;</li>
                    <li>cumplimiento de obligaciones legales cuando una autoridad competente lo requiera.</li>
                  </ul>
                  <p className="text-xs text-neutral-600 italic">
                    Todos los proveedores que intervienen en la prestación del servicio están sujetos a obligaciones de confidencialidad y únicamente acceden a la información necesaria para desarrollar sus funciones.
                  </p>
                </div>

                {/* 6. Protección de la información */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    6. Protección de la información
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Roomia implementa medidas técnicas, administrativas y organizativas destinadas a proteger la información frente a accesos no autorizados, pérdida, alteración o divulgación indebida.
                  </p>
                  <p className="text-xs text-neutral-600 font-medium">
                    Aunque aplicamos estándares de seguridad reconocidos por la industria, ningún sistema conectado a Internet puede garantizar un nivel de seguridad absoluto. Por ello, recomendamos a nuestros usuarios mantener la confidencialidad de sus credenciales y utilizar contraseñas seguras.
                  </p>
                </div>

                {/* 7. Conservación de los datos */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    7. Conservación de los datos
                  </h4>
                  <p className="text-xs text-neutral-600">
                    La información será conservada durante el tiempo necesario para prestar los servicios contratados y cumplir las obligaciones legales aplicables.
                  </p>
                  <p className="text-xs text-neutral-600">
                    Cuando un usuario solicite la eliminación de su cuenta, los datos podrán conservarse únicamente durante el período requerido para cumplir obligaciones fiscales, legales, contables o atender posibles reclamaciones. Una vez finalizados dichos plazos, la información será eliminada o anonimizada de forma segura.
                  </p>
                </div>

                {/* 8. Derechos del usuario */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    8. Derechos del usuario
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Como titular de sus datos personales, usted podrá solicitar en cualquier momento:
                  </p>
                  <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1">
                    <li>Acceder a la información que mantenemos sobre usted.</li>
                    <li>Rectificar datos incorrectos o desactualizados.</li>
                    <li>Solicitar la eliminación de su cuenta cuando sea legalmente posible.</li>
                    <li>Oponerse al tratamiento de determinados datos conforme a la legislación aplicable.</li>
                    <li>Solicitar información sobre el tratamiento realizado por Roomia.</li>
                  </ul>
                  <p className="text-xs text-neutral-600">
                    Las solicitudes podrán enviarse a través de nuestros canales oficiales de contacto.
                  </p>
                </div>

                {/* 9. Cambios en esta Política de Privacidad */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    9. Cambios en esta Política de Privacidad
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Roomia podrá actualizar esta Política de Privacidad cuando existan cambios en la legislación aplicable, en nuestros servicios o en nuestras prácticas de tratamiento de datos.
                  </p>
                  <p className="text-xs text-neutral-600">
                    La versión vigente estará siempre disponible dentro de la plataforma indicando la fecha de su última actualización. El uso continuado de la plataforma después de la publicación de una nueva versión implicará la aceptación de los cambios realizados.
                  </p>
                </div>

                {/* 10. Contacto */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    10. Contacto
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Si tiene preguntas relacionadas con esta Política de Privacidad o desea ejercer cualquiera de sus derechos sobre sus datos personales, puede comunicarse con nosotros mediante los siguientes canales oficiales:
                  </p>
                  
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-150 space-y-2.5 mt-2">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-400 block">Oficina de Privacidad y Tratamiento de Datos</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-teal-600" />
                        <span>roomia.admincontact@gmail.com</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-teal-600" />
                        <span>+593 98 405 6660 (Matriz Ecuador)</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* POLITICA DE CANCELACIONES Y REEMBOLSOS */}
            {documentType === 'cancelaciones' && (
              <div className="space-y-6" id="legal-content-cancelaciones">
                
                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-150 flex items-start gap-3 animate-fade-in">
                  <HeartHandshake className="w-5 h-5 text-teal-750 shrink-0 mt-0.5" />
                  <p className="text-xs text-teal-900 font-semibold leading-normal">
                    En Roomia buscamos ofrecer una experiencia transparente tanto para los establecimientos como para los huéspedes. Esta política explica cómo se gestionan las cancelaciones, modificaciones y solicitudes de reembolso realizadas a través de la plataforma.
                  </p>
                </div>

                {/* Sección 1: Alcance de esta política */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    1. Alcance de esta política
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Roomia es una plataforma tecnológica que facilita la gestión de reservas entre huéspedes y establecimientos de hospedaje.
                  </p>
                  <p className="text-xs text-neutral-600">
                    Cada establecimiento puede definir sus propias políticas de cancelación, modificación y reembolso, las cuales estarán disponibles durante el proceso de reserva y deberán ser aceptadas por el huésped antes de confirmar su solicitud.
                  </p>
                </div>

                {/* Sección 2: Cancelación de reservas */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    2. Cancelación de reservas
                  </h4>
                  <p className="text-xs text-neutral-600">
                    El huésped podrá solicitar la cancelación de una reserva siempre que el establecimiento permita dicha acción conforme a su política vigente.
                  </p>
                  <p className="text-xs text-neutral-600">
                    Las condiciones aplicables, incluyendo plazos, cargos administrativos o posibles penalizaciones, dependerán exclusivamente de la política publicada por el establecimiento al momento de realizar la reserva.
                  </p>
                </div>

                {/* Sección 3: Modificación de reservas */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    3. Modificación de reservas
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Las solicitudes para modificar fechas, habitaciones, número de huéspedes u otros datos estarán sujetas a:
                  </p>
                  <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1">
                    <li>disponibilidad del establecimiento;</li>
                    <li>condiciones de la reserva original;</li>
                    <li>políticas internas del establecimiento.</li>
                  </ul>
                  <p className="text-xs text-neutral-600">
                    La aprobación de una modificación no está garantizada y dependerá de cada caso.
                  </p>
                </div>

                {/* Sección 4: Reembolsos */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    4. Reembolsos
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Cuando una reserva sea elegible para reembolso, éste será procesado conforme a las políticas del establecimiento y al método de pago utilizado durante la compra.
                  </p>
                  <p className="text-xs text-neutral-600">
                    El monto reembolsado podrá ser:
                  </p>
                  <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1">
                    <li>total;</li>
                    <li>parcial; o</li>
                    <li>no aplicable,</li>
                  </ul>
                  <p className="text-xs text-neutral-600">
                    según las condiciones aceptadas durante el proceso de reserva. Roomia no modifica las políticas comerciales definidas por cada establecimiento.
                  </p>
                </div>

                {/* Sección 5: Procesamiento de pagos */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    5. Procesamiento de pagos
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Cuando los pagos sean realizados mediante pasarelas integradas en Roomia, el procesamiento de los reembolsos estará sujeto también a los tiempos establecidos por las entidades financieras y los proveedores de pago.
                  </p>
                  <p className="text-xs text-neutral-600">
                    Dependiendo del método utilizado, la acreditación del dinero podrá requerir varios días hábiles después de la aprobación del reembolso.
                  </p>
                </div>

                {/* Sección 6: Incidencias relacionadas con el alojamiento */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    6. Incidencias relacionadas con el alojamiento
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Si el huésped considera que el establecimiento incumple de manera significativa las condiciones ofrecidas durante la reserva, podrá presentar un reclamo utilizando los canales habilitados por Roomia.
                  </p>
                  <p className="text-xs text-neutral-600">
                    Entre otros casos, podrán reportarse situaciones como:
                  </p>
                  <ul className="list-disc pl-5 text-xs text-neutral-600 space-y-1">
                    <li>diferencias importantes respecto a la información publicada;</li>
                    <li>problemas graves de limpieza;</li>
                    <li>habitaciones distintas a las reservadas;</li>
                    <li>servicios esenciales no disponibles cuando hayan sido ofrecidos como parte de la reserva.</li>
                  </ul>
                  <p className="text-xs text-neutral-600">
                    Roomia podrá revisar la información proporcionada y colaborar como intermediario entre las partes para facilitar una solución, sin perjuicio de las responsabilidades que correspondan al establecimiento.
                  </p>
                </div>

                {/* Sección 7: Evidencias para reclamaciones */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    7. Evidencias para reclamaciones
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Con el fin de facilitar la revisión de un reclamo, el huésped podrá aportar documentación que respalde su solicitud, como fotografías, videos u otros elementos que permitan verificar los hechos reportados.
                  </p>
                  <p className="text-xs text-neutral-600">
                    Siempre que sea posible, se recomienda presentar dichas evidencias durante la estadía o dentro de un plazo razonable posterior al incidente.
                  </p>
                </div>

                {/* Sección 8: Responsabilidad de los establecimientos */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    8. Responsabilidad de los establecimientos
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Cada establecimiento es responsable de cumplir las políticas de cancelación, modificación y reembolso publicadas dentro de la plataforma.
                  </p>
                  <p className="text-xs text-neutral-600">
                    Asimismo, deberá mantener actualizada su información, tarifas, disponibilidad y condiciones comerciales.
                  </p>
                </div>

                {/* Sección 9: Responsabilidad de Roomia */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    9. Responsabilidad de Roomia
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Roomia proporciona la infraestructura tecnológica para administrar reservas y facilitar la comunicación entre huéspedes y establecimientos.
                  </p>
                  <p className="text-xs text-neutral-600">
                    Salvo disposición legal en contrario, Roomia no actúa como parte del contrato de hospedaje ni determina las políticas comerciales individuales de cada establecimiento.
                  </p>
                  <p className="text-xs text-neutral-600">
                    No obstante, cuando corresponda, podremos colaborar en la gestión de incidencias relacionadas con reservas realizadas a través de la plataforma.
                  </p>
                </div>

                {/* Sección 10: Cambios a esta política */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    10. Cambios a esta política
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Roomia podrá actualizar esta Política de Cancelaciones, Modificaciones y Reembolsos cuando existan cambios en la plataforma, en la legislación aplicable o en los procesos operativos.
                  </p>
                  <p className="text-xs text-neutral-600">
                    La versión vigente estará siempre disponible dentro del sitio web indicando la fecha de su última actualización.
                  </p>
                </div>

                {/* Sección 11: Contacto */}
                <div className="space-y-2 transition-all duration-300 hover:translate-x-1 p-1">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block animate-pulse" />
                    11. Contacto
                  </h4>
                  <p className="text-xs text-neutral-600">
                    Si tiene preguntas relacionadas con esta política o necesita asistencia respecto a una reserva realizada mediante Roomia, puede comunicarse con nosotros a través de nuestros canales oficiales:
                  </p>
                  
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-150 space-y-2.5 mt-2">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-400 block">Oficina de Soporte y Atención al Cliente</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-teal-600" />
                        <span>roomia.admincontact@gmail.com</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-teal-600" />
                        <span>+593 98 405 6660 (Matriz Ecuador)</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* SHARED COMPLIANCE SIGNATURE */}
            <div className="mt-10 pt-6 border-t border-neutral-150 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-400 font-sans gap-4" id="legal-compliance-footer">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Garantía de Cumplimiento PMS Homologado</span>
              </div>
              <span className="font-mono text-[10px]">Identificador Legal Único: R-PMS-EC-2026</span>
            </div>

          </div>
        </section>

      </div>

      {/* Tiny localized footer inside the legal templates */}
      <footer className="py-6 border-t border-neutral-150 text-center text-[10px] text-neutral-400 font-mono bg-slate-900 mt-auto" id="legal-page-footer">
        <p className="text-white/60">©2026 Maqyasoft - Santa Elena, Ecuador</p>
      </footer>

    </div>
  );
}
