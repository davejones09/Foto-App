// Keine Spuren der App: JPEG nur mit JFIF und Farbprofil, MP4 ohne Werkzeugnamen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { jpegSauber, jpegAbschnitte, mp4Sauber } from '../src/metadaten.mjs';
import { displayP3Profil, setzeProfil, iccAusJpeg } from '../src/farbe.mjs';

const seg = (marker, inhalt) => {
  const d = typeof inhalt === 'string' ? new TextEncoder().encode(inhalt) : inhalt;
  return [0xff, marker, ((d.length + 2) >> 8) & 255, (d.length + 2) & 255, ...d];
};
const enthaelt = (b, t) => Buffer.from(b).includes(Buffer.from(t));

test('JPEG: EXIF, Kommentare und fremde APP-Abschnitte fliegen raus, JFIF, Profil und Bilddaten bleiben', () => {
  const jfif = seg(0xe0, 'JFIF\0\x01\x01\0\0\x01\0\x01\0\0');
  const exif = seg(0xe1, 'Exif\0\0Software: Nahtlos 0.13');
  const xmp = seg(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>Nahtlos</x:xmpmeta>');
  const kommentar = seg(0xfe, 'Erstellt mit Nahtlos');
  const app13 = seg(0xed, 'Photoshop 3.0\0Nahtlos');
  const dqt = seg(0xdb, new Uint8Array(65));
  const bilddaten = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0xd9];
  let roh = new Uint8Array([0xff, 0xd8, ...jfif, ...exif, ...xmp, ...kommentar, ...app13, ...dqt, ...bilddaten]);
  roh = setzeProfil(roh, displayP3Profil());
  assert.ok(enthaelt(roh, 'Nahtlos'));
  const s = jpegSauber(roh);
  assert.ok(!enthaelt(s, 'Nahtlos'), 'kein Hinweis auf die App');
  assert.deepEqual(jpegAbschnitte(s).map((a) => a.marker.toString(16)), ['e0', 'e2', 'db']);
  assert.equal(jpegAbschnitte(s)[1].kennung, 'ICC_PROFILE');
  assert.deepEqual(iccAusJpeg(s), displayP3Profil(), 'Farbprofil bleibt');
  assert.deepEqual(s.subarray(s.length - bilddaten.length), new Uint8Array(bilddaten), 'Bilddaten unverändert');
  assert.deepEqual(jpegSauber(s), s, 'zweimal säubern ändert nichts');
});

// Kleine MP4-Struktur: ftyp, moov(trak(mdia(hdlr)), udta(meta)), mdat
function box(typ, ...inhalt) {
  const d = inhalt.flatMap((x) => (typeof x === 'string' ? [...new TextEncoder().encode(x)] : [...x]));
  const n = 8 + d.length;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255, ...new TextEncoder().encode(typ), ...d];
}

test('MP4: hdlr-Namen geleert, udta und meta werden free, Größen und Videodaten bleiben', () => {
  const hdlr = box('hdlr', new Uint8Array(4), 'mhlr', 'vide', new Uint8Array(12), 'mp4-muxer-hdlr\0');
  const udta = box('udta', box('meta', new Uint8Array(4), box('ilst', box('\xa9too', 'Nahtlos'))));
  const mp4 = new Uint8Array([
    ...box('ftyp', 'isom', new Uint8Array(4), 'isomavc1mp41'),
    ...box('moov', box('mvhd', new Uint8Array(100)), box('trak', box('mdia', hdlr)), udta),
    ...box('mdat', new Uint8Array([1, 2, 3, 4, 5])),
  ]);
  assert.ok(enthaelt(mp4, 'mp4-muxer') && enthaelt(mp4, 'Nahtlos'));
  const s = mp4Sauber(mp4);
  assert.equal(s.length, mp4.length);
  assert.ok(!enthaelt(s, 'mp4-muxer'), 'kein Werkzeugname');
  assert.ok(!enthaelt(s, 'Nahtlos'), 'kein App-Name');
  assert.ok(!enthaelt(s, 'udta'));
  assert.ok(enthaelt(s, 'free'));
  assert.ok(enthaelt(s, 'vide'), 'Art der Spur bleibt');
  assert.deepEqual(s.subarray(s.length - 5), new Uint8Array([1, 2, 3, 4, 5]), 'Videodaten unverändert');
});
