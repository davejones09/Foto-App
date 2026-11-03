// Ausgaben: Karussell, Gesamtbild, Reel (und Fahrt fürs Finale), Sicherung. Alles über den LRU-Lader, mit Fortschritt.
import { Kachellager, zeichneBand } from './band.mjs';
import { stuecke, stueckeIm, bandBreite, HALT_B, HALT_H, UEBER } from './masse.mjs';
import {
  kennzahlen, karussellAnzahl, KARUSSELL_B, KARUSSELL_H,
  fahrtPlan, FAHRT_B, FAHRT_H, FAHRT_FPS, gesamtGroesse, endstationLayout,
} from './kennzahlen.mjs';
import { leinwand, ctx2d, alsBlob, freigeben } from './bild.mjs';
import { T, f } from './texte.mjs';
import { datumKurz } from './ui.mjs';
import { packe, entpacke, pruefe } from './zip.mjs';
import * as db from './speicher.mjs';
import { APP_VERSION } from './version.mjs';

export class Abgebrochen extends Error {}

// Abbruch, sobald die App in den Hintergrund geht.
export function hintergrundWaechter() {
  const w = { ab: false };
  const fn = () => { if (document.hidden) w.ab = true; };
  document.addEventListener('visibilitychange', fn);
  w.ende = () => document.removeEventListener('visibilitychange', fn);
  w.pruefe = () => { if (w.ab) throw new Abgebrochen(); };
  return w;
}

const kurz = () => new Promise((ok) => setTimeout(ok, 0));

// Lädt alle Bitmaps eines Bandbereichs und zeichnet ihn dann.
async function zeichneBereich(ctx, halte, lager, { s, x0, w, h }) {
  const n = halte.length;
  const noetig = stueckeIm(n, x0, x0 + w / s);
  await Promise.all(noetig.map((st) => lager.hole(halte[st.halt], st.art)));
  zeichneBand(ctx, halte, lager, { s, x0, y0: 0, w, h });
}

export function endstationText(strecke, halte) {
  const k = kennzahlen(halte);
  return [
    T.endstation,
    strecke.name,
    halte.length ? f(T.endZeitraum, { von: datumKurz(halte[0].zeit), bis: datumKurz(halte[halte.length - 1].zeit) }) : '',
    f(T.endHalte, { n: halte.length, p: k.p ?? '–' }),
  ];
}

// Endstation in einen Bereich zeichnen (x, y, Breite, Höhe des Bildes), linksbündig.
function zeichneEndstation(ctx, zeilen, x, mitteY, groesse, maxBreite = groesse * 14) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd400';
  ctx.fillRect(x, mitteY - groesse * 2.6, groesse * 2.2, groesse * 0.22);
  ctx.font = `700 ${groesse * 1.15}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(zeilen[0], x, mitteY - groesse * 1.1, maxBreite);
  ctx.fillStyle = '#dfe1e3';
  ctx.font = `600 ${groesse * 0.8}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(zeilen[1], x, mitteY + groesse * 0.1, maxBreite);
  ctx.fillStyle = '#8d9297';
  ctx.font = `400 ${groesse * 0.6}px ui-monospace, Menlo, monospace`;
  ctx.fillText(zeilen[2], x, mitteY + groesse * 1.1, maxBreite);
  ctx.fillText(zeilen[3], x, mitteY + groesse * 1.9, maxBreite);
  ctx.restore();
}

