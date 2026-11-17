import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBrandEmail, renderBrandText } from '../supabase/functions/_shared/brandEmail.ts';

const sample = {
  eyebrow: 'Comprobante de pago',
  title: '¡Recibimos tu pago!',
  greeting: 'Hola, <script>',
  paragraphs: ['Pago para **Hotel <b>X</b>** aprobado.'],
  status: { label: 'Estado', value: 'Confirmada', tone: 'success' as const, reference: 'Código RES-1' },
  sections: [{ title: 'Estadía', rows: [['Entrada', '2026-11-24'], ['Notas', ''], ['Servicios', undefined]] as Array<[string, string | undefined]> }],
  amounts: { rows: [['Pagado', '$2.32 USD']] as Array<[string, string]>, total: ['Saldo', '$9.28 USD'] as [string, string] },
  cta: { label: 'Ver', url: 'javascript:alert(1)' }
};

test('renderBrandEmail escapa el contenido y solo deja la negrita', () => {
  const html = renderBrandEmail(sample);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Hola, &lt;script&gt;'));
  assert.ok(html.includes('<strong'));
  assert.ok(html.includes('Hotel &lt;b&gt;X&lt;/b&gt;'));
});

test('renderBrandEmail omite filas vacías y enlaces no http', () => {
  const html = renderBrandEmail(sample);
  assert.ok(html.includes('2026-11-24'));
  assert.ok(!html.includes('>Notas<'));
  assert.ok(!html.includes('>Servicios<'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('https://www.roomiapms.site'));
});

test('renderBrandText genera la versión de texto', () => {
  const text = renderBrandText(sample);
  assert.ok(text.includes('ROOMIA PMS · Comprobante de pago'));
  assert.ok(text.includes('Pago para Hotel <b>X</b> aprobado.'));
  assert.ok(text.includes('- Entrada: 2026-11-24'));
  assert.ok(text.includes('Saldo: $9.28 USD'));
  assert.ok(!text.includes('Notas'));
});
