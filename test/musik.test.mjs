// Musik: Tempo und Lage der Schläge an erzeugter Musik, Raster.
import test from 'node:test';
import assert from 'node:assert/strict';
import { schlaegeErkennen, rasterSchlaege, trefferFinden, schnittStellen, monoKlein, tonAusschnitt, spitze } from '../src/musik.mjs';

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

test('schnittStellen: ohne Akzente das Raster ab dem Musikstart', () => {
  const s = [0.5, 1, 1.5, 2, 2.5, 3];
  assert.deepEqual(schnittStellen(s, [], 0, 1).map((x) => x.t), s);
  assert.deepEqual(schnittStellen(s, [], 1, 1).map((x) => x.t), [0.5, 1, 1.5, 2]);
});

test('schnittStellen: zählt ab dem stärksten Schlag und zieht auf den Akzent', () => {
  const s = [0.5, 1, 1.5, 2, 2.5, 3];
  const treffer = [{ t: 1.03, s: 1 }, { t: 2, s: 1 }, { t: 3, s: 1 }, { t: 0.5, s: 0.1 }, { t: 1.5, s: 0.1 }];
  const r = schnittStellen(s, treffer, 0, 2);
  assert.deepEqual(r.map((x) => x.t), [1.03, 2, 3]);
  assert.equal(r[0].s, 1);
});

test('schnittStellen: starker Akzent neben dem Raster kommt dazu', () => {
  const r = schnittStellen([1, 2, 3], [{ t: 1.75, s: 0.9 }, { t: 2.3, s: 0.2 }], 0, 1);
  assert.deepEqual(r.map((x) => x.t), [1, 1.75, 2, 3]);
});

test('trefferFinden: Schläge auch im Off-Takt, zeitlich genau, Kick stärker als Hi-Hat', () => {
  const n = RATE * 10;
  const a = new Float32Array(n);
  const r = zufall(5);
  for (let i = 0; i < n; i++) a[i] = 0.01 * r();
  const kicks = [1, 1.75, 2.5, 3, 4, 4.75, 5.5, 6, 7, 7.75, 8.5, 9];
  const kick = (t) => { const o = Math.round(t * RATE); for (let i = 0; i < RATE * 0.15 && o + i < n; i++) a[o + i] += 0.8 * Math.exp(-i / (RATE * 0.04)) * Math.sin((2 * Math.PI * 70 * i) / RATE); };
  const hat = (t) => { const o = Math.round(t * RATE); for (let i = 0; i < RATE * 0.03 && o + i < n; i++) a[o + i] += 0.1 * Math.exp(-i / (RATE * 0.008)) * r(); };
  kicks.forEach(kick);
  [1.25, 2.25, 3.25, 4.25, 5.25, 6.25].forEach(hat);
  const t = trefferFinden(a, RATE);
  for (const k of kicks) {
    const h = t.find((x) => Math.abs(x.t - k) < 0.03);
    assert.ok(h, `Kick bei ${k} fehlt: ${t.map((x) => x.t.toFixed(2))}`);
    assert.ok(h.s > 0.4, `Kick bei ${k} zu schwach: ${h.s}`);
  }
  const hh = t.find((x) => Math.abs(x.t - 2.25) < 0.03);
  if (hh) assert.ok(hh.s < 0.5, `Hi-Hat zu stark: ${hh.s}`);
});

test('tonAusschnitt: richtige Stelle, Stereo aus Mono, weiches Ende, Rest still', () => {
  const q = new Float32Array(48000 * 4);
  q.fill(0.5, 48000 * 2); // laut ab Sekunde 2
  const [l, r] = tonAusschnitt([q], 48000, 1, 2, 48000);
  assert.equal(l.length, 96000);
  assert.deepEqual(l.subarray(48000, 48010), r.subarray(48000, 48010));
  assert.equal(l[47999], 0);
  assert.equal(l[48001], 0.5);
  assert.ok(l[95999] < 0.01, 'Ende ausgeblendet');
  const kurz = tonAusschnitt([q], 48000, 3.5, 2, 48000)[0];
  assert.equal(kurz[47000], 0, 'hinter dem Ende still');
});

test('tonAusschnitt: andere Quellrate, Tonhöhe bleibt', () => {
  const n = 44100 * 2;
  const q = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 441 * i) / 44100));
  const [z] = tonAusschnitt([q, q], 44100, 0, 1, 48000);
  let wechsel = 0;
  for (let i = 1; i < 24000; i++) if (z[i - 1] < 0 && z[i] >= 0) wechsel++;
  assert.ok(Math.abs(wechsel - 220) <= 2, `${wechsel} Durchgänge in 0,5 s`);
  assert.ok(spitze([z]) > 0.9);
});

test('monoKlein: mittelt die Kanäle und passt die Länge an', () => {
  const a = new Float32Array(48000).fill(1);
  const b = new Float32Array(48000).fill(0);
  const m = monoKlein([a, b], 48000, 22050);
  assert.equal(m.length, 22050);
  assert.ok(Math.abs(m[100] - 0.5) < 1e-6);
});
