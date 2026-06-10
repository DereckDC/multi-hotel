/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-md" id="legal-navbar">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-550 text-slate-950 flex items-center justify-center font-display font-black text-lg shadow-md">
              R
            </div>
            <span className="font-bold text-white text-base tracking-tight">
              Roomia <span className="text-teal-400 font-medium">PMS / Legal</span>
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
            id="back-to-home-btn"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-teal-400" />
            <span>Volver a Inicio</span>
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
              {documentType === 'privacidad' && 'Política de Privacidad y Tratamiento de Información'}
              {documentType === 'cancelaciones' && 'Política de Cancelaciones, Anulaciones y Reembolsos'}
            </h1>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5 font-mono">
                <FileText className="w-3.5 h-3.5 text-neutral-450" />
                Identificador: ROOMIA-{documentType === 'terminos' ? 'TC' : documentType === 'privacidad' ? 'PP' : 'CR'}-2026
              </span>
              <span className="flex items-center gap-1.5 font-mono font-bold text-teal-600">
                <CalendarClock className="w-3.5 h-3.5" />
                Última actualización: 10 de Junio, 2026
              </span>
            </div>
          </div>

          {/* DYNAMIC COMPLIANCE REDACTION FOR ROOMIA */}
          <div className="prose prose-sm prose-teal max-w-none text-neutral-650 leading-relaxed space-y-6 text-xs md:text-sm">
            
            {/* TERMINOS Y CONDICIONES */}
            {documentType === 'terminos' && (
              <div className="space-y-6" id="legal-content-terminos">
                
                {/* Intro Section */}
                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-150 flex items-start gap-3">
                  <Scale className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-teal-900 font-semibold leading-normal">
                    Le rogamos leer con atención los presentes Términos y Condiciones generales. El acceso y uso de la plataforma <strong>Roomia PMS</strong> implica la aceptación sin reserva alguna de cada una de las cláusulas aquí estipuladas.
                  </p>
                </div>

                {/* Cláusula 1: Definición */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    1. Definición y Alcance de Roomia
                  </h4>
                  <p>
                    <strong>Roomia</strong> es una plataforma tecnológica internacional operada bajo el modelo de software como servicio (SaaS). Nuestras herramientas digitales están dedicadas exclusivamente al control de inventarios, optimización de flujos operativos de recepción, administración y publicación de reservas en establecimientos hoteleros, así como la exhibición de anuncios clasificados para alquiler y venta de bienes inmuebles.
                  </p>
                </div>

                {/* Cláusula 2: Propietarios */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    2. Condiciones de Registro para Propietarios y Hoteles
                  </h4>
                  <p>
                    Los administradores y propietarios de establecimientos deben completar el registro formal proporcionando documentación de identidad jurídica verídica, habilitaciones de operación comercial y datos bancarios reales. Al publicar sus propiedades, los propietarios se comprometen a mantener actualizada la disponibilidad, tarifas, servicios y normativas internas, evitando sobreventas ("overbooking") y cobros no declarados.
                  </p>
                </div>

                {/* Cláusula 3: Responsabilidad de Datos */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    3. Responsabilidad sobre la Información Publicada
                  </h4>
                  <p>
                    La plataforma actúa únicamente como canal tecnológico de publicación. La fidelidad de las imágenes, tarifas variables de temporada, descripción de instalaciones y servicios del establecimiento es responsabilidad única y exclusiva del operador del hotel. Roomia no asumirá responsabilidades por imprecisiones informativas, omisiones o discrepancias que vulneren los derechos del consumidor final.
                  </p>
                </div>

                {/* Cláusula 4: Huéspedes */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    4. Condiciones para Huéspedes y Reserva Directa
                  </h4>
                  <p>
                    Los huéspedes de la plataforma pueden navegar de manera pública y efectuar reservas rellenando la información de contacto requerida. Cada solicitud de reserva confirmada constituye un contrato jurídico vinculante entre el huésped y el hotelero. El huésped se compromete a presentarse en el día estipulado, respetar el check-out y liquidar todos los consumos extras realizados dentro del hotel.
                  </p>
                </div>

                {/* Cláusula 5: Uso permitido */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    5. Uso Permitido y Licencia del Software
                  </h4>
                  <p>
                    Roomia concede una licencia limitada, temporal, no exclusiva y revocable para utilizar el software PMS conforme a las funciones descritas para cada rol. Está rotundamente prohibido utilizar técnicas de raspado de datos (web scraping), extracción no autorizada de estadísticas, ataques de denegación de servicio (DDoS) o cualquier intento de ingeniería inversa encaminado a duplicar el motor del software.
                  </p>
                </div>

                {/* Cláusula 6: Fraude */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    6. Tolerancia Cero al Fraude de Pagos e Identidad
                  </h4>
                  <p>
                    El uso de tarjetas de crédito o débito sin autorización de su titular, la falsificación de comprobantes de transferencia electrónica bancaria, el rechazo sistemático injustificado de cargos de reserva legítimos ("chargebacks") o la alteración maliciosa de precios del sistema mediante inyección de código serán procesados de forma legal. Roomia colaborará con la policía cibernética nacional proporcionando logs de auditoría seguros.
                  </p>
                </div>

                {/* Cláusula 7: Disponibilidad */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    7. Reservas Sujetas a Disponibilidad Dinámica
                  </h4>
                  <p>
                    El inventario de suites y habitaciones se procesa dinámicamente mediante transacciones asíncronas en tiempo real. Existe una muy baja posibilidad de colisión de coincidencia de milisegundos. En caso de una sobreventa no deliberada por reajuste de red, el establecimiento se compromete a priorizar la reubicación del huésped afectado o la anulación sin recargos.
                  </p>
                </div>

                {/* Cláusula 8: Proveedores de Pago */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    8. Pasarelas de Pago e Integración de Terceros
                  </h4>
                  <p>
                    El procesamiento de depósitos para apartar habitaciones e inmuebles se realiza a través de pasarelas de pago independientes habilitadas con estrictos estándares de seguridad y tokens encriptados. Las credenciales confidenciales de las tarjetas (como el número de tarjeta completo y código CVV) no son guardadas, archivadas ni transmitidas dentro de las bases de datos nativas del PMS de Roomia.
                  </p>
                </div>

                {/* Cláusula 9 y 10: Inmuebles en Venta y Deslinde de Compraventa */}
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span>9 & 10. Deslinde Expreso de Operaciones de Venta Inmobiliaria</span>
                  </div>
                  <p className="text-xs text-amber-950 leading-relaxed">
                    Las propiedades listadas en venta en Roomia PMS funcionan exclusivamente en carácter de anuncios informativos o tablones de anuncios clasificados directos. 
                    <strong className="block mt-1 bg-amber-100/60 p-2.5 rounded-lg border border-amber-300 font-extrabold text-slate-900">
                      "Roomia no participa como comprador, vendedor, corredor inmobiliario ni representante en operaciones de compraventa de inmuebles."
                    </strong>
                    El procesamiento de pagos, depósitos de garantía, comisiones de corretaje o cualquier transacción financiera por transacciones de compraventa de inmuebles está terminantemente suspendido dentro del software. Las coordinaciones físicas de las visitas, las firmas de escrituras públicas, el saneamiento de dominio y los traspasos monetarios deben acordarse fuera de la plataforma, bajo exclusiva responsabilidad directa del propietario y el comprador, amparados por notaría pública local.
                  </p>
                </div>

                {/* Cláusula 11: Suspensión de cuentas */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    11. Suspensión Inmediata por Conductas Abusivas o Fraudulentas
                  </h4>
                  <p>
                    Roomia se reserva el derecho definitivo y unilateral de inhabilitar cuentas de usuarios temporal o perpetuamente, restringiendo el acceso del hotelero o del huésped ante indicios demostrados de intento de hackeo, uso de identidades falsas, fraude de reembolsos duplicados, o cuando un hotel vulnere las condiciones óptimas de trato digno hacia los huéspedes.
                  </p>
                </div>

                {/* Cláusula 12: Limitación de Responsabilidad */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    12. Limitación de Responsabilidad Legal
                  </h4>
                  <p>
                    Roomia no será civil, administrativa, comercial ni penalmente responsable por daños directos, fortuitos o emergentes relacionados con la imposibilidad de acceso al software, cortes de luz eléctrica del hotel, negligencias de servicio cometidas por el personal del hotel, robos dentro de las habitaciones o incumplimiento de los contratos notariales de compraventa inmobiliaria derivados de los anuncios visualizados.
                  </p>
                </div>

                {/* Cláusula 13 y 14: Modificaciones y Contacto */}
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    13. Modificación del Pliego de Términos
                  </h4>
                  <p>
                    Este documento puede ser actualizado periódicamente para ajustar requisitos fiscales de pasarelas de cobro o optimizaciones de software. Al publicar revisiones, modificaremos la fecha superior de "última actualización". El uso continuado del software constituye su aceptación táctica a los nuevos parámetros legales.
                  </p>
                </div>

                <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-150 space-y-2.5">
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
            )}

            {/* POLITICA DE PRIVACIDAD */}
            {documentType === 'privacidad' && (
              <div className="space-y-6" id="legal-content-privacidad">
                
                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-150 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-teal-750 shrink-0 mt-0.5" />
                  <p className="text-xs text-teal-900 font-semibold leading-normal">
                    Tu privacidad es nuestra prioridad absoluta. Roomia garantiza la protección y confidencialidad en el tratamiento de tus datos personales, amparados por reglamentos internaciones y directivas de protección de datos.
                  </p>
                </div>

                {/* 1. Qué datos recopila */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    1. Categorías de Datos Recopilados por Roomia
                  </h4>
                  <p>
                    Recogemos estrictamente la información técnica e identificativa requerida para operar de manera transparente:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 mt-1">
                    <li><strong>Datos del Perfil de Usuario:</strong> Nombres completos, apellidos, dirección de correo electrónico activa, teléfono de contacto y número de documento nacional de identidad o pasaporte (requerido legalmente para la ficha policial o de migración al registrarse en hoteles).</li>
                    <li><strong>Datos de Transacción y Estadías:</strong> Fechas de check-in y check-out, identificadores de habitaciones, detalles de transacciones de abonos (nunca credenciales plenas de la tarjeta), historial de reservas finalizadas.</li>
                    <li><strong>Datos de Propiedades:</strong> Direcciones físicas, descripciones, geolocalización, fotos representativas e inventarios de suite.</li>
                    <li><strong>Datos de Operación Técnica:</strong> Dirección IP, logs de auditoría detallados (Activity Audit logs) que registran qué usuario PMS realizó cambios en el estado de una reserva o habitación, fecha y hora exacta.</li>
                  </ul>
                </div>

                {/* 2. Finalidad del tratamiento */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    2. Finalidades Detalladas del Tratamiento de Datos
                  </h4>
                  <p>
                    La recolección de su información personal e inmobiliaria se realiza estrictamente con las siguientes motivaciones operacionales:
                  </p>
                  <ol className="list-decimal pl-5 space-y-1.5 mt-1">
                    <li>Garantizar el correcto funcionamiento de los flujos de reservas, check-in, check-out y estados de la suite.</li>
                    <li>Generar facturas proforma imprimibles y reportes de auditoría financiera interna (Invoice PDF generator).</li>
                    <li>Procesar de forma encriptada las reservas con las pasarelas de pago homologadas PCI-DSS.</li>
                    <li>Enviar notificaciones operacionales por correo respecto a la confirmación de la habitación o alteraciones de contraseña.</li>
                    <li>Evitar el lavado de activos, estafas en línea y suplantaciones de identidad de tarjetahabientes.</li>
                  </ol>
                </div>

                {/* 3. Seguridad y protección */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    3. Resguardo, Medidas de Seguridad y Cifrado
                  </h4>
                  <p>
                    Roomia implementa rigurosos protocolos industriales para el resguardo de su información. El intercambio de datos entre su navegador y nuestra infraestructura cloud se cifra bajo certificados seguros de capa de sockets (SSL/TLS). Las bases de datos operativas emplean encriptación de almacenamiento en reposo (PostgreSQL en servidores dedicados Supabase) con firewalls avanzados que restringen intrusiones físicas y lógicas perimetrales.
                  </p>
                </div>

                {/* 4. Conservación de la información */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    4. Conservación Temporal de los Datos
                  </h4>
                  <p>
                    Conservaremos su perfil y registros de reserva de forma indefinida mientras mantenga activa su cuenta de usuario de Roomia, con el objetivo de facilitarle reportes analíticos acumulativos. Si la cuenta permanece inactiva por más de 5 años continuos o si decide cancelarla formalmente, iniciaremos la desactivación y el borrado seguro, salvo por aquella información que se deba retener exclusivamente para cumplir con plazos fiscales o tributarios legales del estado ecuatoriano de hasta 7 años.
                  </p>
                </div>

                {/* 5. Compartición con proveedores */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    5. Transferencia Limitada a Proveedores Autorizados
                  </h4>
                  <p>
                    No vendemos, rentamos, comercializamos ni cedemos bases de datos de nuestros huéspedes o establecimientos hoteleros a anunciantes de publicidad o brokers publicitarios. La transferencia de datos ocurre exclusivamente a:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li><strong>Pasarelas de Cobro de Reservas:</strong> Con el fin exclusivo de autenticar de forma segura los cobros, abonos o reembolsos pertinentes.</li>
                    <li><strong>Módulos de Envío de Correo SMTP:</strong> Servidores autorizados para el despacho instantáneo del PDF de la factura, alertas PMS y códigos QR de llegada rápida.</li>
                    <li><strong>Convenio de Soporte Técnico Especializado:</strong> Bajo estricta confidencialidad con el socio tecnológico <strong>HomeDC°</strong>, para resolver incidentes en la infraestructura base.</li>
                  </ul>
                </div>

                {/* 6. Derechos de acceso, rectificación y eliminación */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    6. Ejercicio de sus Derechos ARCO
                  </h4>
                  <p>
                    Como titular de sus datos personales, goza de amplios derechos para Acceder a sus registros almacenados, Rectificar descripciones incorrectas o mal escritas sobre su identidad, Cancelar perfiles que ya no desea que se mantengan en el sistema y Oponerse a comunicaciones. Para gatillar una solicitud de eliminación formal, envíe una petición por escrito acreditando su identidad a: <strong className="text-teal-700">roomia.admincontact@gmail.com</strong>.
                  </p>
                </div>

                {/* 7. Cookies */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    7. Uso de Cookies Técnicas de Autenticación
                  </h4>
                  <p>
                    Utilizamos cookies técnicas exclusivas de sesión local (como `aura_hotel_pms_current_user_id` o estado reactivo de navegador local (`localStorage`)) con el fin único de preservar su sesión conectada en el PMS sin requerir la inyección repetitiva de su clave cada vez que cambia de pantalla en el panel. Estas cookies no rastrean comportamientos en otros sitios web ajenos a Roomia PMS.
                  </p>
                </div>

              </div>
            )}

            {/* POLITICA DE CANCELACIONES Y REEMBOLSOS */}
            {documentType === 'cancelaciones' && (
              <div className="space-y-6" id="legal-content-cancelaciones">
                
                <div className="p-4 bg-teal-50 rounded-2xl border border-teal-150 flex items-start gap-3">
                  <HeartHandshake className="w-5 h-5 text-teal-750 shrink-0 mt-0.5" />
                  <p className="text-xs text-teal-900 font-semibold leading-normal">
                    Buscamos el equilibrio de equidad ideal para salvaguardar tanto el capital operativo del hotelero como el dinero del huésped. Entendemos los imprevistos de viaje y promovemos un marco estricto y transparente aplicable a disputas.
                  </p>
                </div>

                {/* Cláusula 1: Bloqueo de disponibilidad */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    1. Bloqueo de Inventario y Compromiso de Fechas
                  </h4>
                  <p>
                    Al confirmarse una reserva mediante abono de pasarela, el sistema PMS de Roomia bloquea automáticamente el inventario de la habitación o suite seleccionada para esas fechas específicas. Esto provoca que el hotelero rechace otras consultas comerciales legítimas. Por lo tanto, el huésped asume un compromiso contractual serio respecto a respetar la estadía reservada.
                  </p>
                </div>

                {/* Cláusula 2: Cargos administrativos */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    2. Cancelaciones Voluntarias y Cargos de Gestión
                  </h4>
                  <p>
                    Las solicitudes de cancelación voluntaria emitidas de forma directa por iniciativa propia del huésped a través del sistema podrán estar sujetas a un cargo administrativo no reembolsable de gestión. Esta comisión corresponde a los cobros tecnológicos de reversión de transacciones aplicados por las pasarelas bancarias asociadas.
                  </p>
                </div>

                {/* Cláusula 3: Devoluciones no garantizadas */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    3. No Devolución Automática Absoluta
                  </h4>
                  <p>
                    Entienda de antemano que la sola solicitud de cancelación no gatilla un reembolso íntegro inmediato automático. Los reembolsos totales están estrictamente evaluados de conformidad con las políticas individuales y plazos de preaviso registrados por cada establecimiento de hospedaje afiliado, descritos en los detalles del hotel correspondientes.
                  </p>
                </div>

                {/* Cláusula 4: Reembolso parcial gradual */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    4. Estructura de Reembolso Parcial por Anticipación
                  </h4>
                  <p>
                    En caso de políticas flexibilizadas y salvo indicación contraria expresa y por escrito en el voucher del alojamiento, se aplicará el siguiente cuadro gradual de reembolsos:
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-neutral-700 border-collapse border border-neutral-200 mt-2">
                      <thead>
                        <tr className="bg-neutral-100 text-[#344D67] font-bold text-center">
                          <th className="border border-neutral-200 p-2.5">Anticipación del Preaviso</th>
                          <th className="border border-neutral-200 p-2.5">Porcentaje de Reembolso Efectivo</th>
                          <th className="border border-neutral-200 p-2.5">Tarifa Especial de Gestión</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-center font-medium">
                          <td className="border border-neutral-200 p-2 text-left">Mayor a 14 días calendarios antes del Check-In</td>
                          <td className="border border-neutral-200 p-2 text-[#2D6A4F] font-bold">100% de la seña depositada</td>
                          <td className="border border-neutral-200 p-2 text-neutral-500 font-mono">Únicamente costos bancarios de pasarela</td>
                        </tr>
                        <tr className="text-center font-medium">
                          <td className="border border-neutral-200 p-2 text-left">Entre 7 y 14 días calendario antes del Check-In</td>
                          <td className="border border-neutral-200 p-2 text-amber-700 font-bold">50% de la seña depositada</td>
                          <td className="border border-neutral-200 p-2 text-neutral-500 font-mono">Únicamente costos bancarios de pasarela</td>
                        </tr>
                        <tr className="text-center font-medium bg-red-50/20">
                          <td className="border border-neutral-200 p-2 text-left">Menor a 7 días calendario antes del Check-In o No-Show</td>
                          <td className="border border-neutral-200 p-2 text-red-650 font-extrabold font-semibold">0% (Ningún reembolso)</td>
                          <td className="border border-neutral-200 p-2 text-red-700 font-serif italic">Bloqueo absoluto de suite retenido</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cláusula 5 y 6: Discrepancias y Medidas */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    5 & 6. Procedimiento Especial por Incumplimiento Grave del Alojamiento
                  </h4>
                  <p>
                    Si al momento físico del arribo o check-in, la suite o habitación asignada presenta condiciones significativamente deficientes o discrepancias insalvables contrarias a lo publicitado (por ejemplo, carencia de los servicios descritos como agua caliente, aire acondicionado inoperante definitivo, limpieza sumamente deficiente verificada por la administración de Roomia), se habilitará la opción para iniciar un reclamo formal.
                  </p>
                  <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 border-dashed space-y-2 text-xs">
                    <span className="font-bold text-[#1f2d3d] block">Las medidas correctivas aplicables tras la revisión técnica comprenderán:</span>
                    <ul className="list-disc pl-5 space-y-1 text-neutral-650 font-medium">
                      <li><strong>Reembolsos Parciales o Totales directos:</strong> Co-financiados o absorbidos de inmediato por el establecimiento hotelero acreditado.</li>
                      <li><strong>Créditos Operacionales de Canje:</strong> Emisión de vouchers de saldo a favor canjeables por futuras estadías en suites equivalentes.</li>
                      <li><strong>Sanción perjudicial al Hotelero:</strong> Bloqueo del perfil del hotel o degradación de estatus en Roomia PMS si se constata dolo informativo reiterado.</li>
                    </ul>
                  </div>
                </div>

                {/* Cláusula 7: Evidencia fotográfica */}
                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-850 text-sm md:text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-teal-600 rounded-sm inline-block" />
                    7. Requisito Obligatorio de Evidencias
                  </h4>
                  <p>
                    No se admitirán reclamos infundados de palabra. El huésped que desee iniciar una disputa formal de reembolso por discrepancia sustancial deberá enviar fotos y videos nítidos fechados donde se demuestren de forma inconfundible los defectos físicos, fallos mecánicos o desperfectos higiénicos encontrados dentro del alojamiento en la primera hora del check-in.
                  </p>
                </div>

                {/* Cláusula 8 y 9: Métodos de pago y resolución */}
                <div className="bg-[#FAFDFD] border border-teal-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-teal-900 font-extrabold text-xs uppercase tracking-wider font-mono">
                    <CheckCircle2 className="w-4.5 h-4.5 text-teal-600" />
                    <span>8 & 9. Procesamiento y Tiempos de Reembolso Aprobados</span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Las revisiones de disputas sobre quejas de calidad son dictaminadas en un lapso máximo de <strong>3 a 5 días hábiles</strong>. Una vez aprobado un reembolso parcial o total, éste se procesará de forma ineludible bajo el mismo método de pago utilizado originalmente. 
                  </p>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Bajo regulaciones contra el lavado de dinero de las franquicias Visa/Mastercard y las pasarelas PCI-DSS, <strong>nunca se realizarán devoluciones en efectivo</strong> por transacciones liquidadas originalmente en línea con tarjeta de crédito. Los reembolsos acreditados pueden demorar entre <strong>5 y 10 días laborales</strong> adicionales en impactar en su estado de cuenta corriente, conforme a las políticas del banco emisor correspondiente.
                  </p>
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
