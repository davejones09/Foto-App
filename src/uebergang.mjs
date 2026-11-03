// Übergang zwischen zwei Halten. Reine Rechnung, läuft im Worker. Gilt für jeden Halt: Kamera, Import, Serie.
// Grundregel: Außerhalb der Überlappung bleiben beide Fotos genau so, wie sie sind. Keine Farbangleichung.
// In der Überlappung ein weicher Übergang: die groben Farben über die ganze Breite, die Feinheiten am Faden.
// Liegen zwei Linien höchstens 3 % der Höhe auseinander, werden beide Streifen sanft zueinander gebogen,
// ebenfalls nur innerhalb der Überlappung. An beiden Rändern ist die Naht exakt das Original.
import { KONFIG, analysiere, ausschnitt } from './kern.mjs';

export const UEBERGANG = {
  biegeMax: 0.03, // Linien höchstens 3 % der Höhe auseinander, sonst wird nichts verbogen
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

// Kastenfilter mit Radius r, waagerecht und senkrecht, am Rand fortgesetzt.
function kasten(src, w, h, r) {
  const n = 2 * r + 1;
  const zw = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[o + klemme(k, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      zw[o + x] = s / n;
      s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
    }
  }
  const aus = new Float32Array(w * h);
  const summe = new Float64Array(w);
  for (let k = -r; k <= r; k++) {
    const o = klemme(k, 0, h - 1) * w;
    for (let x = 0; x < w; x++) summe[x] += zw[o + x];
  }
  for (let y = 0; y < h; y++) {
    const o = y * w;
    const dazu = Math.min(h - 1, y + r + 1) * w;
    const weg = Math.max(0, y - r) * w;
    for (let x = 0; x < w; x++) {
      aus[o + x] = summe[x] / n;
      summe[x] += zw[dazu + x] - zw[weg + x];
    }
  }
  return aus;
}

// Weicher Übergang in der Überlappung, je Farbkanal. a und b gleich groß, pfad[y] = Lage des Fadens.
// r = max(4, runde(Breite/16)); la, lb = A, B dreimal kastengefiltert mit Radius r.
// t = smoothstep(x/(Breite-1)), tief = la(1-t) + lb·t.
// feder = max(6, runde(Breite·0,03)), m = smoothstep((x - pfad[y] + feder)/(2·feder)), fein = (A-la)(1-m) + (B-lb)·m.
// rand = min(1, min(x, Breite-1-x)/(2r)), Ergebnis = Original(1-rand) + (tief+fein)·rand,
// Original links der Mitte A, rechts B. Am Rand ist rand = 0, dort steht exakt das Original.
export function ueberblenden(a, b, pfad) {
  const { w, h } = a;
  const r = Math.max(4, Math.round(w / 16));
  const feder = Math.max(6, Math.round(w * 0.03));
  const t = new Float32Array(w);
  const rand = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    t[x] = weich(x / Math.max(1, w - 1));
    rand[x] = Math.min(1, Math.min(x, w - 1 - x) / (2 * r));
  }
  const n = w * h;
  const aus = new Uint8ClampedArray(n * 4);
  const ka = new Float32Array(n);
  const kb = new Float32Array(n);
  for (let c = 0; c < 3; c++) {
    for (let p = 0; p < n; p++) { ka[p] = a.d[p * 4 + c]; kb[p] = b.d[p * 4 + c]; }
    let la = ka;
    let lb = kb;
    for (let i = 0; i < 3; i++) { la = kasten(la, w, h, r); lb = kasten(lb, w, h, r); }
    for (let y = 0; y < h; y++) {
      const fy = pfad[y];
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const q = rand[x];
        const orig = x < w / 2 ? ka[p] : kb[p];
        if (q === 0) { aus[p * 4 + c] = orig; continue; }
        const m = weich((x - fy + feder) / (2 * feder));
        const tief = la[p] * (1 - t[x]) + lb[p] * t[x];
        const fein = (ka[p] - la[p]) * (1 - m) + (kb[p] - lb[p]) * m;
        aus[p * 4 + c] = orig * (1 - q) + (tief + fein) * q;
      }
    }
  }
  for (let p = 0; p < n; p++) aus[p * 4 + 3] = 255;
  return { w, h, d: aus };
}

// Schließt ein neues Foto an den letzten Halt an. Beide gleich hoch, Breiten beliebig (auch nur die
// beiden Randstreifen). Liefert die Naht (Überlappung), den Faden und die Biegung (oder null).
// Die Fotos selbst werden nicht verändert: Ein Halt ist außerhalb der Überlappung das reine Original.
export function anschliessen(letztes, neues, ueberlappung, opt = UEBERGANG) {
  const h = neues.h;
  let ra = ausschnitt(letztes, letztes.w - ueberlappung, ueberlappung);
  let rb = neues.w === ueberlappung ? neues : ausschnitt(neues, 0, ueberlappung);
  let biegung = null;
  const paar = bestesPaar(randLinien(ra), randLinien(rb), opt.biegeMax);
  if (paar && Math.abs(paar.dy) * h >= 0.5) {
    // Gemeinsame Linie über die Überlappung: links auf der Höhe von A, rechts auf der von B.
    // A wird zur rechten Seite hin, B zur linken Seite hin gebogen. Am jeweils äußeren Rand bleibt alles.
    const ya = paar.a.y * h;
    const yb = paar.b.y * h;
    const linie = (x) => ya + (yb - ya) * weich(x / (ueberlappung - 1));
    ra = biegen(ra, ya, (x) => linie(x) - ya);
    rb = biegen(rb, yb, (x) => linie(x) - yb);
    biegung = { von: paar.b.y, nach: paar.a.y, pixel: ya - yb };
  }
  const { pfad } = analysiere(ra, rb);
  return { naht: ueberblenden(ra, rb, pfad), pfad, biegung };
}
