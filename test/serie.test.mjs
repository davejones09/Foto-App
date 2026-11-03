// Serie aus der Mediathek: Reihenfolge über volle Fotos, fester Start, Motivkarte, Zuschnitt, Aufnahmezeit, Held-Karp, EXIF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skaliere, kantenMerkmale, paarWert, heldKarp, SerienPlaner, motivKarte, motivSetzen, zuschnitt, erhalt, spaltenProfil, KH, KUE } from '../src/serie.mjs';
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

// Ein Foto wird als Ganzes bewertet: ein einziger Kandidat, kleine Fassung mit 120 Zeilen.
const klein = (bild) => skaliere(bild, { x: 0, y: 0, w: bild.w, h: bild.h }, Math.round((KH * bild.w) / bild.h), KH);
function vorbereiten(bild) {
  return [{ ...kantenMerkmale(klein(bild)), kosten: 0, erlaubt: true }];
}

const FARBEN = [
  [[135, 175, 215], [30, 75, 110]], [[205, 190, 165], [90, 55, 35]], [[180, 200, 160], [60, 90, 40]],
  [[240, 200, 150], [70, 70, 80]], [[150, 160, 190], [40, 50, 45]], [[220, 220, 210], [110, 80, 60]],
];
const HOEHEN = [0.3, 0.45, 0.62, 0.5, 0.36, 0.56];

function kette(n = 5) {
  return Array.from({ length: n }, (_, k) => foto(240, 300, { a: HOEHEN[k], b: HOEHEN[k + 1], oben: FARBEN[k][0], unten: FARBEN[k][1], seed: 10 + k }));
}

test('Schneller Paarwert folgt dem Kern: Treffer hoch, versetzte Linie niedrig', () => {
  const a = foto(240, 300, { a: 0.5, b: 0.5, oben: FARBEN[0][0], unten: FARBEN[0][1], seed: 1 });
  const gut = foto(240, 300, { a: 0.5, b: 0.5, oben: FARBEN[1][0], unten: FARBEN[1][1], seed: 2 });
  const schlecht = foto(240, 300, { a: 0.25, b: 0.25, oben: FARBEN[1][0], unten: FARBEN[1][1], seed: 3 });
  const k = klein;
  const ma = kantenMerkmale(k(a));
  const wg = paarWert(ma.rechts, kantenMerkmale(k(gut)).links);
  const ws = paarWert(ma.rechts, kantenMerkmale(k(schlecht)).links);
  const kg = analysiere(ausschnitt(k(a), k(a).w - KUE, KUE), ausschnitt(k(gut), 0, KUE)).wert;
  const ks = analysiere(ausschnitt(k(a), k(a).w - KUE, KUE), ausschnitt(k(schlecht), 0, KUE)).wert;
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
});

test('Fester Start: der letzte Halt der Strecke bestimmt das erste Foto', () => {
  const fotos = kette(5);
  const halt = foto(240, 300, { a: 0.4, b: HOEHEN[2], oben: [200, 180, 170], unten: [50, 40, 60], seed: 99 });
  const p = new SerienPlaner();
  for (const k of [0, 1, 2, 3, 4]) p.setze({ id: `f${k}`, zeit: k, kandidaten: vorbereiten(fotos[k]) });
  assert.equal(p.plane().reihenfolge[0], 'f0');
  p.setzeStart(kantenMerkmale(klein(halt)).rechts);
  const r = p.plane({ modus: 'beste' });
  assert.equal(r.reihenfolge[0], 'f2', `Reihenfolge ${r.reihenfolge}`);
  assert.deepEqual(r.reihenfolge.slice(0, 3), ['f2', 'f3', 'f4']);
  assert.ok(r.werte[0] >= 70, `Anschluss an den Start ${r.werte[0]}`);
});

