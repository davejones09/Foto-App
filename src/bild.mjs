// Hilfen rund um Canvas, Blobs und Pixel.
import { zeichneTransformiert } from './geometrie.mjs';

export function leinwand(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c, lesen = false) {
  return c.getContext('2d', lesen ? { willReadFrequently: true } : undefined);
}

export const pixel = (c, x = 0, y = 0, w = c.width, h = c.height) => {
  const d = ctx2d(c, true).getImageData(x, y, w, h);
  return { w, h, d: d.data };
};

export function ausPixel(b) {
  const c = leinwand(b.w, b.h);
  ctx2d(c).putImageData(new ImageData(new Uint8ClampedArray(b.d.buffer || b.d, b.d.byteOffset || 0, b.w * b.h * 4), b.w, b.h), 0, 0);
  return c;
}

export function alsBlob(c, typ = 'image/jpeg', q = 0.92) {
  return new Promise((ok, fehler) => {
    c.toBlob((b) => (b ? ok(b) : fehler(new Error('Bild ließ sich nicht kodieren'))), typ, q);
  });
}

export const ladeBitmap = (blob) => createImageBitmap(blob);

export function freigeben(x) {
  if (!x) return;
  if (typeof x.close === 'function') x.close();
  else if (x.width !== undefined) { x.width = 0; x.height = 0; }
}

// Verkleinert schrittweise (höchstens halbieren je Schritt), damit nichts flimmert.
export function verkleinere(quelle, qw, qh, zw, zh, sx = 0, sy = 0, sw = qw, sh = qh) {
  let akt = quelle;
  let aw = sw;
  let ah = sh;
  let ax = sx;
  let ay = sy;
  const zwischen = [];
  while (aw / 2 > zw && ah / 2 > zh) {
    const nw = Math.round(aw / 2);
    const nh = Math.round(ah / 2);
    const c = leinwand(nw, nh);
    const k = ctx2d(c);
    k.imageSmoothingQuality = 'high';
    k.drawImage(akt, ax, ay, aw, ah, 0, 0, nw, nh);
    zwischen.push(c);
    akt = c; aw = nw; ah = nh; ax = 0; ay = 0;
  }
  const c = leinwand(zw, zh);
  const k = ctx2d(c, true);
  k.imageSmoothingQuality = 'high';
  k.drawImage(akt, ax, ay, aw, ah, 0, 0, zw, zh);
  zwischen.forEach(freigeben);
  return c;
}

// Rendert ein Rohbild mit Transformation in den Rahmen B×H. Bei großer Verkleinerung über Zwischenstufe.
export function rendere(quelle, rw, rh, t, B, H) {
  const s = Math.max(B / rw, H / rh) * t.zoom;
  if (s < 0.45) {
    // Zwischenstufe: erst grob, aber sauber verkleinern, dann transformieren.
    const f = Math.min(1, (s * 2.2));
    const zw = Math.max(1, Math.round(rw * f));
    const zh = Math.max(1, Math.round(rh * f));
    const z = verkleinere(quelle, rw, rh, zw, zh);
    const c = leinwand(B, H);
    const k = ctx2d(c, true);
    k.imageSmoothingQuality = 'high';
    zeichneTransformiert(k, z, zw, zh, t, B, H);
    freigeben(z);
    return c;
  }
  const c = leinwand(B, H);
  const k = ctx2d(c, true);
  k.imageSmoothingQuality = 'high';
  zeichneTransformiert(k, quelle, rw, rh, t, B, H);
  return c;
}
