// Übergang zwischen zwei Serienfotos. Reine Rechnung, läuft im Worker.
// Anders als bei Kamerahalten: kein weiches Überblenden (kein Blur), sondern ein harter Schnitt am Faden.
// Dafür ein weiter Farbverlauf und, wenn zwei Linien fast aufeinandertreffen, eine sanfte Biegung des
// neuen Fotos. Der vorherige Halt bleibt unangetastet.
import { KONFIG, zeilenGain, angleichen, analysiere, ausschnitt } from './kern.mjs';

export const SERIE_KONFIG = { ...KONFIG, gainMin: 0.2, gainMax: 3.5, zeilenSigmaAnteil: 0.14 };
export const UEBERGANG = {
  ausblend: 0.85, // angleichen läuft über 85 % der Bildbreite aus, der Rest bleibt unverändert
  biegeMax: 0.08, // Linien höchstens 8 % der Höhe auseinander, sonst wird nichts verbogen
  biegeBis: 0.45, // Biegung voll am Übergang, auslaufend bis 45 % der Breite
  schnitt: 1, // halbe Breite der Kante am Faden in Pixeln (gegen Treppchen, kein Weichzeichnen)
};

const klemme = (v, a, b) => (v < a ? a : v > b ? b : v);
const weich = (t) => { const u = klemme(t, 0, 1); return u * u * (3 - 2 * u); };

function glaetten(p, sigma) {
  const n = p.length;
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const aus = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let g = 0;
    for (let k = -r; k <= r; k++) {
      const w = Math.exp(-(k * k) / (2 * sigma * sigma));
      s += p[klemme(i + k, 0, n - 1)] * w;
      g += w;
    }
    aus[i] = s / g;
  }
  return aus;
}

// Hauptlinien in einem Randstreifen: Höhe (0 bis 1), Stärke und Richtung (hell über dunkel oder umgekehrt).
export function randLinien(streifen, n = 3) {
  const { w, h, d } = streifen;
  const L = (x, y) => { const i = (y * w + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
  const roh = new Float32Array(h);
  for (let y = 1; y < h - 1; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) s += (L(x, y + 1) - L(x, y - 1)) * 0.5;
    roh[y] = s / w;
  }
  const p = glaetten(roh, Math.max(1, h / 60));
  let spitze = 0;
  for (const v of p) spitze = Math.max(spitze, Math.abs(v));
  const boden = Math.max(KONFIG.linienMin, KONFIG.linienRel * spitze);
  const kand = [];
  for (let y = 2; y < h - 2; y++) {
    const a = Math.abs(p[y]);
    if (a > boden && a >= Math.abs(p[y - 1]) && a > Math.abs(p[y + 1])) kand.push({ y: y / h, staerke: a, zeichen: Math.sign(p[y]) });
  }
  kand.sort((x, z) => z.staerke - x.staerke);
  const aus = [];
  for (const k of kand) {
    if (aus.length === n) break;
    if (aus.every((e) => Math.abs(e.y - k.y) >= 0.08)) aus.push(k);
  }
  return aus;
}

// Bestes Linienpaar: gleiche Richtung, höchstens biegeMax auseinander, kräftig auf beiden Seiten.
export function bestesPaar(linienA, linienB, max = UEBERGANG.biegeMax) {
  let best = null;
  for (const a of linienA) {
    for (const b of linienB) {
      const dy = Math.abs(a.y - b.y);
      if (dy > max || a.zeichen !== b.zeichen) continue;
      const punkte = Math.min(a.staerke, b.staerke) * (1 - 0.5 * (dy / max));
      if (!best || punkte > best.punkte) best = { a, b, punkte, dy: a.y - b.y };
    }
  }
  return best;
}

// Biegt das Bild spaltenweise senkrecht: Die Linie auf Höhe yVon wandert um verschiebung(x) Pixel.
// Oben und unten bleiben verankert, damit am Rand nichts verschmiert.
export function biegen(bild, yVon, verschiebung) {
  const { w, h, d } = bild;
  const aus = new Uint8ClampedArray(d);
  const y0 = yVon;
  for (let x = 0; x < w; x++) {
    const s = verschiebung(x);
    if (Math.abs(s) < 0.05) continue;
    const y1 = klemme(y0 + s, 1, h - 2);
    const oben = y0 / y1;
    const unten = (h - 1 - y0) / (h - 1 - y1);
    for (let y = 0; y < h; y++) {
      const q = y <= y1 ? y * oben : y0 + (y - y1) * unten;
      const qa = Math.floor(q);
      const qb = Math.min(h - 1, qa + 1);
      const t = q - qa;
      const o = (y * w + x) * 4;
      const ia = (qa * w + x) * 4;
      const ib = (qb * w + x) * 4;
      for (let c = 0; c < 3; c++) aus[o + c] = d[ia + c] * (1 - t) + d[ib + c] * t;
    }
  }
  return { w, h, d: aus };
}

// Harter Schnitt am Faden: links A, rechts B, nur eine Kante von wenigen Pixeln gegen Treppchen.
export function harterSchnitt(a, b, pfad, halb = UEBERGANG.schnitt) {
  const { w, h } = a;
  const aus = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const p = pfad[y];
    for (let x = 0; x < w; x++) {
      const t = klemme((x - (p - halb)) / (2 * halb), 0, 1); // 0 = A, 1 = B
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) aus[i + c] = a.d[i + c] * (1 - t) + b.d[i + c] * t;
      aus[i + 3] = 255;
    }
  }
  return { w, h, d: aus };
}

// Schließt das neue Serienfoto an den letzten Halt an. Beide 1620 hoch, Breiten beliebig.
// Liefert naht (Überlappung), neu (gebogen und angeglichen), pfad und die Biegung (oder null).
export function anschliessenSerie(letztes, neues, ueberlappung, cfg = SERIE_KONFIG, opt = UEBERGANG) {
  const h = neues.h;
  const ra = ausschnitt(letztes, letztes.w - ueberlappung, ueberlappung);
  let gebogen = neues;
  let biegung = null;
  const paar = bestesPaar(randLinien(ra), randLinien(ausschnitt(neues, 0, ueberlappung)), opt.biegeMax);
  if (paar && Math.abs(paar.dy) * h >= 0.5) {
    const s = paar.dy * h;
    const ende = Math.max(ueberlappung + 1, opt.biegeBis * neues.w);
    gebogen = biegen(neues, paar.b.y * h, (x) => s * (1 - weich((x - ueberlappung) / (ende - ueberlappung))));
    biegung = { von: paar.b.y, nach: paar.a.y, pixel: s };
  }
  const gain = zeilenGain(ra, ausschnitt(gebogen, 0, ueberlappung), cfg);
  const neu = angleichen(gebogen, gain, neues.w * opt.ausblend);
  const rb = ausschnitt(neu, 0, ueberlappung);
  const { pfad } = analysiere(ra, rb, cfg);
  return { naht: harterSchnitt(ra, rb, pfad, opt.schnitt), neu, pfad, biegung };
}
