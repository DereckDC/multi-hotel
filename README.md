# Roomia PMS - Hotel Property Management System

**Roomia PMS** es una plataforma integral de gestión hotelera y propiedades (Property Management System - PMS) diseñada para optimizar las operaciones de hotelería moderna. Combina un potente motor de reservas públicas, un panel administrativo multi-propiedad, un módulo de recepción de alta velocidad con lectura y generación de códigos QR, emisión automática de facturas en PDF, analíticas operativas y un sistema de chat en tiempo real con aislamiento estricto de privacidad para huéspedes y recepcionistas.

---

## 🌟 Características Principales

### 1. Gestión Multi-Hotel y Habitaciones
- **Soporte Multi-Propiedad:** Administre múltiples sucursales, hoteles o departamentos de forma centralizada o aislada.
- **Configuración de Habitaciones:** Definición de tipologías (Suite, Doble, Simple, etc.), capacidad, tarifas base, políticas de cancelación, inventario de comodidades y galerías multimedia interactivas.
- **Variaciones de Precios Dinámicas:** Reglas estacionales, suplementos por fechas especiales y modificaciones tarifarias automáticas.

### 2. Motor de Reservas & Portal del Huésped
- **Experiencia de Reserva Fluida:** Calendario interactivo de disponibilidad en tiempo real, selección de fechas, cálculo automático de noches y desgloses impositivos (IVA/Tasas).
- **Confirmación con Código QR:** Generación instantánea de credenciales digitales con código QR para agilizar la llegada del huésped.
- **Comprobantes y Descargas:** Descarga directa de comprobantes de reserva y facturas tributarias en formato PDF de alta fidelidad.

### 3. Recepción y Operaciones (Front-Desk)
- **Check-in / Check-out Express con QR:** Escáner integrado para cámaras web y dispositivos móviles para validar llegadas y salidas en segundos.
- **Check-in Manual y Walk-In:** Registro ágil de huéspedes no registrados previamente con captura de documento de identidad y métodos de pago.
- **Gestión de Incidencias & Mantenimiento:** Módulo especializado para reporte, priorización y resolución de averías o tareas de limpieza de habitaciones.

### 4. Chat de Soporte en Tiempo Real con Aislamiento Estricto
- **Arquitectura WebSocket:** Comunicación instantánea y bidireccional entre huéspedes y el personal del hotel impulsada por Socket.io.
- **Privacidad y Aislamiento Total:** Cada huésped interactúa exclusivamente con el personal de la propiedad en un hilo privado. Los huéspedes jamás tienen visibilidad de mensajes ni respuestas de otros usuarios.
- **Consola de Atención para Recepción:** Los agentes pueden alternar entre diferentes conversaciones activas con notificación de mensajes no leídos y confirmación de lectura en tiempo real.

### 5. Facturación, Finanzas e Informes
- **Generación de Facturas PDF (jsPDF):** Exportación de comprobantes oficiales con desglose de ítems, subtotal, impuestos aplicables (IVA 15%/12%) y datos del cliente.
- **Libro de Transacciones:** Registro unificado de ingresos por reservas, consumos adicionales y pagos registrados.
- **Cuadro de Mando y Analíticas (Recharts):** Gráficos visuales de ocupación hotelera, ingresos mensuales, ADR (Tarifa Promedio Diaria) y métricas de desempeño operativo.

