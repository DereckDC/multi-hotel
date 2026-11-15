# Plan: facturación electrónica del SRI en Roomia

Estado: **propuesta, sin código**. Fecha: 15/11/2026.

## Respuesta corta

Sí se puede. Roomia puede emitir la factura electrónica al SRI de forma automática cuando una reserva queda pagada o al hacer el check-out. No es un cambio pequeño: hay trámites que debe hacer cada hotel ante el SRI y decisiones contables que debe validar un contador antes de programar.

Lo que hoy genera Roomia es una **pre-factura informativa**, sin validez tributaria. La factura electrónica sería un documento nuevo, además de la pre-factura.

## Cómo funciona la factura electrónica en Ecuador

El SRI usa el esquema "offline":

1. El sistema arma la factura en **XML** con el formato de la ficha técnica del SRI.
2. Le calcula la **clave de acceso** de 49 dígitos (fecha, tipo de comprobante, RUC, ambiente, establecimiento, punto de emisión, secuencial, código numérico y dígito verificador módulo 11).
3. La **firma** con la firma electrónica del contribuyente (archivo `.p12`, formato XAdES-BES).
4. La **envía** al servicio web de recepción del SRI y luego **consulta** el servicio de autorización.
5. Si el SRI la autoriza, se genera el **RIDE** (el PDF con formato oficial) y se entregan RIDE y XML al cliente por correo.

El SRI tiene dos ambientes, **pruebas** y **producción**, con direcciones distintas. Se desarrolla y se certifica en pruebas antes de emitir en producción.

Las direcciones de los servicios web, la versión del XML y los catálogos (códigos de impuestos, formas de pago, tipos de identificación) están en la **ficha técnica de comprobantes electrónicos, esquema offline**, que el SRI actualiza cada cierto tiempo. Antes de programar hay que descargar la versión vigente desde sri.gob.ec; no encontré el documento oficial en esta búsqueda, solo referencias de consultoras.

## Qué necesita cada hotel (no lo puede hacer Roomia por ellos)

- **RUC activo** con la actividad económica de alojamiento.
- **Firma electrónica** en archivo `.p12` y su clave, emitida por una entidad certificadora autorizada.
- **Autorización para emitir comprobantes electrónicos**, solicitada en SRI en Línea, primero en ambiente de pruebas y luego en producción.
- Datos del **establecimiento** y **punto de emisión** (los códigos de 3 dígitos), dirección matriz, si lleva contabilidad, y su régimen (general, RIMPE, etc.).

## Punto clave: Roomia es multi-hotel

El emisor de la factura es **cada hotel o propietario**, no Roomia. Eso define el diseño:

- Cada establecimiento carga su RUC, sus datos fiscales, su `.p12` y su clave.
- El secuencial de facturas se lleva **por establecimiento y punto de emisión**, sin saltos ni duplicados.
- La firma y su clave son lo más sensible del sistema: se guardan cifradas y **solo se usan en el servidor**. Nunca llegan al navegador ni al APK.
- Un hotel que no configure el SRI sigue usando solo la pre-factura.

## Dos caminos para hacerlo

### A. Integración directa con el SRI
Roomia arma el XML, firma y habla con los servicios del SRI.
- A favor: sin costo por factura, control total.
- En contra: es el camino más largo. La firma XAdES-BES y el manejo de rechazos y reintentos son la parte difícil, y hay que mantenerlo al día con cada cambio de la ficha técnica.

### B. Usar un proveedor de facturación electrónica con API
Roomia envía los datos de la venta y el proveedor firma, envía al SRI y devuelve el RIDE.
- A favor: mucho más rápido de implementar; el proveedor absorbe los cambios del SRI.
- En contra: costo mensual o por comprobante, y el hotel entrega su firma a un tercero.

**Recomendación:** empezar por **B** con uno o dos hoteles piloto para validar el flujo y los criterios contables, y pasar a **A** solo si el volumen lo justifica. Si se prefiere no depender de terceros, ir directo a A asumiendo más tiempo.

## Cambios que haría falta en Roomia

**Datos (Supabase)**
- Datos fiscales por establecimiento: RUC, razón social, nombre comercial, dirección matriz, códigos de establecimiento y punto de emisión, ambiente, obligado a llevar contabilidad, régimen.
- Almacén cifrado para la firma y su clave, accesible solo desde el servidor.
- Tabla de comprobantes: reserva, clave de acceso, secuencial, estado (pendiente, enviada, autorizada, rechazada, anulada), número y fecha de autorización, XML, RIDE, mensajes del SRI.
- Contador de secuenciales con bloqueo para que dos facturas simultáneas no tomen el mismo número.

