import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reglas del diseño de Roomia (ver src/index.css y src/components/ui). Esta prueba revisa el código de
 * las pantallas para que no se vuelvan a escribir estilos fuera del estándar:
 *   · letra mínima de 11px (clase `text-micro`);
 *   · colores de marca y de estado con sus nombres (`brand-*`, `success`, `warning`, `danger`, `info`),
 *     no como hex escrito a mano ni con los nombres de la paleta estándar;
 *   · un solo gris (`neutral`); la landing oscura mantiene el suyo;
 *   · avisos con `notify`, sin `alert()` ni eventos sueltos.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

const SCREENS = files('src');
const read = (path: string) => readFileSync(path, 'utf8');
const lines = (path: string) => read(path).split('\n');

function find(pattern: RegExp, skip: (path: string) => boolean = () => false): string[] {
  const hits: string[] = [];
  for (const path of SCREENS) {
    if (skip(path)) continue;
    lines(path).forEach((line, i) => {
      if (/^\s*(\/\/|\*|\{\/\*)/.test(line)) return;
      const m = line.match(pattern);
      if (m) hits.push(`${path}:${i + 1}  ${m[0]}`);
    });
  }
  return hits;
}

test('la letra no baja de 11px: se usa text-micro, no text-[6px…11px]', () => {
  assert.deepEqual(find(/text-\[(?:[0-9]|10|11)(?:\.\d+)?px\]/), []);
});

test('los colores de marca no se escriben como hex dentro de las clases', () => {
  assert.deepEqual(find(/(?:bg|text|border|ring|from|to|via)-\[#(?:0e2a47|071726|23b4e6|133a62|3fc2f0)\]/i), []);
});

test('los colores de estado usan success / warning / danger / info', () => {
  assert.deepEqual(find(/\b(?:bg|text|border|ring|from|to|via)-(?:emerald|amber|red|green|blue|yellow|rose|sky|violet|purple|orange)-\d+/), []);
});

test('un solo gris: neutral (la landing oscura queda fuera)', () => {
  assert.deepEqual(find(/\b(?:bg|text|border|ring|from|to|via)-slate-\d+/, p => /LandingPageView/.test(p)), []);
});

test('los avisos usan notify: sin alert() ni eventos aura-toast sueltos', () => {
  const alerts = find(/(?<![.\w])alert\(/);
  const events = find(/aura-toast/);
  assert.deepEqual(alerts, []);
  assert.deepEqual(events, []);
});

test('las listas de opciones usan el selector de la plataforma, no <select> del navegador', () => {
  assert.deepEqual(find(/<select\b/, p => /[\\/]ui[\\/]/.test(p)), []);
});

test('los componentes comunes existen', () => {
  for (const name of ['Button', 'Modal', 'Badge', 'Field', 'Toast', 'OptionPicker', 'SelectPicker']) {
    assert.ok(read(`src/components/ui/${name}.tsx`).length > 200, name);
  }
});
