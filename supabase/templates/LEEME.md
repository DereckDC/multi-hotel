# Correos de acceso con el diseño de Roomia

Los correos de **confirmar cuenta**, **recuperar contraseña** y **cambiar correo** los envía el servicio de
acceso de Roomia, no la aplicación. Por eso sus plantillas se pegan una sola vez en su panel.

Los archivos de esta carpeta se generan con `npx tsx scripts/generateAuthTemplates.ts` (si cambias el diseño
de los correos, vuelve a generarlos y a pegarlos).

## Pasos

1. Abre el proyecto en Supabase y ve a **Authentication → Emails → Templates**
   (en algunas versiones: **Authentication → Email Templates**).
2. Para cada plantilla de la tabla, abre su pestaña, pega el **asunto** en "Subject" y el contenido del
   archivo en "Message body" (modo código fuente / HTML). Guarda.

| Plantilla del panel | Asunto | Archivo |
| --- | --- | --- |
| Confirm signup | Confirma tu correo · Roomia PMS | `confirmacion-de-cuenta.html` |
| Reset password | Recupera tu contraseña · Roomia PMS | `recuperar-contrasena.html` |
| Change email address | Confirma tu nuevo correo · Roomia PMS | `cambio-de-correo.html` |

3. Revisa que la **URL del sitio** sea `https://www.roomiapms.site` en **Authentication → URL Configuration**
   y que `https://www.roomiapms.site` esté en las direcciones de redirección permitidas.
4. Pide un correo de recuperación de contraseña con tu cuenta y comprueba que llegue con este diseño.

No cambies las variables entre llaves (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`): las
rellena el servicio al enviar.
