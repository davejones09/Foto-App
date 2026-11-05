// Musik: Tempo und Lage der Schläge an erzeugter Musik, Raster.
import test from 'node:test';
import assert from 'node:assert/strict';
import { schlaegeErkennen, schnittRaster, rasterSchlaege } from '../src/musik.mjs';

const RATE = 22050;

function zufall(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 2;
}

// Einfacher Track: Bass-Kick auf jedem Schlag, Hi-Hat dazwischen, Akkordteppich, leichtes Rauschen.
function track({ bpm, sek = 40, versatz = 0.13, hat = true, teppich = true, seed = 3, schwanken = 0 }) {
  const n = sek * RATE;
  const a = new Float32Array(n);
  const r = zufall(seed);
  const schlaege = [];
  let t = versatz;
  let k = 0;
  while (t < sek - 0.3) {
    schlaege.push(t);
    const start = Math.round(t * RATE);
    for (let i = 0; i < 0.16 * RATE && start + i < n; i++) {
      const x = i / RATE;
      a[start + i] += 0.9 * Math.sin(2 * Math.PI * (55 + 80 * Math.exp(-x * 30)) * x) * Math.exp(-x * 18);
    }
    if (hat) {
      const halb = Math.round((t + 30 / bpm) * RATE);
      for (let i = 0; i < 0.03 * RATE && halb + i < n; i++) a[halb + i] += 0.2 * r() * Math.exp((-i / RATE) * 120);
    }
    k++;
    t += (60 / bpm) * (1 + schwanken * Math.sin(k / 9));
  }
  for (let i = 0; i < n; i++) {
    const x = i / RATE;
    if (teppich) a[i] += 0.12 * (Math.sin(2 * Math.PI * 220 * x) + Math.sin(2 * Math.PI * 277 * x) + Math.sin(2 * Math.PI * 330 * x)) / 3;
    a[i] += 0.01 * r();
  }
  return { a, schlaege };
}

function trefferQuote(gefunden, echt, tol = 0.05) {
  let t = 0;
  for (const e of echt) if (gefunden.some((g) => Math.abs(g - e) <= tol)) t++;
  return t / echt.length;
}

for (const bpm of [80, 97, 120, 128, 150]) {
  test(`Erkennt ${bpm} BPM und trifft die Schläge`, () => {
    const { a, schlaege } = track({ bpm });
    const t0 = performance.now();
    const r = schlaegeErkennen(a, RATE);
    const ms = performance.now() - t0;
    assert.ok(Math.abs(r.bpm - bpm) < 2.5, `${r.bpm} statt ${bpm}`);
    assert.ok(r.sicher);
    const q = trefferQuote(r.schlaege, schlaege.slice(4));
    assert.ok(q > 0.9, `Trefferquote ${q}`);
    assert.ok(ms < 2000, `${ms} ms`);
  });
}

test('Leicht schwankendes Tempo wird mitverfolgt', () => {
  const { a, schlaege } = track({ bpm: 110, schwanken: 0.015 });
  const r = schlaegeErkennen(a, RATE);
  const q = trefferQuote(r.schlaege, schlaege.slice(4), 0.06);
  assert.ok(q > 0.85, `Trefferquote ${q}`);
});

test('Rauschen ohne Takt gilt als unsicher', () => {
  const r0 = zufall(9);
  const a = Float32Array.from({ length: 20 * RATE }, () => 0.2 * r0());
  assert.equal(schlaegeErkennen(a, RATE).sicher, false);
});

test('Zu kurze Musik ergibt keine Schläge', () => {
  assert.deepEqual(schlaegeErkennen(new Float32Array(RATE), RATE).schlaege, []);
});

test('Raster: ab Musikstart und nur jeder n-te Schlag', () => {
  const s = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  assert.deepEqual(schnittRaster(s, 0, 1), [0.5, 1, 1.5, 2, 2.5, 3]);
  assert.deepEqual(schnittRaster(s, 1, 1), [0.5, 1, 1.5, 2]);
  assert.deepEqual(schnittRaster(s, 0, 2), [1, 2, 3]);
  assert.equal(rasterSchlaege(10, 120).length, 20);
});
