// Vorher und nachher: Paare werden auch bei starker Bearbeitung gefunden, vorher ist das flachere Bild.
import test from 'node:test';
import assert from 'node:assert/strict';
import { merkmal, paareFinden, vnZustand, paarDauer } from '../src/vorhernachher.mjs';

const W = 60;
const H = 80;
// Szene: Horizont auf Höhe h, Kreis an (cx, cy). Bearbeitung: Kontrast und Farbe.
function bild({ h = 0.5, cx = 0.3, cy = 0.3, kontrast = 1, warm = 0 }) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = y / H < h ? 170 : 70;
    if (Math.hypot(x / W - cx, (y / H - cy) * 1.3) < 0.12) v = 230;
    v = 128 + (v - 128) * kontrast;
    const i = (y * W + x) * 4;
    d[i] = v + warm; d[i + 1] = v; d[i + 2] = v - warm; d[i + 3] = 255;
  }
  return merkmal(d, W, H);
}

test('Paare: Bearbeitung zählt nicht, die Szene schon; vorher ist flacher', () => {
  const m = [
    bild({ h: 0.4, cx: 0.7, kontrast: 0.6 }), // A vorher
    bild({ h: 0.65, cx: 0.2, cy: 0.7, kontrast: 1.4, warm: 30 }), // B nachher
    bild({ h: 0.4, cx: 0.7, kontrast: 1.5, warm: 40 }), // A nachher
    bild({ h: 0.65, cx: 0.2, cy: 0.7, kontrast: 0.5 }), // B vorher
    bild({ h: 0.2, cx: 0.5, cy: 0.8, kontrast: 1 }), // ohne Partner
  ];
  const { paare, rest } = paareFinden(m);
  assert.equal(paare.length, 2);
  assert.deepEqual(paare.map((p) => [p.vorher, p.nachher]).sort(), [[0, 2], [3, 1]].sort());
  assert.deepEqual(rest, [4]);
});

test('Zeitplan: erst vorher, dann Wischen, dann nachher, je Paar', () => {
  assert.deepEqual(vnZustand(0.2, 2), { k: 0, linie: 0 });
  assert.equal(vnZustand(paarDauer() - 0.1, 2).linie, 1);
  const mitte = vnZustand(1.1 + 0.65, 2);
  assert.ok(mitte.linie > 0.4 && mitte.linie < 0.6);
  assert.equal(vnZustand(paarDauer() + 0.1, 2).k, 1);
  assert.equal(vnZustand(100, 2).k, 1);
});
