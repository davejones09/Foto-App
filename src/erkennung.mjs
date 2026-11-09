// Erkennung von Menschen und Fahrzeugen auf dem Gerät: MediaPipe Image Segmenter mit DeepLab v3
// (Apache-2.0, 21 Klassen). Wird erst geladen, wenn eine Funktion sie braucht. Nichts verlässt das Gerät.
export const KLASSEN = ['hintergrund', 'flugzeug', 'fahrrad', 'vogel', 'boot', 'flasche', 'bus', 'auto', 'katze', 'stuhl', 'kuh', 'tisch', 'hund', 'pferd', 'motorrad', 'mensch', 'pflanze', 'schaf', 'sofa', 'zug', 'bildschirm'];
export const FAHRZEUGE = new Set([1, 2, 4, 6, 7, 14, 19]);
export const MENSCHEN = new Set([15]);
import { ladeClip, suche, clipWeg, zeichneQuelle, spitzeFinden } from './clipreel.mjs';

const BASIS = new URL('../vendor/erkennung/', import.meta.url).href;

let laden = null;
export function erkenner() {
  if (!laden) {
    laden = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('../vendor/erkennung/vision_bundle.mjs');
      const fs = await FilesetResolver.forVisionTasks(BASIS.replace(/\/$/, ''));
      return ImageSegmenter.createFromOptions(fs, {
        baseOptions: { modelAssetPath: `${BASIS}deeplab_v3.tflite`, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    })();
    laden.catch(() => { laden = null; });
  }
  return laden;
}

// Maske eines Bilds: Klasse je Pixel in kleiner Auflösung (das Modell rechnet intern mit 257 × 257).
export async function segmentiere(bild) {
  const s = await erkenner();
  const r = s.segment(bild);
  try {
    const m = r.categoryMask;
    return { w: m.width, h: m.height, klasse: m.getAsUint8Array().slice() };
  } finally {
    r.close?.();
  }
}

// Anteil des Bilds, den eine Klassengruppe bedeckt.
export function anteil(maske, gruppe) {
  let n = 0;
  for (const k of maske.klasse) if (gruppe.has(k)) n++;
  return n / maske.klasse.length;
}

// Maske als Leinwand in Bildgröße: deckend, wo die Gruppe ist, mit weicher Kante.
export function maskenLeinwand(maske, gruppe, W, H) {
  const c = new OffscreenCanvas(maske.w, maske.h);
  const k = c.getContext('2d');
  const d = k.createImageData(maske.w, maske.h);
  for (let i = 0; i < maske.klasse.length; i++) {
    const an = gruppe.has(maske.klasse[i]);
    d.data[i * 4 + 3] = an ? 255 : 0;
  }
  k.putImageData(d, 0, 0);
  const aus = new OffscreenCanvas(W, H);
  const a = aus.getContext('2d');
  a.filter = `blur(${Math.max(1.5, W / 140).toFixed(1)}px)`;
  a.drawImage(c, 0, 0, W, H);
  a.filter = 'none';
  return aus;
}

export const VORDERGRUND = new Set(KLASSEN.map((_, i) => i).filter((i) => i > 0));
const GRUPPE = { fahrzeug: FAHRZEUGE, stehen: VORDERGRUND };

// Für den Maler (clipreel.mjs): Maske des Vordergrunds in der Größe der Quelle, oder null, wenn kaum etwas da ist.
export async function vordergrundMaske(quelle, art) {
  const gruppe = GRUPPE[art] || VORDERGRUND;
  const m = await segmentiere(quelle);
  if (anteil(m, gruppe) < 0.01) return null;
  return maskenLeinwand(m, gruppe, quelle.width, quelle.height);
}

// Bild eines Mediums im Rahmen des Reels, klein, für die Erkennung.
function rahmenBild(quelle, qw, qh, m) {
  const c = new OffscreenCanvas(144, 256);
  const k = c.getContext('2d');
  k.translate(72, 128);
  zeichneQuelle(k, quelle, qw, qh, 144, 256, m.rahmen);
  return c;
}

// Sucht im Clip den Moment, in dem ein Fahrzeug am meisten vom Bild bedeckt.
// Liefert { t, anteil, aus } (Zeit im Clip) oder null. fort(0..1) meldet den Fortschritt.
export async function fahrzeugSuchen(m, fort = () => {}) {
  await erkenner();
  const v = await ladeClip(m.url);
  try {
    const von = m.start || 0;
    // Gesucht wird nur im gewählten Teil des Clips, damit man Fehlgriffe einfach wegschneiden kann.
    const bis = Math.max(von + 0.2, Math.min(v.duration - 0.05, m.wechsel?.bis ?? m.ende ?? v.duration));
    const schritt = Math.max(0.12, (bis - von) / 70);
    const proben = [];
    for (let t = von; t <= bis + 1e-6; t += schritt) {
      await suche(v, t);
      const mk = await segmentiere(rahmenBild(v, v.videoWidth, v.videoHeight, m));
      proben.push({ t, a: anteil(mk, FAHRZEUGE) });
      fort((t - von) / (bis - von));
    }
    // Rund um die Spitze genauer nachsehen.
    const grob = spitzeFinden(proben, { zeitEnde: v.duration });
    if (!grob) return null;
    for (let t = Math.max(von, grob.t - schritt); t <= Math.min(bis, grob.t + schritt); t += schritt / 4) {
      await suche(v, t);
      const mk = await segmentiere(rahmenBild(v, v.videoWidth, v.videoHeight, m));
      proben.push({ t, a: anteil(mk, FAHRZEUGE) });
    }
    proben.sort((x, y) => x.t - y.t);
    const r = spitzeFinden(proben, { zeitEnde: v.duration });
    return r && { ...r, bis };
  } finally {
    clipWeg(v);
  }
}

// Gibt es im letzten Bild etwas, das stehen bleiben kann? Anteil des Vordergrunds (Menschen zählen voll).
export async function vordergrundIm(bild, m) {
  const mk = await segmentiere(rahmenBild(bild, bild.videoWidth || bild.width, bild.videoHeight || bild.height, m));
  return anteil(mk, VORDERGRUND);
}
