// Übergang: Fotos bleiben außerhalb der Überlappung unverändert, weicher Übergang innen, Linien biegen nur innen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { anschliessen, ueberblenden, randLinien, bestesPaar, UEBERGANG } from '../src/uebergang.mjs';
import * as kern from '../src/kern.mjs';
import { ausschnitt } from '../src/kern.mjs';
import { stuecke, bandBreite } from '../src/masse.mjs';

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
      for (let c = 0; c < 3; c++) d[i + c] = oben[c] * (1 - k) + unten[c] * k + (z() - 0.5) * 6 + 8 * Math.sin((x + seed * 17) / 23) * Math.cos(py / 31);
      d[i + 3] = 255;
    }
  }
  return { w, h: H, d };
}

const spalte = (b, x) => { const o = []; for (let y = 0; y < b.h; y++) { const i = (y * b.w + x) * 4; o.push(b.d[i], b.d[i + 1], b.d[i + 2]); } return o; };

// Höhe der stärksten Linie in den Spalten x0..x1
function linieBei(bild, x0, x1) {
  return randLinien({ w: x1 - x0, h: bild.h, d: ausschnitt(bild, x0, x1 - x0).d }, 1)[0]?.y;
}

// Band aus Halten und Nähten, genau wie die App es zusammensetzt (masse.stuecke).
function band(halte, naehte) {
  const B = bandBreite(halte.map((h) => h.w));
  const d = new Uint8ClampedArray(B * H * 4);
  for (const st of stuecke(halte.map((h) => h.w))) {
    const q = st.art === 'naht' ? naehte[st.halt] : halte[st.halt];
    for (let y = 0; y < H; y++) d.set(q.d.subarray((y * q.w + st.sx) * 4, (y * q.w + st.sx + st.sw) * 4), (y * B + st.x) * 4);
  }
  return { w: B, h: H, d };
}

test('Außerhalb der Überlappung ist jeder Halt verlustfrei das unveränderte Original', () => {
  const a = foto(1296, 0.55, [140, 180, 220], [30, 70, 110], 1);
  const b = foto(2160, 0.40, [230, 230, 230], [70, 60, 50], 2); // ganz andere Helligkeit: früher wurde hier angeglichen
  const c = foto(1080, 0.62, [60, 60, 60], [200, 180, 150], 3);
  const kopien = [a, b, c].map((x) => new Uint8ClampedArray(x.d));
  const t0 = performance.now();
  const r1 = anschliessen(a, b, UE);
  console.log(`Übergang ${UE}x${H}: ${(performance.now() - t0).toFixed(0)} ms`);
  const r2 = anschliessen(b, c, UE);
  assert.equal(r1.neu, undefined, 'es gibt kein verändertes neues Bild mehr');
  [a, b, c].forEach((x, i) => assert.deepEqual(x.d, kopien[i], `Foto ${i + 1} unangetastet`));
  const gesamt = band([a, b, c], [null, r1.naht, r2.naht]);
  // Jede Spalte außerhalb der Überlappungen ist exakt die Spalte des Originals.
  const lagen = [0, a.w - UE, a.w - UE + b.w - UE];
  [a, b, c].forEach((x, i) => {
    const von = i === 0 ? 0 : UE;
    const bis = i === 2 ? x.w : x.w - UE;
    for (let sx = von; sx < bis; sx += 7) assert.deepEqual(spalte(gesamt, lagen[i] + sx), spalte(x, sx), `Halt ${i + 1}, Spalte ${sx}`);
  });
});

test('Die Naht geht an beiden Rändern ohne Stufe ins Original über', () => {
  const a = foto(1296, 0.5, [200, 200, 200], [60, 60, 60], 4);
  const b = foto(1296, 0.5, [100, 140, 220], [20, 40, 90], 5);
  const { naht } = anschliessen(a, b, UE);
  const ra = ausschnitt(a, a.w - UE, UE);
  const rb = ausschnitt(b, 0, UE);
  assert.deepEqual(spalte(naht, 0), spalte(ra, 0), 'linker Rand ist exakt A');
  assert.deepEqual(spalte(naht, UE - 1), spalte(rb, UE - 1), 'rechter Rand ist exakt B');
  // Keine Stufe: Der Sprung von Spalte zu Spalte am Rand ist nicht größer als im Original selbst.
  const sprung = (bild, x0, x1) => { let s = 0; for (let y = 0; y < H; y++) for (let c = 0; c < 3; c++) s += Math.abs(bild.d[(y * bild.w + x0) * 4 + c] - bild.d[(y * bild.w + x1) * 4 + c]); return s / (H * 3); };
  for (let x = 0; x < 6; x++) {
    assert.ok(sprung(naht, x, x + 1) <= sprung(ra, x, x + 1) + 0.6, `links Spalte ${x}: ${sprung(naht, x, x + 1)} gegen ${sprung(ra, x, x + 1)}`);
    const y = UE - 1 - x;
    assert.ok(sprung(naht, y, y - 1) <= sprung(rb, y, y - 1) + 0.6, `rechts Spalte ${y}`);
  }
  // Übergang ins Band: links schließt die Naht an A an, rechts B an die Naht. Gleicher Sprung wie im Foto.
  const vorher = ausschnitt(a, a.w - UE - 1, 1);
  const n0 = ausschnitt(naht, 0, 1);
  const a0 = ausschnitt(a, a.w - UE, 1);
  assert.deepEqual(n0.d, a0.d);
  assert.ok(vorher.d.length === n0.d.length);
});

