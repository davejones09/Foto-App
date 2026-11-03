// Aufnahme und Nähen. Regel: Rohbild zuerst in die Datenbank, erst dann alles andere.
import * as db from './speicher.mjs';
import { auftrag } from './rechner.mjs';
import { STANDARD } from './geometrie.mjs';
import { leinwand, ctx2d, pixel, ausPixel, alsBlob, ladeBitmap, freigeben, verkleinere, rendere } from './bild.mjs';
import { HALT_B, HALT_H, UEBER, KLEIN_B, KLEIN_H, KLEIN_UE, VORSCHAU_H, ROH_MAX } from './masse.mjs';
import { messung } from './diagnose.mjs';

// Volles Videobild (längste Seite höchstens ROH_MAX) als JPEG.
export async function rohAusVideo(video) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const f = Math.min(1, ROH_MAX / Math.max(vw, vh));
  const w = Math.round(vw * f);
  const h = Math.round(vh * f);
  const c = leinwand(w, h);
  ctx2d(c).drawImage(video, 0, 0, w, h);
  const blob = await alsBlob(c, 'image/jpeg', 0.95);
  return { blob, w, h, leinwand: c };
}

// Speichert den Halt mit Rohbild. Kehrt erst zurück, wenn die Transaktion abgeschlossen ist.
export async function sichereRoh({ streckeId, index, quelle, roh, rohB, rohH }) {
  return db.neuerHalt({
    id: db.neueId(), streckeId, index, zeit: Date.now(), quelle,
    roh, rohB, rohH, transform: { ...STANDARD },
    bild: null, naht: null, vorschau: null, nahtVorschau: null, pfad: null,
    wert: null, teile: null, name: '',
  });
}

async function blobZuLeinwand(blob) {
  const bm = await ladeBitmap(blob);
  const c = leinwand(bm.width, bm.height);
  ctx2d(c, true).drawImage(bm, 0, 0);
  freigeben(bm);
  return c;
}

// Kleine Fassungen für den angezeigten Wert und den Sucher-Rest.
export function kleinRest(bildLeinwand) {
  const k = verkleinere(bildLeinwand, bildLeinwand.width, bildLeinwand.height, KLEIN_B, KLEIN_H);
  const p = pixel(k, KLEIN_B - KLEIN_UE, 0, KLEIN_UE, KLEIN_H);
  freigeben(k);
  return p;
}

export function kleinAnfang(bildLeinwand) {
  const k = verkleinere(bildLeinwand, bildLeinwand.width, bildLeinwand.height, KLEIN_B, KLEIN_H);
  const p = pixel(k, 0, 0, KLEIN_UE, KLEIN_H);
  freigeben(k);
  return p;
}

// Rechnet einen Halt fertig: Rahmen, Angleichung, Naht, Vorschauen, Wert.
// rohQuelle optional (schon dekodiertes Rohbild), spart Zeit direkt nach der Aufnahme.
export async function fertigstellen(halt, vorgaenger, { rohQuelle = null } = {}) {
  const t0 = performance.now();
  let roh = rohQuelle;
  let eigen = false;
  if (!roh) { roh = await ladeBitmap(halt.roh); eigen = true; }
  const rw = halt.rohB || roh.width;
  const rh = halt.rohH || roh.height;
  const neuC = rendere(roh, rw, rh, halt.transform || STANDARD, HALT_B, HALT_H);
  if (eigen) freigeben(roh);
  const felder = { naht: null, nahtVorschau: null, pfad: null, wert: null, teile: null };
  let bildC = neuC;
  if (vorgaenger) {
    if (!vorgaenger.bild) throw new Error('Vorgänger ist nicht fertig');
    const letztesC = await blobZuLeinwand(vorgaenger.bild);
    const letztes = pixel(letztesC);
    const neues = pixel(neuC);
    const r = await auftrag('anschliessen', { letztes, neues, ueberlappung: UEBER }, [letztes.d.buffer, neues.d.buffer]);
    freigeben(neuC);
    bildC = ausPixel(r.neu);
    const nahtC = ausPixel(r.naht);
    felder.naht = await alsBlob(nahtC, 'image/jpeg', 0.95);
    const nv = verkleinere(nahtC, UEBER, HALT_H, Math.round((UEBER * VORSCHAU_H) / HALT_H), VORSCHAU_H);
    felder.nahtVorschau = await alsBlob(nv, 'image/jpeg', 0.85);
    freigeben(nv);
    freigeben(nahtC);
    felder.pfad = r.pfad;
    const a = kleinRest(letztesC);
    const b = kleinAnfang(bildC);
    freigeben(letztesC);
    const w = await auftrag('analyse', { rest: a, kamera: b }, [a.d.buffer, b.d.buffer]);
    felder.wert = w.wert;
    felder.teile = w.teile;
  }
  felder.bild = await alsBlob(bildC, 'image/jpeg', 0.92);
  const v = verkleinere(bildC, HALT_B, HALT_H, Math.round((HALT_B * VORSCHAU_H) / HALT_H), VORSCHAU_H);
  felder.vorschau = await alsBlob(v, 'image/jpeg', 0.85);
  freigeben(v);
  freigeben(bildC);
  const fertig = await db.aendereHalt(halt.id, felder);
  messung('naehen', performance.now() - t0);
  return fertig;
}

// Beim Start: Halte mit Rohbild, aber ohne fertiges Bild, werden nachgerechnet.
export async function offeneFertigstellen(streckeId) {
  const l = await db.halte(streckeId);
  let geaendert = false;
  for (let i = 0; i < l.length; i++) {
    if (!l[i].bild && l[i].roh) {
      l[i] = await fertigstellen(l[i], i > 0 ? l[i - 1] : null);
      geaendert = true;
    }
  }
  return geaendert;
}
