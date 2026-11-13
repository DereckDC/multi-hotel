import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIcal,
  buildIcs,
  foldLine,
  unfoldLines,
  parseIcsDate,
  validateImportUrl,
  isPrivateIp,
  addDays,
  diffDays,
  dateInTz
} from '../supabase/functions/ical/ical.ts';

const TODAY = '2026-11-12';
const opts = { today: TODAY };

// Formato representativo del calendario de Airbnb (RFC 5545). Debe confirmarse con un enlace real.
const AIRBNB = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN',
  'CALSCALE:GREGORIAN',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20261120',
  'DTSTART;VALUE=DATE:20261115',
  'UID:1418fb94e984-9b4f1b5b2c0b6c5d@airbnb.com',
  'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABCDE\\nPhone Number (Last 4 Digits): 1234',
  'SUMMARY:Reserved',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20261203',
  'DTSTART;VALUE=DATE:20261201',
  'UID:6e8f5b8b8c1d@airbnb.com',
  'SUMMARY:Airbnb (Not available)',
  'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');

// Formato representativo del calendario de Booking.
const BOOKING = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Booking.com//Calendar//EN',
  'BEGIN:VEVENT',
  'UID:abc123-booking',
  'DTSTART;VALUE=DATE:20261210',
  'DTEND;VALUE=DATE:20261214',
  'SUMMARY:CLOSED - Not available',
  'END:VEVENT',
  'END:VCALENDAR'
].join('\n');

test('Airbnb: fechas de día completo, fin exclusivo, sin datos personales', () => {
  const r = parseIcal(AIRBNB, opts);
  assert.equal(r.valid, true);
  assert.equal(r.events.length, 2);
  assert.deepEqual(r.events[0], {
    uid: '1418fb94e984-9b4f1b5b2c0b6c5d@airbnb.com',
    start: '2026-11-15',
    stop: '2026-11-20',
    summary: 'Reserved'
  });
  assert.equal(r.events[1].summary, 'Airbnb (Not available)');
  // La DESCRIPTION (teléfono, enlace de la reserva) nunca llega al resultado
  assert.ok(!JSON.stringify(r).includes('1234'));
  assert.ok(!JSON.stringify(r).includes('HMABCDE'));
});

test('Booking: líneas con solo LF y bloqueos "CLOSED"', () => {
  const r = parseIcal(BOOKING, opts);
  assert.equal(r.valid, true);
  assert.deepEqual(r.events, [
    { uid: 'abc123-booking', start: '2026-12-10', stop: '2026-12-14', summary: 'CLOSED - Not available' }
  ]);
});

test('líneas plegadas se desdoblan', () => {
  const text = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:largo\r\nDTSTART;VALUE=DATE:20261201\r\nDTEND;VALUE=DATE:20261203\r\nSUMMARY:Reserva con un\r\n  nombre muy largo\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const r = parseIcal(text, opts);
  assert.equal(r.events[0].summary, 'Reserva con un nombre muy largo');
  assert.deepEqual(unfoldLines('a\r\n b\r\nc'), ['ab', 'c']);
});

test('fecha-hora en UTC se convierte a la fecha local de Guayaquil (UTC-5)', () => {
  // 02:00 UTC del 21 = 21:00 del 20 en Guayaquil
  assert.equal(parseIcsDate('20261121T020000Z', 'America/Guayaquil'), '2026-11-20');
  assert.equal(parseIcsDate('20261121T150000Z', 'America/Guayaquil'), '2026-11-21');
  // Hora local o con TZID: la fecha tal cual
  assert.equal(parseIcsDate('20261121T230000', 'America/Guayaquil'), '2026-11-21');
  assert.equal(parseIcsDate('20261121', 'America/Guayaquil'), '2026-11-21');
});

test('fechas inválidas se rechazan', () => {
  assert.equal(parseIcsDate('20261301', 'America/Guayaquil'), null);
  assert.equal(parseIcsDate('20260230', 'America/Guayaquil'), null);
  assert.equal(parseIcsDate('05/08/2027', 'America/Guayaquil'), null);
  assert.equal(parseIcsDate('19990101', 'America/Guayaquil'), null);
  assert.equal(parseIcsDate('', 'America/Guayaquil'), null);
});

