// Farbprofile: lesen, erkennen, Display-P3-Profil erzeugen und in ein JPEG setzen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { iccLesen, iccAusJpeg, profilAusBytes, displayP3Profil, setzeProfil, wirdUmgerechnet } from '../src/farbe.mjs';

// Kleinstes "JPEG": SOI, APP0, ein Bildabschnitt, EOI. Zum Lesen der Abschnitte reicht das.
function jpeg(...segmente) {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sos = [0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9];
  return new Uint8Array([0xff, 0xd8, ...app0, ...segmente.flat(), ...sos]);
}

// Profil mit anderen Primärfarben: die XYZ-Werte im erzeugten P3-Profil überschreiben.
function mitPrimaer(r, g, b) {
  const p = displayP3Profil();
  const dv = new DataView(p.buffer);
  const n = dv.getUint32(128);
  for (let i = 0; i < n; i++) {
    const o = 132 + i * 12;
    const sig = String.fromCharCode(...p.subarray(o, o + 4));
    const werte = { rXYZ: r, gXYZ: g, bXYZ: b }[sig];
    if (werte) werte.forEach((v, k) => dv.setInt32(dv.getUint32(o + 4) + 8 + k * 4, Math.round(v * 65536)));
  }
  return p;
}

test('Erzeugtes Display-P3-Profil wird als Display P3 erkannt', () => {
  const p = displayP3Profil();
  assert.equal(new DataView(p.buffer).getUint32(0), p.length);
  const info = iccLesen(p);
  assert.equal(info.art, 'display-p3');
  assert.equal(info.name, 'Display P3');
  assert.equal(info.modell, 'RGB');
});

test('Primärfarben entscheiden: sRGB, Display P3, Adobe RGB ist weit', () => {
  assert.equal(iccLesen(mitPrimaer([0.4361, 0.2225, 0.0139], [0.3851, 0.7169, 0.0971], [0.1431, 0.0606, 0.7141])).art, 'srgb');
  assert.equal(iccLesen(mitPrimaer([0.6097, 0.3111, 0.0195], [0.2053, 0.6257, 0.0609], [0.1492, 0.0632, 0.7446])).art, 'weit');
  assert.equal(iccLesen(new Uint8Array(200)), null);
});

test('Profil ins JPEG setzen und wieder lesen, vorhandenes Profil wird ersetzt', () => {
  const ohne = jpeg();
  assert.equal(iccAusJpeg(ohne), null);
  const p3 = displayP3Profil();
  const mit = setzeProfil(ohne, p3);
  assert.deepEqual(iccAusJpeg(mit), p3);
  assert.deepEqual(mit.subarray(mit.length - 11), ohne.subarray(ohne.length - 11), 'Bilddaten unverändert');
  // APP0 bleibt vorn, das Profil kommt danach
  assert.equal(mit[2], 0xff); assert.equal(mit[3], 0xe0);
  const srgb = mitPrimaer([0.4361, 0.2225, 0.0139], [0.3851, 0.7169, 0.0971], [0.1431, 0.0606, 0.7141]);
  const doppelt = setzeProfil(setzeProfil(ohne, srgb), p3);
  assert.equal(iccLesen(iccAusJpeg(doppelt)).art, 'display-p3');
  assert.equal(doppelt.length, mit.length, 'altes Profil ist raus');
});

test('Profil aus Dateien: JPEG, PNG mit iCCP oder sRGB, HEIC-artig, ohne Profil', async () => {
  const p3 = displayP3Profil();
  assert.equal((await profilAusBytes(setzeProfil(jpeg(), p3))).art, 'display-p3');
  assert.equal((await profilAusBytes(jpeg())).art, 'keins');
  const chunk = (typ, daten) => {
    const b = new Uint8Array(12 + daten.length);
    new DataView(b.buffer).setUint32(0, daten.length);
    for (let i = 0; i < 4; i++) b[4 + i] = typ.charCodeAt(i);
    b.set(daten, 8);
    return b;
  };
  const kopf = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = chunk('IHDR', new Uint8Array(13));
  const name = new TextEncoder().encode('Display P3');
  const iccp = chunk('iCCP', new Uint8Array([...name, 0, 0, ...deflateSync(p3)]));
  const png = new Uint8Array([...kopf, ...ihdr, ...iccp, ...chunk('IEND', new Uint8Array(0))]);
  assert.equal((await profilAusBytes(png)).art, 'display-p3');
  const pngSrgb = new Uint8Array([...kopf, ...ihdr, ...chunk('sRGB', new Uint8Array([0])), ...chunk('IEND', new Uint8Array(0))]);
  assert.equal((await profilAusBytes(pngSrgb)).art, 'srgb');
  const heic = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode('ftypheic'), ...new Uint8Array(40), ...p3, ...new Uint8Array(100)]);
  assert.equal((await profilAusBytes(heic)).art, 'display-p3');
});

test('Umgerechnet wird nur, was nicht in den Arbeitsfarbraum passt', () => {
  assert.equal(wirdUmgerechnet({ art: 'keins' }, 'srgb'), false);
  assert.equal(wirdUmgerechnet({ art: 'srgb' }, 'srgb'), false);
  assert.equal(wirdUmgerechnet({ art: 'display-p3' }, 'display-p3'), false);
  assert.equal(wirdUmgerechnet({ art: 'display-p3' }, 'srgb'), true);
  assert.equal(wirdUmgerechnet({ art: 'weit' }, 'display-p3'), true);
});
