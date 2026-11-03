// Serie: Fotos auf kleiner Fassung vorbereiten (Ausschnitte, Motivschutz, Kantenmerkmale) und
// Ausschnitte in Transformationen für den Halt umrechnen. Die Rechnung selbst steht in serie.mjs.
import { fotoKandidaten, kantenMerkmale, KB, KH } from './serie.mjs';
import { leinwand, ctx2d, pixel, ladeBitmap, freigeben, verkleinere } from './bild.mjs';
import { fuellmass, begrenze } from './geometrie.mjs';
import { blob as ladeDatei, blobPflicht } from './speicher.mjs';

export const VORSCHAU_LANG = 480; // längste Seite der Arbeitsfassung je Foto
const MOTIV_LANG = 64;

const klein = leinwand(KB, KH);
const kleinCtx = ctx2d(klein, true);
kleinCtx.imageSmoothingQuality = 'high';

function proxyVon(quelle, w, h, lang) {
  const f = Math.min(1, lang / Math.max(w, h));
  return verkleinere(quelle, w, h, Math.max(1, Math.round(w * f)), Math.max(1, Math.round(h * f)));
}

// quelle: Canvas oder Bitmap des Rohbilds. Liefert die Arbeitsfassung und alle Kandidaten.
export function vorbereiten(quelle) {
  const proxy = proxyVon(quelle, quelle.width, quelle.height, VORSCHAU_LANG);
  const motiv = proxyVon(proxy, proxy.width, proxy.height, MOTIV_LANG);
  const motivBild = pixel(motiv);
  freigeben(motiv);
  const kandidaten = fotoKandidaten(proxy.width, proxy.height, motivBild, (a) => {
    kleinCtx.drawImage(proxy, a.x, a.y, a.w, a.h, 0, 0, KB, KH);
    return pixel(klein);
  });
  return { proxy, kandidaten };
}

// Arbeitsfassung aus dem gesicherten Rohbild eines Serienfotos.
export async function vorbereitenAusDb(rec) {
  const bm = await ladeBitmap(await blobPflicht(rec, 'roh'));
  try {
    return vorbereiten(bm);
  } finally {
    freigeben(bm);
  }
}

// Rechte Kante des letzten Halts: der feste Start der Serie.
export async function startMerkmale(halt) {
  const b = halt?.bild ? await ladeDatei(halt, 'bild') : null;
  if (!b) return null;
  const bm = await ladeBitmap(b);
  const c = verkleinere(bm, bm.width, bm.height, KB, KH);
  freigeben(bm);
  const m = kantenMerkmale(pixel(c)).rechts;
  freigeben(c);
  return m;
}

// Ausschnitt (in Koordinaten der Arbeitsfassung) als Transformation des Rohbilds.
export function transformFuer(a, proxy, rohB, rohH) {
  const k = proxy.width / rohB;
  const cx = (a.x + a.w / 2) / k;
  const cy = (a.y + a.h / 2) / k;
  const s = fuellmass(rohB, rohH) * a.zoom;
  return begrenze({ dx: -s * (cx - rohB / 2), dy: -s * (cy - rohH / 2), zoom: a.zoom, drehung: 0 }, rohB, rohH);
}

export function zeichneAusschnitt(canvas, proxy, a) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round((r.width || 64) * dpr));
  const h = Math.max(1, Math.round((r.height || 80) * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const k = ctx2d(canvas);
  k.imageSmoothingQuality = 'high';
  k.drawImage(proxy, a.x, a.y, a.w, a.h, 0, 0, w, h);
}
