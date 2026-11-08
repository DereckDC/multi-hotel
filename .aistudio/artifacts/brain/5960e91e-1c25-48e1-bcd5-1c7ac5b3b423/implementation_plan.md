# Plan de Implementación: Expiración de Reservas en 24h & Corrección de Mapas Embebidos

Solución técnica para el control de expiración automática de reservaciones pendientes de pago tras 24 horas (con temporizador visible en tiempo real) y la resolución definitiva del bloqueo de iframe en el mapa de ubicación satelital de cada hotel.

> [!IMPORTANT] Decisiones Confirmadas por el Usuario
> - **Temporizador de Expiración**: Se mostrará una cuenta regresiva en vivo de 24 horas directamente en la tarjeta de cada reservación con estado `pendiente`.
> - **Visualización de Mapa**: Se corregirá el mapa embebido para renderizarse de forma fluida directamente en la página mediante un `iframe` compatible sin botones externos adicionales.

---

### 1. Visión General & Objetivos

1. **Expiración Automática en 24 Horas**:
   - Garantizar que toda reserva en estado `pendiente` de pago se cancele automáticamente a las 24 horas exactas de su creación (`fechaRegistroTimestamp`).
   - Liberar de inmediato la habitación asociada para restablecer su estado a `disponible`.
   - Mostrar al cliente un reloj de cuenta regresiva en tiempo real (`HH:MM:SS`) indicando el tiempo restante antes de la cancelación automática.

2. **Corrección de Bloqueo de Google Maps**:
   - Resolver el mensaje *"Este contenido está bloqueado. Comunícate con el propietario del sitio..."* causado por URLs no embebibles de Google Maps (rutas cortas tipo `maps.app.goo.gl` o enlaces estándar de búsqueda en lugar del endpoint `/maps/embed`).
   - Transformar automáticamente cualquier enlace de Google Maps ingresado a su versión oficial embebible de Google Maps (`https://maps.google.com/maps?q=...&output=embed` o coordenadas decodificadas) y ajustar las cabeceras de seguridad CSP (`frame-src` / `child-src`) en `server.ts`.

---

### 2. Experiencia de Usuario & Diseño Visual

- **Temporizador en Tarjeta de Reserva Pendiente**:
  - En la sección "Mis Reservaciones", las tarjetas pendientes mostrarán un distintivo dinámico en la parte superior con ícono de reloj y cuenta regresiva (`⏱ Expiración de pago en: 23h 45m 12s`).
  - Al llegar a 0, la tarjeta se actualizará automáticamente a estado `cancelada` liberando la habitación.
- **Mapa Satelital de Hotel Integrado**:
  - Un contenedor `iframe` limpio de 176px de alto con bordes suaves que renderiza sin errores de bloqueo la ubicación exacta de la propiedad o las coordenadas sanitizadas.

---

### 3. Arquitectura Técnica & Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AUTOMATED WATCHDOG                            │
│                                                                         │
│  [Reserva Creada] ──> timestamp: fechaRegistroTimestamp                │
│                                │                                        │
│                                ▼                                        │
│  [sweepExpiredReservations] (Ejecución cada 60s en store.ts)            │
│       │                                                                 │
│       ├── Diff > 24 Horas? ──> [Estado = cancelada] + [Habitación disponible]
│       └── Diff < 24 Horas? ──> [Calcula tiempo restante]                │
│                                        │                                │
│                                        ▼                                │
│                         [Live Countdown Component]                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          GOOGLE MAPS EMBED FIX                          │
│                                                                         │
│  [URL / Dirección Input] ──> [getMapEmbedUrl(ubicacion, mapsUrl)]       │
│                                │                                        │
│                                ▼                                        │
│  Sanitización & Transformación a:                                      │
│  "https://maps.google.com/maps?q={query}&t=&z=15&ie=UTF8&iwloc=&output=embed"
│                                │                                        │
│                                ▼                                        │
│  [Iframe Render] + CSP `frame-src 'self' https://maps.google.com`       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 4. Pasos de Implementación

1. **`src/store.ts` (Watchdog de Expiración en 24h)**:
   - Ajustar el intervalo de verificación `sweepExpiredReservations` de 5 minutos a 1 minuto (60,000 ms).
   - Asegurar que al crear una reserva (`createReservation`), siempre se adjunte `fechaRegistroTimestamp = new Date().toISOString()` exacto.
   - Sincronizar el cambio de estado de reserva (`cancelada`) y de habitación (`disponible`) en Supabase y estado global.

2. **`src/components/ClientView.tsx` (Cuenta Regresiva & Transformador de Mapa)**:
   - Crear el subcomponente interno `ReservationCountdown` que actualiza el segundero cada 1000 ms y dispara la cancelación inmediata al llegar a cero.
   - Perfeccionar la función `getMapEmbedUrl` para extraer limpiamente consultas de búsqueda, coordenadas lat/lng, o sanitizar URLs para el formato oficial `output=embed` de Google Maps, evitando bloqueos de seguridad.

3. **`server.ts` (Cabeceras de Seguridad CSP)**:
   - Asegurar que la directiva `frame-src` y `connect-src` en la política de seguridad CSP permitan `https://maps.google.com` y `https://www.google.com` para que el navegador apruebe el marco sin restricciones.
