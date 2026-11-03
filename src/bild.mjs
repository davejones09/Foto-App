// Hilfen rund um Canvas, Blobs und Pixel.
// Jede Leinwand kennt ihren Farbraum (c.farbraum, 'srgb' oder 'display-p3'). Alle Zwischenstufen eines
// Fotos laufen im Farbraum des Fotos, damit beim Rechnen nichts still nach sRGB umgerechnet wird.
import { zeichneTransformiert } from './geometrie.mjs';
import { farbTest, setzeProfil, displayP3Profil, iccAusJpeg } from './farbe.mjs';

// JPEG-Qualität der Halte (Rohbild und fertiges Bild). Vorschauen dürfen gröber sein.
export const HALT_Q = 0.95;

export function leinwand(w, h, farbraum = 'srgb') {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.farbraum = farbraum;
  return c;
}

export const raumVon = (x) => (x && x.farbraum) || 'srgb';

export function ctx2d(c, lesen = false) {
  const opt = { colorSpace: raumVon(c) };
  if (lesen) opt.willReadFrequently = true;
  return c.getContext('2d', opt);
}

export const pixel = (c, x = 0, y = 0, w = c.width, h = c.height) => {
  const raum = raumVon(c);
  const d = ctx2d(c, true).getImageData(x, y, w, h, { colorSpace: raum });
  return { w, h, d: d.data, farbraum: raum };
};

function bilddaten(d, w, h, raum) {
  try { return new ImageData(d, w, h, { colorSpace: raum }); } catch { return new ImageData(d, w, h); }
}

export function ausPixel(b, farbraum = b.farbraum || 'srgb') {
  const c = leinwand(b.w, b.h, farbraum);
  ctx2d(c).putImageData(bilddaten(new Uint8ClampedArray(b.d.buffer || b.d, b.d.byteOffset || 0, b.w * b.h * 4), b.w, b.h, farbraum), 0, 0);
  return c;
}

function kodiere(c, typ, q) {
  return new Promise((ok, fehler) => {
    c.toBlob((b) => (b ? ok(b) : fehler(new Error('Bild ließ sich nicht kodieren'))), typ, q);
  });
}

// Kodiert eine Leinwand. Bei Display P3 bekommt das JPEG sicher sein Profil: Schreibt toBlob es
// nicht selbst (farbTest), setzt die App es ein.
export async function alsBlob(c, typ = 'image/jpeg', q = 0.92) {
  const b = await kodiere(c, typ, q);
  if (raumVon(c) !== 'display-p3' || typ !== 'image/jpeg') return b;
  const t = await farbTest();
  if (t.speichern !== 'nachgesetzt') return b;
  const bytes = new Uint8Array(await b.arrayBuffer());
  if (iccAusJpeg(bytes)) return b;
  return new Blob([setzeProfil(bytes, displayP3Profil())], { type: 'image/jpeg' });
}

export const ladeBitmap = (blob) => createImageBitmap(blob);

function bildElement(blob) {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Bild nicht lesbar')); };
    img.src = url;
  });
}

// Dekodiert ein gespeichertes Bild im gewünschten Farbraum. sRGB wie bisher über createImageBitmap.
// Display P3 über ein Bild-Element in eine P3-Leinwand: Das ist überall farbrichtig, ImageBitmap nicht sicher.
export async function ladeBild(blob, farbraum = 'srgb') {
  if (farbraum !== 'display-p3') return createImageBitmap(blob);
  const img = await bildElement(blob);
  const c = leinwand(img.naturalWidth, img.naturalHeight, 'display-p3');
  ctx2d(c).drawImage(img, 0, 0);
  img.src = '';
  return c;
}

export function freigeben(x) {
  if (!x) return;
  if (typeof x.close === 'function') x.close();
  else if (x.width !== undefined) { x.width = 0; x.height = 0; }
}

// Verkleinert schrittweise (höchstens halbieren je Schritt), damit nichts flimmert.
// Alle Stufen im Farbraum farbraum (Vorgabe: der der Quelle).
export function verkleinere(quelle, qw, qh, zw, zh, sx = 0, sy = 0, sw = qw, sh = qh, farbraum = raumVon(quelle)) {
  let akt = quelle;
  let aw = sw;
  let ah = sh;
  let ax = sx;
  let ay = sy;
  const zwischen = [];
  while (aw / 2 > zw && ah / 2 > zh) {
    const nw = Math.round(aw / 2);
    const nh = Math.round(ah / 2);
    const c = leinwand(nw, nh, farbraum);
    const k = ctx2d(c);
    k.imageSmoothingQuality = 'high';
    k.drawImage(akt, ax, ay, aw, ah, 0, 0, nw, nh);
    zwischen.push(c);
    akt = c; aw = nw; ah = nh; ax = 0; ay = 0;
  }
  const c = leinwand(zw, zh, farbraum);
  const k = ctx2d(c, true);
  k.imageSmoothingQuality = 'high';
  k.drawImage(akt, ax, ay, aw, ah, 0, 0, zw, zh);
  zwischen.forEach(freigeben);
  return c;
}

// Rendert ein Rohbild mit Transformation in den Rahmen B×H. Bei großer Verkleinerung über Zwischenstufe.
// Ergebnis im Farbraum farbraum (Vorgabe: der der Quelle).
export function rendere(quelle, rw, rh, t, B, H, bezugB = undefined, farbraum = raumVon(quelle)) {
  const s = Math.max(B / rw, H / rh) * t.zoom;
  if (s < 0.45) {
    // Zwischenstufe: erst grob, aber sauber verkleinern, dann transformieren.
    const f = Math.min(1, (s * 2.2));
    const zw = Math.max(1, Math.round(rw * f));
    const zh = Math.max(1, Math.round(rh * f));
    const z = verkleinere(quelle, rw, rh, zw, zh, 0, 0, rw, rh, farbraum);
    const c = leinwand(B, H, farbraum);
    const k = ctx2d(c, true);
    k.imageSmoothingQuality = 'high';
    zeichneTransformiert(k, z, zw, zh, t, B, H, bezugB);
    freigeben(z);
    return c;
  }
  const c = leinwand(B, H, farbraum);
  const k = ctx2d(c, true);
  k.imageSmoothingQuality = 'high';
  zeichneTransformiert(k, quelle, rw, rh, t, B, H, bezugB);
  return c;
}
