# Facturación electrónica del SRI en Roomia

Esquema **offline** del SRI (Ecuador): factura **01**, versión **1.1.0** de la ficha técnica (v2.32, octubre 2025). El flujo es el mismo que en Roomia ERP (FrioSpondylus2).

## Cómo funciona

```
Check-out (reserva → finalizada) ─► trigger crea la factura "pendiente"
                                    (secuencial + clave de acceso de 49 dígitos, módulo 11)
      │
      └─► función sri (la app la llama al instante; pg_cron cada minuto)
             ├─ arma el XML con la reserva y el huésped (IVA incluido, sin la garantía)
             ├─ firma XAdES-BES con la firma .p12 del establecimiento (Vault)
             ├─ RecepcionComprobantesOffline  → RECIBIDA / DEVUELTA
             ├─ AutorizacionComprobantesOffline → AUTORIZADO / NO AUTORIZADO
             └─ RIDE en PDF (pdf-lib, Code 128) + XML autorizado → correo al huésped (y copia)

pg_cron (cada minuto) reintenta "pendiente / error / recibida" con espera creciente
(1, 2, 5, 10, 15, 30, 60, 120, 240, 480 min; máximo 15 intentos), con bloqueo de 3 min
para no enviar dos veces la misma factura.
```

| Estado | Significado | Qué hace Roomia |
|---|---|---|
| En cola (`pendiente`) | Creada, sin enviar | La envía al instante o en el próximo minuto |
| Enviando (`procesando`) | Bloqueada por un proceso (3 min) | Evita envíos dobles |
| Recibida | El SRI la recibió, falta autorizar | Solo consulta la autorización; no reenvía |
| Autorizada | Válida | RIDE y XML listos; correo enviado |
| Devuelta | Rechazada en recepción, o faltan datos del cliente | Muestra el mensaje; se corrige y se reenvía con el mismo número |
| No autorizada | Rechazada en autorización | Igual que devuelta |
| Reintentando (`error`) | Sin conexión o el SRI caído | Reintento automático |
| Descartada (`anulado`) | No llegó al SRI y se descartó, o la reserva se canceló antes | Nada que enviar |

### Reglas

- **Emisión automática al hacer check-out:** se activa por establecimiento con la casilla correspondiente. Desactivada, se emite a mano con **Factura SRI** en la prefactura o en recepción. El botón también sirve para emitirla antes del check-out.
- **Lo que se factura:** el total cobrado sin la garantía, que es reembolsable. El IVA va incluido y la base se reparte entre hospedaje y servicios.
- **El cliente sale de los datos del huésped:**
  - RUC o cédula válidos;
  - si no, pasaporte;
  - sin documento y hasta $50, consumidor final;
  - sin documento y más de $50, la factura queda **Devuelta** ("faltan datos") para que el personal complete la cédula o el RUC.
- **Una factura por reserva** y ambiente.
- **Errores 43, 45 o 70** en la recepción ("clave ya registrada" o "en procesamiento") se tratan como recibida, para no duplicar la factura.
- **Reserva cancelada:**
  - si la factura no llegó al SRI, se descarta;
  - si ya estaba autorizada, queda marcada **"Anular en SRI en línea"**.
- **La facturación nunca bloquea** un check-out ni una cancelación.

## Configuración (una vez por establecimiento)

Panel del administrador → **Facturación SRI**:

1. **Datos tributarios:** RUC, razón social, nombre comercial, dirección matriz, régimen, contabilidad y copia al contador. En *Opciones avanzadas*: serie, tarifa de IVA, forma de pago habitual, contribuyente especial, agente de retención y secuencial inicial.
2. **Firma electrónica:** archivo .p12 y su clave.
   - Se valida que abra, que esté vigente y que pertenezca al RUC.
   - Se guarda cifrada en Supabase Vault y solo el servidor la lee.
3. **Probar conexión con el SRI:** revisa los datos, firma un comprobante de prueba sin enviarlo y comprueba que *celcer* o *cel* respondan.
4. Marcar **Emitir la factura automáticamente al hacer check-out** y guardar.
5. Cuando las pruebas salgan bien, cambiar el ambiente a **Producción** (pide confirmación).

El correo con adjuntos sale por `/api/send-email` (SMTP de Vercel), autenticado con un token interno guardado en Vault. No hay que configurar nada nuevo.

## Archivos

