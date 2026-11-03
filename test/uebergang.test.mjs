// Serien-Übergang: harter Schnitt, weiter Farbverlauf, Linien verbiegen, vorheriger Halt unberührt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { anschliessenSerie, randLinien, bestesPaar, UEBERGANG, SERIE_KONFIG } from '../src/uebergang.mjs';
import { ausschnitt } from '../src/kern.mjs';

const H = 1620;
const UE = 363;

// Foto mit waagerechter Linie auf Höhe y (Anteil), oben/unten je eine Farbe, leichte Körnung.
function foto(w, y, oben, unten, seed = 1) {
  let s = seed;
  const z = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const d = new Uint8ClampedArray(w * H * 4);
  for (let py = 0; py < H; py++) {
    const k = Math.max(0, Math.min(1, (py - y * H) / 2 + 0.5));
    for (let x = 0; x < w; x++) {
      const i = (py * w + x) * 4;
      for (let c = 0; c < 3; c++) d[i + c] = oben[c] * (1 - k) + unten[c] * k + (z() - 0.5) * 4;
      d[i + 3] = 255;
    }
  }
  return { w, h: H, d };
}

// Höhe der stärksten Linie in den Spalten x0..x1
function linieBei(bild, x0, x1) {
  const sp = { w: x1 - x0, h: bild.h, d: ausschnitt(bild, x0, x1 - x0).d };
  return randLinien(sp, 1)[0]?.y;
}

test('Linien 4 % auseinander: das neue Foto wird verbogen, voll am Übergang, ab 45 % unverändert', () => {
  const a = foto(1296, 0.55, [140, 180, 220], [30, 70, 110], 1);
  const b = foto(2160, 0.51, [210, 190, 160], [90, 55, 35], 2);
  const kopieA = new Uint8ClampedArray(a.d);
  const r = anschliessenSerie(a, b, UE);
  assert.ok(r.biegung, 'Biegung erkannt');
  assert.ok(Math.abs(r.biegung.von - 0.51) < 0.01 && Math.abs(r.biegung.nach - 0.55) < 0.01, JSON.stringify(r.biegung));
  // Am Übergang liegt die Linie jetzt auf der Höhe von A ...
  assert.ok(Math.abs(linieBei(r.neu, 0, UE) - 0.55) < 0.006, `Übergang ${linieBei(r.neu, 0, UE)}`);
  assert.ok(Math.abs(linieBei(r.naht, 0, UE) - 0.55) < 0.006, `Naht ${linieBei(r.naht, 0, UE)}`);
  // ... und ab 45 % der Breite dort, wo sie im Foto war
  const x45 = Math.ceil(UEBERGANG.biegeBis * b.w);
  assert.ok(Math.abs(linieBei(r.neu, x45, b.w) - 0.51) < 0.003, `hinten ${linieBei(r.neu, x45, b.w)}`);
  assert.deepEqual(a.d, kopieA, 'der vorherige Halt bleibt unangetastet');
});

test('Linien 12 % auseinander: nichts wird verbogen', () => {
  const a = foto(1296, 0.55, [140, 180, 220], [30, 70, 110], 1);
  const b = foto(1620, 0.43, [210, 190, 160], [90, 55, 35], 3);
  const r = anschliessenSerie(a, b, UE);
  assert.equal(r.biegung, null);
  assert.ok(Math.abs(linieBei(r.neu, 0, UE) - 0.43) < 0.003);
  assert.equal(bestesPaar([{ y: 0.5, staerke: 10, zeichen: 1 }], [{ y: 0.45, staerke: 10, zeichen: -1 }]), null, 'Richtung muss passen');
});

test('Kein Blur: harter Schnitt am Faden, Ränder gehen exakt in die Nachbarn über', () => {
  const a = foto(1296, 0.5, [200, 200, 200], [60, 60, 60], 4);
  const b = foto(1296, 0.5, [100, 140, 220], [20, 40, 90], 5);
  const r = anschliessenSerie(a, b, UE);
  const ra = ausschnitt(a, a.w - UE, UE);
  const rb = ausschnitt(r.neu, 0, UE);
  let abweichung = 0;
  for (let y = 0; y < H; y += 7) {
    const p = r.pfad[y];
    for (const [x, quelle] of [[p - 3, ra], [p + 3, rb], [0, ra], [UE - 1, rb]]) {
      const i = (y * UE + x) * 4;
      for (let c = 0; c < 3; c++) abweichung = Math.max(abweichung, Math.abs(r.naht.d[i + c] - quelle.d[i + c]));
    }
  }
  assert.ok(abweichung <= 1, `drei Pixel neben dem Faden ist es schon das reine Foto: ${abweichung}`);
});

test('Weiter Farbverlauf: große Helligkeitsunterschiede werden ausgeglichen, der Rest bleibt unverändert', () => {
  const a = foto(1296, 0.5, [230, 230, 230], [200, 200, 200], 6);
  const b = foto(1620, 0.5, [70, 70, 70], [60, 60, 60], 7); // gut dreimal dunkler
  const r = anschliessenSerie(a, b, UE);
  const mittel = (bild, x0, x1) => { let s = 0; let n = 0; for (let y = 0; y < H; y += 5) for (let x = x0; x < x1; x += 3) { s += bild.d[(y * bild.w + x) * 4]; n++; } return s / n; };
  const links = mittel(r.neu, 0, 40);
  assert.ok(Math.abs(links - mittel(a, a.w - 40, a.w)) < 0.1 * links, `Übergang ${links}`);
  const xFrei = Math.ceil(UEBERGANG.ausblend * b.w);
  for (let y = 0; y < H; y += 11) for (let x = xFrei; x < b.w; x += 13) {
    const i = (y * b.w + x) * 4;
    assert.equal(r.neu.d[i], b.d[i]);
  }
  assert.equal(SERIE_KONFIG.gainMin, 0.2);
  assert.equal(SERIE_KONFIG.gainMax, 3.5);
  assert.equal(SERIE_KONFIG.zeilenSigmaAnteil, 0.14);
});
