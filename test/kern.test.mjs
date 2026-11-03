// Tests für den Bildkern. Start: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { analysiere, ausschnitt, bewertung, hauptlinien } from '../src/kern.mjs';
// Die Naht selbst testet uebergang.test.mjs. Eine Farbangleichung gibt es nicht mehr.

function zufall(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function wertRauschen(w, h, zellen, seed) {
  const r = zufall(seed);
  const gw = zellen + 2;
  const gh = Math.ceil((zellen * h) / w) + 2;
  const g = new Float32Array(gw * gh).map(() => r());
  return (x, y) => {
    const fx = (x / w) * zellen;
    const fy = (y / h) * zellen;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const v = (a, b) => g[Math.min(gh - 1, b) * gw + Math.min(gw - 1, a)];
    return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
  };
}

// Szene: oben Farbe A, unten Farbe B, Trennlinie bei linieY mit leichter Welligkeit.
function szene(w, h, { oben, unten, linieY, wellig = 0, seed = 1, koernung = 5, verschub = 0 }) {
  const d = new Uint8ClampedArray(w * h * 4);
  const n1 = wertRauschen(w * 4, h, 24, seed);
  const n2 = wertRauschen(w, h, 16, seed + 7);
  const korn = zufall(seed + 13);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const kante = linieY * h + (n1(x + verschub, 0) - 0.5) * wellig * h;
      const t = Math.max(0, Math.min(1, (y - kante) / 2 + 0.5));
      const f = oben.map((o, c) => o * (1 - t) + unten[c] * t);
      const m = 1 + (n2(x + verschub, y) - 0.5) * 0.14;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) d[i + c] = f[c] * m + (korn() - 0.5) * koernung;
      d[i + 3] = 255;
    }
  }
  return { w, h, d };
}

const W = 96;
const H = 120;
const UE = 27;
const meer = szene(W, H, { oben: [135, 175, 215], unten: [30, 75, 110], linieY: 0.55, seed: 3 });
const rest = ausschnitt(meer, W - UE, UE);

test('Fortsetzung derselben Szene erreicht "Planmäßig"', () => {
  const live = szene(W, H, { oben: [135, 175, 215], unten: [30, 75, 110], linieY: 0.55, seed: 9 });
  const r = analysiere(rest, ausschnitt(live, 0, UE));
  assert.ok(r.wert >= 90, `Wert ${r.wert}`);
});

test('Anderes Motiv mit gleicher Linienhöhe schlägt versetzte Linie deutlich', () => {
  const tisch = szene(W, H, { oben: [205, 190, 165], unten: [90, 55, 35], linieY: 0.55, seed: 21 });
  const versetzt = szene(W, H, { oben: [205, 190, 165], unten: [90, 55, 35], linieY: 0.25, seed: 21 });
  const gut = analysiere(rest, ausschnitt(tisch, 0, UE));
  const schlecht = analysiere(rest, ausschnitt(versetzt, 0, UE));
  assert.ok(gut.wert >= 70, `getroffen: ${gut.wert}`);
  assert.ok(schlecht.wert < 40, `versetzt: ${schlecht.wert}`);
});

test('Linie um 2 % verfehlt ist noch gut, um 10 % verfehlt nicht mehr', () => {
  const nah = szene(W, H, { oben: [205, 190, 165], unten: [90, 55, 35], linieY: 0.57, seed: 21 });
  const weit = szene(W, H, { oben: [205, 190, 165], unten: [90, 55, 35], linieY: 0.65, seed: 21 });
  const a = analysiere(rest, ausschnitt(nah, 0, UE)).wert;
  const b = analysiere(rest, ausschnitt(weit, 0, UE)).wert;
  assert.ok(a > b, `nah ${a}, weit ${b}`);
  assert.ok(a >= 60, `nah ${a}`);
});

test('Himmel an Himmel bleibt unter 90: leichte Anschlüsse sind gedeckelt', () => {
  const flach1 = szene(W, H, { oben: [135, 175, 215], unten: [135, 175, 215], linieY: 0.5, seed: 31 });
  const flach2 = szene(W, H, { oben: [125, 170, 220], unten: [125, 170, 220], linieY: 0.5, seed: 33 });
  const r = analysiere(ausschnitt(flach1, W - UE, UE), ausschnitt(flach2, 0, UE));
  assert.ok(r.wert < 90, `Wert ${r.wert}`);
});

test('Live-Analyse ist schnell genug für 15 Bilder pro Sekunde', () => {
  const live = ausschnitt(szene(W, H, { oben: [205, 190, 165], unten: [90, 55, 35], linieY: 0.55, seed: 41 }), 0, UE);
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) analysiere(rest, live);
  const ms = (performance.now() - t0) / 200;
  console.log(`Analyse: ${ms.toFixed(2)} ms pro Durchlauf`);
  assert.ok(ms < 10, `${ms} ms`);
});

test('bewertung liefert die vier Texte', () => {
  assert.equal(bewertung(95), 'Planmäßig. Auf die Sekunde.');
  assert.equal(bewertung(75), 'Anschluss erreicht');
  assert.equal(bewertung(50), 'Knapp, läuft aber');
  assert.equal(bewertung(10), 'Anschluss verpasst');
});

test('Identische Überlappung ergibt 100', () => {
  const r = analysiere(rest, rest);
  assert.equal(r.wert, 100);
});

test('Je näher die Linie, desto höher der Wert: das führt den Nutzer', () => {
  const werte = [0.55, 0.56, 0.57, 0.59, 0.62, 0.65, 0.7].map((linieY) =>
    analysiere(rest, ausschnitt(szene(W, H, { oben: [205, 190, 165], unten: [90, 55, 35], linieY, seed: 21 }), 0, UE)).wert,
  );
  console.log(`Wert nach Abstand: ${werte.join(' ')}`);
  for (let i = 1; i < werte.length; i++) assert.ok(werte[i] <= werte[i - 1], werte.join(' '));
});

test('Einfahrhilfe findet die Linie am Bildrand', () => {
  const linien = hauptlinien(rest);
  assert.ok(linien.length >= 1);
  assert.ok(Math.abs(linien[0].y - 0.55) < 0.03, `y ${linien[0].y}`);
  const flach = szene(W, H, { oben: [135, 175, 215], unten: [135, 175, 215], linieY: 0.5, seed: 31, koernung: 2 });
  for (const l of hauptlinien(ausschnitt(flach, W - UE, UE))) assert.ok(l.staerke <= 1);
});