### 6. Aplicación Híbrida Móvil (Capacitor)
- **Soporte Nativo Android:** Empaquetado y sincronización con Capacitor para despliegue directo en dispositivos Android físicos y tabletas de recepción.

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Empaquetador y Build Tool:** [Vite 6](https://vitejs.dev/)
- **Estilos y Diseño:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Iconografía:** [Lucide React](https://lucide.dev/)
- **Animaciones:** [Motion](https://motion.dev/)
- **Visualización de Datos:** [Recharts](https://recharts.org/)
- **Mapas:** [@vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/)
- **Documentos & Códigos QR:** [jsPDF](https://github.com/parallax/jsPDF), [qrcode](https://www.npmjs.com/package/qrcode) y [html5-qrcode](https://scanapp.org/)

### Backend y Tiempo Real
- **Servidor:** [Express](https://expressjs.com/) sobre [Node.js](https://nodejs.org/) ejecutado con `tsx` / `esbuild`
- **WebSockets:** [Socket.io](https://socket.io/) (comunicación full-duplex de eventos en tiempo real)
- **Mailing:** [Nodemailer](https://nodemailer.com/) con transporte SMTP transaccional
- **Base de Datos & Auth:** [PostgreSQL](https://www.postgresql.org/) con [Supabase](https://supabase.com/)
- **Seguridad en BD:** Políticas de seguridad a nivel de fila (Row Level Security - RLS) y funciones PL/pgSQL

### Mobile
- **Runtime Nativo:** [Capacitor 8](https://capacitorjs.com/) (Android Core y CLI)

---

## 🗄️ Arquitectura de la Base de Datos

El sistema cuenta con esquemas SQL robustos y normalizados en PostgreSQL:

| Tabla | Propósito |
| :--- | :--- |
| `hotels` | Catálogo de establecimientos, geolocalización, políticas y horarios. |
| `rooms` | Unidades habitacionales, tipologías, precios y estados (`disponible`, `ocupada`, `mantenimiento`). |
| `reservations` | Registro de reservas, fechas in/out, código QR, huéspedes y estado de pago. |
| `users` | Usuarios del sistema y roles de acceso (`admin`, `recepcion`, `cliente`). |
| `messages` | Mensajería de soporte con metadatos de aislamiento y marcas de lectura. |
| `transactions` | Registro financiero de cobros y pagos asociados a reservas o servicios. |
| `property_details` | Información complementaria, contratos y términos de servicio. |
| `reviews` | Calificaciones y testimonios de huéspedes validados. |
| `room_price_variations`| Reglas y suplementos de precios por temporada o eventos. |

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js (v18 o superior)
- Gestor de paquetes npm o pnpm
- Proyecto o instancia activa de PostgreSQL / Supabase

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/roomia-pms.git
cd roomia-pms
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```env
# URL de la aplicación
APP_URL=http://localhost:3000

# Base de datos Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima-publica

# Google Maps API (Opcional para mapas interactivos)
GOOGLE_MAPS_PLATFORM_KEY=tu-api-key-de-google-maps

# Configuración SMTP para correos transaccionales (Opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=tu-contraseña-de-aplicacion
SMTP_FROM="Roomia PMS <tu-correo@gmail.com>"
```

### 4. Inicializar la base de datos
Ejecuta el script SQL en el editor SQL de tu instancia de base de datos PostgreSQL/Supabase:
- Archivo: `supabase_schema.sql` (crea tablas, índices optimizados y políticas RLS seguras).

### 5. Iniciar en modo desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

---

## 📦 Compilación y Producción

### Generar la build web
```bash
npm run build
```
Este comando compila el frontend mediante Vite y empaqueta el servidor backend `server.ts` a un bundle Node.js optimizado en `dist/server.cjs`.

### Ejecutar en producción
```bash
npm start
```

---

## 📱 Compilación para Android (Capacitor)

1. Sincronizar los assets web compilados con el proyecto Android:
```bash
npm run build:android
```

2. Abrir en Android Studio para generar el archivo APK / AAB:
```bash
npm run cap:open
```

---

## 🔒 Seguridad y Buenas Prácticas
- **Autenticación y Roles:** Control de acceso granular para Perfiles de Cliente, Recepcionista y Administrador General.
- **Aislamiento en Canales de Chat:** Identificación estricta de remitente y destinatario para prevenir fuga de información y visualización cruzada de chats.
- **Validación Criptográfica de QR:** Verificación de autenticidad en check-in para prevenir duplicados o reservas fraudulentas.
- **CORS Seguro:** Configuración para clientes web y entornos WebView en aplicaciones Android.

---

## 📄 Licencia

Este proyecto se distribuye bajo los términos de la Licencia MIT.
