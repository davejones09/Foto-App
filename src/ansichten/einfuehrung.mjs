// Einführung: drei kurze Bildschirme mit gezeichneten, animierten Beispielen. Keine fremden Fotos.
// Kommt nur beim ersten Start und lässt sich in den Einstellungen wieder öffnen.
import { registriere, zeige } from '../zustand.mjs';
import { T } from '../texte.mjs';
import { $, el } from '../ui.mjs';
import { bewertung } from '../kern.mjs';
import * as db from '../speicher.mjs';

const SCHLUESSEL = 'nahtlos-einfuehrung';

// Nur beim allerersten Start: noch nie gesehen und noch kein einziger Halt gespeichert.
export async function einfuehrungNoetig() {
  try { if (localStorage.getItem(SCHLUESSEL) === 'gesehen') return false; } catch {}
  if (await db.einstellung('einfuehrung').catch(() => null)) return false;
  if ((await db.zaehleHalte().catch(() => 0)) > 0) return false;
  return true;
}

async function gesehen() {
  try { localStorage.setItem(SCHLUESSEL, 'gesehen'); } catch {}
  await db.setzeEinstellung('einfuehrung', true).catch(() => {});
}

// --- Gezeichnete Beispielszenen. Jede Linie liegt an beiden Rändern auf Höhe L. ---

const AKZENT = '#8fb1ff';
const HELL = '#ececee';
const MATT = '#a3a6ab';
const LINIE = '#2e3033';
const GRUND = '#111213';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const SANS = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

