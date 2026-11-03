// Serie aus der Mediathek: Motivkarte, Zuschnitt (nur außerhalb 0,7 bis 2:1), schnelle Paarwerte und
// Reihenfolge (Held-Karp). Fotos bleiben ganz: Bewertet wird das volle Foto, nicht mehr 75 Ausschnitte.
// Reine Rechnung, läuft in Node, Worker und Hauptthread. Bild-Typ wie im Kern: { w, h, d } mit d = RGBA.

export const SERIE_MAX = 10;
export const KH = 120; // kleine Fassung eines Fotos: 120 Zeilen, Breite nach Seitenverhältnis
export const KUE = 27; // 363 von 1620 Pixeln Höhe, auf 120 Zeilen
export const SEITE_MIN = 0.7;
export const SEITE_MAX = 2;

// Motivkarte über Schärfe (Werte aus Tests an echten Fotos).
export const MOTIV = {
  lang: 640, // Arbeitsfassung, lange Seite
  detailSigma: 1, // Detail = |L − L weich|
  fenster: 9, // Detail über 9 × 9 Pixel gemittelt
  medianFaktor: 1.5, // so viel vom Median der Umgebung abziehen: entfernt gleichmäßige Textur
  abzug: 0.3,
  glattSigma: 6,
  mitteSigma: 0.4, // Mittengewicht, nur schwach
  block: 32, // Umgebung: Mittel je Block, davon der Median über 5 × 5 Blöcke
};

const TOPK = 10;

const klemme = (v, a, b) => (v < a ? a : v > b ? b : v);

// Flächengemittelte Verkleinerung eines Rechtecks (für Tests und ohne Canvas).
export function skaliere(bild, r, zw, zh) {
  const d = new Uint8ClampedArray(zw * zh * 4);
  const fx = r.w / zw;
  const fy = r.h / zh;
  for (let y = 0; y < zh; y++) {
    const y0 = r.y + y * fy;
    const y1 = y0 + fy;
    for (let x = 0; x < zw; x++) {
      const x0 = r.x + x * fx;
      const x1 = x0 + fx;
      let s0 = 0; let s1 = 0; let s2 = 0; let n = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const py = klemme(yy, 0, bild.h - 1);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const i = (py * bild.w + klemme(xx, 0, bild.w - 1)) * 4;
          s0 += bild.d[i]; s1 += bild.d[i + 1]; s2 += bild.d[i + 2]; n++;
        }
      }
      const o = (y * zw + x) * 4;
      d[o] = s0 / n; d[o + 1] = s1 / n; d[o + 2] = s2 / n; d[o + 3] = 255;
    }
  }
  return { w: zw, h: zh, d };
}

// --- Motivkarte: Wo ist das Bild scharf? ---
// Ein unscharfer Vordergrund oder gleichmäßige Textur (Meer, Gras) zählt nicht, das scharfe Motiv schon.

function gaussBild(werte, w, h, sigma) {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let summe = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); summe += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= summe;
  const t = new Float32Array(w * h);
  const aus = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const z = y * w;
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) v += werte[z + klemme(x + i, 0, w - 1)] * k[i + r];
      t[z + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) v += t[klemme(y + i, 0, h - 1) * w + x] * k[i + r];
      aus[y * w + x] = v;
    }
  }
  return aus;
}

function integral(werte, w, h) {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let z = 0;
    for (let x = 0; x < w; x++) { z += werte[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + z; }
  }
  return I;
}

const rechteck = (I, w, x0, y0, x1, y1) => I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];