// --- Karussell: 1296×1620-Ausschnitte des Bands als 1080×1350 JPEG ---
export async function karussell(strecke, halte, { fortschritt, waechter } = {}) {
  const n = halte.length;
  const breite = bandBreite(n);
  const anzahl = karussellAnzahl(n);
  const s = KARUSSELL_B / HALT_B;
  const lager = new Kachellager(6);
  const c = leinwand(KARUSSELL_B, KARUSSELL_H);
  const ctx = ctx2d(c);
  ctx.imageSmoothingQuality = 'high';
  const bilder = [];
  try {
    for (let k = 0; k < anzahl; k++) {
      waechter?.pruefe();
      const x0 = k * HALT_B;
      ctx.fillStyle = '#0e0f10';
      ctx.fillRect(0, 0, KARUSSELL_B, KARUSSELL_H);
      await zeichneBereich(ctx, halte, lager, { s, x0, w: KARUSSELL_B, h: KARUSSELL_H });
      if (k === anzahl - 1) {
        // Das Ende läuft in den dunklen Grund aus, dahinter die Endstation.
        const ende = (breite - x0) * s;
        const ausVon = Math.max(0, Math.min(ende - 140, KARUSSELL_B * 0.55));
        const g = ctx.createLinearGradient(ausVon, 0, Math.max(ausVon + 1, ende), 0);
        g.addColorStop(0, 'rgba(14,15,16,0)');
        g.addColorStop(1, 'rgba(14,15,16,1)');
        ctx.fillStyle = g;
        ctx.fillRect(ausVon, 0, KARUSSELL_B - ausVon, KARUSSELL_H);
        ctx.fillStyle = '#0e0f10';
        ctx.fillRect(Math.round(ende), 0, KARUSSELL_B, KARUSSELL_H);
        const textX = Math.max(ende + 30, KARUSSELL_B * 0.6);
        zeichneEndstation(ctx, endstationText(strecke, halte), textX, KARUSSELL_H / 2, Math.min(40, (KARUSSELL_B - textX) / 8), KARUSSELL_B - textX - 24);
      }
      bilder.push(await alsBlob(c, 'image/jpeg', 0.92));
      fortschritt?.((k + 1) / anzahl);
      await kurz();
    }
  } finally {
    lager.leeren();
    freigeben(c);
  }
  return bilder;
}

// --- Gesamtbild ---
let grenzeCache = null;
// Größte Canvas-Fläche, die tatsächlich funktioniert: Pixel zeichnen und zurücklesen.
export function canvasGrenze(bedarf) {
  const SICHER = 16_777_216;
  if (bedarf <= SICHER) return SICHER;
  if (grenzeCache) return grenzeCache;
  for (const fl of [Math.min(bedarf, 33_554_432), SICHER]) {
    const w = Math.min(32767, Math.ceil(Math.sqrt(fl * 24)));
    const h = Math.max(1, Math.floor(fl / w));
    const c = leinwand(w, h);
    let ok = false;
    try {
      const k = c.getContext('2d');
      if (k) {
        k.fillStyle = '#ff0000';
        k.fillRect(w - 1, h - 1, 1, 1);
        ok = k.getImageData(w - 1, h - 1, 1, 1).data[0] === 255;
      }
    } catch { ok = false; }
    freigeben(c);
    if (ok) { grenzeCache = fl; return fl; }
  }
  return SICHER;
}

export function gesamtPlan(n) {
  const voll = bandBreite(n) * HALT_H;
  return gesamtGroesse(n, canvasGrenze(voll));
}

export async function gesamtbild(halte, { fortschritt, waechter } = {}) {
  const plan = gesamtPlan(halte.length);
  const c = leinwand(plan.b, plan.h);
  const ctx = ctx2d(c);
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#0e0f10';
  ctx.fillRect(0, 0, plan.b, plan.h);
  const lager = new Kachellager(2);
  const s = plan.h / HALT_H;
  try {
    const teile = stuecke(halte.length);
    for (let i = 0; i < teile.length; i++) {
      waechter?.pruefe();
      const st = teile[i];
      const bm = await lager.hole(halte[st.halt], st.art);
      const f = bm.width / (st.art === 'naht' ? UEBER : HALT_B);
      const links = Math.round(st.x * s);
      const rechts = Math.round((st.x + st.sw) * s);
      ctx.drawImage(bm, st.sx * f, 0, st.sw * f, bm.height, links, 0, rechts - links, plan.h);
      fortschritt?.(Math.min(0.95, (i + 1) / teile.length));
      await kurz();
    }
    const blob = await alsBlob(c, 'image/jpeg', 0.9);
    fortschritt?.(1);
    return { blob, ...plan };
  } finally {
    lager.leeren();
    freigeben(c);
  }
}

// --- Fahrt ---
export async function fahrtWeg() {
  if (typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined') {
    for (const codec of ['avc1.640028', 'avc1.4D0028', 'avc1.42E028']) {
      try {
        const r = await VideoEncoder.isConfigSupported({ codec, width: FAHRT_B, height: FAHRT_H, bitrate: 8_000_000, framerate: FAHRT_FPS });
        if (r.supported) return { art: 'webcodecs', codec };
      } catch {}
    }
  }
  if (typeof MediaRecorder !== 'undefined' && HTMLCanvasElement.prototype.captureStream) {
    const typ = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    if (typ) return { art: 'recorder', typ };
  }
  return null;
}