test('cancelados, pasados, sin fin, mismo día y duración', () => {
  const ev = (body: string) => `BEGIN:VEVENT\n${body}\nEND:VEVENT`;
  const text = [
    'BEGIN:VCALENDAR',
    ev('UID:cancel\nDTSTART;VALUE=DATE:20261201\nDTEND;VALUE=DATE:20261205\nSTATUS:CANCELLED'),
    ev('UID:pasado\nDTSTART;VALUE=DATE:20260101\nDTEND;VALUE=DATE:20260105'),
    ev('UID:sinfin\nDTSTART;VALUE=DATE:20261220'),
    ev('UID:mismodia\nDTSTART:20261222T100000\nDTEND:20261222T180000'),
    ev('UID:duracion\nDTSTART;VALUE=DATE:20261230\nDURATION:P3D'),
    ev('UID:termina-hoy\nDTSTART;VALUE=DATE:20261110\nDTEND;VALUE=DATE:20261112'),
    ev('UID:malo\nDTSTART:no-es-fecha'),
    'END:VCALENDAR'
  ].join('\n');
  const r = parseIcal(text, opts);
  const byUid = Object.fromEntries(r.events.map((e) => [e.uid, e]));
  assert.equal(byUid['cancel'], undefined);
  assert.equal(byUid['pasado'], undefined);
  assert.equal(byUid['malo'], undefined);
  assert.deepEqual([byUid['sinfin'].start, byUid['sinfin'].stop], ['2026-12-20', '2026-12-21']);
  assert.deepEqual([byUid['mismodia'].start, byUid['mismodia'].stop], ['2026-12-22', '2026-12-23']);
  assert.deepEqual([byUid['duracion'].start, byUid['duracion'].stop], ['2026-12-30', '2027-01-02']);
  assert.ok(byUid['termina-hoy'], 'un evento que termina hoy se conserva');
  assert.deepEqual(r.stats, { cancelled: 1, invalid: 1, past: 1, recurring: 0 });
});

test('VALARM anidado no pisa las propiedades del evento', () => {
  const text = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:alarma',
    'DTSTART;VALUE=DATE:20261201',
    'DTEND;VALUE=DATE:20261203',
    'SUMMARY:Reserved',
    'BEGIN:VALARM',
    'SUMMARY:alarma',
    'DESCRIPTION:x',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\n');
  assert.equal(parseIcal(text, opts).events[0].summary, 'Reserved');
});

test('UID repetido: se queda uno; RECURRENCE-ID distingue; RRULE se cuenta', () => {
  const ev = (body: string) => `BEGIN:VEVENT\n${body}\nEND:VEVENT`;
  const text = [
    'BEGIN:VCALENDAR',
    ev('UID:u\nDTSTART;VALUE=DATE:20261201\nDTEND;VALUE=DATE:20261203'),
    ev('UID:u\nDTSTART;VALUE=DATE:20261201\nDTEND;VALUE=DATE:20261204'),
    ev('UID:u\nRECURRENCE-ID:20261205\nDTSTART;VALUE=DATE:20261205\nDTEND;VALUE=DATE:20261206'),
    ev('UID:r\nRRULE:FREQ=WEEKLY\nDTSTART;VALUE=DATE:20261207\nDTEND;VALUE=DATE:20261208'),
    'END:VCALENDAR'
  ].join('\n');
  const r = parseIcal(text, opts);
  assert.equal(r.events.length, 3);
  assert.equal(r.events.find((e) => e.uid === 'u')?.stop, '2026-12-04');
  assert.equal(r.stats.recurring, 1);
});

test('texto que no es un calendario no es válido (no se debe tocar la base)', () => {
  assert.equal(parseIcal('<html><body>Error 404</body></html>', opts).valid, false);
  assert.equal(parseIcal('', opts).valid, false);
  assert.equal(parseIcal('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x', opts).valid, false); // cortado
  const vacio = parseIcal('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR', opts);
  assert.equal(vacio.valid, true);
  assert.equal(vacio.events.length, 0); // calendario legítimamente vacío
});

test('límite de eventos y de duración', () => {
  const many = ['BEGIN:VCALENDAR'];
  for (let i = 0; i < 12; i++) {
    many.push(`BEGIN:VEVENT\nUID:e${i}\nDTSTART;VALUE=DATE:2027010${(i % 9) + 1}\nEND:VEVENT`);
  }
  many.push('END:VCALENDAR');
  const r = parseIcal(many.join('\n'), { today: TODAY, maxEvents: 5 });
  assert.equal(r.truncated, true);

  const larga = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:l\nDTSTART;VALUE=DATE:20270101\nDTEND;VALUE=DATE:20350101\nEND:VEVENT\nEND:VCALENDAR';
  const e = parseIcal(larga, opts).events[0];
  assert.equal(diffDays(e.start, e.stop), 1100);
});

