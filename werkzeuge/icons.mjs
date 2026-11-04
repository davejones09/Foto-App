// Erzeugt App-Icons und Startbilder als PNG: zwei Fotoflächen, die nahtlos ineinander übergehen,
// der Horizont läuft durch. Neutrales dunkles Grau, keine Schrift. Start: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ZIEL = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(ZIEL, { recursive: true });

const GRUND = [0x11, 0x12, 0x13];
const GRUND_HELL = [0x1b, 0x1c, 0x1f];
// Links kühl, rechts warm. Oben Himmel, unten Boden.
const LINKS_OBEN = [0xb9, 0xc8, 0xdc];
const LINKS_UNTEN = [0x4b, 0x5a, 0x6e];
const RECHTS_OBEN = [0xe2, 0xd6, 0xc2];
const RECHTS_UNTEN = [0x6f, 0x5e, 0x4c];

const crcTab = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => { let c = ~0; for (const x of b) c = crcTab[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };

function chunk(typ, daten) {
  const l = Buffer.alloc(4); l.writeUInt32BE(daten.length);
  const td = Buffer.concat([Buffer.from(typ), daten]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
}

function png(w, h, pixel) {
  const roh = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    roh[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x + 0.5, y + 0.5);
      const i = y * (w * 3 + 1) + 1 + x * 3;
      roh[i] = r; roh[i + 1] = g; roh[i + 2] = b;
    }
  }
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(w, 0); kopf.writeUInt32BE(h, 4);
  kopf[8] = 8; kopf[9] = 2; kopf[10] = 0; kopf[11] = 0; kopf[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', kopf),
    chunk('IDAT', deflateSync(roh, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const klemme = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const weich = (t) => { const u = klemme(t); return u * u * (3 - 2 * u); };
const misch = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const rund = (c) => c.map((v) => Math.round(klemme(v, 0, 255)));

// Abgerundetes Rechteck: Deckung 0..1 mit weicher Kante (1 Pixel).
function rechteck(x, y, x0, y0, x1, y1, r) {
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
  const d = Math.hypot(dx, dy) - r;
  const innen = Math.min(x - x0, x1 - x, y - y0, y1 - y);
  return dx > 0 && dy > 0 ? klemme(0.5 - d) : klemme(innen + 0.5);
}

// Das Zeichen: ein Band aus zwei Fotos. s = Größe des Zeichens, (cx, cy) = Mitte.
function zeichen(cx, cy, s) {
  const x0 = cx - s * 0.5;
  const x1 = cx + s * 0.5;
  const y0 = cy - s * 0.3;
  const y1 = cy + s * 0.3;
  const horizont = cy + s * 0.04;
  const naht = (y) => cx + s * 0.035 * Math.sin(((y - y0) / (y1 - y0)) * Math.PI * 1.6 + 0.4);
  const breite = s * 0.16; // weicher Übergang
  return (x, y) => {
    const a = rechteck(x, y, x0, y0, x1, y1, s * 0.07);
    if (a <= 0) return null;
    const t = weich((x - naht(y) + breite / 2) / breite);
    const oben = misch(LINKS_OBEN, RECHTS_OBEN, t);
    const unten = misch(LINKS_UNTEN, RECHTS_UNTEN, t);
    // Himmel hellt nach oben auf, Boden dunkelt nach unten ab, die Kante ist weich (1 Pixel)
    const kante = klemme((y - horizont) + 0.5);
    const himmel = misch(oben, [255, 255, 255], 0.25 * klemme((horizont - y) / (horizont - y0)));
    const boden = misch(unten, [0, 0, 0], 0.25 * klemme((y - horizont) / (y1 - horizont)));
    return { farbe: misch(himmel, boden, kante), a };
  };
}

function icon(gr) {
  const z = zeichen(gr * 0.5, gr * 0.5, gr * 0.62);
  return png(gr, gr, (x, y) => {
    const grund = misch(GRUND_HELL, GRUND, klemme(y / gr));
    const p = z(x, y);
    return rund(p ? misch(grund, p.farbe, p.a) : grund);
  });
}

function splash(w, h) {
  const z = zeichen(w * 0.5, h * 0.5, w * 0.26);
  return png(w, h, (x, y) => {
    const p = z(x, y);
    return rund(p ? misch(GRUND, p.farbe, p.a) : GRUND);
  });
}

for (const [name, gr] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) {
  writeFileSync(join(ZIEL, name), icon(gr));
}
for (const [w, h] of [[750, 1334], [828, 1792], [1125, 2436], [1242, 2688], [1170, 2532], [1179, 2556], [1284, 2778], [1290, 2796], [1206, 2622], [1320, 2868]]) {
  writeFileSync(join(ZIEL, `splash-${w}x${h}.png`), splash(w, h));
}
console.log('Icons geschrieben nach', ZIEL);