// Median der Umgebung: Mittel je Block, Median über 5 × 5 Blöcke, bilinear auf Pixel zurück.
function umgebungsMedian(werte, w, h, block) {
  const I = integral(werte, w, h);
  const bw = Math.max(1, Math.ceil(w / block));
  const bh = Math.max(1, Math.ceil(h / block));
  const mittel = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const x0 = bx * block; const y0 = by * block;
      const x1 = Math.min(w, x0 + block); const y1 = Math.min(h, y0 + block);
      mittel[by * bw + bx] = rechteck(I, w, x0, y0, x1, y1) / ((x1 - x0) * (y1 - y0));
    }
  }
  const med = new Float32Array(bw * bh);
  const l = [];
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      l.length = 0;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const x = bx + i; const y = by + j;
        if (x >= 0 && y >= 0 && x < bw && y < bh) l.push(mittel[y * bw + x]);
      }
      l.sort((a, b) => a - b);
      med[by * bw + bx] = l.length % 2 ? l[(l.length - 1) / 2] : 0.5 * (l[l.length / 2 - 1] + l[l.length / 2]);
    }
  }
  const aus = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = klemme((y + 0.5) / block - 0.5, 0, bh - 1);
    const y0 = Math.floor(fy); const y1 = Math.min(bh - 1, y0 + 1); const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = klemme((x + 0.5) / block - 0.5, 0, bw - 1);
      const x0 = Math.floor(fx); const x1 = Math.min(bw - 1, x0 + 1); const tx = fx - x0;
      aus[y * w + x] = (med[y0 * bw + x0] * (1 - tx) + med[y0 * bw + x1] * tx) * (1 - ty)
        + (med[y1 * bw + x0] * (1 - tx) + med[y1 * bw + x1] * tx) * ty;
    }
  }
  return aus;
}

// bild: Arbeitsfassung mit langer Seite MOTIV.lang (640). Liefert Karte mit Integralbild.
export function motivKarte(bild, cfg = MOTIV) {
  const { w, h, d } = bild;
  const n = w * h;
  const L = new Float32Array(n);
  for (let p = 0; p < n; p++) L[p] = 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2];
  // Detail: Betrag von L minus L weich (Sigma 1), über 9 × 9 gemittelt
  const weich = gaussBild(L, w, h, cfg.detailSigma);
  const roh = new Float32Array(n);
  for (let p = 0; p < n; p++) roh[p] = Math.abs(L[p] - weich[p]);
  const r = (cfg.fenster - 1) / 2;
  const I = integral(roh, w, h);
  const detail = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r); const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r); const x1 = Math.min(w, x + r + 1);
      detail[y * w + x] = rechteck(I, w, x0, y0, x1, y1) / ((x1 - x0) * (y1 - y0));
    }
  }
  // Gleichmäßige Textur abziehen: 1,5 × Median der Umgebung und 0,3
  const med = umgebungsMedian(detail, w, h, cfg.block);
  const rest = new Float32Array(n);
  for (let p = 0; p < n; p++) rest[p] = Math.max(0, detail[p] - cfg.medianFaktor * med[p] - cfg.abzug);
  // Glätten, dann ein schwaches Mittengewicht
  const sal = gaussBild(rest, w, h, cfg.glattSigma);
  const s2 = 2 * cfg.mitteSigma * cfg.mitteSigma;
  for (let y = 0; y < h; y++) {
    const dy = (y + 0.5) / h - 0.5;
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w - 0.5;
      sal[y * w + x] *= Math.exp(-(dx * dx + dy * dy) / s2);
    }
  }
  const J = integral(sal, w, h);
  return { w, h, sal, I: J, summe: J[h * (w + 1) + w] };
}

// Setzt ein per Antippen gewähltes Motiv: eine kräftige Glocke um den Punkt (x, y in Anteilen).
export function motivSetzen(karte, punkt) {
  if (!punkt) return karte;
  const { w, h } = karte;
  const sal = new Float32Array(karte.sal);
  let max = 1e-6;
  for (const v of sal) if (v > max) max = v;
  const sx = 0.12 * w;
  const sy = 0.12 * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - punkt.x * w) / sx;
      const dy = (y - punkt.y * h) / sy;
      sal[y * w + x] += 4 * max * Math.exp(-0.5 * (dx * dx + dy * dy));
    }
  }
  const J = integral(sal, w, h);
  return { w, h, sal, I: J, summe: J[h * (w + 1) + w] };
}

