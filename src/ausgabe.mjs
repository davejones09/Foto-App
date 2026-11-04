// Ausgaben: Karussell, Gesamtbild, Reel (und Fahrt fürs Finale), Sicherung. Alles über den LRU-Lader, mit Fortschritt.
// Farben: Alle Bild- und Videoausgaben entstehen auf sRGB-Leinwänden. Display-P3-Halte rechnet der Browser
// beim Zeichnen sauber nach sRGB um, so sehen sie bei Instagram richtig aus. Die Sicherung enthält die
// gespeicherten Dateien unverändert, mit ihrem Profil.
import { Kachellager, zeichneBand, KLEIN } from './band.mjs';
import { blobSauber } from './metadaten.mjs';
import { stuecke, stueckeIm, bandBreite, breiteVon, lagen, HALT_B, HALT_H, UEBER } from './masse.mjs';
import {
  karussellPlan, bandProfil, slideAusschnitt, KARUSSELL_B, KARUSSELL_H,
  fahrtPlan, FAHRT_B, FAHRT_H, FAHRT_FPS, gesamtGroesse, reelPlan as reelPlanBand,
} from './kennzahlen.mjs';
import { leinwand, ctx2d, alsBlob, freigeben, ladeBitmap, verkleinere, pixel } from './bild.mjs';
import { T, f } from './texte.mjs';
import { datumKurz } from './ui.mjs';
import { packe, entpacke, pruefe } from './zip.mjs';
import * as db from './speicher.mjs';
import { APP_VERSION } from './version.mjs';
import { auftrag } from './rechner.mjs';
import { MOTIV } from './serie.mjs';
import { stilPlan, zustand, lage, reelAusschnitt, nahtGrenze, teilzeiten, RAHMEN, ZEITEN } from './reelstil.mjs';

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

// Lädt alle Bitmaps eines Bandbereichs und zeichnet ihn dann. klein: nur die Vorschauen (für Vorschauen).
async function zeichneBereich(ctx, halte, lager, { s, x0, y0 = 0, w, h, klein = false }) {
  const noetig = stueckeIm(halte, x0, x0 + w / s);
  await Promise.all(noetig.map((st) => lager.hole(halte[st.halt], klein ? KLEIN[st.art] : st.art)));
  zeichneBand(ctx, halte, lager, { s, x0, y0, w, h, klein });
}

// Jede Ausgabe ohne Spuren der App: Metadaten säubern (metadaten.mjs).
async function sauber(blob) { return blobSauber(blob); }

// --- Karussell: 1296×1620-Ausschnitte des Bands als 1080×1350 JPEG ---

// Motivprofil des Bands: je Halt die Motivkarte (Schärfe) auf 640 Pixeln, im Worker, zwischengespeichert.
const profilCache = new Map();
export async function motivProfil(halte, { fortschritt } = {}) {
  return bandProfil(halte, await haltProfile(halte, { fortschritt }));
}

// Spaltenprofile je Halt (Motivdichte über die Breite), für Carousel-Grenzen und Reel-Ausschnitte.
export async function haltProfile(halte, { fortschritt } = {}) {
  const profile = [];
  for (let i = 0; i < halte.length; i++) {
    const h = halte[i];
    const sch = `${h.id}:${h.bild?.laenge}:${h.motiv ? `${h.motiv.x},${h.motiv.y}` : ''}`;
    if (!profilCache.has(sch)) {
      const b = h.bild ? await db.blob(h, 'bild').catch(() => null) : null;
      if (!b) { profile.push(null); continue; }
      const bm = await ladeBitmap(b);
      const f = MOTIV.lang / Math.max(bm.width, bm.height);
      const c = verkleinere(bm, bm.width, bm.height, Math.max(1, Math.round(bm.width * f)), Math.max(1, Math.round(bm.height * f)));
      freigeben(bm);
      const px = pixel(c);
      freigeben(c);
      const r = await auftrag('motivprofil', { bild: px, motiv: h.motiv || null }, [px.d.buffer]);
      profilCache.set(sch, r.profil);
    }
    profile.push(profilCache.get(sch));
    fortschritt?.((i + 1) / halte.length);
  }
  return profile;
}

