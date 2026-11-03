// Serie aus der Mediathek: Ausschnitte, Motivschutz, schnelle Paarwerte, Reihenfolge (Held-Karp)
// und Ausschnittwahl entlang der Kette (Viterbi). Reine Rechnung, läuft in Node, Worker und Hauptthread.
// Bild-Typ wie im Kern: { w, h, d } mit d = RGBA, Zeile für Zeile.

export const SERIE_MAX = 10;
export const ZOOMS = [1, 1.15, 1.3];
export const POSITIONEN = [0, 0.25, 0.5, 0.75, 1];
export const KB = 96; // kleine Fassung eines Ausschnitts, wie die Live-Analyse
export const KH = 120;
export const KUE = 27;

export const MOTIV = {
  gewicht: 250, // Punkte für den vollständigen Verlust des Auffälligen (ein Anschluss bringt höchstens 100)
  minErhalt: 0.8, // darunter ist ein Ausschnitt gar nicht erlaubt (relativ zum besten Ausschnitt)
  zoomKosten: 50, // Punkte je +1,0 Zoom, also 7,5 bei 1,15 und 15 bei 1,3
  mitteSigma: 0.3,
};

const TOPK = 10; // Ausschnitte je Foto, mit denen Held-Karp die Reihenfolge abschätzt

const klemme = (v, a, b) => (v < a ? a : v > b ? b : v);

// --- Ausschnitte: 3 Zoomstufen mal 5 × 5 Positionen, doppelte fallen weg ---
export function ausschnitte(pw, ph) {
  let bw;
  let bh;
  if (pw / ph > 0.8) { bh = ph; bw = ph * 0.8; } else { bw = pw; bh = pw / 0.8; }
  const aus = [];
  const gesehen = new Set();
  for (const zoom of ZOOMS) {
    const w = bw / zoom;
    const h = bh / zoom;
    for (const v of POSITIONEN) {
      for (const u of POSITIONEN) {
        const x = u * (pw - w);
        const y = v * (ph - h);
        const sch = `${zoom}|${Math.round(x * 4)}|${Math.round(y * 4)}`;
        if (gesehen.has(sch)) continue;
        gesehen.add(sch);
        aus.push({ zoom, u, v, x, y, w, h });
      }
    }
  }
  return aus;
}

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

// --- Motivschutz: wo liegt das Auffällige? Farbabweichung zur Umgebung und Kanten, zur Mitte stärker gewichtet ---
// Abweichung zur Umgebung statt zum Bildmittel: Große, gleichmäßige Flächen (Himmel, Meer) sind dann
// unauffällig, ein kleines, andersfarbiges Motiv sticht heraus.
function boxWeich(werte, w, h, r) {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let z = 0;
    for (let x = 0; x < w; x++) { z += werte[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + z; }
  }
  const aus = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r); const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r); const x1 = Math.min(w, x + r + 1);
      const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      aus[y * w + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return aus;
}

export function motivKarte(bild) {
  const { w, h, d } = bild;
  const n = w * h;
  const L = new Float32Array(n);
  const U = new Float32Array(n);
  const V = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const r = d[p * 4]; const g = d[p * 4 + 1]; const b = d[p * 4 + 2];
    L[p] = 0.299 * r + 0.587 * g + 0.114 * b;
    U[p] = r - g;
    V[p] = 0.5 * (r + g) - b;
  }
  const rad = Math.max(2, Math.round(Math.min(w, h) / 5));
  const Lw = boxWeich(L, w, h, rad);
  const Uw = boxWeich(U, w, h, rad);
  const Vw = boxWeich(V, w, h, rad);
  const farbe = new Float32Array(n);
  const kante = new Float32Array(n);
  let maxF = 1e-6;
  let maxK = 1e-6;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      farbe[p] = 0.6 * Math.abs(L[p] - Lw[p]) + Math.abs(U[p] - Uw[p]) + Math.abs(V[p] - Vw[p]);
      const gx = L[y * w + Math.min(w - 1, x + 1)] - L[y * w + Math.max(0, x - 1)];
      const gy = L[Math.min(h - 1, y + 1) * w + x] - L[Math.max(0, y - 1) * w + x];
      kante[p] = Math.hypot(gx, gy);
      if (farbe[p] > maxF) maxF = farbe[p];
      if (kante[p] > maxK) maxK = kante[p];
    }
  }
  const sal = new Float32Array(n);
  const s2 = 2 * MOTIV.mitteSigma * MOTIV.mitteSigma;
  for (let y = 0; y < h; y++) {
    const dy = (y + 0.5) / h - 0.5;
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w - 0.5;
      const mitte = 0.4 + 0.6 * Math.exp(-(dx * dx + dy * dy) / s2);
      const p = y * w + x;
      const roh = farbe[p] / maxF + 0.5 * (kante[p] / maxK);
      sal[p] = roh * roh * mitte; // Quadrat: Deutliches zählt viel mehr als leichtes Rauschen
    }
  }
  // Integralbild für schnelle Rechtecksummen
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let zeile = 0;
    for (let x = 0; x < w; x++) {
      zeile += sal[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + zeile;
    }
  }
  return { w, h, sal, I, summe: I[h * (w + 1) + w] };
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

// Kosten je Ausschnitt: Verlust am Auffälligen (relativ zum besten Ausschnitt) und Zoom.
export function ausschnittKosten(karte, liste, masse) {
  const e = liste.map((a) => erhalt(karte, a, masse));
  const best = Math.max(1e-9, ...e);
  return liste.map((a, i) => {
    const rel = e[i] / best;
    return { erhalt: rel, erlaubt: rel >= MOTIV.minErhalt, kosten: MOTIV.gewicht * (1 - rel) + MOTIV.zoomKosten * (a.zoom - 1) };
  });
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

// Alle Kandidaten eines Fotos: Ausschnitt, Motivschutz-Kosten und Kantenmerkmale.
// motivBild: kleine Fassung des ganzen Fotos; klein(a): Ausschnitt a als KB × KH-Bild.
export function fotoKandidaten(pw, ph, motivBild, klein) {
  const liste = ausschnitte(pw, ph);
  const karte = motivKarte(motivBild);
  const kost = ausschnittKosten(karte, liste, { w: pw, h: ph });
  return liste.map((a, i) => ({ ...a, ...kost[i], ...kantenMerkmale(klein(a)) }));
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
    return n ? heldKarp(W, WS).map((i) => ids[i]) : [];
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

  // Beste Alternativen für ein Foto bei gegebenen Nachbarn, für die Auswahl per Antippen.
  alternativen(ordnung, wahl, id, anzahl = 8) {
    const k = ordnung.indexOf(id);
    const vor = k > 0 ? ordnung[k - 1] : (this.start ? 'start' : null);
    const nach = k < ordnung.length - 1 ? ordnung[k + 1] : null;
    const kand = this.fotos.get(id).kandidaten;
    const l = kand.map((c, i) => i).filter((i) => kand[i].erlaubt).map((i) => {
      const w1 = vor ? this.wert(vor, vor === 'start' ? 0 : wahl[vor], id, i) : null;
      const w2 = nach ? this.wert(id, i, nach, wahl[nach]) : null;
      const punkte = (w1 ?? 0) + (w2 ?? 0) - kand[i].kosten;
      return { index: i, punkte, wert: w1 };
    });
    l.sort((a, b) => b.punkte - a.punkte);
    const aktuell = l.findIndex((x) => x.index === wahl[id]);
    if (aktuell > 0) l.unshift(l.splice(aktuell, 1)[0]);
    return l.slice(0, anzahl);
  }
}
