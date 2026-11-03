// Serie aus der Mediathek: Reihenfolge, fester Start, Motivschutz, Aufnahmezeit, Held-Karp, EXIF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ausschnitte, skaliere, fotoKandidaten, kantenMerkmale, paarWert, heldKarp, SerienPlaner, KB, KH, KUE } from '../src/serie.mjs';
import { analysiere, ausschnitt } from '../src/kern.mjs';
import { aufnahmezeit } from '../src/exif.mjs';

function zufall(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Testfoto: Linie links flach auf Höhe a, rechts flach auf Höhe b, dazwischen ein weicher Übergang.
// Darüber und darunter je eine Farbe, etwas Körnung. Optional ein auffälliges Motiv (roter Kreis).
function foto(w, h, { a, b, oben, unten, seed = 1, motiv = null, flach = 0.3 }) {
  const d = new Uint8ClampedArray(w * h * 4);
  const r = zufall(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const t = u < flach ? 0 : u > 1 - flach ? 1 : (u - flach) / (1 - 2 * flach);
      const linie = (a + (b - a) * t * t * (3 - 2 * t)) * h;
      const k = Math.max(0, Math.min(1, (y - linie) / 2 + 0.5));
      let f = oben.map((o, c) => o * (1 - k) + unten[c] * k);
      if (motiv) {
        const dx = (u - motiv.x) / motiv.r;
        const dy = (y / h - motiv.y) / (motiv.r * w / h);
        if (dx * dx + dy * dy < 1) f = [220, 30, 40];
      }
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) d[i + c] = f[c] + (r() - 0.5) * 6;
      d[i + 3] = 255;
    }
  }
  return { w, h, d };
}

function vorbereiten(bild) {
  const motivBild = skaliere(bild, { x: 0, y: 0, w: bild.w, h: bild.h }, Math.round(bild.w / 8), Math.round(bild.h / 8));
  return fotoKandidaten(bild.w, bild.h, motivBild, (r) => skaliere(bild, r, KB, KH));
}

const FARBEN = [
  [[135, 175, 215], [30, 75, 110]], [[205, 190, 165], [90, 55, 35]], [[180, 200, 160], [60, 90, 40]],
  [[240, 200, 150], [70, 70, 80]], [[150, 160, 190], [40, 50, 45]], [[220, 220, 210], [110, 80, 60]],
];
const HOEHEN = [0.3, 0.45, 0.62, 0.5, 0.36, 0.56];

function kette(n = 5) {
  return Array.from({ length: n }, (_, k) => foto(240, 300, { a: HOEHEN[k], b: HOEHEN[k + 1], oben: FARBEN[k][0], unten: FARBEN[k][1], seed: 10 + k }));
}

test('Ausschnitte: drei Zoomstufen mal 5 × 5 Positionen, ohne doppelte', () => {
  const quer = ausschnitte(480, 360);
  const hoch = ausschnitte(400, 500);
  assert.equal(quer.length, 5 + 25 + 25);
  assert.equal(hoch.length, 1 + 25 + 25);
  for (const a of [...quer, ...hoch]) {
    assert.ok(Math.abs(a.w / a.h - 0.8) < 1e-9);
    assert.ok(a.x >= -1e-9 && a.y >= -1e-9);
  }
  assert.ok(ausschnitte(4000, 3000).length >= 55 && ausschnitte(4000, 3000).length <= 75);
});

test('Schneller Paarwert folgt dem Kern: Treffer hoch, versetzte Linie niedrig', () => {
  const a = foto(240, 300, { a: 0.5, b: 0.5, oben: FARBEN[0][0], unten: FARBEN[0][1], seed: 1 });
  const gut = foto(240, 300, { a: 0.5, b: 0.5, oben: FARBEN[1][0], unten: FARBEN[1][1], seed: 2 });
  const schlecht = foto(240, 300, { a: 0.25, b: 0.25, oben: FARBEN[1][0], unten: FARBEN[1][1], seed: 3 });
  const k = (b) => skaliere(b, { x: 0, y: 0, w: b.w, h: b.h }, KB, KH);
  const ma = kantenMerkmale(k(a));
  const wg = paarWert(ma.rechts, kantenMerkmale(k(gut)).links);
  const ws = paarWert(ma.rechts, kantenMerkmale(k(schlecht)).links);
  const kg = analysiere(ausschnitt(k(a), KB - KUE, KUE), ausschnitt(k(gut), 0, KUE)).wert;
  const ks = analysiere(ausschnitt(k(a), KB - KUE, KUE), ausschnitt(k(schlecht), 0, KUE)).wert;
  assert.ok(wg >= 70, `gut ${wg} (Kern ${kg})`);
  assert.ok(ws < 40, `schlecht ${ws} (Kern ${ks})`);
  assert.ok(kg >= 70 && ks < 40, 'Kern sieht es genauso');
});