test('Weicher Übergang: gleiche Streifen bleiben exakt, verschiedene laufen ohne Sprung ineinander', () => {
  const a = ausschnitt(foto(UE, 0.5, [120, 90, 60], [40, 30, 20], 6), 0, UE);
  const pfad = new Int32Array(H).fill(180);
  const gleich = ueberblenden(a, a, pfad);
  let ab = 0;
  for (let p = 0; p < a.d.length; p++) ab = Math.max(ab, Math.abs(gleich.d[p] - a.d[p]));
  assert.equal(ab, 0, 'A mit A überblendet ist A');
  // Flach 100 gegen flach 200: monoton, ohne Stufe, an den Rändern genau 100 und 200.
  const flach = (v) => ({ w: UE, h: 64, d: new Uint8ClampedArray(UE * 64 * 4).map((_, i) => (i % 4 === 3 ? 255 : v)) });
  const r = ueberblenden(flach(100), flach(200), new Int32Array(64).fill(120));
  const zeile = Array.from({ length: UE }, (_, x) => r.d[(32 * UE + x) * 4]);
  assert.equal(zeile[0], 100);
  assert.equal(zeile[UE - 1], 200);
  for (let x = 1; x < UE; x++) {
    assert.ok(zeile[x] >= zeile[x - 1], `monoton bei ${x}`);
    assert.ok(zeile[x] - zeile[x - 1] <= 2, `kein Sprung bei ${x}: ${zeile[x - 1]} → ${zeile[x]}`);
  }
});

test('Linien 2 % auseinander: nur in der Überlappung gebogen, ohne Stufe am Faden', () => {
  const a = foto(1296, 0.55, [140, 180, 220], [30, 70, 110], 7);
  const b = foto(2160, 0.53, [210, 190, 160], [90, 55, 35], 8);
  const kopie = new Uint8ClampedArray(b.d);
  const r = anschliessen(a, b, UE);
  assert.ok(r.biegung, 'Biegung erkannt');
  assert.ok(Math.abs(r.biegung.von - 0.53) < 0.01 && Math.abs(r.biegung.nach - 0.55) < 0.01, JSON.stringify(r.biegung));
  assert.deepEqual(b.d, kopie, 'das neue Foto selbst bleibt unverändert');
  // Am linken Rand liegt die Linie auf der Höhe von A, am rechten auf der von B ...
  assert.ok(Math.abs(linieBei(r.naht, 0, 30) - 0.55) < 0.004, `links ${linieBei(r.naht, 0, 30)}`);
  assert.ok(Math.abs(linieBei(r.naht, UE - 30, UE) - 0.53) < 0.004, `rechts ${linieBei(r.naht, UE - 30, UE)}`);
  // ... und am Faden gibt es keine Stufe: links und rechts davon fast dieselbe Höhe.
  const y = Math.round(0.54 * H);
  const p = r.pfad[y];
  const l = linieBei(r.naht, Math.max(0, p - 14), p - 2);
  const re = linieBei(r.naht, p + 2, Math.min(UE, p + 14));
  assert.ok(Math.abs(l - re) < 0.004, `Faden bei ${p}: links ${l}, rechts ${re}`);
});

test('Linien 4 % auseinander: nichts wird verbogen', () => {
  const a = foto(1296, 0.55, [140, 180, 220], [30, 70, 110], 1);
  const b = foto(1620, 0.51, [210, 190, 160], [90, 55, 35], 3);
  const r = anschliessen(a, b, UE);
  assert.equal(r.biegung, null);
  assert.equal(UEBERGANG.biegeMax, 0.03);
  assert.equal(bestesPaar([{ y: 0.5, staerke: 10, zeichen: 1 }], [{ y: 0.52, staerke: 10, zeichen: -1 }]), null, 'Richtung muss passen');
  assert.equal(bestesPaar([{ y: 0.5, staerke: 10, zeichen: 1 }], [{ y: 0.535, staerke: 10, zeichen: 1 }]), null, 'über 3 % nicht');
  assert.ok(bestesPaar([{ y: 0.5, staerke: 10, zeichen: 1 }], [{ y: 0.525, staerke: 10, zeichen: 1 }]), 'unter 3 % schon');
});

test('Keine Stelle im Bau ruft angleichen auf, zeilenGain nur für die Bewertung', () => {
  assert.equal(kern.angleichen, undefined);
  assert.equal(kern.naehen, undefined);
  assert.equal(kern.anschliessen, undefined);
  const dateien = [];
  const lauf = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) lauf(p); else if (p.endsWith('.mjs')) dateien.push(p); } };
  lauf(new URL('../src', import.meta.url).pathname);
  assert.ok(dateien.length > 20);
  for (const p of dateien) {
    const s = readFileSync(p, 'utf8');
    assert.ok(!/angleichen\s*\(/.test(s), `${p} ruft angleichen auf`);
    if (!p.endsWith('kern.mjs')) assert.ok(!/zeilenGain/.test(s), `${p} benutzt zeilenGain`);
  }
});
