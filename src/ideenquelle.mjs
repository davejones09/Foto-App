// Ideenquelle für den Sucher: Merkmale des Rests, Farben der letzten Halte, Tageszeit, gemerkter Ort,
// und welche Ideen in dieser Strecke schon dran waren. Der Knopf „Idee“ und die Tipps bei niedrigem
// Wert holen sich ihre Sätze beide von hier.
import { restMerkmale, monotonie, tageszeit, waehleIdee, ORTE } from './ideen.mjs';
import { ladeBitmap, freigeben, verkleinere, pixel } from './bild.mjs';
import { HALT_B, UEBER } from './masse.mjs';
import * as db from './speicher.mjs';
import { protokolliere } from './diagnose.mjs';

let merkmale = null;
const farbCache = new Map();

// bildLeinwand: das ganze Bild des letzten Halts (1296 × 1620). Gemessen wird nur der Rest.
export function setzeRest(bildLeinwand) {
  if (!bildLeinwand) { merkmale = null; return; }
  const w = bildLeinwand.width;
  const h = bildLeinwand.height;
  const rw = (UEBER / HALT_B) * w;
  const c = verkleinere(bildLeinwand, w, h, 91, 405, w - rw, 0, rw, h);
  merkmale = restMerkmale(pixel(c));
  freigeben(c);
}

export const restBekannt = () => !!merkmale;

async function mittelfarbe(halt) {
  if (farbCache.has(halt.id)) return farbCache.get(halt.id);
  const blob = halt.vorschau || halt.bild;
  if (!blob) return null;
  const bm = await ladeBitmap(blob);
  const c = verkleinere(bm, bm.width, bm.height, 8, 10);
  freigeben(bm);
  const p = pixel(c);
  freigeben(c);
  const s = [0, 0, 0];
  for (let i = 0; i < p.d.length; i += 4) { s[0] += p.d[i]; s[1] += p.d[i + 1]; s[2] += p.d[i + 2]; }
  const f = s.map((v) => v / (p.d.length / 4));
  farbCache.set(halt.id, f);
  return f;
}

export async function ort() {
  const o = await db.einstellung('ideen-ort').catch(() => null);
  return ORTE.includes(o) ? o : null;
}

export async function setzeOrt(o) {
  await db.setzeEinstellung('ideen-ort', ORTE.includes(o) ? o : null).catch(() => {});
}

// Liefert den nächsten Satz. Innerhalb einer Strecke keine Wiederholung, bis alle passenden durch sind.
export async function naechsteIdee(strecke, halte, { jetzt = new Date() } = {}) {
  if (!merkmale || !strecke) return null;
  try {
    const farben = [];
    for (const h of halte.filter((x) => x.bild).slice(-3)) farben.push(await mittelfarbe(h));
    const m = { ...merkmale, zeit: tageszeit(jetzt.getHours()), ort: await ort(), monoton: monotonie(farben.filter(Boolean)) };
    const schluessel = `ideen:${strecke.id}`;
    let benutzt = new Set(await db.einstellung(schluessel, []).catch(() => []));
    const r = waehleIdee(m, { benutzt });
    if (!r) return null;
    if (r.neueRunde) benutzt = new Set();
    benutzt.add(r.idee.id);
    await db.setzeEinstellung(schluessel, [...benutzt]).catch(() => {});
    return r.satz;
  } catch (err) {
    protokolliere('idee', err);
    return null;
  }
}