test('Held-Karp findet exakt die beste Reihenfolge (gegen Ausprobieren aller)', () => {
  const r = zufall(7);
  for (let runde = 0; runde < 20; runde++) {
    const n = 2 + (runde % 6);
    const W = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? -Infinity : Math.round(r() * 100))));
    const WS = runde % 2 ? Array.from({ length: n }, () => Math.round(r() * 100)) : null;
    const summe = (p) => p.reduce((s, x, k) => s + (k ? W[p[k - 1]][x] : WS ? WS[x] : 0), 0);
    let best = -Infinity;
    const perm = (p, rest) => {
      if (!rest.length) { best = Math.max(best, summe(p)); return; }
      for (const x of rest) perm([...p, x], rest.filter((y) => y !== x));
    };
    perm([], [...Array(n).keys()]);
    const hk = heldKarp(W, WS);
    assert.equal(new Set(hk).size, n);
    assert.equal(summe(hk), best);
  }
});

test('Reihenfolge: gemischte Fotos werden zur durchgehenden Kette', () => {
  const fotos = kette(5);
  const p = new SerienPlaner();
  for (const k of [3, 0, 4, 1, 2]) p.setze({ id: `f${k}`, zeit: 100 - k, kandidaten: vorbereiten(fotos[k]) });
  const r = p.plane({ modus: 'beste' });
  assert.deepEqual(r.reihenfolge, ['f0', 'f1', 'f2', 'f3', 'f4']);
  for (const w of r.werte.slice(1)) assert.ok(w >= 70, `Anschlüsse ${r.werte}`);
  for (const id of r.reihenfolge) assert.equal(p.fotos.get(id).kandidaten[r.wahl[id]].zoom, 1, 'kein unnötiger Zoom');
});

test('Fester Start: der letzte Halt der Strecke bestimmt das erste Foto', () => {
  const fotos = kette(5);
  const halt = foto(240, 300, { a: 0.4, b: HOEHEN[2], oben: [200, 180, 170], unten: [50, 40, 60], seed: 99 });
  const p = new SerienPlaner();
  for (const k of [0, 1, 2, 3, 4]) p.setze({ id: `f${k}`, zeit: k, kandidaten: vorbereiten(fotos[k]) });
  assert.equal(p.plane().reihenfolge[0], 'f0');
  p.setzeStart(kantenMerkmale(skaliere(halt, { x: 0, y: 0, w: 240, h: 300 }, KB, KH)).rechts);
  const r = p.plane({ modus: 'beste' });
  assert.equal(r.reihenfolge[0], 'f2', `Reihenfolge ${r.reihenfolge}`);
  assert.deepEqual(r.reihenfolge.slice(0, 3), ['f2', 'f3', 'f4']);
  assert.ok(r.werte[0] >= 70, `Anschluss an den Start ${r.werte[0]}`);
});

test('Nach Aufnahmezeit: Reihenfolge bleibt fest, nur die Ausschnitte werden gewählt', () => {
  const fotos = kette(4);
  const p = new SerienPlaner();
  const zeiten = { f0: 40, f1: 10, f2: 30, f3: 20 };
  for (let k = 0; k < 4; k++) p.setze({ id: `f${k}`, zeit: zeiten[`f${k}`], kandidaten: vorbereiten(fotos[k]) });
  const r = p.plane({ modus: 'zeit' });
  assert.deepEqual(r.reihenfolge, ['f1', 'f3', 'f2', 'f0']);
  assert.equal(Object.keys(r.wahl).length, 4);
  // Eigene Reihenfolge und fest gewählter Ausschnitt bleiben ebenfalls erhalten
  const eigen = p.plane({ reihenfolge: ['f2', 'f0', 'f1', 'f3'], fest: { f0: 3 } });
  assert.deepEqual(eigen.reihenfolge, ['f2', 'f0', 'f1', 'f3']);
  assert.equal(eigen.wahl.f0, 3);
});

