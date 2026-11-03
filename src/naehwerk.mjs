// Aufnahme und Nähen. Regel: Rohbild zuerst in die Datenbank, erst dann alles andere.
import * as db from './speicher.mjs';
import { auftrag } from './rechner.mjs';
import { STANDARD } from './geometrie.mjs';
import { leinwand, ctx2d, pixel, ausPixel, alsBlob, ladeBitmap, freigeben, verkleinere, rendere } from './bild.mjs';
import { HALT_B, HALT_H, UEBER, KLEIN_B, KLEIN_H, KLEIN_UE, VORSCHAU_H, ROH_MAX } from './masse.mjs';
import { messung, protokolliere } from './diagnose.mjs';

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

// Speichert den Halt mit Rohbild. Kehrt erst zurück, wenn das Rohbild geschrieben und zurückgelesen ist.
// Scheitert das, wirft es db.NichtGesichert: Das Foto gilt dann nicht als gesichert.
export async function sichereRoh({ streckeId, index, quelle, roh, rohB, rohH }) {
  return db.neuerHalt({
    id: db.neueId(), streckeId, index, zeit: Date.now(), quelle,
    rohB, rohH, transform: { ...STANDARD },
  }, { roh });
}

// Ein Halt ohne Bild und ohne Rohbild lässt sich nicht mehr retten, nur löschen.
export const unrettbar = (h) => !!h && !h.bild && !h.roh;

async function blobZuLeinwand(blob) {
  const bm = await ladeBitmap(blob);
  try {
    const c = leinwand(bm.width, bm.height);
    ctx2d(c, true).drawImage(bm, 0, 0);
    return c;
  } finally {
    freigeben(bm);
  }
}

// Kleine Fassungen für den angezeigten Wert und den Sucher-Rest.
export function kleinRest(bildLeinwand) {
  const k = verkleinere(bildLeinwand, bildLeinwand.width, bildLeinwand.height, KLEIN_B, KLEIN_H);
  try {
    return pixel(k, KLEIN_B - KLEIN_UE, 0, KLEIN_UE, KLEIN_H);
  } finally {
    freigeben(k);
  }
}

export function kleinAnfang(bildLeinwand) {
  const k = verkleinere(bildLeinwand, bildLeinwand.width, bildLeinwand.height, KLEIN_B, KLEIN_H);
  try {
    return pixel(k, 0, 0, KLEIN_UE, KLEIN_H);
  } finally {
    freigeben(k);
  }
}

// Rechnet einen Halt fertig: Rahmen, Angleichung, Naht, Vorschauen, Wert.
// rohQuelle optional (schon dekodiertes Rohbild), spart Zeit direkt nach der Aufnahme. Sie gehört dem
// Aufrufer und wird hier nicht freigegeben. Alles andere wird freigegeben, auch wenn etwas scheitert.
export async function fertigstellen(halt, vorgaenger, { rohQuelle = null } = {}) {
  const t0 = performance.now();
  const frei = [];
  const merke = (x) => { if (x) frei.push(x); return x; };
  try {
    if (vorgaenger && !vorgaenger.bild) throw new Error('Vorgänger ist nicht fertig');
    const roh = rohQuelle || merke(await ladeBitmap(await db.blobPflicht(halt, 'roh')));
    const rw = halt.rohB || roh.width;
    const rh = halt.rohH || roh.height;
    const neuC = merke(rendere(roh, rw, rh, halt.transform || STANDARD, HALT_B, HALT_H));
    if (!rohQuelle) freigeben(roh); // früh freigeben, das Rohbild ist das größte Stück
    const felder = { pfad: null, wert: null, teile: null, beschaedigt: null };
    const dateien = { naht: null, nahtVorschau: null };
    let bildC = neuC;
    if (vorgaenger) {
      const letztesC = merke(await blobZuLeinwand(await db.blobPflicht(vorgaenger, 'bild')));
      const letztes = pixel(letztesC);
      const neues = pixel(neuC);
      freigeben(neuC);
      const r = await auftrag('anschliessen', { letztes, neues, ueberlappung: UEBER }, [letztes.d.buffer, neues.d.buffer]);
      bildC = merke(ausPixel(r.neu));
      const nahtC = merke(ausPixel(r.naht));
      dateien.naht = await alsBlob(nahtC, 'image/jpeg', 0.95);
      const nv = merke(verkleinere(nahtC, UEBER, HALT_H, Math.round((UEBER * VORSCHAU_H) / HALT_H), VORSCHAU_H));
      dateien.nahtVorschau = await alsBlob(nv, 'image/jpeg', 0.85);
      felder.pfad = r.pfad;
      const a = kleinRest(letztesC);
      const b = kleinAnfang(bildC);
      const w = await auftrag('analyse', { rest: a, kamera: b }, [a.d.buffer, b.d.buffer]);
      felder.wert = w.wert;
      felder.teile = w.teile;
    }
    dateien.bild = await alsBlob(bildC, 'image/jpeg', 0.92);
    const v = merke(verkleinere(bildC, HALT_B, HALT_H, Math.round((HALT_B * VORSCHAU_H) / HALT_H), VORSCHAU_H));
    dateien.vorschau = await alsBlob(v, 'image/jpeg', 0.85);
    const fertig = await db.aendereHalt(halt.id, felder, dateien);
    messung('naehen', performance.now() - t0);
    return fertig;
  } finally {
    for (const x of frei) freigeben(x);
  }
}