**Servidor** (funciones del servidor, como `api/send-email.ts` hoy)
- Emitir: armar XML, firmar, enviar, consultar autorización, guardar resultado.
- Reintentos automáticos cuando el SRI no responde, sin duplicar la factura.
- Generar el RIDE y enviarlo por correo junto con el XML.

**Pantallas**
- Admin del hotel: configuración del SRI (datos fiscales, subir firma, probar conexión, elegir ambiente).
- Reserva: datos de facturación del cliente (cédula, RUC, pasaporte o consumidor final), botón "Emitir factura", estado de la factura, descargar RIDE y XML, reenviar por correo.
- Opción por hotel: emitir automáticamente al confirmar el pago o al check-out.
- Nota de crédito para cancelaciones y reembolsos de reservas ya facturadas.

## Fases

1. **Definiciones** con contador y un hotel piloto (ver la lista de abajo). Sin esto no conviene programar.
2. **Configuración fiscal por hotel** y almacenamiento seguro de la firma.
3. **Emisión en ambiente de pruebas**: factura de hospedaje con servicios adicionales, autorización y RIDE.
4. **Notas de crédito** y manejo de rechazos y reintentos.
5. **Producción con un hotel piloto**, y luego emisión automática opcional.
6. **Resto de hoteles**, con una guía para que cada uno haga sus trámites.

No doy fechas: dependen del camino elegido (A o B) y de cuánto tarden los trámites de cada hotel.

## Lo que debe confirmar un contador antes de empezar

- **Tarifa de IVA.** Roomia calcula hoy **16 %** en todas las reservas. La tarifa general vigente en Ecuador es **15 %**, según la circular del SRI NAC-DGECCGC25-00000006 del 26/12/2025. El SRI rechaza una factura con una tarifa que no exista en su catálogo, así que esto hay que corregirlo en la app antes de emitir. También afecta a lo que ya se cobra hoy.
- **IVA en turismo.** Vi una mención a una tarifa reducida temporal para turismo en feriados, pero solo en una fuente privada; no la pude confirmar en fuentes oficiales.
- **Alquiler de casas y departamentos.** No pude confirmar qué tarifa de IVA aplica al arriendo de vivienda. Hoy Roomia le cobra IVA a la mensualidad.
- **Depósito de garantía.** Es un valor reembolsable, no una venta; normalmente no va en la factura. Hoy aparece como línea de la pre-factura.
- **Pagos parciales.** Definir si se factura al recibir el anticipo, al pagar el total o al check-out.
- **Quién factura** cuando Roomia cobra por cuenta del hotel, y cómo se factura la comisión de Roomia al hotel.
- **Clientes extranjeros** (pasaporte) y **consumidor final**: límites y datos obligatorios.
- **Retenciones** y demás obligaciones según el régimen de cada hotel.

## Fuentes consultadas

- [Circular del SRI sobre la vigencia de la tarifa general del IVA (NMS Law)](https://nmslaw.com.ec/?p=15921)
- [SRI: ante la ausencia de un nuevo decreto seguirá rigiendo el 15 % de IVA (Expreso)](https://www.expreso.ec/actualidad/economia/sri-ante-la-ausencia-de-un-nuevo-decreto-seguira-rigiendo-el-15-de-iva-269423.html)
- [Facturación electrónica en Ecuador (Sovos)](https://sovos.com/ec/iva/reglas-fiscales/factura-electronica-ecuador/)
- [Actualización de la ficha técnica offline 2.24 (Sovos)](https://sovos.com/es/cambios-regulatorios/iva/ecuador-actualizacion-ficha-tecnica-de-los-comprobantes-electronicos-regimen-offline-version-2-24/)
- [Factura electrónica en Ecuador (Edicom)](https://edicomgroup.com/es/blog/como-es-la-factura-electronica-en-ecuador)
- [Actualización ficha técnica comprobantes electrónicos (Moore Ecuador)](https://ec.moore-global.com/MediaLibsAndFiles/media/ec.moorestephens.com/Moore_New/Moore_pdf/Moore-Ecuador-Informa-No95-ACTUALIZACION-FICHA-TECNICA-COMPROBANTES-ELECTRONICOS.pdf)
- [Guía de IVA de Ecuador (Kintsugi)](https://trykintsugi.com/es-419/sales-tax-guides/latam/ecuador)

Casi todas son consultoras y prensa, no el SRI directamente. La ficha técnica oficial y la tabla de tarifas hay que tomarlas de sri.gob.ec.