function fahrtBildMaler(strecke, halte, tempo) {
  const plan = fahrtPlan(halte.length, tempo);
  const lager = new Kachellager(6);
  const zeilen = endstationText(strecke, halte);
  const breite = bandBreite(halte.length) * plan.f;
  const endeStart = plan.dauer - 2.4;
  async function male(ctx, t) {
    const x = plan.x(t);
    ctx.fillStyle = '#0e0f10';
    ctx.fillRect(0, 0, FAHRT_B, FAHRT_H);
    // Kurzes Band: mittig zeigen
    const x0 = breite < FAHRT_B ? -(FAHRT_B - breite) / 2 / plan.f : x / plan.f;
    await zeichneBereich(ctx, halte, lager, { s: plan.f, x0, w: FAHRT_B, h: FAHRT_H });
    if (t > endeStart) {
      const a = Math.min(1, (t - endeStart) / 0.8);
      ctx.fillStyle = `rgba(14,15,16,${(a * 0.88).toFixed(3)})`;
      ctx.fillRect(0, 0, FAHRT_B, FAHRT_H);
      ctx.globalAlpha = a;
      zeichneEndstation(ctx, zeilen, 90, FAHRT_H / 2, 64, FAHRT_B - 180);
      ctx.globalAlpha = 1;
    }
  }
  return { plan, male, ende: () => lager.leeren() };
}

// Kodiert Bilder zu einem Video. male(ctx, t) zeichnet das Bild zur Zeit t.
async function videoBauen(weg, male, bilder, { fortschritt, waechter } = {}) {
  const c = leinwand(FAHRT_B, FAHRT_H);
  const ctx = ctx2d(c);
  ctx.imageSmoothingQuality = 'high';
  try {
    if (weg.art === 'webcodecs') {
      const { Muxer, ArrayBufferTarget } = await import('../vendor/mp4-muxer.mjs');
      const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: FAHRT_B, height: FAHRT_H }, fastStart: 'in-memory' });
      let fehler = null;
      const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (fehler = e) });
      enc.configure({ codec: weg.codec, width: FAHRT_B, height: FAHRT_H, bitrate: 8_000_000, framerate: FAHRT_FPS, avc: { format: 'avc' } });
      for (let i = 0; i < bilder; i++) {
        waechter?.pruefe();
        if (fehler) throw fehler;
        await male(ctx, i / FAHRT_FPS);
        const frame = new VideoFrame(c, { timestamp: Math.round((i * 1e6) / FAHRT_FPS), duration: Math.round(1e6 / FAHRT_FPS) });
        enc.encode(frame, { keyFrame: i % (FAHRT_FPS * 2) === 0 });
        frame.close();
        while (enc.encodeQueueSize > 4) await new Promise((ok) => setTimeout(ok, 5));
        if (i % 10 === 0) { fortschritt?.(i / bilder); await kurz(); }
      }
      await enc.flush();
      if (fehler) throw fehler;
      enc.close();
      muxer.finalize();
      fortschritt?.(1);
      return new Blob([muxer.target.buffer], { type: 'video/mp4' });
    }
    // Ausweg: in Echtzeit aufnehmen.
    const dauer = bilder / FAHRT_FPS;
    const stream = c.captureStream(FAHRT_FPS);
    const rec = new MediaRecorder(stream, { mimeType: weg.typ, videoBitsPerSecond: 8_000_000 });
    const teile = [];
    rec.ondataavailable = (e) => e.data.size && teile.push(e.data);
    const fertig = new Promise((ok) => (rec.onstop = ok));
    await male(ctx, 0);
    rec.start(1000);
    const t0 = performance.now();
    let abbruch = null;
    await new Promise((ok) => {
      const schritt = async () => {
        const t = (performance.now() - t0) / 1000;
        try { waechter?.pruefe(); } catch (e) { abbruch = e; ok(); return; }
        if (t >= dauer) { ok(); return; }
        await male(ctx, t);
        fortschritt?.(t / dauer);
        requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    });
    rec.stop();
    await fertig;
    for (const tr of stream.getTracks()) tr.stop();
    if (abbruch) throw abbruch;
    fortschritt?.(1);
    return new Blob(teile, { type: weg.typ.split(';')[0] });
  } finally {
    freigeben(c);
  }
}