// Halt und Vorgänger frisch aus der Datenbank. Nie Blob-Objekte aus einer früheren Transaktion
// weiterverwenden: iOS kann sie nach dem Löschen des Quelldatensatzes womöglich nicht mehr lesen.
async function ausDb(haltId) {
  const halt = await db.halt(haltId);
  if (!halt) throw new Error('Halt fehlt in der Datenbank');
  if (halt.index === 0) return { halt, vor: null };
  const vor = (await db.halte(halt.streckeId)).find((h) => h.index === halt.index - 1) || null;
  if (!vor) throw new Error('Vorgänger fehlt in der Datenbank');
  return { halt, vor };
}

// Stellt einen Halt fertig, bei einem Fehler höchstens einmal automatisch neu (frisch gelesen).
export async function fertigstellenMitWiederholung(haltId, { versuche = 2, neu = false } = {}) {
  let letzter = null;
  for (let v = 1; v <= versuche; v++) {
    const { halt, vor } = await ausDb(haltId);
    if (halt.bild && !neu) return halt;
    try {
      return await fertigstellen(halt, vor);
    } catch (err) {
      letzter = err;
      protokolliere('naehen', `Versuch ${v} von ${versuche} für Halt ${halt.index + 1}: ${err && (err.stack || err.message) || err}`);
    }
  }
  throw letzter;
}

// Ohne Rohbild, aber mit Bild (etwa nach einem Umzug mit unlesbarem Rohbild): Fehlende Vorschau und
// Naht aus dem fertigen Bild nachrechnen. Das Bild selbst bleibt, wie es ist.
async function ausBildNachrechnen(halt, vor) {
  const frei = [];
  const merke = (x) => { if (x) frei.push(x); return x; };
  try {
    const bildC = merke(await blobZuLeinwand(await db.blobPflicht(halt, 'bild')));
    const felder = {};
    const dateien = {};
    if (!halt.vorschau) {
      const v = merke(verkleinere(bildC, bildC.width, bildC.height, Math.round((HALT_B * VORSCHAU_H) / HALT_H), VORSCHAU_H));
      dateien.vorschau = await alsBlob(v, 'image/jpeg', 0.85);
    }
    if (halt.index > 0 && !halt.naht && vor?.bild) {
      const letztesC = merke(await blobZuLeinwand(await db.blobPflicht(vor, 'bild')));
      const letztes = pixel(letztesC);
      const neues = pixel(bildC);
      const r = await auftrag('anschliessen', { letztes, neues, ueberlappung: UEBER }, [letztes.d.buffer, neues.d.buffer]);
      const nahtC = merke(ausPixel(r.naht));
      dateien.naht = await alsBlob(nahtC, 'image/jpeg', 0.95);
      const nv = merke(verkleinere(nahtC, UEBER, HALT_H, Math.round((UEBER * VORSCHAU_H) / HALT_H), VORSCHAU_H));
      dateien.nahtVorschau = await alsBlob(nv, 'image/jpeg', 0.85);
      felder.pfad = r.pfad;
      const a = kleinRest(letztesC);
      const b = kleinAnfang(bildC);
      const w = await auftrag('analyse', { rest: a, kamera: b }, [a.d.buffer, b.d.buffer]);
      felder.wert = w.wert;
      felder.teile = w.teile;
    }
    return await db.aendereHalt(halt.id, felder, dateien);
  } finally {
    for (const x of frei) freigeben(x);
  }
}

// Rechnet alles nach, was sich nachrechnen lässt: fehlendes Bild aus dem Rohbild, fehlende Vorschau
// oder Naht aus dem Rohbild oder ersatzweise aus dem Bild. Unrettbare Halte (weder Bild noch Rohbild)
// bleiben stehen und werden in der App zum Löschen angeboten. Scheitert ein Halt, geht es mit dem
// nächsten weiter; geliefert wird die Zahl der ausgebesserten und der gescheiterten Halte.
export async function ausbessern(streckeId) {
  const ids = (await db.halte(streckeId)).map((h) => h.id);
  let ausgebessert = 0;
  let gescheitert = 0;
  for (const id of ids) {
    try {
      const { halt: h, vor } = await ausDb(id);
      if (unrettbar(h)) continue;
      const nahtFehlt = h.index > 0 && !h.naht;
      if (h.bild && h.vorschau && !nahtFehlt) continue;
      if (vor && !vor.bild) continue; // Vorgänger erst retten oder löschen
      if (h.roh) await fertigstellenMitWiederholung(id, { neu: true });
      else await ausBildNachrechnen(h, vor);
      ausgebessert++;
    } catch (err) {
      gescheitert++;
      protokolliere('ausbessern', err);
    }
  }
  return { ausgebessert, gescheitert };
}

// Halte mit Rohbild, aber ohne fertiges Bild, werden der Reihe nach nachgerechnet.
// Scheitert einer, bricht es ab: Alle späteren hängen von ihm ab.
export async function offeneFertigstellen(streckeId, { versuche = 2 } = {}) {
  const offen = (await db.halte(streckeId)).filter((h) => !h.bild && h.roh).map((h) => h.id);
  for (const id of offen) await fertigstellenMitWiederholung(id, { versuche });
  return offen.length > 0;
}
