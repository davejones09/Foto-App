// Aufnahme und Nähen. Regel: Rohbild zuerst in die Datenbank, erst dann alles andere.
import * as db from './speicher.mjs';
import { auftrag } from './rechner.mjs';
import { STANDARD } from './geometrie.mjs';
import { leinwand, ctx2d, pixel, ausPixel, alsBlob, ladeBild, freigeben, verkleinere, rendere, raumVon, HALT_Q } from './bild.mjs';
import { HALT_B, HALT_H, UEBER, KLEIN_H, KLEIN_UE, VORSCHAU_H, ROH_MAX, breiteVon } from './masse.mjs';
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
  const blob = await alsBlob(c, 'image/jpeg', HALT_Q);
  return { blob, w, h, leinwand: c };
}

// Speichert den Halt mit Rohbild. Kehrt erst zurück, wenn das Rohbild geschrieben und zurückgelesen ist.
// Scheitert das, wirft es db.NichtGesichert: Das Foto gilt dann nicht als gesichert.
// farbraum: in welchem Farbraum das Rohbild vorliegt ('srgb' oder 'display-p3'), profil: was die Datei mitbrachte.
export async function sichereRoh({ streckeId, index, quelle, roh, rohB, rohH, farbraum = 'srgb', profil = null }) {
  return db.neuerHalt({
    id: db.neueId(), streckeId, index, zeit: Date.now(), quelle,
    rohB, rohH, breite: HALT_B, transform: { ...STANDARD }, farbraum, profil,
  }, { roh });
}

// Verfahren 2: Fotos unverändert, weicher Übergang nur in der Überlappung. Ältere Halte haben kein Feld.
export const VERFAHREN = 2;
export const raumHalt = (h) => (h && h.farbraum) || 'srgb';
export const raumNaht = (h) => (h && h.nahtFarbraum) || raumHalt(h);

// Ein Halt ohne Bild und ohne Rohbild lässt sich nicht mehr retten, nur löschen.
export const unrettbar = (h) => !!h && !h.bild && !h.roh;

async function blobZuLeinwand(blob, farbraum = 'srgb') {
  const bm = await ladeBild(blob, farbraum);
  if (bm instanceof HTMLCanvasElement) return bm;
  try {
    const c = leinwand(bm.width, bm.height, farbraum);
    ctx2d(c, true).drawImage(bm, 0, 0);
    return c;
  } finally {
    freigeben(bm);
  }
}

// Kleine Fassungen für den angezeigten Wert und den Sucher-Rest: der 363 Pixel breite Streifen
// am rechten bzw. linken Rand, auf 27 × 120. Gilt für jede Halt-Breite.
function kleinStreifen(bildLeinwand, rechts) {
  const w = bildLeinwand.width;
  const h = bildLeinwand.height;
  const sw = (UEBER * h) / HALT_H;
  const k = verkleinere(bildLeinwand, w, h, KLEIN_UE, KLEIN_H, rechts ? w - sw : 0, 0, sw, h, 'srgb');
  try {
    return pixel(k);
  } finally {
    freigeben(k);
  }
}

export const kleinRest = (bildLeinwand) => kleinStreifen(bildLeinwand, true);
export const kleinAnfang = (bildLeinwand) => kleinStreifen(bildLeinwand, false);

// Randstreifen (UEBER breit) einer Leinwand im Farbraum raum. Gleicher Farbraum: Pixel genau so, wie sie sind.
function randStreifen(c, rechts, raum, frei) {
  const x = rechts ? c.width - UEBER : 0;
  if (raumVon(c) === raum) return pixel(c, x, 0, UEBER, c.height);
  const s = leinwand(UEBER, c.height, raum);
  frei.push(s);
  ctx2d(s, true).drawImage(c, x, 0, UEBER, c.height, 0, 0, UEBER, c.height);
  return pixel(s);
}

// Naht zwischen dem fertigen Bild des Vorgängers und dem neuen Bild. Beide Leinwände bleiben, wie sie sind:
// Der Worker bekommt nur Kopien der beiden Randstreifen und schickt nur die Naht zurück.
// Die Naht rechnet in Display P3, sobald eines der beiden Fotos P3 ist.
export async function nahtZwischen(vorC, neuC, frei = []) {
  const raum = raumVon(vorC) === 'display-p3' || raumVon(neuC) === 'display-p3' ? 'display-p3' : 'srgb';
  const letztes = randStreifen(vorC, true, raum, frei);
  const neues = randStreifen(neuC, false, raum, frei);
  const r = await auftrag('anschliessen', { letztes, neues, ueberlappung: UEBER }, [letztes.d.buffer, neues.d.buffer]);
  const nahtC = ausPixel(r.naht, raum);
  frei.push(nahtC);
  const dateien = { naht: await alsBlob(nahtC, 'image/jpeg', HALT_Q) };
  const nv = verkleinere(nahtC, UEBER, HALT_H, Math.round((UEBER * VORSCHAU_H) / HALT_H), VORSCHAU_H);
  frei.push(nv);
  dateien.nahtVorschau = await alsBlob(nv, 'image/jpeg', 0.85);
  const a = kleinRest(vorC);
  const b = kleinAnfang(neuC);
  const w = await auftrag('analyse', { rest: a, kamera: b }, [a.d.buffer, b.d.buffer]);
  return { dateien, felder: { pfad: r.pfad, wert: w.wert, teile: w.teile, nahtFarbraum: raum, biegung: r.biegung || null }, nahtC };
}

