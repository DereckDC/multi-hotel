import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendlyError, hasTechnicalTerms } from '../src/utils/errors.ts';
import { cleanNoticeText } from '../src/utils/notify.ts';

test('friendlyError traduce los errores más comunes de acceso', () => {
  assert.equal(friendlyError({ message: 'Invalid login credentials' }, 'login'),
    'El correo o la contraseña no son correctos. Revísalos e inténtalo de nuevo.');
  assert.match(friendlyError({ message: 'Email not confirmed' }, 'login'), /confirmas tu correo/);
  assert.match(friendlyError({ message: 'User already registered' }, 'registro'), /Ya existe una cuenta/);
  assert.equal(friendlyError({ message: 'User already registered' }, 'correo'), 'Ese correo ya pertenece a otra cuenta.');
  assert.match(friendlyError({ message: 'Password should be at least 6 characters.' }, 'registro'), /al menos 6 caracteres/);
  assert.match(friendlyError({ message: 'email rate limit exceeded' }, 'recuperar'), /demasiados intentos/);
});

test('friendlyError traduce fallos de conexión, sesión y permisos', () => {
  assert.match(friendlyError(new TypeError('Failed to fetch'), 'guardar'), /Revisa tu conexión/);
  assert.match(friendlyError({ message: 'JWT expired' }, 'guardar'), /sesión expiró/);
  assert.match(friendlyError({ message: 'new row violates row-level security policy for table "reservations"' }, 'guardar'), /No tienes permiso/);
  assert.match(friendlyError({ message: 'conflicting key value violates exclusion constraint "no_overlap"' }, 'guardar'), /fechas ya no están disponibles/);
});

test('friendlyError nunca deja pasar términos técnicos', () => {
  const rawErrors = [
    'Error en la autenticación de Supabase: algo raro',
    'relation "public.hotels" does not exist',
    'SMTP connection timeout',
    'FATAL: password authentication failed for user "postgres"',
    'No se pudo guardar en la base de datos',
    'TypeError: undefined is not a function',
    'Error 500 en el servidor'
  ];
  for (const raw of rawErrors) {
    const message = friendlyError({ message: raw }, 'guardar');
    assert.ok(!hasTechnicalTerms(message), `se filtró un término técnico: ${message}`);
    assert.ok(message.length > 10);
  }
});

test('friendlyError respeta los mensajes propios en español y usa un respaldo según el contexto', () => {
  assert.equal(friendlyError(new Error('La foto sigue pesando más de 5 MB después de reducirla.'), 'imagen'),
    'La foto sigue pesando más de 5 MB después de reducirla.');
  assert.equal(friendlyError(null, 'pago'), 'No pudimos procesar el pago. Inténtalo de nuevo.');
  assert.equal(friendlyError(undefined), 'Algo salió mal. Inténtalo de nuevo.');
  assert.equal(friendlyError({ message: 'xyz_unknown' }, 'pdf'), 'No pudimos generar el documento. Inténtalo de nuevo.');
});

test('cleanNoticeText quita los emojis del inicio de un aviso', () => {
  assert.equal(cleanNoticeText('✅ Guardado'), 'Guardado');
  assert.equal(cleanNoticeText('⚠️ Revisa tu conexión'), 'Revisa tu conexión');
  assert.equal(cleanNoticeText('❌ Error: no se pudo'), 'Error: no se pudo');
  assert.equal(cleanNoticeText('Sin emoji'), 'Sin emoji');
});
