// Tagesrückblick: aus vielen Fotos und Clips eine gute Auswahl. Schärfe zählt, fast gleiche Bilder fliegen raus,
// Clips und Fotos bleiben gemischt, am Ende in der Reihenfolge des Tages.
import { merkmal, aehnlich } from './vorhernachher.mjs';

async function vorschauVon(d) {
  if (d.type.startsWith('image/')) return createImageBitmap(d, { resizeWidth: 96, resizeHeight: 128, resizeQuality: 'medium' });
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = URL.createObjectURL(d);
  try {
    await new Promise((ok, nein) => { v.onloadeddata = ok; v.onerror = nein; setTimeout(nein, 8000); });
    v.currentTime = Math.min(1, (v.duration || 2) / 2);
    await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 3000); });
    return await createImageBitmap(v, { resizeWidth: 96, resizeHeight: 128 });
  } finally {
    URL.revokeObjectURL(v.src);
  }
}

// Schärfe: mittlere Stärke der Kanten in der kleinen Fassung.
export function schaerfe(d, w, h) {
  let s = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    const l = (k) => 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
    s += Math.abs(4 * l(i) - l(i - 4) - l(i + 4) - l(i - w * 4) - l(i + w * 4));
  }
  return s / ((w - 2) * (h - 2));
}

// Auswahl aus bewerteten Kandidaten: { punkte, m, zeit, clip }. Reine Rechnung.
export function auswaehlen(kandidaten, anzahl, { doppelt = 0.86 } = {}) {
  const sortiert = kandidaten.map((k, i) => ({ ...k, i })).sort((a, b) => b.punkte - a.punkte);
  const wahl = [];
  for (const k of sortiert) {
    if (wahl.length >= anzahl) break;
    if (wahl.some((w) => aehnlich(w.m, k.m) > doppelt)) continue;
    wahl.push(k);
  }
  return wahl.sort((a, b) => a.zeit - b.zeit || a.i - b.i).map((k) => k.i);
}

export async function auswahlTreffen(dateien, { anzahl = 10, fortschritt = null } = {}) {
  if (dateien.length <= anzahl) return [...dateien].sort((a, b) => a.lastModified - b.lastModified);
  const c = new OffscreenCanvas(96, 128);
  const k = c.getContext('2d', { willReadFrequently: true });
  const kandidaten = [];
  for (const [i, d] of dateien.entries()) {
    fortschritt?.(i + 1, dateien.length);
    try {
      const b = await vorschauVon(d);
      k.drawImage(b, 0, 0, 96, 128);
      b.close?.();
      const px = k.getImageData(0, 0, 96, 128).data;
      const clip = !d.type.startsWith('image/');
      kandidaten.push({ datei: d, m: merkmal(px, 96, 128), punkte: schaerfe(px, 96, 128) * (clip ? 1.25 : 1), zeit: d.lastModified || 0, clip });
    } catch {
      // nicht lesbar: nicht dabei
    }
  }
  return auswaehlen(kandidaten, anzahl).map((i) => kandidaten[i].datei);
}