| Pieza | Archivo |
|---|---|
| Clave de acceso, cédula/RUC, XML, firma, SOAP | `supabase/functions/_shared/sri/{claveAcceso,identificacion,factura,firma,p12,soap}.ts` |
| Reserva → líneas y cliente | `supabase/functions/_shared/sri/reserva.ts` |
| RIDE (PDF) y código de barras | `supabase/functions/_shared/sri/{ride,codigoBarras,leerXml}.ts` |
| Función del servidor | `supabase/functions/sri/index.ts` (+ `deno.json`) |
| Tablas, trigger, cola, Vault, pg_cron | `supabase/migrations/20261125_facturacion_sri.sql` |
| Pantallas | `src/components/FacturacionView.tsx`, `src/components/FacturaSriModal.tsx` |

## Qué está probado automáticamente (`npm test`)

- **Clave de acceso:** ejemplo oficial del SRI y dígito verificador módulo 11.
- **Cédula y RUC,** y cliente deducido del huésped.
- **Reserva → líneas:**
  - el total cobrado al centavo;
  - la garantía fuera;
  - el mismo resultado en el navegador y en el servidor.
- **XML de la factura:** orden de etiquetas, decimales, escapes y límite de consumidor final.
- **Firma XAdES-BES:**
  - la verifica xml-crypto, una librería independiente;
  - alterar el total, la hora de la firma o el certificado la invalida;
  - se comprueba que la firma pertenezca al RUC.
- **SOAP:** respuestas recibida, devuelta, autorizada (en CDATA o escapada), no autorizada y sin respuesta.
- **RIDE:** se genera en PDF y pasa a una segunda hoja cuando hay muchas líneas.
- **Correo:** solo admite adjuntos XML y PDF reales, con tamaño acotado.

## Pruebas manuales que hay que hacer

Necesitas tu **.p12 real** y tu **RUC habilitado en el ambiente de pruebas**: SRI en línea → Facturación electrónica → Producción/Pruebas → solicitar ambiente de pruebas.

### Nivel 1 · Casos en el ambiente de pruebas (celcer)

| # | Caso | Cómo | Resultado esperado |
|---|---|---|---|
| 1 | Check-out automático | Activa la emisión automática y haz el check-out de una reserva de un huésped con cédula | En segundos, en Facturación SRI: **Autorizada** con el aviso 60 y el correo enviado |
| 2 | Consumidor final | Reserva de menos de $50 de un huésped sin documento | Autorizada a CONSUMIDOR FINAL |
| 3 | Faltan datos | Reserva de más de $50 de un huésped sin documento | **Devuelta** "faltan datos"; *Corregir y reenviar* con su cédula → Autorizada con el mismo número |
| 4 | RUC y servicios | Huésped con RUC y servicios extra | Autorizada; en el RIDE, las líneas suman el total cobrado |
| 5 | Alquiler | Casa o departamento en alquiler | Autorizada **sin** la garantía |
| 6 | Rechazo forzado | Pon un establecimiento que no tengas en el SRI (p. ej. `099`) en *Opciones avanzadas* y emite | **Devuelta** o **No autorizada** con el código y el mensaje del SRI legibles. Vuelve a `001` y emite otra |
| 7 | Cancelación | Cancela una reserva con factura autorizada | Queda marcada "Anular en SRI en línea"; anúlala allí |
| 8 | Emisión manual | Botón **Factura SRI** en la prefactura de una reserva confirmada | Autorizada; RIDE y XML descargables |

### Nivel 2 · Resiliencia

1. **SRI caído:** si al emitir ves **Reintentando**, no hagas nada. En Facturación SRI deben subir los intentos y la factura debe terminar **Autorizada** sola, sin duplicar la clave.
2. **Simultáneas:** haz el check-out de varias reservas a la vez. Los secuenciales deben quedar correlativos, sin repetidos y sin "Error 43".

### Nivel 3 · Entrega

1. **Código de barras:** imprime el RIDE y escanéalo con una app lectora. Debe leer los 49 dígitos de la clave.
2. **Portal SRI:** SRI en línea → Facturación electrónica → **Validez de comprobantes** → pega la clave → AUTORIZADO.
3. **Correo:**
   - debe llegar con `Factura 001-001-….xml`, que empieza con `<autorizacion>` y lleva el comprobante en CDATA;
   - y con `Factura 001-001-….pdf`.
4. **Paso a producción:** emite **una factura real de bajo valor** y compruébala en *Validez de comprobantes*.

Si algo falla, copia el mensaje del SRI que aparece en el detalle de la factura (código y texto).

## Pendiente

- **Nota de crédito (04):** para devoluciones de una factura autorizada. Hoy se anula en SRI en línea.
- **Tarifa de IVA del arriendo de vivienda:** que la confirme el contador. Se puede elegir 0 % en *Opciones avanzadas*.