test('buildIcs: formato RFC, CRLF, plegado y sin datos personales', () => {
  const ics = buildIcs(
    'Hotel Ñandú, Suite 1',
    [
      { uid: 'res-RES-1@roomiapms.site', start: '2026-12-01', end: '2026-12-04', summary: 'Reservado (Roomia)' },
      { uid: 'blk-x@roomiapms.site', start: '2026-12-10', end: '2026-12-12', summary: 'Reservado (Booking)' }
    ],
    new Date('2026-11-12T15:30:00.123Z')
  );
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'todas las líneas terminan en CRLF');
  assert.ok(ics.includes('DTSTAMP:20261112T153000Z'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261201'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261204'));
  assert.ok(ics.includes('X-WR-CALNAME:Hotel Ñandú\\, Suite 1'));
  for (const line of ics.split('\r\n')) {
    assert.ok(new TextEncoder().encode(line).length <= 75, `línea demasiado larga: ${line}`);
  }
  // Lo que Roomia publica se puede volver a leer con el mismo parser
  const back = parseIcal(ics, { today: '2026-11-01' });
  assert.equal(back.valid, true);
  assert.deepEqual(
    back.events.map((e) => [e.uid, e.start, e.stop]),
    [
      ['res-RES-1@roomiapms.site', '2026-12-01', '2026-12-04'],
      ['blk-x@roomiapms.site', '2026-12-10', '2026-12-12']
    ]
  );
});

test('foldLine respeta caracteres multibyte', () => {
  const linea = 'SUMMARY:' + 'ñ'.repeat(100);
  const partes = foldLine(linea);
  assert.ok(partes.length > 1);
  assert.equal(partes.map((p, i) => (i === 0 ? p : p.slice(1))).join(''), linea);
  for (const p of partes) assert.ok(new TextEncoder().encode(p).length <= 75);
});

test('URL de importación: reglas por plataforma y SSRF', () => {
  const ok = (u: string, p: string) => validateImportUrl(u, p).ok;
  assert.equal(ok('https://www.airbnb.com/calendar/ical/1.ics?s=x', 'airbnb'), true);
  assert.equal(ok('https://airbnb.com.ec/calendar/ical/1.ics', 'airbnb'), true);
  assert.equal(ok('https://www.airbnb.co.uk/calendar/ical/1.ics', 'airbnb'), true);
  assert.equal(ok('https://es.airbnb.es/calendar/ical/1.ics', 'airbnb'), true);
  assert.equal(ok('https://www.airbnb.com.au/calendar/ical/1.ics', 'airbnb'), true);
  assert.equal(ok('https://airbnb.ab.io/calendar/ical/1.ics', 'airbnb'), false);
  assert.equal(ok('https://airbnb.evil.com/calendar/ical/1.ics', 'airbnb'), false);
  assert.equal(ok('https://ical.booking.com/v1/export?t=abc', 'booking'), true);
  assert.equal(ok('https://calendario.ejemplo.com/a.ics', 'otro'), true);

  assert.equal(ok('http://ical.booking.com/v1/export', 'booking'), false);
  assert.equal(ok('https://www.airbnb.com/a.ics', 'booking'), false);
  assert.equal(ok('https://evil.com/ical.booking.com/a.ics', 'booking'), false);
  assert.equal(ok('https://airbnb.com.evil.net/a.ics', 'airbnb'), false);
  assert.equal(ok('https://127.0.0.1/a.ics', 'otro'), false);
  assert.equal(ok('https://169.254.169.254/latest/meta-data', 'otro'), false);
  assert.equal(ok('https://[::1]/a.ics', 'otro'), false);
  assert.equal(ok('https://localhost/a.ics', 'otro'), false);
  assert.equal(ok('https://servidor.internal/a.ics', 'otro'), false);
  assert.equal(ok('https://intranet/a.ics', 'otro'), false);
  assert.equal(ok('https://user:pass@ical.booking.com/a', 'booking'), false);
  assert.equal(ok('https://ical.booking.com:8443/a', 'booking'), false);
  assert.equal(ok('no es una url', 'otro'), false);
  assert.equal(ok('file:///etc/passwd', 'otro'), false);
});

test('IP privadas', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '172.16.5.5', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', 'basura']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '151.101.1.1', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('utilidades de fecha', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-03-01', -1), '2027-02-28');
  assert.equal(diffDays('2026-12-01', '2026-12-04'), 3);
  assert.match(dateInTz('America/Guayaquil'), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dateInTz('America/Guayaquil', new Date('2026-11-13T03:00:00Z')), '2026-11-12');
});
