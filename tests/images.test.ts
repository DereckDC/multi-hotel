import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeDataUrl, extensionFor, isOwnStorageUrl, isPrivateIp, sniffImageType, validateFolder, validateImageUrl
} from '../supabase/functions/import-image/imageRules.ts';

test('validateImageUrl: solo https públicos', () => {
  assert.equal(validateImageUrl('https://image.wasi.co/foto.jpg').ok, true);
  assert.equal(validateImageUrl('http://example.com/a.jpg').ok, false);
  assert.equal(validateImageUrl('https://localhost/a.jpg').ok, false);
  assert.equal(validateImageUrl('https://127.0.0.1/a.jpg').ok, false);
  assert.equal(validateImageUrl('https://user:pw@example.com/a.jpg').ok, false);
  assert.equal(validateImageUrl('https://example.com:8443/a.jpg').ok, false);
  assert.equal(validateImageUrl('https://router.lan/a.jpg').ok, false);
  assert.equal(validateImageUrl('no es una url').ok, false);
});

test('isPrivateIp', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.27.226', '172.16.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['3.166.160.65', '8.8.8.8', '2600:9000:27a4:9e00:17:54e1:9e80:93a1']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('sniffImageType reconoce por los bytes', () => {
  assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
  const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  assert.equal(sniffImageType(webp), 'image/webp');
  assert.equal(sniffImageType(new TextEncoder().encode('<html><body>no</body></html>')), null);
  assert.equal(sniffImageType(new TextEncoder().encode('GIF89a')), null);
  assert.equal(extensionFor('image/jpeg'), 'jpg');
});

test('validateFolder', () => {
  assert.equal(validateFolder('hotels/hotel-1784836737153'), 'hotels/hotel-1784836737153');
  assert.equal(validateFolder('rooms/room_1'), 'rooms/room_1');
  assert.equal(validateFolder('../etc'), null);
  assert.equal(validateFolder('hotels/../x'), null);
  assert.equal(validateFolder('users/1'), null);
});

test('isOwnStorageUrl', () => {
  const base = 'https://fyreapnukipdvcebvokj.supabase.co';
  assert.equal(isOwnStorageUrl(`${base}/storage/v1/object/public/establecimientos/hotels/h1/a.webp`, base), true);
  assert.equal(isOwnStorageUrl('https://image.wasi.co/a.jpg', base), false);
  assert.equal(isOwnStorageUrl(`${base}/storage/v1/object/public/otro/a.webp`, base), false);
});

test('decodeDataUrl', () => {
  const png = decodeDataUrl('data:image/png;base64,iVBORw0KGgo=');
  assert.ok(png);
  assert.equal(sniffImageType(png!), 'image/png');
  assert.equal(decodeDataUrl('data:text/html;base64,PGh0bWw+'), null);
});