test('Motivschutz: das Hauptmotiv bleibt im Ausschnitt, auch wenn ein anderer besser anschließen würde', () => {
  // Querformat, links ein roter Kreis. Die Linie liegt links hoch, rechts tief.
  // Der nächste Halt passt nur zur rechten Seite, dort ist das Motiv aber weg.
  const linieRechts = 0.66;
  const motiv = { x: 0.17, y: 0.5, r: 0.07 };
  const mitMotiv = foto(480, 360, { a: 0.32, b: linieRechts, oben: FARBEN[3][0], unten: FARBEN[3][1], seed: 5, motiv, flach: 0.35 });
  const ohneMotiv = foto(480, 360, { a: 0.32, b: linieRechts, oben: FARBEN[3][0], unten: FARBEN[3][1], seed: 5, flach: 0.35 });
  const weiter = foto(240, 300, { a: linieRechts, b: 0.5, oben: FARBEN[1][0], unten: FARBEN[1][1], seed: 6 });
  const enthaeltMotiv = (a) => a.x <= (motiv.x - motiv.r) * 480 + 1 && a.x + a.w >= (motiv.x + motiv.r) * 480 - 1;

  const mit = new SerienPlaner();
  mit.setze({ id: 'm', zeit: 1, kandidaten: vorbereiten(mitMotiv) });
  mit.setze({ id: 'q', zeit: 2, kandidaten: vorbereiten(weiter) });
  const r = mit.plane({ modus: 'zeit' });
  const gewaehlt = mit.fotos.get('m').kandidaten[r.wahl.m];
  assert.ok(enthaeltMotiv(gewaehlt), `Ausschnitt x=${gewaehlt.x.toFixed(0)} w=${gewaehlt.w.toFixed(0)} zoom=${gewaehlt.zoom}`);

  // Gegenprobe: ein Ausschnitt ohne Motiv hätte klar besser angeschlossen ...
  const kand = mit.fotos.get('m').kandidaten;
  let besterOhne = -1;
  kand.forEach((a, i) => { if (!enthaeltMotiv(a)) besterOhne = Math.max(besterOhne, mit.wert('m', i, 'q', r.wahl.q)); });
  assert.ok(besterOhne > r.werte[1] + 15, `ohne Motiv ${besterOhne}, gewählt ${r.werte[1]}`);
  // ... und ohne Motiv im Bild nimmt der Planer genau so einen.
  const ohne = new SerienPlaner();
  ohne.setze({ id: 'm', zeit: 1, kandidaten: vorbereiten(ohneMotiv) });
  ohne.setze({ id: 'q', zeit: 2, kandidaten: vorbereiten(weiter) });
  const r2 = ohne.plane({ modus: 'zeit' });
  assert.ok(!enthaeltMotiv(ohne.fotos.get('m').kandidaten[r2.wahl.m]), 'ohne Motiv zählt der Anschluss');
  assert.ok(r2.werte[1] > r.werte[1]);
});

test('Motivschutz: erlaubte Ausschnitte behalten mindestens 95 % des Motivs, auch beim Zoomen', () => {
  for (const my of [0.2, 0.3, 0.5]) {
    const W = 400;
    const H = 500;
    const m = { x: 0.5, y: my, r: 0.1 };
    const b = foto(W, H, { a: 0.6, b: 0.6, oben: FARBEN[2][0], unten: FARBEN[2][1], seed: 8, motiv: m });
    const k = vorbereiten(b);
    const anteil = (a) => {
      let drin = 0;
      let alle = 0;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        const dx = (x / W - m.x) / m.r;
        const dy = (y / H - m.y) / ((m.r * W) / H);
        if (dx * dx + dy * dy >= 1) continue;
        alle++;
        if (x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) drin++;
      }
      return drin / alle;
    };
    for (const a of k.filter((x) => x.erlaubt)) assert.ok(anteil(a) >= 0.95, `Motiv bei ${my}: erlaubter Ausschnitt behält nur ${anteil(a)}`);
    if (my === 0.2) assert.ok(k.some((x) => !x.erlaubt && anteil(x) < 0.8), 'Ausschnitte, die das Motiv anschneiden, sind verboten');
  }
});

function jpegMitExif(datum, gross = false) {
  const g = gross;
  const u16 = (v) => (g ? [v >> 8, v & 255] : [v & 255, v >> 8]);
  const u32 = (v) => (g ? [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255] : [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24]);
  const text = [...new TextEncoder().encode(datum), 0];
  // TIFF: Kopf (8), IFD0 mit 1 Eintrag (2+12+4), Exif-IFD mit 1 Eintrag (2+12+4), dann der Text
  const ifd0 = 8;
  const exifIfd = ifd0 + 18;
  const textOff = exifIfd + 18;
  const tiff = [
    ...(g ? [0x4d, 0x4d] : [0x49, 0x49]), ...u16(42), ...u32(ifd0),
    ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifIfd), ...u32(0),
    ...u16(1), ...u16(0x9003), ...u16(2), ...u32(text.length), ...u32(textOff), ...u32(0),
    ...text,
  ];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const laenge = app1.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, laenge >> 8, laenge & 255, ...app1, 0xff, 0xd9]).buffer;
}

test('Aufnahmezeit aus EXIF (beide Bytereihenfolgen), sonst null', () => {
  const erwartet = new Date(2026, 5, 14, 18, 42, 7).getTime();
  assert.equal(aufnahmezeit(jpegMitExif('2026:06:14 18:42:07')), erwartet);
  assert.equal(aufnahmezeit(jpegMitExif('2026:06:14 18:42:07', true)), erwartet);
  assert.equal(aufnahmezeit(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer), null);
  assert.equal(aufnahmezeit(new Uint8Array([1, 2, 3, 4]).buffer), null);
  assert.equal(aufnahmezeit(jpegMitExif('0000:00:00 00:00:00')), null);
});