test('Nach Aufnahmezeit: Reihenfolge folgt der Zeit, eigene Reihenfolge bleibt', () => {
  const fotos = kette(4);
  const p = new SerienPlaner();
  const zeiten = { f0: 40, f1: 10, f2: 30, f3: 20 };
  for (let k = 0; k < 4; k++) p.setze({ id: `f${k}`, zeit: zeiten[`f${k}`], kandidaten: vorbereiten(fotos[k]) });
  const r = p.plane({ modus: 'zeit' });
  assert.deepEqual(r.reihenfolge, ['f1', 'f3', 'f2', 'f0']);
  assert.equal(Object.keys(r.wahl).length, 4);
  // Eigene Reihenfolge und fest gewählter Ausschnitt bleiben ebenfalls erhalten
  const eigen = p.plane({ reihenfolge: ['f2', 'f0', 'f1', 'f3'] });
  assert.deepEqual(eigen.reihenfolge, ['f2', 'f0', 'f1', 'f3']);
});

// Arbeitsfassung für die Motivkarte: Himmel, großer dunkler, unscharfer Vordergrund, gleichmäßige Textur
// (wie Meer) und ein kleines, scharfes Motiv.
function szeneMitMotiv(w, h, { motivX = 0.75, motivY = 0.35, motivR = 0.06, vordergrund = true, textur = true } = {}) {
  const d = new Uint8ClampedArray(w * h * 4);
  const r = zufall(42);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      let f = [150 + 60 * (1 - v), 175 + 40 * (1 - v), 215];
      if (textur && v > 0.6) { const n = (r() - 0.5) * 50; f = [40 + n, 80 + n, 110 + n]; }
      if (vordergrund) {
        // Großer, dunkler Vordergrund mit sehr weichem Rand (unscharf)
        const t = Math.min(1, Math.max(0, (0.55 - Math.hypot(u - 0.2, v - 0.85)) / 0.25));
        const k = t * t * (3 - 2 * t);
        f = f.map((c) => c * (1 - k) + 20 * k);
      }
      const du = (u - motivX) / motivR;
      const dv = (v - motivY) / ((motivR * w) / h);
      if (du * du + dv * dv < 1) f = ((Math.floor(x / 3) + Math.floor(y / 3)) % 2) ? [240, 230, 210] : [30, 20, 25]; // scharf
      const i = (y * w + x) * 4;
      d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255;
    }
  }
  return { w, h, d };
}

const motivRect = (w, h, mx, my, mr) => ({ x: (mx - mr) * w, y: (my - mr * (w / h)) * h, w: 2 * mr * w, h: 2 * mr * w });

test('Motivkarte: das kleine scharfe Motiv gewinnt gegen großen, unscharfen, dunklen Vordergrund und Textur', () => {
  const W = 640;
  const H = 480;
  const b = szeneMitMotiv(W, H);
  const t0 = performance.now();
  const k = motivKarte(b);
  console.log(`Motivkarte ${W}x${H}: ${(performance.now() - t0).toFixed(0)} ms`);
  let arg = 0;
  for (let i = 1; i < k.sal.length; i++) if (k.sal[i] > k.sal[arg]) arg = i;
  const ax = (arg % W) / W;
  const ay = Math.floor(arg / W) / H;
  assert.ok(Math.abs(ax - 0.75) < 0.08 && Math.abs(ay - 0.35) < 0.1, `Spitze bei ${ax.toFixed(2)}, ${ay.toFixed(2)}`);
  const motiv = erhalt(k, motivRect(W, H, 0.75, 0.35, 0.09));
  const vorne = erhalt(k, { x: 0, y: 0.55 * H, w: 0.45 * W, h: 0.45 * H });
  const meer = erhalt(k, { x: 0.45 * W, y: 0.62 * H, w: 0.55 * W, h: 0.38 * H });
  console.log(`Anteile: Motiv ${motiv.toFixed(2)}, Vordergrund ${vorne.toFixed(2)}, Textur ${meer.toFixed(2)}`);
  assert.ok(motiv > 0.6, `Motiv ${motiv}`);
  assert.ok(motiv > 4 * vorne, 'unscharfer Vordergrund zählt kaum');
  assert.ok(motiv > 4 * meer, 'gleichmäßige Textur zählt kaum');
});

