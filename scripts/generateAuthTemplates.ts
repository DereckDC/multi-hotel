/**
 * Genera las plantillas HTML de los correos de acceso (confirmar cuenta, recuperar contraseña y
 * cambiar correo) con el mismo diseño que el resto de los correos de Roomia.
 *
 *   npx tsx scripts/generateAuthTemplates.ts
 *
 * Crea los archivos de supabase/templates/. Esos correos los envía el servicio de acceso, así que
 * las plantillas se pegan en su panel (los pasos están en supabase/templates/LEEME.md).
 * Las variables entre llaves ({{ .ConfirmationURL }}, {{ .Email }}…) las rellena ese servicio.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { emailSubject, renderBrandEmail, type BrandEmail } from '../supabase/functions/_shared/brandEmail.ts';

interface AuthTemplate {
  file: string;
  panelName: string;
  subject: string;
  email: BrandEmail;
}

const TEMPLATES: AuthTemplate[] = [
  {
    file: 'confirmacion-de-cuenta.html',
    panelName: 'Confirm signup',
    subject: emailSubject('Confirma tu correo', 'Roomia PMS'),
    email: {
      preheader: 'Confirma tu correo para activar tu cuenta.',
      eyebrow: 'Confirma tu cuenta',
      title: '¡Ya casi estás dentro!',
      greeting: 'Hola',
      paragraphs: [
        'Gracias por registrarte en **Roomia PMS**. Para activar tu cuenta con el correo **{{ .Email }}**, confírmalo con el botón de abajo.',
        'Si no creaste esta cuenta, puedes ignorar este mensaje.'
      ],
      cta: { label: 'Confirmar mi correo', url: '{{ .ConfirmationURL }}' },
      note: { text: 'Este enlace es personal y vence en poco tiempo. No lo compartas con nadie.', tone: 'info' }
    }
  },
  {
    file: 'recuperar-contrasena.html',
    panelName: 'Reset password',
    subject: emailSubject('Recupera tu contraseña', 'Roomia PMS'),
    email: {
      preheader: 'Crea una contraseña nueva para tu cuenta.',
      eyebrow: 'Seguridad de la cuenta',
      title: 'Recupera tu contraseña',
      greeting: 'Hola',
      paragraphs: [
        'Recibimos una solicitud para cambiar la contraseña de tu cuenta de **Roomia PMS** (**{{ .Email }}**).',
        'Toca el botón para crear una contraseña nueva.'
      ],
      cta: { label: 'Crear contraseña nueva', url: '{{ .ConfirmationURL }}' },
      note: { text: '**¿No fuiste tú?** Ignora este correo: tu contraseña actual sigue funcionando.', tone: 'warning' }
    }
  },
  {
    file: 'cambio-de-correo.html',
    panelName: 'Change email address',
    subject: emailSubject('Confirma tu nuevo correo', 'Roomia PMS'),
    email: {
      preheader: 'Confirma el cambio de correo de tu cuenta.',
      eyebrow: 'Seguridad de la cuenta',
      title: 'Confirma tu nuevo correo',
      greeting: 'Hola',
      paragraphs: [
        'Pediste cambiar el correo de tu cuenta de **Roomia PMS** de **{{ .Email }}** a **{{ .NewEmail }}**.',
        'Confírmalo con el botón de abajo. Hasta entonces seguirás entrando con tu correo actual.'
      ],
      cta: { label: 'Confirmar el cambio', url: '{{ .ConfirmationURL }}' },
      note: { text: '**¿No fuiste tú?** Ignora este correo y cambia tu contraseña por seguridad.', tone: 'danger' }
    }
  }
];

mkdirSync('supabase/templates', { recursive: true });
for (const template of TEMPLATES) {
  writeFileSync(`supabase/templates/${template.file}`, renderBrandEmail(template.email), 'utf8');
  console.log(`✓ supabase/templates/${template.file}  ·  asunto: ${template.subject}`);
}

const guide = `# Correos de acceso con el diseño de Roomia

Los correos de **confirmar cuenta**, **recuperar contraseña** y **cambiar correo** los envía el servicio de
acceso de Roomia, no la aplicación. Por eso sus plantillas se pegan una sola vez en su panel.

Los archivos de esta carpeta se generan con \`npx tsx scripts/generateAuthTemplates.ts\` (si cambias el diseño
de los correos, vuelve a generarlos y a pegarlos).

## Pasos

1. Abre el proyecto en Supabase y ve a **Authentication → Emails → Templates**
   (en algunas versiones: **Authentication → Email Templates**).
2. Para cada plantilla de la tabla, abre su pestaña, pega el **asunto** en "Subject" y el contenido del
   archivo en "Message body" (modo código fuente / HTML). Guarda.

| Plantilla del panel | Asunto | Archivo |
| --- | --- | --- |
${TEMPLATES.map((t) => `| ${t.panelName} | ${t.subject} | \`${t.file}\` |`).join('\n')}

3. Revisa que la **URL del sitio** sea \`https://www.roomiapms.site\` en **Authentication → URL Configuration**
   y que \`https://www.roomiapms.site\` esté en las direcciones de redirección permitidas.
4. Pide un correo de recuperación de contraseña con tu cuenta y comprueba que llegue con este diseño.

No cambies las variables entre llaves (\`{{ .ConfirmationURL }}\`, \`{{ .Email }}\`, \`{{ .NewEmail }}\`): las
rellena el servicio al enviar.
`;
writeFileSync('supabase/templates/LEEME.md', guide, 'utf8');
console.log('✓ supabase/templates/LEEME.md');