function zufall(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function verlauf(ctx, y0, y1, a, b) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

const SZENEN = [
  // Meer mit Horizont
  (ctx, w, h, L) => {
    const y = L * h;
    ctx.fillStyle = verlauf(ctx, 0, y, '#5f97cf', '#b3d3ec');
    ctx.fillRect(0, 0, w, y);
    ctx.fillStyle = 'rgba(255,244,214,0.95)';
    ctx.beginPath(); ctx.arc(w * 0.68, h * 0.2, w * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = verlauf(ctx, y, h, '#22557f', '#10304a');
    ctx.fillRect(0, y, w, h - y);
    const r = zufall(3);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = 0; i < 26; i++) ctx.fillRect(r() * w, y + 6 + r() * (h - y - 10), w * (0.06 + r() * 0.08), Math.max(1, h * 0.006));
  },
  // Café: Wand und Tischkante
  (ctx, w, h, L) => {
    const y = L * h;
    ctx.fillStyle = verlauf(ctx, 0, y, '#e3d2b0', '#c9b085');
    ctx.fillRect(0, 0, w, y);
    ctx.fillStyle = 'rgba(120,90,60,0.35)';
    ctx.fillRect(w * 0.3, h * 0.12, w * 0.32, h * 0.2);
    ctx.fillStyle = '#7fa0b8';
    ctx.fillRect(w * 0.32, h * 0.135, w * 0.28, h * 0.17);
    ctx.fillStyle = verlauf(ctx, y, h, '#6e4227', '#3f2414');
    ctx.fillRect(0, y, w, h - y);
    ctx.fillStyle = 'rgba(255,225,180,0.45)';
    ctx.fillRect(0, y, w, Math.max(1, h * 0.006));
    // Tasse
    ctx.fillStyle = '#f3efe7';
    ctx.fillRect(w * 0.52, y - h * 0.11, w * 0.13, h * 0.11);
    ctx.strokeStyle = '#f3efe7';
    ctx.lineWidth = Math.max(1.5, w * 0.018);
    ctx.beginPath(); ctx.arc(w * 0.665, y - h * 0.06, w * 0.032, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  },
  // Hafen: Geländer vor Abendhimmel
  (ctx, w, h, L) => {
    const y = L * h;
    ctx.fillStyle = verlauf(ctx, 0, y, '#e98b5a', '#f6d39b');
    ctx.fillRect(0, 0, w, y);
    ctx.fillStyle = verlauf(ctx, y, h, '#3a4d68', '#1d2a3d');
    ctx.fillRect(0, y, w, h - y);
    ctx.fillStyle = 'rgba(255,210,160,0.22)';
    const r = zufall(11);
    for (let i = 0; i < 18; i++) ctx.fillRect(r() * w, y + h * 0.05 + r() * (h - y - h * 0.08), w * (0.05 + r() * 0.07), Math.max(1, h * 0.005));
    ctx.fillStyle = '#16191e';
    ctx.fillRect(0, y - h * 0.008, w, h * 0.022);
    ctx.fillRect(0, y + h * 0.19, w, h * 0.014);
    for (let x = w * 0.08; x < w; x += w * 0.2) ctx.fillRect(x, y, w * 0.022, h * 0.36);
  },
  // Berg mit Grat
  (ctx, w, h, L) => {
    const y = L * h;
    ctx.fillStyle = verlauf(ctx, 0, y, '#86aac2', '#cddde6');
    ctx.fillRect(0, 0, w, y);
    ctx.fillStyle = '#4c5563';
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(w * 0.3, y - h * 0.1); ctx.lineTo(w * 0.52, y - h * 0.25);
    ctx.lineTo(w * 0.7, y - h * 0.12); ctx.lineTo(w, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eef2f5';
    ctx.beginPath(); ctx.moveTo(w * 0.52, y - h * 0.25); ctx.lineTo(w * 0.46, y - h * 0.2); ctx.lineTo(w * 0.585, y - h * 0.205); ctx.closePath(); ctx.fill();
    ctx.fillStyle = verlauf(ctx, y, h, '#557f3d', '#33521f');
    ctx.fillRect(0, y, w, h - y);
  },
  // Straße vor Hecke
  (ctx, w, h, L) => {
    const y = L * h;
    ctx.fillStyle = verlauf(ctx, 0, y, '#2c5b34', '#3d6d40');
    ctx.fillRect(0, 0, w, y);
    const r = zufall(23);
    ctx.fillStyle = 'rgba(160,210,120,0.22)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(r() * w, r() * y, w * (0.01 + r() * 0.02), 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = verlauf(ctx, y, h, '#686c72', '#45484d');
    ctx.fillRect(0, y, w, h - y);
    ctx.fillStyle = '#e9e9e4';
    for (let x = w * 0.04; x < w; x += w * 0.3) ctx.fillRect(x, y + (h - y) * 0.55, w * 0.16, h * 0.018);
  },
];

const SW = 480;
const SH = 600;
const UE = 134; // 28 % von 480
const SCHRITT = SW - UE;
let szenenBilder = null;
let streifen = null;

function leinwand(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function vorbereiten() {
  if (streifen) return;
  szenenBilder = SZENEN.map((mal) => {
    const c = leinwand(SW, SH);
    mal(c.getContext('2d'), SW, SH, 0.55);
    return c;
  });
  // Ein durchgehender Streifen: Nachbarn verschmelzen weich in der Überlappung.
  streifen = leinwand(SCHRITT * (SZENEN.length - 1) + SW, SH);
  const k = streifen.getContext('2d');
  k.drawImage(szenenBilder[0], 0, 0);
  for (let i = 1; i < szenenBilder.length; i++) {
    const t = leinwand(SW, SH);
    const tk = t.getContext('2d');
    tk.drawImage(szenenBilder[i], 0, 0);
    tk.globalCompositeOperation = 'destination-in';
    const g = tk.createLinearGradient(UE * 0.12, 0, UE * 0.88, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    tk.fillStyle = g;
    tk.fillRect(0, 0, SW, SH);
    k.drawImage(t, i * SCHRITT, 0);
  }
}

const klemme = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const weich = (u) => { const x = klemme(u); return x * x * (3 - 2 * x); };
const misch = (a, b, u) => a + (b - a) * u;
const phase = (t, von, dauer) => weich((t - von) / dauer);

// Faden als feine, leicht wellige Linie
function faden(ctx, x, y0, y1, alpha, breite = 2, bis = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = AKZENT;
  ctx.lineWidth = breite;
  ctx.beginPath();
  const ende = y0 + (y1 - y0) * bis;
  for (let y = y0; y <= ende; y += 4) {
    const dx = Math.sin(y * 0.045) * 3 + Math.sin(y * 0.13) * 1.5;
    if (y === y0) ctx.moveTo(x + dx, y); else ctx.lineTo(x + dx, y);
  }
  ctx.stroke();
  ctx.restore();
}

function abblenden(ctx, cw, ch, a) {
  if (a <= 0) return;
  ctx.fillStyle = `rgba(17,18,19,${a.toFixed(3)})`;
  ctx.fillRect(0, 0, cw, ch);
}

function rundRechteck(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- Bildschirm 1: Fotos liegen durcheinander, sortieren sich und werden eine Strecke ---
const DAUER1 = 8.5;
function bild1(ctx, cw, ch, t) {
  const ws = Math.min(cw * 0.39, ch * 0.7 * 0.8);
  const hs = ws * 1.25;
  const cy = ch * 0.5;
  const sd = (ws * SCHRITT) / SW;
  const dreiB = 2 * sd + ws;
  const x0 = (cw - dreiB) / 2;
  const streifenB = (streifen.width / SH) * hs;
  const zusammen = phase(t, 1.6, 1.2);
  const verschmelzen = phase(t, 2.8, 0.6);
  const fahrt = phase(t, 3.7, 3.6);
  const pan = -fahrt * (streifenB - (cw - 2 * x0));

  if (verschmelzen < 1) {
    // Lage im Stapel je Szene: erst durcheinander, beim Zusammenrücken in der richtigen Reihenfolge
    const lage = [[0, -14, 4], [0.62, 8, 11], [-0.62, 12, -9]];
    for (const i of [2, 0, 1]) {
      const auf = klemme((t - [0.3, 0.6, 0][i]) / 0.35);
      if (auf <= 0) continue;
      const [ox, oy, rot] = lage[i];
      const x = misch(cw / 2 + ox * ws, x0 + i * sd + ws / 2, zusammen);
      const y = misch(cy + oy - (1 - weich(auf)) * 40, cy, zusammen);
      const s = misch(0.76, 1, zusammen);
      ctx.save();
      ctx.globalAlpha = auf;
      ctx.translate(x, y);
      ctx.rotate(((1 - zusammen) * rot * Math.PI) / 180);
      ctx.scale(s, s);
      const rand = 7 * (1 - zusammen);
      if (rand > 0.3) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 16 * (1 - zusammen);
        ctx.fillStyle = '#f4f1ea';
        ctx.fillRect(-ws / 2 - rand, -hs / 2 - rand, ws + 2 * rand, hs + 2 * rand);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }
      ctx.drawImage(szenenBilder[i], -ws / 2, -hs / 2, ws, hs);
      ctx.restore();
    }
  }
  if (verschmelzen > 0) {
    ctx.save();
    const links = misch(x0, 0, phase(t, 3.7, 0.4));
    const rechts = misch(x0 + dreiB, cw, phase(t, 3.7, 0.5));
    ctx.beginPath();
    ctx.rect(links, 0, rechts - links, ch);
    ctx.clip();
    ctx.globalAlpha = verschmelzen;
    ctx.drawImage(streifen, x0 + pan, cy - hs / 2, streifenB, hs);
    ctx.restore();
  }
  // Kurz zeigt sich, wo die Fäden laufen, dann verschwinden sie.
  const fa = klemme(1 - Math.abs(t - 3.2) / 0.6) * 0.95;
  for (let i = 1; i < 3; i++) faden(ctx, x0 + i * sd + ((ws * UE) / SW) / 2, cy - hs / 2, cy + hs / 2, fa);
  abblenden(ctx, cw, ch, phase(t, DAUER1 - 0.8, 0.8));
}

// --- Bildschirm 2: im Sucher den Anschluss finden ---
const DAUER2 = 9;
const ZIEL = 0.55;
function linieZuZeit(t) {
  const punkte = [[0, 0.3], [1.0, 0.3], [2.3, 0.46], [2.8, 0.435], [3.5, ZIEL]];
  let L = ZIEL;
  for (let i = 0; i < punkte.length - 1; i++) {
    const [ta, la] = punkte[i];
    const [tb, lb] = punkte[i + 1];
    if (t <= tb) { L = misch(la, lb, weich((t - ta) / (tb - ta))); break; }
  }
  const zittern = t < 3.5 ? 0.004 : 0.0012;
  return L + Math.sin(t * 7.3) * zittern + Math.sin(t * 3.1) * zittern * 0.6;
}

// Passung wie im Sucher: Zahl, Text und ein schmaler Balken darunter.
function passung(ctx, cw, y, wert) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const zahl = String(wert).padStart(2, ' ');
  const text = bewertung(wert);
  ctx.font = `600 34px ${MONO}`;
  const bz = ctx.measureText('00').width;
  ctx.font = `15px ${SANS}`;
  const bt = Math.min(ctx.measureText(text).width, cw - bz - 30);
  const lx = (cw - (bz + 10 + bt)) / 2;
  ctx.fillStyle = HELL;
  ctx.font = `600 34px ${MONO}`;
  ctx.fillText(zahl, lx, y + 34);
  ctx.fillStyle = MATT;
  ctx.font = `15px ${SANS}`;
  ctx.fillText(text, lx + bz + 10, y + 32, cw - (lx + bz + 10) - 8);
  const bw = Math.min(170, cw * 0.5);
  const bx = (cw - bw) / 2;
  ctx.fillStyle = LINIE;
  rundRechteck(ctx, bx, y + 46, bw, 4, 2);
  ctx.fill();
  ctx.fillStyle = wert >= 70 ? AKZENT : MATT;
  rundRechteck(ctx, bx, y + 46, Math.max(4, (bw * wert) / 100), 4, 2);
  ctx.fill();
}

function bild2(ctx, cw, ch, t) {
  const kopf = 74;
  const fh = Math.min(ch - kopf - 8, cw * 0.78 * 1.25);
  const fw = fh * 0.8;
  const fx = (cw - fw) / 2;
  const oy = Math.max(0, (ch - kopf - fh) / 2);
  const fy = oy + kopf;
  const rb = fw * 0.28;
  const aufnahme = 4.6;
  const L = t < aufnahme ? linieZuZeit(t) : ZIEL;
  const d = Math.abs(L - ZIEL);
  const wert = Math.round(klemme(97 - d * 380, 8, 97));

  // Kopf: Passung als Zahl mit Balken
  passung(ctx, cw, oy + 4, wert);

  const zoom = phase(t, 6.1, 0.8);
  if (t < aufnahme || zoom === 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip();
    ctx.translate(fx, fy);
    SZENEN[1](ctx, fw, fh, L);
    ctx.restore();
  }
  if (t < aufnahme + 0.5) {
    // Rest: das Ende des letzten Fotos, halb durchsichtig
    const rest = 0.55 * (1 - phase(t, aufnahme + 0.1, 0.35));
    ctx.save();
    ctx.globalAlpha = rest;
    ctx.drawImage(szenenBilder[0], SW - UE, 0, UE, SH, fx, fy, rb, fh);
    ctx.restore();
    if (t < aufnahme) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(fx + rb - 0.5, fy, 1, fh);
      faden(ctx, fx + rb * 0.48, fy, fy + fh, 0.9, 1.5);
      // Hilfslinie: leuchtet, wenn die Linie sie trifft
      const my = fy + ZIEL * fh;
      ctx.fillStyle = d < 0.02 ? AKZENT : HELL;
      ctx.beginPath(); ctx.moveTo(fx + rb, my - 10); ctx.lineTo(fx + rb, my + 10); ctx.lineTo(fx + rb - 13, my); ctx.closePath(); ctx.fill();
      // Hinweis: das iPhone wandert, die Linie wandert mit
      if (t < 3.4) {
        const pfeil = 0.6 + 0.4 * Math.sin(t * 6);
        ctx.strokeStyle = `rgba(255,255,255,${(0.75 * pfeil).toFixed(2)})`;
        ctx.lineWidth = 3;
        const px = fx + fw - 26;
        const py = fy + L * fh;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(px - 9, py + s * 18); ctx.lineTo(px, py + s * 27); ctx.lineTo(px + 9, py + s * 18); ctx.stroke(); }
      }
    }
  }
  // Auslösen: kurzer Blitz
  if (t >= aufnahme && t < aufnahme + 0.35) {
    ctx.fillStyle = `rgba(255,255,255,${(0.85 * (1 - (t - aufnahme) / 0.35)).toFixed(3)})`;
    ctx.fillRect(fx, fy, fw, fh);
  }
  // Aufdeckung: der Faden zeichnet sich, die Fotos verschmelzen, dann herauszoomen.
  if (t >= aufnahme + 0.3) {
    const zeichnen = phase(t, aufnahme + 0.35, 1.0);
    const quelleB = SCHRITT + SW;
    const gesamtS = Math.min(fh / SH, (cw * 0.94) / quelleB);
    const zielX = (cw - quelleB * gesamtS) / 2;
    const zielY = fy + (fh - SH * gesamtS) / 2;
    const s = misch(fw / SW, gesamtS, zoom);
    const ursprungX = misch(fx, zielX + SCHRITT * gesamtS, zoom);
    const sx = misch(SCHRITT, 0, zoom);
    const dy = misch(fy, zielY, zoom);
    ctx.save();
    if (zoom === 0) { ctx.beginPath(); ctx.rect(fx, fy, fw, fh * zeichnen); ctx.clip(); }
    ctx.drawImage(streifen, sx, 0, quelleB - sx, SH, ursprungX - (SCHRITT - sx) * s, dy, (quelleB - sx) * s, SH * s);
    ctx.restore();
    if (zoom < 1) faden(ctx, ursprungX + (UE * s) / 2, dy, dy + SH * s, 1 - phase(t, 6.0, 0.6), 2, zeichnen);
  }
  abblenden(ctx, cw, ch, phase(t, DAUER2 - 0.7, 0.7));
}

// --- Bildschirm 3: was am Ende rauskommt: Carousel, Reel und Collage ---
const DAUER3 = 10;
function bild3(ctx, cw, ch, t) {
  const sw = cw * 0.94;
  const sh = (sw * SH) / streifen.width;
  const sx0 = (cw - sw) / 2;
  const hUnten = Math.min(ch - sh - 76, (cw * 0.94) / (0.8 + 9 / 16 + 0.8 + 0.12));
  const sy0 = Math.max(8, (ch - (sh + 30 + hUnten + 32)) / 2);
  const f = sw / streifen.width;
  // Das Band geht genau in ganze Slides auf (in der App per Zoom oder Beschnitt).
  const kacheln = Math.max(1, Math.round(streifen.width / (SH * 0.8)));
  const kachel = streifen.width / kacheln;
  ctx.drawImage(streifen, sx0, sy0, sw, sh);
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 2;
  for (let k = 1; k < kacheln; k++) {
    const a = klemme((t - 0.4 - k * 0.25) / 0.3);
    ctx.strokeStyle = `rgba(143,177,255,${a.toFixed(3)})`;
    const x = sx0 + k * kachel * f;
    ctx.beginPath(); ctx.moveTo(x, sy0 - 4); ctx.lineTo(x, sy0 + sh + 4); ctx.stroke();
  }
  ctx.restore();

  // Unten: Carousel (4:5), Reel (9:16) und Collage (4:5)
  const oben = sy0 + sh + 30;
  let kh = Math.min(ch - oben - 32, hUnten);
  let kw = kh * 0.8;
  let vw = (kh * 9) / 16;
  let luecke = 18;
  const passt = (cw * 0.94) / (kw + luecke + vw + luecke + kw);
  if (passt < 1) { kh *= passt; kw *= passt; vw *= passt; luecke *= passt; }
  const gesamtB = kw + luecke + vw + luecke + kw;
  const kx = (cw - gesamtB) / 2;
  const vx = kx + kw + luecke;
  const cx = vx + vw + luecke;
  ctx.save();
  ctx.globalAlpha = phase(t, 1.3, 0.5);

  // Carousel: wischt Slide für Slide durch, die letzte Slide ist voll
  const takt = 1.7;
  const lauf = Math.max(0, t - 1.8);
  const k = Math.floor(lauf / takt);
  const im = lauf - k * takt;
  const pos = Math.min(kacheln - 1, k + weich((im - 1.1) / 0.55));
  const ks = kh / SH;
  const kz = kw / (kachel * ks); // kleiner Zoom, damit die Slide genau passt
  ctx.save();
  rundRechteck(ctx, kx, oben, kw, kh, 8);
  ctx.clip();
  ctx.drawImage(streifen, kx - pos * kachel * ks * kz, oben - (kh * (kz - 1)) / 2, streifen.width * ks * kz, kh * kz);
  ctx.restore();
  ctx.strokeStyle = LINIE;
  ctx.lineWidth = 2;
  rundRechteck(ctx, kx, oben, kw, kh, 8);
  ctx.stroke();
  for (let i = 0; i < kacheln; i++) {
    ctx.fillStyle = Math.round(pos) === i ? HELL : LINIE;
    ctx.beginPath(); ctx.arc(kx + kw / 2 + (i - (kacheln - 1) / 2) * 10, oben + kh + 10, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx0 + pos * kachel * f, sy0, kachel * f, sh);

  // Reel: fährt gleichmäßig durch alle Fotos
  ctx.save();
  rundRechteck(ctx, vx, oben, vw, kh, 8);
  ctx.clip();
  const vs = kh / SH;
  const sichtbar = vw / vs;
  const fortschritt = phase(t, 1.8, DAUER3 - 2.9);
  ctx.drawImage(streifen, vx - fortschritt * (streifen.width - sichtbar) * vs, oben, streifen.width * vs, kh);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.moveTo(vx + 10, oben + 10); ctx.lineTo(vx + 10, oben + 26); ctx.lineTo(vx + 23, oben + 18); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = LINIE;
  rundRechteck(ctx, vx, oben, vw, kh, 8);
  ctx.stroke();

  // Collage: vier Felder aus den Szenen, eines groß
  ctx.save();
  rundRechteck(ctx, cx, oben, kw, kh, 8);
  ctx.clip();
  ctx.fillStyle = '#f2f2f3';
  ctx.fillRect(cx, oben, kw, kh);
  const g = Math.max(2, kw * 0.025);
  const felder = [[0, 0, 1, 0.58], [0, 0.58, 0.5, 0.42], [0.5, 0.58, 0.5, 0.42]];
  felder.forEach(([fx, fy, fw, fh], i) => {
    const q = szenenBilder[(i + Math.floor(t / 3)) % szenenBilder.length];
    const x = cx + fx * kw + g / 2;
    const y = oben + fy * kh + g / 2;
    const w = fw * kw - g;
    const h = fh * kh - g;
    const s = Math.max(w / SW, h / SH);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(q, x + (w - SW * s) / 2, y + (h - SH * s) / 2, SW * s, SH * s);
    ctx.restore();
  });
  ctx.restore();
  ctx.strokeStyle = LINIE;
  rundRechteck(ctx, cx, oben, kw, kh, 8);
  ctx.stroke();

  ctx.fillStyle = MATT;
  ctx.font = `13px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(T.einfKarussell, kx + kw / 2, oben + kh + 28);
  ctx.fillText(T.einfReel, vx + vw / 2, oben + kh + 28);
  ctx.fillText(T.einfCollage, cx + kw / 2, oben + kh + 28);
  ctx.restore();
  abblenden(ctx, cw, ch, phase(t, DAUER3 - 0.7, 0.7));
}

const BILDER = [
  { mal: bild1, dauer: DAUER1, still: 5.2 },
  { mal: bild2, dauer: DAUER2, still: 7.6 },
  { mal: bild3, dauer: DAUER3, still: 4.6 },
];

// --- Ansicht ---
const v = $('#v-einfuehrung');
const flaeche = $('.einf-flaeche', v);
const canvas = $('.einf-bild', v);
const titel = $('.einf-titel', v);
const absatz = $('.einf-absatz', v);
const punkte = $('.einf-punkte', v);
const weiterBtn = $('#einf-weiter');

let seite = 0;
let start = 0;
let aktiv = false;
let rafId = 0;
let danach = 'sucher';
const ruhig = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function groesse() {
  const r = flaeche.getBoundingClientRect();
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { cw: r.width, ch: r.height, dpr };
}

function malen(jetzt) {
  if (!aktiv) return;
  const { cw, ch, dpr } = groesse();
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = GRUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  const b = BILDER[seite];
  const t = ruhig() ? b.still : ((jetzt - start) / 1000) % b.dauer;
  b.mal(ctx, cw, ch, t);
  if (!ruhig()) rafId = requestAnimationFrame(malen);
}

function zeigeSeite(i) {
  seite = Math.max(0, Math.min(BILDER.length - 1, i));
  const text = T.einfuehrung[seite];
  titel.textContent = text.titel;
  absatz.textContent = text.text;
  weiterBtn.textContent = seite === BILDER.length - 1 ? T.einfLos : T.weiter;
  for (const [k, p] of [...punkte.children].entries()) p.setAttribute('aria-current', String(k === seite));
  v.dataset.seite = String(seite + 1);
  start = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(malen);
}

async function fertig() {
  await gesehen();
  zeige(danach);
}

punkte.replaceChildren(...BILDER.map((_, i) => el('button', { 'aria-label': `${i + 1} / ${BILDER.length}`, onclick: () => zeigeSeite(i) })));
weiterBtn.addEventListener('click', () => (seite < BILDER.length - 1 ? zeigeSeite(seite + 1) : fertig()));
$('#einf-ueberspringen').addEventListener('click', fertig);

// Wischen zwischen den Bildschirmen
{
  let x0 = null;
  flaeche.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  flaeche.addEventListener('pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 50) return;
    zeigeSeite(seite + (dx < 0 ? 1 : -1));
  });
  flaeche.addEventListener('pointercancel', () => (x0 = null));
}

registriere('einfuehrung', {
  betreten(d = {}) {
    danach = d.danach || 'start';
    vorbereiten();
    aktiv = true;
    zeigeSeite(0);
  },
  verlassen() {
    aktiv = false;
    cancelAnimationFrame(rafId);
  },
});