test('Zuschnitt nur außerhalb von 0,7 bis 2:1, dann um das Motiv herum', () => {
  for (const [w, h] of [[640, 480], [480, 640], [448, 640], [640, 320], [4000, 3000]]) {
    const z = zuschnitt(w, h, null);
    assert.equal(z.beschnitten, false, `${w}x${h} bleibt ganz`);
    assert.deepEqual([z.x, z.y, z.w, z.h], [0, 0, w, h]);
  }
  // Panorama 3:1, Motiv rechts: Zuschnitt auf 2:1 enthält das Motiv
  const pano = szeneMitMotiv(960, 320, { motivX: 0.85, motivY: 0.4, motivR: 0.03, vordergrund: false });
  const kp = motivKarte(pano);
  const zp = zuschnitt(960, 320, kp);
  assert.ok(zp.beschnitten);
  assert.ok(Math.abs(zp.w / zp.h - 2) < 1e-9);
  assert.ok(zp.x + zp.w >= 0.88 * 960 && zp.x <= 0.82 * 960, `Fenster ${zp.x}..${zp.x + zp.w}`);
  // Sehr hohes Bild (0,5), Motiv oben
  const hoch = szeneMitMotiv(320, 640, { motivX: 0.5, motivY: 0.12, motivR: 0.08, vordergrund: false, textur: false });
  const zh = zuschnitt(320, 640, motivKarte(hoch));
  assert.ok(Math.abs(zh.w / zh.h - 0.7) < 1e-9);
  assert.ok(zh.y <= 0.05 * 640, `oben geblieben: ${zh.y}`);
  // Per Antippen gesetztes Motiv schlägt die Karte
  const links = zuschnitt(960, 320, motivSetzen(kp, { x: 0.1, y: 0.5 }));
  assert.ok(links.x <= 0.05 * 960, `nach links: ${links.x}`);
});

test('Spaltenprofil: Summe je Spalte, Spitze beim Motiv', () => {
  const b = szeneMitMotiv(640, 320, { motivX: 0.3, motivY: 0.5, motivR: 0.05, vordergrund: false });
  const p = spaltenProfil(motivKarte(b));
  assert.equal(p.length, 640);
  let arg = 0;
  for (let i = 1; i < p.length; i++) if (p[i] > p[arg]) arg = i;
  assert.ok(Math.abs(arg / 640 - 0.3) < 0.05, `Spitze bei ${arg / 640}`);
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

test('Ab 13 Fotos rechnet eine Näherung: gültige Reihenfolge, findet eine klare Kette, nah an exakt', async () => {
  const { naeherung, besteReihenfolge, EXAKT_BIS } = await import('../src/serie.mjs');
  const r = zufall(11);
  // Klare Kette 0 → 1 → … → 15 mit hohen Werten, sonst Rauschen
  const n = 16;
  const W = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? -Infinity : j === i + 1 ? 90 + r() * 5 : r() * 40)));
  const weg = besteReihenfolge(W);
  assert.equal(new Set(weg).size, n);
  assert.deepEqual(weg, [...Array(n).keys()]);
  // Bis EXAKT_BIS genau Held-Karp, die Näherung bleibt dort nah dran
  for (let runde = 0; runde < 10; runde++) {
    const m = 8;
    const V = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => (i === j ? -Infinity : Math.round(r() * 100))));
    const summe = (p) => p.reduce((s, x, k) => s + (k ? V[p[k - 1]][x] : 0), 0);
    assert.deepEqual(besteReihenfolge(V), heldKarp(V));
    assert.ok(summe(naeherung(V)) >= 0.9 * summe(heldKarp(V)));
  }
  assert.equal(EXAKT_BIS, 12);
});