let letzterPlan = null;
export const letzterKarussellPlan = () => letzterPlan;

// Versatz und Grenzen, so dass möglichst keine Grenze durchs Motiv läuft.
export async function karussellPlanen(halte) {
  return karussellPlan(halte, await motivProfil(halte));
}

// Vorschau für den Hinweis: eine Slide-Breite Band um die Grenze x, die Grenze gelb.
export async function grenzVorschau(canvas, halte, x) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round((r.width || 300) * dpr));
  const h = Math.max(1, Math.round((r.height || 120) * dpr));
  canvas.width = w;
  canvas.height = h;
  const ctx = ctx2d(canvas);
  ctx.fillStyle = '#0e0f10';
  ctx.fillRect(0, 0, w, h);
  const s = h / HALT_H;
  const x0 = x - w / s / 2;
  const lager = new Kachellager(4);
  try {
    await zeichneBereich(ctx, halte, lager, { s, x0, w, h });
  } finally {
    lager.leeren();
  }
  ctx.strokeStyle = '#ffd400';
  ctx.lineWidth = 2 * dpr;
  ctx.setLineDash([6 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
}

export async function karussell(strecke, halte, { fortschritt, waechter, plan = null } = {}) {
  plan = plan || (await karussellPlanen(halte));
  letzterPlan = plan;
  const lager = new Kachellager(6);
  const c = leinwand(KARUSSELL_B, KARUSSELL_H, 'srgb');
  const ctx = ctx2d(c);
  ctx.imageSmoothingQuality = 'high';
  const bilder = [];
  try {
    for (let k = 0; k < plan.anzahl; k++) {
      waechter?.pruefe();
      const a = slideAusschnitt(plan, k);
      await zeichneBereich(ctx, halte, lager, { s: KARUSSELL_B / a.w, x0: a.x0, y0: a.y0, w: KARUSSELL_B, h: KARUSSELL_H });
      bilder.push(await sauber(await alsBlob(c, 'image/jpeg', 0.92)));
      fortschritt?.((k + 1) / plan.anzahl);
      await kurz();
    }
  } finally {
    lager.leeren();
    freigeben(c);
  }
  return bilder;
}

// Vorschau des Carousels: jede Slide klein, genau so geschnitten wie das Ergebnis.
export async function karussellVorschau(leinwaende, halte, plan) {
  const lager = new Kachellager(4);
  try {
    for (let k = 0; k < leinwaende.length && k < plan.anzahl; k++) {
      const cv = leinwaende[k];
      const ctx = ctx2d(cv);
      ctx.imageSmoothingQuality = 'high';
      const a = slideAusschnitt(plan, k);
      await zeichneBereich(ctx, halte, lager, { s: cv.width / a.w, x0: a.x0, y0: a.y0, w: cv.width, h: cv.height, klein: true });
    }
  } finally {
    lager.leeren();
  }
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

export function gesamtPlan(halte) {
  const voll = bandBreite(halte) * HALT_H;
  return gesamtGroesse(halte, canvasGrenze(voll));
}

export async function gesamtbild(halte, { fortschritt, waechter } = {}) {
  const plan = gesamtPlan(halte);
  const c = leinwand(plan.b, plan.h, 'srgb');
  const ctx = ctx2d(c);
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#0e0f10';
  ctx.fillRect(0, 0, plan.b, plan.h);
  const lager = new Kachellager(2);
  const s = plan.h / HALT_H;
  try {
    const teile = stuecke(halte);
    for (let i = 0; i < teile.length; i++) {
      waechter?.pruefe();
      const st = teile[i];
      const bm = await lager.hole(halte[st.halt], st.art);
      const f = bm.width / (st.art === 'naht' ? UEBER : breiteVon(halte[st.halt]));
      const links = Math.round(st.x * s);
      const rechts = Math.round((st.x + st.sw) * s);
      ctx.drawImage(bm, st.sx * f, 0, st.sw * f, bm.height, links, 0, rechts - links, plan.h);
      fortschritt?.(Math.min(0.95, (i + 1) / teile.length));
      await kurz();
    }
    const blob = await sauber(await alsBlob(c, 'image/jpeg', 0.9));
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
  const plan = fahrtPlan(halte, tempo);
  const lager = new Kachellager(6);
  const breite = bandBreite(halte) * plan.f;
  async function male(ctx, t) {
    const x = plan.x(t);
    ctx.fillStyle = '#0e0f10';
    ctx.fillRect(0, 0, FAHRT_B, FAHRT_H);
    // Kurzes Band: mittig zeigen
    const x0 = breite < FAHRT_B ? -(FAHRT_B - breite) / 2 / plan.f : x / plan.f;
    await zeichneBereich(ctx, halte, lager, { s: plan.f, x0, w: FAHRT_B, h: FAHRT_H });
  }
  return { plan, male, ende: () => lager.leeren() };
}

// Kodiert Bilder zu einem Video. male(ctx, t) zeichnet das Bild zur Zeit t.
async function videoBauen(weg, male, bilder, { fortschritt, waechter } = {}) {
  const c = leinwand(FAHRT_B, FAHRT_H, 'srgb');
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

const abschnittHalte = (halte, plan) => halte.slice(plan.von, plan.bis + 1);

function reelBildMaler(strecke, halte, plan) {
  const lager = new Kachellager(6);
  async function male(ctx, t) {
    const xb = plan.xBand(Math.min(t, plan.bewegung));
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, FAHRT_B, FAHRT_H);
    await zeichneBereich(ctx, halte, lager, { s: plan.f, x0: xb, w: FAHRT_B, h: FAHRT_H });
  }
  return { male, ende: () => lager.leeren() };
}

// --- Reel-Stile: jedes Foto formatfüllend in 9:16, der Ausschnitt folgt der Motivkarte ---
// Zeichnet ein Bild des Stils in einen Rahmen W × H. klein: nur die Vorschauen (für die Live-Vorschau).
export async function stilMaler(halte, plan, { klein = false, W = FAHRT_B, H = FAHRT_H } = {}) {
  const lager = new Kachellager(4);
  const profile = await haltProfile(halte).catch(() => halte.map(() => null));
  const ausschnitte = halte.map((h, i) => reelAusschnitt(breiteVon(h), profile[i]));
  const art = klein ? 'vorschau' : 'bild';
  const kx = W / RAHMEN.w;
  async function foto(ctx, k, { s = 1, dx = 0, alpha = 1 }) {
    const bm = await lager.hole(halte[k], art);
    const a = ausschnitte[k];
    const f = bm.height / HALT_H;
    ctx.globalAlpha = alpha;
    if (s >= 1) {
      const sw = a.w / s;
      const sh = HALT_H / s;
      ctx.drawImage(bm, (a.x0 + (a.w - sw) / 2) * f, ((HALT_H - sh) / 2) * f, sw * f, sh * f, dx * kx, 0, W, H);
    } else {
      const dw = W * s;
      const dh = H * s;
      ctx.drawImage(bm, a.x0 * f, 0, a.w * f, HALT_H * f, dx * kx + (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    ctx.globalAlpha = 1;
  }
  async function bildBei(ctx, t, alpha = 1) {
    const z = zustand(plan, t);
    const l = lage(plan.stil, z);
    await foto(ctx, z.i, { ...l.aktuell, alpha: alpha * l.aktuell.alpha });
    if (z.j == null) return;
    if (plan.stil === 'naht') {
      // Die Grenze hat die Form der echten Naht und läuft weich aus: fünf Masken, innen deckend.
      const pfad = halte[z.j].pfad;
      const grenze = nahtGrenze(pfad, l.naechstes.kante, { w: W, h: H, schritt: Math.max(4, Math.round(8 * kx)) });
      const versatz = [-16, -8, 0, 8, 16].map((d) => d * kx);
      for (let k = 0; k < versatz.length; k++) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(W + 400, 0);
        for (const pt of grenze) ctx.lineTo(pt.x + versatz[k], pt.y);
        ctx.lineTo(W + 400, H);
        ctx.closePath();
        ctx.clip();
        await foto(ctx, z.j, { alpha: alpha / (versatz.length - k) });
        ctx.restore();
      }
      return;
    }
    await foto(ctx, z.j, { ...l.naechstes, alpha: alpha * l.naechstes.alpha });
  }
  async function male(ctx, t) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const z = zustand(plan, t);
    if (plan.stil === 'schwung' && z.j != null) {
      // Bewegungsunschärfe: mehrere Bilder kurz vor t übereinander, im laufenden Mittel.
      const zeiten = teilzeiten(t);
      for (let k = 0; k < zeiten.length; k++) await bildBei(ctx, Math.max(0, zeiten[k]), k === 0 ? 1 : 1 / (k + 1));
      return;
    }
    await bildBei(ctx, t);
  }
  return { male, ausschnitte, ende: () => lager.leeren() };
}

// Plan für den gewählten Abschnitt: Band wie bisher, sonst ein Stil-Plan über die Fotos von bis.
export function reelStilPlan(halte, { von = 0, bis = null, laenge = 30, stil = 'band' } = {}) {
  if (stil === 'band' || !ZEITEN[stil]) return { ...reelPlanBand(halte, { von, bis, laenge }), stil: 'band' };
  const b = bis == null ? halte.length - 1 : bis;
  const p = stilPlan(b - von + 1, { laenge, stil });
  return { ...p, von, bis: b, vorschlag: p.zuKurz ? { von, bis: Math.min(b, von + p.maxFotos - 1) } : null };
}

export async function reel(strecke, halte, plan, opt = {}) {
  const weg = await reelWeg();
  if (!weg) throw new KeinMp4('Kein MP4');
  if (plan.stil && plan.stil !== 'band') {
    const teil = halte.slice(plan.von, plan.bis + 1);
    const m = await stilMaler(teil, plan);
    try {
      return await sauber(await videoBauen(weg, m.male, plan.bilder, opt));
    } finally {
      m.ende();
    }
  }
  const { male, ende } = reelBildMaler(strecke, halte, plan);
  try {
    return await sauber(await videoBauen(weg, male, plan.bilder, opt));
  } finally {
    ende();
  }
}

// Titelbild 1080×1920: ein Bild des Reels, das Band in voller Höhe, mittig auf der besten Passung.
// Keine Ränder, kein Text.
export function titelAusschnitt(halte, plan) {
  const s = FAHRT_H / HALT_H;
  const sicht = FAHRT_B / s;
  let mitte = (plan.x0 + plan.x1) / 2;
  let bester = -1;
  const anf = lagen(halte);
  for (const h of abschnittHalte(halte, plan)) {
    if (h.index > plan.von && h.wert != null && h.wert > bester) { bester = h.wert; mitte = anf[h.index] + UEBER / 2; }
  }
  const x0 = Math.max(plan.x0, Math.min(plan.x1 - sicht, mitte - sicht / 2));
  return { s, x0, y: 0 };
}

export async function titelbild(halte, plan) {
  const c = leinwand(FAHRT_B, FAHRT_H, 'srgb');
  const ctx = ctx2d(c);
  ctx.imageSmoothingQuality = 'high';
  if (plan.stil && plan.stil !== 'band') {
    const teil = halte.slice(plan.von, plan.bis + 1);
    let k = 0;
    teil.forEach((h, i) => { if (i > 0 && (h.wert ?? -1) > (teil[k].wert ?? -1)) k = i; });
    const ruhig = { ...stilPlan(teil.length, { laenge: plan.laenge, stil: 'sanft' }), stil: 'sanft' };
    const m = await stilMaler(teil, ruhig);
    try {
      await m.male(ctx, ruhig.beginn[k] + 0.01);
      return await sauber(await alsBlob(c, 'image/jpeg', 0.92));
    } finally {
      m.ende();
      freigeben(c);
    }
  }
  const lager = new Kachellager(4);
  try {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, FAHRT_B, FAHRT_H);
    const a = titelAusschnitt(halte, plan);
    await zeichneBereich(ctx, halte, lager, { s: a.s, x0: a.x0, w: FAHRT_B, h: FAHRT_H });
    return await sauber(await alsBlob(c, 'image/jpeg', 0.92));
  } finally {
    lager.leeren();
    freigeben(c);
  }
}

// Live-Vorschau eines Stils in einer kleinen Leinwand, in Schleife. Liefert eine Funktion zum Stoppen.
export function stilVorschau(canvas, halte, stil) {
  let aktiv = true;
  let maler = null;
  const teil = halte.slice(0, Math.min(3, halte.length));
  const W = canvas.width;
  const H = canvas.height;
  const ctx = ctx2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  (async () => {
    if (!teil.length) return;
    let plan;
    if (stil === 'band') {
      plan = reelPlanBand(teil, { laenge: 4 });
      const lager = new Kachellager(4);
      const s = H / HALT_H;
      maler = {
        male: async (c, t) => { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); await zeichneBereich(c, teil, lager, { s, x0: plan.x0 + (plan.xBand(t) - plan.x0), w: W, h: H, klein: true }); },
        ende: () => lager.leeren(),
      };
    } else {
      const z = ZEITEN[stil];
      plan = { ...stilPlan(teil.length, { laenge: teil.length * 0.9 + (teil.length - 1) * z.uebergang, stil }), stil };
      maler = await stilMaler(teil, plan, { klein: true, W, H });
    }
    const t0 = performance.now();
    const schritt = async () => {
      if (!aktiv) { maler.ende(); return; }
      const t = ((performance.now() - t0) / 1000) % (plan.dauer + 0.6);
      await maler.male(ctx, Math.min(plan.dauer - 0.001, t));
      canvas.dataset.laeuft = '1';
      requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  })().catch(() => {});
  return () => { aktiv = false; };
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
    const eintrag = { index: h.index, zeit: h.zeit, quelle: h.quelle, rohB: h.rohB, rohH: h.rohH, breite: breiteVon(h), uebergang: h.uebergang || null, motiv: h.motiv || null, farbraum: h.farbraum || 'srgb', nahtFarbraum: h.nahtFarbraum || null, profil: h.profil || null, verfahren: h.verfahren || null, transform: h.transform, pfad: h.pfad, wert: h.wert, teile: h.teile, name: h.name, dateien: {} };
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
  if (manifest.typ === 'collage') {
    const { einspielen: collageEinspielen } = await import('./collagewerk.mjs');
    return { collage: await collageEinspielen(manifest, eintraege, { fortschritt }) };
  }
  const s = await db.neueStrecke({ name: manifest.strecke.name, blind: manifest.strecke.blind });
  try {
    await db.aendereStrecke(s.id, { ziel: !!manifest.strecke.ziel, erstellt: manifest.strecke.erstellt || s.erstellt, gesichertBei: manifest.halte.length });
    const l = manifest.halte.slice().sort((a, b) => a.index - b.index);
    for (let i = 0; i < l.length; i++) {
      const e = l[i];
      const h = {
        id: db.neueId(), streckeId: s.id, index: e.index, zeit: e.zeit, quelle: e.quelle,
        rohB: e.rohB, rohH: e.rohH, breite: e.breite || HALT_B, uebergang: e.uebergang || null, motiv: e.motiv || null,
        farbraum: e.farbraum || 'srgb', nahtFarbraum: e.nahtFarbraum || null, profil: e.profil || null, verfahren: e.verfahren || null,
        transform: e.transform, pfad: e.pfad ?? null,
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
      if (!bilder.roh && !bilder.bild) throw new Error('Foto ohne Bild');
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