// Anteil des Auffälligen im Rechteck r (Koordinaten im Maßstab "masse", z. B. der Vorschau).
export function erhalt(karte, r, masse = { w: karte.w, h: karte.h }) {
  const fx = karte.w / masse.w;
  const fy = karte.h / masse.h;
  const x0 = klemme(Math.round(r.x * fx), 0, karte.w);
  const y0 = klemme(Math.round(r.y * fy), 0, karte.h);
  const x1 = klemme(Math.round((r.x + r.w) * fx), 0, karte.w);
  const y1 = klemme(Math.round((r.y + r.h) * fy), 0, karte.h);
  const W = karte.w + 1;
  const s = karte.I[y1 * W + x1] - karte.I[y0 * W + x1] - karte.I[y1 * W + x0] + karte.I[y0 * W + x0];
  return karte.summe > 0 ? s / karte.summe : 1;
}

// Zuschnitt nur, wenn das Seitenverhältnis außerhalb von 0,7 bis 2:1 liegt, und dann um das Motiv herum.
// pw/ph: Maße des Fotos (beliebige Einheit), karte: Motivkarte desselben Fotos oder null.
// Liefert das Rechteck in Foto-Koordinaten und ob beschnitten wurde.
export function zuschnitt(pw, ph, karte = null) {
  const seite = pw / ph;
  if (seite >= SEITE_MIN - 1e-9 && seite <= SEITE_MAX + 1e-9) return { x: 0, y: 0, w: pw, h: ph, beschnitten: false };
  const quer = seite > SEITE_MAX;
  const w = quer ? ph * SEITE_MAX : pw;
  const h = quer ? ph : pw / SEITE_MIN;
  const spiel = quer ? pw - w : ph - h;
  let best = 0.5;
  if (karte) {
    let bestWert = -1;
    for (let k = 0; k <= 100; k++) {
      const u = k / 100;
      const r = quer ? { x: u * spiel, y: 0, w, h } : { x: 0, y: u * spiel, w, h };
      // bei gleichem Anteil gewinnt die Mitte
      const e = erhalt(karte, r, { w: pw, h: ph }) - 1e-6 * Math.abs(u - 0.5);
      if (e > bestWert) { bestWert = e; best = u; }
    }
  }
  return quer ? { x: best * spiel, y: 0, w, h, beschnitten: true } : { x: 0, y: best * spiel, w, h, beschnitten: true };
}

// Wie viel Motiv steckt in jeder Spalte? Für die Grenzen der Karussellbilder.
export function spaltenProfil(karte) {
  const { w, h, sal } = karte;
  const p = new Float32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p[x] += sal[y * w + x];
  return p;
}

// --- Kantenmerkmale eines Ausschnitts (kleine Fassung KB × KH) ---
function gauss1D(werte, sigma) {
  const n = werte.length;
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const kern = new Float32Array(2 * r + 1);
  let summe = 0;
  for (let i = -r; i <= r; i++) { kern[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); summe += kern[i + r]; }
  const aus = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += werte[klemme(i + k, 0, n - 1)] * kern[k + r] / summe;
    aus[i] = s;
  }
  return aus;
}

