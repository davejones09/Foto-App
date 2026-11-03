// Erzeugt App-Icons und Startbilder als PNG: gelber Faden auf fast Schwarz.
// Start: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ZIEL = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(ZIEL, { recursive: true });

const GRUND = [0x0e, 0x0f, 0x10];
const GRUND_LINKS = [0x15, 0x17, 0x19];
const GELB = [0xff, 0xd4, 0x00];

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

const misch = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));

// Faden als Kurve x = mx + a·sin(...) zwischen y0 und y1, Breite in Pixeln.
function faden(mx, y0, y1, a, breite) {
  const p = (y1 - y0) / 1.6;
  const fx = (y) => mx + a * Math.sin(((y - y0) / p) * 2 * Math.PI + 0.6) + a * 0.35 * Math.sin(((y - y0) / p) * 5.1 * Math.PI);
  const fd = (y) => (fx(y + 0.5) - fx(y - 0.5));
  return (x, y) => {
    if (y < y0 - breite || y > y1 + breite) return 0;
    const yy = Math.min(y1, Math.max(y0, y));
    const d = Math.abs(x - fx(yy)) / Math.sqrt(1 + fd(yy) ** 2) + Math.max(0, Math.abs(y - yy));
    return Math.min(1, Math.max(0, breite / 2 - d + 0.5));
  };
}

function icon(gr, rand = 0) {
  const f = faden(gr * 0.5, -gr * 0.05, gr * 1.05, gr * 0.06, gr * 0.04);
  return png(gr, gr, (x, y) => {
    const links = x < gr * 0.5 + gr * 0.06 * Math.sin(((y + gr * 0.05) / (gr * 1.1 / 1.6)) * 2 * Math.PI + 0.6);
    const grund = links ? GRUND_LINKS : GRUND;
    return misch(grund, GELB, f(x, y));
  });
}

function splash(w, h) {
  const l = w * 0.2;
  const f = faden(w * 0.5, h * 0.5 - l / 2, h * 0.5 + l / 2, w * 0.02, w * 0.014);
  return png(w, h, (x, y) => misch(GRUND, GELB, f(x, y)));
}

for (const [name, gr] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) {
  writeFileSync(join(ZIEL, name), icon(gr));
}
for (const [w, h] of [[750, 1334], [828, 1792], [1125, 2436], [1242, 2688], [1170, 2532], [1179, 2556], [1284, 2778], [1290, 2796], [1206, 2622], [1320, 2868]]) {
  writeFileSync(join(ZIEL, `splash-${w}x${h}.png`), splash(w, h));
}
console.log('Icons geschrieben nach', ZIEL);
