import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los textos que ve la gente (avisos, errores, botones, títulos) no deben nombrar a los servicios
 * que hay detrás de Roomia: Supabase, SMTP o Vercel. Esta prueba revisa los textos entre comillas y
 * el texto de las pantallas; los nombres de código, las importaciones y los `console.*` no cuentan.
 */
const FORBIDDEN = /supabase|\bsmtp\b|vercel|base de datos/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Quita comentarios, importaciones y registros de consola, que no ve nadie */
function visibleCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !/^\s*(import|export .* from)\b/.test(line) && !/console\.(log|warn|error|info|debug)/.test(line))
    .map(line => line.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n');
}

function offenders(path: string): string[] {
  const code = visibleCode(readFileSync(path, 'utf8'));
  const found: string[] = [];
  // Textos entre comillas simples, dobles o con plantilla
  for (const match of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const text = match[1] ?? match[2] ?? match[3] ?? '';
    // Quita lo que va dentro de ${...}: es código, no texto
    const literal = text.replace(/\$\{[^}]*\}/g, '');
    if (FORBIDDEN.test(literal) && !/^[\w./@:-]+$/.test(literal)) found.push(literal.trim().slice(0, 90));
  }
  // Texto escrito directamente en las pantallas (entre etiquetas)
  for (const match of code.matchAll(/>([^<>{};=]*[A-Za-zÁ-ú][^<>{};=]*)</g)) {
    if (FORBIDDEN.test(match[1])) found.push(match[1].trim().slice(0, 90));
  }
  return found;
}

test('ningún texto visible de la app menciona Supabase, SMTP o Vercel', () => {
  const problems: string[] = [];
  for (const file of files('src')) {
    for (const text of offenders(file)) problems.push(`${file}: ${text}`);
  }
  assert.deepEqual(problems, []);
});