// --- Reel: immer MP4 ---
export class KeinMp4 extends Error {}

export async function reelWeg() {
  const w = await fahrtWeg();
  if (!w) return null;
  if (w.art === 'webcodecs') return w;
  return w.typ.startsWith('video/mp4') ? w : null;
}

// Endstation-Zahlen beziehen sich auf den gewählten Abschnitt.
const abschnittHalte = (halte, plan) => halte.slice(plan.von, plan.bis + 1);

function reelBildMaler(strecke, halte, plan) {
  const lager = new Kachellager(6);
  const zeilen = endstationText(strecke, abschnittHalte(halte, plan));
  const layout = endstationLayout();
  const endeStart = plan.bewegung - 0.2;
  async function male(ctx, t) {
    const xb = plan.xBand(Math.min(t, plan.bewegung));
    ctx.fillStyle = '#0e0f10';
    ctx.fillRect(0, 0, FAHRT_B, FAHRT_H);
    await zeichneBereich(ctx, halte, lager, { s: plan.f, x0: xb, w: FAHRT_B, h: FAHRT_H });
    if (plan.endstation && t > endeStart) {
      const a = Math.min(1, (t - endeStart) / 0.8);
      ctx.fillStyle = `rgba(14,15,16,${(a * 0.88).toFixed(3)})`;
      ctx.fillRect(0, 0, FAHRT_B, FAHRT_H);
      ctx.globalAlpha = a;
      zeichneEndstation(ctx, zeilen, layout.x, layout.mitteY, layout.groesse, layout.maxBreite);
      ctx.globalAlpha = 1;
    }
  }
  return { male, ende: () => lager.leeren() };
}

export async function reel(strecke, halte, plan, opt = {}) {
  const weg = await reelWeg();
  if (!weg) throw new KeinMp4('Kein MP4');
  const { male, ende } = reelBildMaler(strecke, halte, plan);
  try {
    return await videoBauen(weg, male, plan.bilder, opt);
  } finally {
    ende();
  }
}

// Titelbild 1080×1920. Das Wichtigste liegt in den mittleren 1080×1350: dort steht das Band
// in voller Höhe, mittig auf dem besten Anschluss des Abschnitts.
export const TITEL_MITTE = 1350;
export function titelAusschnitt(halte, plan) {
  const s = TITEL_MITTE / HALT_H;
  const sicht = FAHRT_B / s;
  let mitte = (plan.x0 + plan.x1) / 2;
  let bester = -1;
  for (const h of abschnittHalte(halte, plan)) {
    if (h.index > plan.von && h.wert != null && h.wert > bester) { bester = h.wert; mitte = h.index * (HALT_B - UEBER) + UEBER / 2; }
  }
  const x0 = Math.max(plan.x0, Math.min(plan.x1 - sicht, mitte - sicht / 2));
  return { s, x0, y: (FAHRT_H - TITEL_MITTE) / 2 };
}

export async function titelbild(halte, plan) {
  const c = leinwand(FAHRT_B, FAHRT_H);
  const ctx = ctx2d(c);
  ctx.imageSmoothingQuality = 'high';
  const lager = new Kachellager(4);
  try {
    ctx.fillStyle = '#0e0f10';
    ctx.fillRect(0, 0, FAHRT_B, FAHRT_H);
    const a = titelAusschnitt(halte, plan);
    ctx.save();
    ctx.translate(0, a.y);
    ctx.beginPath();
    ctx.rect(0, 0, FAHRT_B, TITEL_MITTE);
    ctx.clip();
    await zeichneBereich(ctx, halte, lager, { s: a.s, x0: a.x0, w: FAHRT_B, h: TITEL_MITTE });
    ctx.restore();
    return await alsBlob(c, 'image/jpeg', 0.92);
  } finally {
    lager.leeren();
    freigeben(c);
  }
}