function kantenStreifen(bild, x0) {
  const { w, h, d } = bild;
  const L = (x, y) => { const i = (y * w + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
  const profil = new Float32Array(h);
  const farben = [new Float32Array(h), new Float32Array(h), new Float32Array(h)];
  // Linienprofil: mittlere senkrechte Helligkeitsänderung um die Mitte des Überlappungsstreifens
  for (let y = 0; y < h; y++) {
    const yo = Math.max(0, y - 1);
    const yu = Math.min(h - 1, y + 1);
    let s = 0;
    for (let x = x0 + 10; x <= x0 + 16; x++) s += (L(x, yu) - L(x, yo)) * 0.5;
    profil[y] = s / 7;
    for (let x = x0; x < x0 + KUE; x++) {
      const i = (y * w + x) * 4;
      farben[0][y] += d[i] / KUE; farben[1][y] += d[i + 1] / KUE; farben[2][y] += d[i + 2] / KUE;
    }
  }
  const eng = gauss1D(profil, Math.max(1, h / 60));
  const weit = gauss1D(profil, Math.max(2, h / 20));
  let maxEng = 0; let maxWeit = 0;
  for (let y = 0; y < h; y++) { maxEng = Math.max(maxEng, Math.abs(eng[y])); maxWeit = Math.max(maxWeit, Math.abs(weit[y])); }
  const glatt = farben.map((f) => gauss1D(f, Math.max(1, h * 0.1)));
  return { farben, glatt, eng, weit, maxEng, maxWeit };
}

export function kantenMerkmale(klein) {
  return { links: kantenStreifen(klein, 0), rechts: kantenStreifen(klein, klein.w - KUE) };
}

function treffer(a, b, spitzeA, spitzeB) {
  const boden = Math.max(1.5, 0.25 * Math.max(spitzeA, spitzeB));
  let schnitt = 0; let sa = 0; let sb = 0;
  for (let y = 0; y < a.length; y++) {
    const ma = Math.max(0, Math.abs(a[y]) - boden);
    const mb = Math.max(0, Math.abs(b[y]) - boden);
    sa += ma; sb += mb;
    schnitt += Math.min(ma, mb) * (a[y] * b[y] >= 0 ? 1 : 0.5);
  }
  const mitte = 0.5 * (sa + sb);
  return { t: mitte > 1e-3 ? klemme(schnitt / mitte, 0, 1) : 0, staerke: Math.max(sa, sb) };
}

// Schneller Anschlusswert 0 bis 100: rechter Rand von A gegen linken Rand von B.
// Nachbildung von analysiere() im Kern, aber nur über Linienprofile und Zeilenfarben.
export function paarWert(A, B) {
  const h = A.eng.length;
  let kosten = 0;
  for (let y = 0; y < h; y++) {
    const rgbA = [0, 1, 2].map((c) => A.farben[c][y]);
    const rgbB = [0, 1, 2].map((c) => Math.min(255, B.farben[c][y] * klemme((A.glatt[c][y] + 4) / (B.glatt[c][y] + 4), 0.6, 1.6)));
    const La = 0.299 * rgbA[0] + 0.587 * rgbA[1] + 0.114 * rgbA[2];
    const Lb = 0.299 * rgbB[0] + 0.587 * rgbB[1] + 0.114 * rgbB[2];
    kosten += Math.abs(La - Lb) + 0.5 * (Math.abs((rgbA[0] - rgbA[1]) - (rgbB[0] - rgbB[1])) + Math.abs((0.5 * (rgbA[0] + rgbA[1]) - rgbA[2]) - (0.5 * (rgbB[0] + rgbB[1]) - rgbB[2])));
  }
  const farbe = 1 - klemme(kosten / h / 255 / 0.3, 0, 1);
  const e = treffer(A.eng, B.eng, A.maxEng, B.maxEng);
  const w = treffer(A.weit, B.weit, A.maxWeit, B.maxWeit);
  const linien = 0.5 * e.t + 0.5 * w.t;
  const struktur = klemme(e.staerke / 20, 0, 1);
  return Math.round((1 - struktur) * 82 * farbe + struktur * 100 * (0.3 * farbe + 0.7 * linien));
}

// --- Held-Karp: beste Reihenfolge, exakt. W[i][j] = Gewinn, wenn j direkt auf i folgt. ---
// start: optionales Feld WS[j] für einen festen Start vor allen Fotos.
export function heldKarp(W, WS = null) {
  const n = W.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  const voll = (1 << n) - 1;
  const dp = new Float64Array((1 << n) * n).fill(-Infinity);
  const von = new Int8Array((1 << n) * n).fill(-1);
  for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = WS ? WS[j] : 0;
  for (let m = 1; m <= voll; m++) {
    for (let j = 0; j < n; j++) {
      const wert = dp[m * n + j];
      if (wert === -Infinity || !(m & (1 << j))) continue;
      for (let k = 0; k < n; k++) {
        if (m & (1 << k)) continue;
        const neu = m | (1 << k);
        const w = wert + W[j][k];
        if (w > dp[neu * n + k]) { dp[neu * n + k] = w; von[neu * n + k] = j; }
      }
    }
  }
  let ende = 0;
  for (let j = 1; j < n; j++) if (dp[voll * n + j] > dp[voll * n + ende]) ende = j;
  const weg = [];
  let m = voll;
  let j = ende;
  while (j >= 0) {
    weg.push(j);
    const v = von[m * n + j];
    m &= ~(1 << j);
    j = v;
  }
  return weg.reverse();
}

// Ab 13 Fotos wird Held-Karp zu groß (2^n · n Zustände). Dann eine Näherung: gierig von jedem
// möglichen Anfang aus, danach Teilstücke verschieben und umdrehen, solange es besser wird.
export const EXAKT_BIS = 12;

export function naeherung(W, WS = null) {
  const n = W.length;
  const summe = (p) => p.reduce((s, x, k) => s + (k ? W[p[k - 1]][x] : WS ? WS[x] : 0), 0);
  let best = null;
  let bestWert = -Infinity;
  for (let a = 0; a < n; a++) {
    const weg = [a];
    const frei = new Set([...Array(n).keys()].filter((x) => x !== a));
    while (frei.size) {
      const j = weg[weg.length - 1];
      let k = -1;
      for (const x of frei) if (k < 0 || W[j][x] > W[j][k]) k = x;
      weg.push(k);
      frei.delete(k);
    }
    const w = summe(weg);
    if (w > bestWert) { bestWert = w; best = weg; }
  }
  let besser = true;
  for (let runde = 0; besser && runde < 50; runde++) {
    besser = false;
    for (let i = 0; i < n; i++) {
      for (let laenge = 1; laenge <= 3 && i + laenge <= n; laenge++) {
        const stueck = best.slice(i, i + laenge);
        const rest = [...best.slice(0, i), ...best.slice(i + laenge)];
        for (const teil of [stueck, stueck.slice().reverse()]) {
          for (let j = 0; j <= rest.length; j++) {
            const neu = [...rest.slice(0, j), ...teil, ...rest.slice(j)];
            const w = summe(neu);
            if (w > bestWert + 1e-9) { bestWert = w; best = neu; besser = true; }
          }
        }
      }
    }
  }
  return best;
}

export const besteReihenfolge = (W, WS = null) => (W.length <= EXAKT_BIS ? heldKarp(W, WS) : naeherung(W, WS));

// --- Planer mit Zwischenspeicher für Paarwerte ---
export class SerienPlaner {
  constructor() {
    this.fotos = new Map(); // id -> { id, zeit, kandidaten: [{ rechts, links, kosten, erlaubt }] }
    this.start = null; // rechte Kante des letzten Halts der Strecke oder null
    this.cache = new Map();
  }

  setze(foto) { this.fotos.set(foto.id, foto); this.#vergiss(foto.id); }
  entferne(id) { this.fotos.delete(id); this.#vergiss(id); }
  setzeStart(rechts) { this.start = rechts || null; this.#vergiss('start'); }
  #vergiss(id) { for (const k of [...this.cache.keys()]) if (k.split('|').includes(id)) this.cache.delete(k); }

  // Paarwerte aller Ausschnittpaare von a (rechts) nach b (links). a = 'start' für den festen Start.
  matrix(a, b) {
    const sch = `${a}|${b}`;
    if (this.cache.has(sch)) return this.cache.get(sch);
    const ka = a === 'start' ? [{ rechts: this.start }] : this.fotos.get(a).kandidaten;
    const kb = this.fotos.get(b).kandidaten;
    const m = new Float32Array(ka.length * kb.length).fill(NaN);
    const eintrag = { m, nb: kb.length };
    this.cache.set(sch, eintrag);
    return eintrag;
  }

  wert(a, ia, b, ib) {
    const e = this.matrix(a, b);
    const i = ia * e.nb + ib;
    if (Number.isNaN(e.m[i])) {
      const A = a === 'start' ? this.start : this.fotos.get(a).kandidaten[ia].rechts;
      e.m[i] = paarWert(A, this.fotos.get(b).kandidaten[ib].links);
    }
    return e.m[i];
  }

  #erlaubt(id, fest) {
    const k = this.fotos.get(id).kandidaten;
    if (fest && fest[id] != null) return [fest[id]];
    const l = k.map((_, i) => i).filter((i) => k[i].erlaubt);
    return l.length ? l : [0];
  }

  #beste(id, fest) {
    const k = this.fotos.get(id).kandidaten;
    return this.#erlaubt(id, fest).sort((x, y) => k[x].kosten - k[y].kosten).slice(0, TOPK);
  }

  // Liefert Reihenfolge, Ausschnitt je Foto und geschätzte Anschlusswerte.
  plane({ modus = 'beste', reihenfolge = null, fest = {} } = {}) {
    const ids = [...this.fotos.keys()];
    let ordnung;
    if (reihenfolge) ordnung = reihenfolge.filter((id) => this.fotos.has(id));
    else if (modus === 'zeit') ordnung = ids.slice().sort((a, b) => (this.fotos.get(a).zeit ?? 0) - (this.fotos.get(b).zeit ?? 0));
    else ordnung = this.#reihenfolge(ids, fest);
    return { reihenfolge: ordnung, ...this.#viterbi(ordnung, fest) };
  }

  #reihenfolge(ids, fest) {
    const n = ids.length;
    const top = ids.map((id) => this.#beste(id, fest));
    const kosten = (id, i) => this.fotos.get(id).kandidaten[i].kosten;
    const W = ids.map((a, i) => ids.map((b, j) => {
      if (i === j) return -Infinity;
      let best = -Infinity;
      for (const ia of top[i]) for (const ib of top[j]) {
        const v = this.wert(a, ia, b, ib) - (kosten(a, ia) + kosten(b, ib)) / 2;
        if (v > best) best = v;
      }
      return best;
    }));
    let WS = null;
    if (this.start) {
      WS = ids.map((b, j) => {
        let best = -Infinity;
        for (const ib of top[j]) best = Math.max(best, this.wert('start', 0, b, ib) - kosten(b, ib) / 2);
        return best;
      });
    }
    return n ? besteReihenfolge(W, WS).map((i) => ids[i]) : [];
  }

  // Viterbi: beste Ausschnitte entlang der festen Kette (Anschlusswerte minus Ausschnittkosten).
  #viterbi(ordnung, fest) {
    if (!ordnung.length) return { wahl: {}, werte: [], summe: 0 };
    const zust = ordnung.map((id) => this.#erlaubt(id, fest));
    const kosten = (id, i) => this.fotos.get(id).kandidaten[i].kosten;
    let punkte = zust[0].map((i) => (this.start ? this.wert('start', 0, ordnung[0], i) : 0) - kosten(ordnung[0], i));
    const zurueck = [null];
    for (let k = 1; k < ordnung.length; k++) {
      const a = ordnung[k - 1];
      const b = ordnung[k];
      const neu = [];
      const von = [];
      for (const ib of zust[k]) {
        let best = -Infinity;
        let arg = 0;
        zust[k - 1].forEach((ia, x) => {
          const v = punkte[x] + this.wert(a, ia, b, ib);
          if (v > best) { best = v; arg = x; }
        });
        neu.push(best - kosten(b, ib));
        von.push(arg);
      }
      punkte = neu;
      zurueck.push(von);
    }
    let x = 0;
    for (let i = 1; i < punkte.length; i++) if (punkte[i] > punkte[x]) x = i;
    const summe = punkte[x];
    const wahlIdx = new Array(ordnung.length);
    for (let k = ordnung.length - 1; k >= 0; k--) {
      wahlIdx[k] = zust[k][x];
      if (k > 0) x = zurueck[k][x];
    }
    const wahl = {};
    ordnung.forEach((id, k) => { wahl[id] = wahlIdx[k]; });
    const werte = ordnung.map((id, k) => {
      if (k === 0) return this.start ? this.wert('start', 0, id, wahlIdx[0]) : null;
      return this.wert(ordnung[k - 1], wahlIdx[k - 1], id, wahlIdx[k]);
    });
    return { wahl, werte, summe };
  }
}
