// Serie: Arbeitsfassung je Foto, Rahmen (ganzes Foto, nur außerhalb 0,7 bis 2:1 um das Motiv
// beschnitten), Kantenmerkmale des vollen Rahmens und Zeichnen für Vorschau und Feinjustieren.
// Die Rechnung selbst steht in serie.mjs.
import { kantenMerkmale, motivKarte, motivSetzen, zuschnitt, KH, KUE, MOTIV, SEITE_MIN, SEITE_MAX } from './serie.mjs';
import { leinwand, ctx2d, pixel, ladeBitmap, freigeben, verkleinere } from './bild.mjs';
import { fuellmass, begrenze, zeichneTransformiert, STANDARD } from './geometrie.mjs';
import { blob as ladeDatei, blobPflicht } from './speicher.mjs';
import { HALT_H, breiteFuerSeite } from './masse.mjs';

export const VORSCHAU_LANG = MOTIV.lang; // Arbeitsfassung, zugleich Fassung der Motivkarte (640)

function proxyVon(quelle, w, h, lang) {
  const f = Math.min(1, lang / Math.max(w, h));
  return verkleinere(quelle, w, h, Math.max(1, Math.round(w * f)), Math.max(1, Math.round(h * f)));
}

// quelle: Canvas oder Bitmap des Rohbilds.
export function vorbereiten(quelle) {
  return { proxy: proxyVon(quelle, quelle.width, quelle.height, VORSCHAU_LANG) };
}

export async function vorbereitenAusDb(rec) {
  const bm = await ladeBitmap(await blobPflicht(rec, 'roh'));
  try {
    return vorbereiten(bm);
  } finally {
    freigeben(bm);
  }
}

export const imRahmen = (rohB, rohH) => rohB / rohH >= SEITE_MIN - 1e-9 && rohB / rohH <= SEITE_MAX + 1e-9;

// Transformation für ein Rechteck der Arbeitsfassung (Zoom 1, nur verschoben).
function transformFuerRechteck(z, proxy, rohB, rohH, breite) {
  const k = proxy.width / rohB;
  const cx = (z.x + z.w / 2) / k;
  const cy = (z.y + z.h / 2) / k;
  const s = fuellmass(rohB, rohH, breite, HALT_H);
  return begrenze({ dx: -s * (cx - rohB / 2), dy: -s * (cy - rohH / 2), zoom: 1, drehung: 0 }, rohB, rohH, breite, HALT_H);
}

// Rahmen eines Serienfotos. Standard ist das ganze Foto, ungezoomt. Nur außerhalb von 0,7 bis 2:1
// wird beschnitten, dann um das Motiv herum (Motivkarte oder per Antippen gesetzter Punkt).
// motivFoto: Punkt in Anteilen des ganzen Fotos oder null.
export function rahmen(proxy, rohB, rohH, motivFoto = null) {
  const breite = breiteFuerSeite(rohB / rohH);
  if (imRahmen(rohB, rohH)) return { breite, transform: { ...STANDARD }, beschnitten: false };
  let karte = motivKarte(pixel(proxy));
  if (motivFoto) karte = motivSetzen(karte, motivFoto);
  const z = zuschnitt(proxy.width, proxy.height, karte);
  return { breite, transform: transformFuerRechteck(z, proxy, rohB, rohH, breite), beschnitten: true };
}

// Kantenmerkmale des vollen Rahmens: kleine Fassung mit 120 Zeilen, Breite nach Seitenverhältnis.
export function merkmale(proxy, breite, t) {
  const kw = Math.max(2 * KUE, Math.round((KH * breite) / HALT_H));
  const c = leinwand(kw, KH);
  try {
    const k = ctx2d(c, true);
    k.imageSmoothingQuality = 'high';
    zeichneTransformiert(k, proxy, proxy.width, proxy.height, t, kw, KH, breite);
    return kantenMerkmale(pixel(c));
  } finally {
    freigeben(c);
  }
}

// Rechte Kante des letzten Halts: der feste Start der Serie.
export async function startMerkmale(halt) {
  const b = halt?.bild ? await ladeDatei(halt, 'bild') : null;
  if (!b) return null;
  const bm = await ladeBitmap(b);
  const c = verkleinere(bm, bm.width, bm.height, Math.max(2 * KUE, Math.round((KH * bm.width) / bm.height)), KH);
  freigeben(bm);
  try {
    return kantenMerkmale(pixel(c)).rechts;
  } finally {
    freigeben(c);
  }
}

// Punkt im Rahmen (Anteile) als Punkt im ganzen Foto (Anteile): Umkehrung der Transformation.
export function rahmenZuFoto(punkt, rohB, rohH, breite, t) {
  const s = fuellmass(rohB, rohH, breite, HALT_H) * t.zoom;
  const x = (punkt.x * breite - breite / 2 - t.dx) / s + rohB / 2;
  const y = (punkt.y * HALT_H - HALT_H / 2 - t.dy) / s + rohH / 2;
  return { x: Math.min(1, Math.max(0, x / rohB)), y: Math.min(1, Math.max(0, y / rohH)) };
}

// Zeichnet den Rahmen in eine Leinwand (Größe aus CSS), mit gesetztem Motiv als Ring.
export function zeichneRahmen(canvas, proxy, breite, t, motiv = null) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round((r.width || 64) * dpr));
  const h = Math.max(1, Math.round((r.height || 80) * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const k = ctx2d(canvas);
  k.imageSmoothingQuality = 'high';
  k.fillStyle = '#000';
  k.fillRect(0, 0, w, h);
  zeichneTransformiert(k, proxy, proxy.width, proxy.height, t, w, h, breite);
  if (motiv) {
    k.strokeStyle = '#ffd400';
    k.lineWidth = 2 * dpr;
    k.beginPath();
    k.arc(motiv.x * w, motiv.y * h, Math.max(6, 0.06 * Math.min(w, h) * 2), 0, Math.PI * 2);
    k.stroke();
  }
}