// Rechnet einen Halt fertig: Rahmen, Naht, Vorschauen, Wert. Das Foto selbst wird nur gerahmt
// (Ausschnitt und Maßstab) und bleibt sonst, wie es ist: keine Farbangleichung, nichts verbogen.
// rohQuelle optional (schon dekodiertes Rohbild), spart Zeit direkt nach der Aufnahme. Sie gehört dem
// Aufrufer und wird hier nicht freigegeben. Alles andere wird freigegeben, auch wenn etwas scheitert.
export async function fertigstellen(halt, vorgaenger, { rohQuelle = null } = {}) {
  const t0 = performance.now();
  const frei = [];
  const merke = (x) => { if (x) frei.push(x); return x; };
  try {
    if (vorgaenger && !vorgaenger.bild) throw new Error('Vorgänger ist nicht fertig');
    const raum = raumHalt(halt);
    const roh = rohQuelle || merke(await ladeBild(await db.blobPflicht(halt, 'roh'), raum));
    const rw = halt.rohB || roh.width;
    const rh = halt.rohH || roh.height;
    const breite = breiteVon(halt);
    const bildC = merke(rendere(roh, rw, rh, halt.transform || STANDARD, breite, HALT_H, breite, raum));
    if (!rohQuelle) freigeben(roh); // früh freigeben, das Rohbild ist das größte Stück
    const felder = { pfad: null, wert: null, teile: null, beschaedigt: null, nahtFarbraum: null, biegung: null, verfahren: VERFAHREN };
    const dateien = { naht: null, nahtVorschau: null };
    if (vorgaenger) {
      const letztesC = merke(await blobZuLeinwand(await db.blobPflicht(vorgaenger, 'bild'), raumHalt(vorgaenger)));
      const n = await nahtZwischen(letztesC, bildC, frei);
      Object.assign(felder, n.felder);
      Object.assign(dateien, n.dateien);
    }
    dateien.bild = await alsBlob(bildC, 'image/jpeg', HALT_Q);
    const v = merke(verkleinere(bildC, bildC.width, HALT_H, Math.round((bildC.width * VORSCHAU_H) / HALT_H), VORSCHAU_H));
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
  if (!halt) throw new Error('Foto fehlt in der Datenbank');
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
      protokolliere('naehen', `Versuch ${v} von ${versuche} für Foto ${halt.index + 1}: ${err && (err.stack || err.message) || err}`);
    }
  }
  throw letzter;
}

// Ohne Rohbild, aber mit Bild (etwa nach einem Umzug mit unlesbarem Rohbild): Fehlende Vorschau und
// Naht aus dem fertigen Bild nachrechnen. Das Bild selbst bleibt, wie es ist.
async function ausBildNachrechnen(halt, vor, { nahtNeu = false } = {}) {
  const frei = [];
  const merke = (x) => { if (x) frei.push(x); return x; };
  try {
    const bildC = merke(await blobZuLeinwand(await db.blobPflicht(halt, 'bild'), raumHalt(halt)));
    const felder = {};
    const dateien = {};
    if (!halt.vorschau) {
      const v = merke(verkleinere(bildC, bildC.width, bildC.height, Math.round((bildC.width * VORSCHAU_H) / bildC.height), VORSCHAU_H));
      dateien.vorschau = await alsBlob(v, 'image/jpeg', 0.85);
    }
    if (halt.index > 0 && (nahtNeu || !halt.naht) && vor?.bild) {
      const letztesC = merke(await blobZuLeinwand(await db.blobPflicht(vor, 'bild'), raumHalt(vor)));
      const n = await nahtZwischen(letztesC, bildC, frei);
      Object.assign(felder, n.felder);
      Object.assign(dateien, n.dateien);
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

// Halte, die noch mit Farbangleichung genäht sind (vor Verfahren 2). Der erste Halt hatte nie eine.
export const altGenaeht = (halte) => halte.filter((h) => h.index > 0 && h.bild && h.verfahren !== VERFAHREN);

// Rechnet eine Strecke mit dem heutigen Verfahren neu, nur auf ausdrücklichen Wunsch (nach Rückfrage).
// Halte mit Rohbild bekommen Bild und Naht neu, das Bild ist danach das unveränderte Original.
// Halte ohne Rohbild behalten ihr Bild und bekommen nur die Naht neu. Scheitert einer, bleibt er, wie
// er war (aendereHalt schreibt erst, wenn alles gerechnet ist), und es geht mit dem nächsten weiter.
export async function neuNaehen(streckeId, { fortschritt } = {}) {
  const ids = (await db.halte(streckeId)).map((h) => h.id);
  let gescheitert = 0;
  for (let i = 0; i < ids.length; i++) {
    try {
      const { halt, vor } = await ausDb(ids[i]);
      if (halt.index === 0 && halt.bild && halt.verfahren === VERFAHREN) { /* nichts zu tun */ }
      else if (halt.roh) await fertigstellenMitWiederholung(ids[i], { neu: true });
      else if (halt.bild && vor?.bild) await ausBildNachrechnen(halt, vor, { nahtNeu: true });
    } catch (err) {
      gescheitert++;
      protokolliere('neu-naehen', err);
    }
    fortschritt?.((i + 1) / ids.length);
  }
  return { gescheitert };
}

// Halte mit Rohbild, aber ohne fertiges Bild, werden der Reihe nach nachgerechnet.
// Scheitert einer, bricht es ab: Alle späteren hängen von ihm ab.
export async function offeneFertigstellen(streckeId, { versuche = 2 } = {}) {
  const offen = (await db.halte(streckeId)).filter((h) => !h.bild && h.roh).map((h) => h.id);
  for (const id of offen) await fertigstellenMitWiederholung(id, { versuche });
  return offen.length > 0;
}