// Fahrt live abspielen (Finale der Blindfahrt). Liefert eine Funktion zum Stoppen.
export function fahrtAbspielen(canvas, strecke, halte, tempo, { fertig } = {}) {
  const { plan, male, ende } = fahrtBildMaler(strecke, halte, tempo);
  canvas.width = FAHRT_B;
  canvas.height = FAHRT_H;
  const ctx = ctx2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  let aktiv = true;
  let t0 = null;
  const schritt = async (jetzt) => {
    if (!aktiv) return;
    if (t0 == null) t0 = jetzt;
    const t = Math.min(plan.dauer, (jetzt - t0) / 1000);
    await male(ctx, t);
    if (t >= plan.dauer) { aktiv = false; ende(); fertig?.(); return; }
    requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
  return () => { aktiv = false; ende(); };
}

// --- Sicherung ---
const FELDER = db.BILDFELDER;

export async function sicherung(strecke, halte, { fortschritt } = {}) {
  const dateien = [];
  const manifest = {
    format: 'nahtlos-sicherung',
    formatVersion: db.FORMAT,
    app: APP_VERSION,
    erstellt: Date.now(),
    strecke: { name: strecke.name, erstellt: strecke.erstellt, blind: strecke.blind, ziel: strecke.ziel },
    halte: [],
  };
  for (const h of halte) {
    const ordner = `halte/${String(h.index).padStart(4, '0')}`;
    const eintrag = { index: h.index, zeit: h.zeit, quelle: h.quelle, rohB: h.rohB, rohH: h.rohH, transform: h.transform, pfad: h.pfad, wert: h.wert, teile: h.teile, name: h.name, dateien: {} };
    for (const feld of FELDER) {
      if (!h[feld]) continue;
      // Bilddaten einzeln aus der Datenbank. Unlesbares fehlt in der Sicherung und steht im Manifest.
      const b = await db.blob(h, feld).catch(() => null);
      if (!b) { (eintrag.fehlt ||= []).push(feld); continue; }
      const name = `${ordner}/${feld}.jpg`;
      eintrag.dateien[feld] = name;
      dateien.push({ name, inhalt: new Uint8Array(await b.arrayBuffer()) });
    }
    manifest.halte.push(eintrag);
  }
  dateien.unshift({ name: 'manifest.json', inhalt: JSON.stringify(manifest, null, 1) });
  return packe(dateien, { fortschritt });
}

// Legt die Strecke aus einer Sicherung unter neuer ID an. Liefert die neue Strecke.
export async function einspielen(datei, { fortschritt } = {}) {
  const eintraege = await entpacke(datei);
  const m = eintraege.get('manifest.json');
  if (!m) throw new Error('Keine Sicherung');
  const manifest = JSON.parse(await m.blob.text());
  if (manifest.format !== 'nahtlos-sicherung') throw new Error('Keine Sicherung');
  if (manifest.formatVersion > db.FORMAT) throw new Error('Sicherung aus neuerer Version');
  const s = await db.neueStrecke({ name: manifest.strecke.name, blind: manifest.strecke.blind });
  try {
    await db.aendereStrecke(s.id, { ziel: !!manifest.strecke.ziel, erstellt: manifest.strecke.erstellt || s.erstellt, gesichertBei: manifest.halte.length });
    const l = manifest.halte.slice().sort((a, b) => a.index - b.index);
    for (let i = 0; i < l.length; i++) {
      const e = l[i];
      const h = {
        id: db.neueId(), streckeId: s.id, index: e.index, zeit: e.zeit, quelle: e.quelle,
        rohB: e.rohB, rohH: e.rohH, transform: e.transform, pfad: e.pfad ?? null,
        wert: e.wert ?? null, teile: e.teile ?? null, name: e.name || '',
      };
      const bilder = {};
      for (const feld of FELDER) {
        const name = e.dateien?.[feld];
        const z = name && eintraege.get(name);
        if (!z) continue;
        if (!(await pruefe(z))) throw new Error(`Beschädigt: ${name}`);
        bilder[feld] = { daten: await z.blob.arrayBuffer(), typ: 'image/jpeg' };
      }
      if (!bilder.roh && !bilder.bild) throw new Error('Halt ohne Bild');
      await db.neuerHalt(h, bilder);
      fortschritt?.((i + 1) / l.length);
    }
  } catch (err) {
    await db.loescheStrecke(s.id).catch(() => {});
    throw err;
  }
  return s;
}

// --- Teilen ---
export async function teilen(dateien, titel) {
  if (navigator.canShare && navigator.canShare({ files: dateien })) {
    try {
      await navigator.share({ files: dateien, title: titel });
      return 'geteilt';
    } catch (err) {
      if (err.name === 'AbortError') return 'abgebrochen';
      throw err;
    }
  }
  throw new Error('Teilen nicht verfügbar');
}

export function speichern(dateien) {
  for (const d of dateien) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(d);
    a.download = d.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  }
}
