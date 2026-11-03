// REFERENZ.mjs – getesteter Bildkern (siehe TECHNIK.md, Abschnitt 3).
// Rein rechnerisch, ohne Browser-APIs: läuft in Node, im Worker und im Hauptthread.
// Bild-Typ überall: { w, h, d } mit d = Uint8ClampedArray (RGBA, Zeile für Zeile).

export const KONFIG = {
  zeilenSigmaAnteil: 0.10, // Glättung der Zeilen-Angleichung, Anteil der Bildhöhe
  gainMin: 0.6,
  gainMax: 1.6,
  gradGewicht: 0.5,        // Gewicht der Gradienten im Kostenfeld
  schrittStrafe: 0.012,    // macht den Faden ruhiger
  randAnteil: 0.10,        // Faden bleibt so weit von den Rändern der Überlappung weg
  farbKostenVoll: 0.30,    // ab dieser mittleren Kosten gilt die Farbe als "passt gar nicht"
  linienRef: 20,           // Summe der Linienstärke, ab der "volle Struktur" gilt
  linienMin: 1.5,          // darunter ist es Rauschen, keine Linie
  linienRel: 0.25,         // nur Linien ab diesem Anteil der stärksten Linie zählen
  linienFensterAnteil: 0.11, // Breite des Messfensters links und rechts vom Faden
  linienSigmaEng: 1 / 60,  // Weichheit der genauen Messung, Anteil der Bildhöhe
  linienSigmaWeit: 1 / 20, // Weichheit der groben Messung: führt den Nutzer zur Linie hin
  linienGewicht: 0.7,      // Anteil der Linien am Wert, sobald eine Linie da ist
  kappeOhneLinien: 82,     // ohne echte Linie gibt es höchstens diesen Wert
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function gauss1D(werte, sigma) {
  const n = werte.length;
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const kern = new Float32Array(2 * r + 1);
  let summe = 0;
  for (let i = -r; i <= r; i++) {
    const g = Math.exp(-(i * i) / (2 * sigma * sigma));
    kern[i + r] = g;
    summe += g;
  }
  for (let i = 0; i < kern.length; i++) kern[i] /= summe;
  const aus = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += werte[clamp(i + k, 0, n - 1)] * kern[k + r];
    aus[i] = s;
  }
  return aus;
}

// Verstärkung je Zeile und Farbkanal, damit B an der Überlappung zu A passt.
// Sorgt dafür, dass der Wert Linien belohnt und nicht nur zufällig gleiche Farben.
export function zeilenGain(a, b, cfg = KONFIG) {
  const { w, h } = a;
  const gain = [new Float32Array(h), new Float32Array(h), new Float32Array(h)];
  const ma = [new Float32Array(h), new Float32Array(h), new Float32Array(h)];
  const mb = [new Float32Array(h), new Float32Array(h), new Float32Array(h)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        ma[c][y] += a.d[i + c];
        mb[c][y] += b.d[i + c];
      }
    }
    for (let c = 0; c < 3; c++) {
      ma[c][y] /= w;
      mb[c][y] /= w;
    }
  }
  const sigma = Math.max(1, h * cfg.zeilenSigmaAnteil);
  for (let c = 0; c < 3; c++) {
    const sa = gauss1D(ma[c], sigma);
    const sb = gauss1D(mb[c], sigma);
    for (let y = 0; y < h; y++) {
      gain[c][y] = clamp((sa[y] + 4) / (sb[y] + 4), cfg.gainMin, cfg.gainMax);
    }
  }
  return gain;
}

function lumaFeld(bild, gain) {
  const { w, h, d } = bild;
  const L = new Float32Array(w * h);
  const U = new Float32Array(w * h);
  const V = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const gr = gain ? gain[0][y] : 1;
    const gg = gain ? gain[1][y] : 1;
    const gb = gain ? gain[2][y] : 1;
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      const r = Math.min(255, d[i] * gr);
      const g = Math.min(255, d[i + 1] * gg);
      const b = Math.min(255, d[i + 2] * gb);
      L[p] = 0.299 * r + 0.587 * g + 0.114 * b;
      U[p] = r - g;
      V[p] = 0.5 * (r + g) - b;
    }
  }
  return { L, U, V };
}

function gradienten(L, w, h) {
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const yo = Math.max(0, y - 1);
    const yu = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const xl = Math.max(0, x - 1);
      const xr = Math.min(w - 1, x + 1);
      gx[y * w + x] = (L[y * w + xr] - L[y * w + xl]) * 0.5;
      gy[y * w + x] = (L[yu * w + x] - L[yo * w + x]) * 0.5;
    }
  }
  return { gx, gy };
}

// Der Faden: kostengünstigster Weg von oben nach unten durch die Überlappung.
export function fadenFinden(kosten, w, h, cfg = KONFIG) {
  const rand = Math.max(1, Math.round(w * cfg.randAnteil));
  const M = new Float32Array(w * h);
  const von = new Int16Array(w * h);
  for (let x = 0; x < w; x++) {
    M[x] = x < rand || x >= w - rand ? 1e6 : kosten[x];
  }
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < rand || x >= w - rand) {
        M[y * w + x] = 1e6;
        continue;
      }
      let best = M[(y - 1) * w + x];
      let bx = x;
      const l = M[(y - 1) * w + x - 1] + cfg.schrittStrafe;
      const r = M[(y - 1) * w + x + 1] + cfg.schrittStrafe;
      if (l < best) { best = l; bx = x - 1; }
      if (r < best) { best = r; bx = x + 1; }
      M[y * w + x] = kosten[y * w + x] + best;
      von[y * w + x] = bx;
    }
  }
  let bx = rand;
  let best = Infinity;
  for (let x = rand; x < w - rand; x++) {
    const v = M[(h - 1) * w + x];
    if (v < best) { best = v; bx = x; }
  }
  const pfad = new Int16Array(h);
  pfad[h - 1] = bx;
  for (let y = h - 1; y > 0; y--) pfad[y - 1] = von[y * w + pfad[y]];
  return pfad;
}

// Treffen sich die Linien am Faden? A und B werden im selben schmalen Fenster um den Faden
// gemessen, denn dort liegen sie im Band übereinander. Je Zeile zählt die mittlere
// Helligkeitsänderung: Rauschen mittelt sich weg, Linien bleiben stehen.
function linienProfile(ga, gb, pfad, w, h, cfg) {
  const k = Math.max(1, Math.round(w * cfg.linienFensterAnteil));
  const pa = new Float32Array(h);
  const pb = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    const x = pfad[y];
    let sa = 0;
    let sb = 0;
    for (let i = -k; i <= k; i++) {
      const p = y * w + clamp(x + i, 0, w - 1);
      sa += ga.gy[p];
      sb += gb.gy[p];
    }
    pa[y] = sa / (2 * k + 1);
    pb[y] = sb / (2 * k + 1);
  }
  return { pa, pb };
}

// Überlappung zweier Linienprofile bei einer Weichheit: 1 = deckungsgleich, 0 = nichts passt.
function linienTreffer(pa, pb, sigma, cfg) {
  const a = gauss1D(pa, sigma);
  const b = gauss1D(pb, sigma);
  let spitze = 0;
  for (let y = 0; y < a.length; y++) spitze = Math.max(spitze, Math.abs(a[y]), Math.abs(b[y]));
  const boden = Math.max(cfg.linienMin, cfg.linienRel * spitze);
  let schnitt = 0;
  let sa = 0;
  let sb = 0;
  for (let y = 0; y < a.length; y++) {
    const ma = Math.max(0, Math.abs(a[y]) - boden);
    const mb = Math.max(0, Math.abs(b[y]) - boden);
    sa += ma;
    sb += mb;
    // Hell-auf-dunkel trifft dunkel-auf-hell: gleiche Stelle, aber halber Wert.
    schnitt += Math.min(ma, mb) * (a[y] * b[y] >= 0 ? 1 : 0.5);
  }
  const mitte = 0.5 * (sa + sb);
  return { treffer: mitte > 1e-3 ? clamp(schnitt / mitte, 0, 1) : 0, staerke: Math.max(sa, sb) };
}

// Live-Analyse: a = Rest des letzten Bildes, b = Überlappung der Kamera. Gleiche Maße.
export function analysiere(a, b, cfg = KONFIG) {
  const { w, h } = a;
  const gain = zeilenGain(a, b, cfg);
  const fa = lumaFeld(a);
  const fb = lumaFeld(b, gain);
  const ga = gradienten(fa.L, w, h);
  const gb = gradienten(fb.L, w, h);
  const kosten = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const farbe =
      Math.abs(fa.L[p] - fb.L[p]) +
      0.5 * (Math.abs(fa.U[p] - fb.U[p]) + Math.abs(fa.V[p] - fb.V[p]));
    const grad = Math.abs(ga.gx[p] - gb.gx[p]) + Math.abs(ga.gy[p] - gb.gy[p]);
    kosten[p] = (farbe + cfg.gradGewicht * grad) / 255;
  }
  const pfad = fadenFinden(kosten, w, h, cfg);
  const zeilen = new Float32Array(h);
  let summe = 0;
  for (let y = 0; y < h; y++) {
    zeilen[y] = kosten[y * w + pfad[y]];
    summe += zeilen[y];
  }
  const { pa, pb } = linienProfile(ga, gb, pfad, w, h, cfg);
  const eng = linienTreffer(pa, pb, Math.max(1, h * cfg.linienSigmaEng), cfg);
  const weit = linienTreffer(pa, pb, Math.max(2, h * cfg.linienSigmaWeit), cfg);
  const farbe = 1 - clamp(summe / h / cfg.farbKostenVoll, 0, 1);
  const linien = 0.5 * eng.treffer + 0.5 * weit.treffer;
  const struktur = clamp(eng.staerke / cfg.linienRef, 0, 1);
  const ohneLinie = cfg.kappeOhneLinien * farbe;
  const mitLinie = 100 * ((1 - cfg.linienGewicht) * farbe + cfg.linienGewicht * linien);
  const wert = Math.round((1 - struktur) * ohneLinie + struktur * mitLinie);
  return { pfad, zeilen, wert, teile: { farbe, linien, struktur } };
}

// Einfahrhilfe: die stärksten Linien, die am rechten Rand eines Bildes enden.
// Ergebnis: bis zu n Einträge { y, staerke }, y als Anteil der Bildhöhe (0 = oben).
export function hauptlinien(bild, n = 3, cfg = KONFIG) {
  const { w, h } = bild;
  const { L } = lumaFeld(bild);
  const { gy } = gradienten(L, w, h);
  const fenster = Math.max(2, Math.round(w * 0.25));
  const roh = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = w - fenster; x < w; x++) s += gy[y * w + x];
    roh[y] = Math.abs(s / fenster);
  }
  const p = gauss1D(roh, Math.max(1, h * cfg.linienSigmaEng));
  let spitze = 0;
  for (let y = 0; y < h; y++) spitze = Math.max(spitze, p[y]);
  const boden = Math.max(cfg.linienMin, cfg.linienRel * spitze);
  const abstand = Math.round(h * 0.08);
  const kandidaten = [];
  for (let y = 1; y < h - 1; y++) {
    if (p[y] > boden && p[y] >= p[y - 1] && p[y] > p[y + 1]) kandidaten.push({ y, s: p[y] });
  }
  kandidaten.sort((a, b) => b.s - a.s);
  const aus = [];
  for (const k of kandidaten) {
    if (aus.length === n) break;
    if (aus.every((e) => Math.abs(e.y - k.y) >= abstand)) aus.push(k);
  }
  return aus.map((k) => ({ y: k.y / h, staerke: k.s / spitze }));
}

export function bewertung(wert) {
  if (wert >= 90) return 'Planmäßig. Auf die Sekunde.';
  if (wert >= 70) return 'Anschluss erreicht';
  if (wert >= 40) return 'Knapp, läuft aber';
  return 'Anschluss verpasst';
}

// Finale Angleichung des neuen Bildes: Korrektur je Zeile, die nach rechts ausläuft.
// Der rechte Rand bleibt original, deshalb driften die Farben über das Band nicht weg.
export function angleichen(bild, gain, ausblendBreite) {
  const { w, h, d } = bild;
  const aus = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = clamp(1 - x / ausblendBreite, 0, 1);
      const f = t * t * (3 - 2 * t);
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        aus[i + c] = d[i + c] * (1 + (gain[c][y] - 1) * f);
      }
    }
  }
  return { w, h, d: aus };
}

// --- Mehrband-Überblendung entlang des Fadens (Laplace-Pyramide) ---

function zuKanaelen(bild) {
  const n = bild.w * bild.h;
  const k = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let p = 0; p < n; p++) {
    k[0][p] = bild.d[p * 4];
    k[1][p] = bild.d[p * 4 + 1];
    k[2][p] = bild.d[p * 4 + 2];
  }
  return k;
}

const BINOM = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];

function falte(src, w, h) {
  const t = new Float32Array(w * h);
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) s += src[y * w + clamp(x + i, 0, w - 1)] * BINOM[i + 2];
      t[y * w + x] = s;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -2; i <= 2; i++) s += t[clamp(y + i, 0, h - 1) * w + x] * BINOM[i + 2];
      o[y * w + x] = s;
    }
  }
  return o;
}

function runter(src, w, h) {
  const g = falte(src, w, h);
  const nw = Math.max(1, Math.floor(w / 2));
  const nh = Math.max(1, Math.floor(h / 2));
  const o = new Float32Array(nw * nh);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) o[y * nw + x] = g[y * 2 * w + x * 2];
  return { d: o, w: nw, h: nh };
}

function hoch(src, sw, sh, w, h) {
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1, y / 2);
    const y0 = Math.floor(fy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1, x / 2);
      const x0 = Math.floor(fx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = fx - x0;
      o[y * w + x] =
        src[y0 * sw + x0] * (1 - tx) * (1 - ty) +
        src[y0 * sw + x1] * tx * (1 - ty) +
        src[y1 * sw + x0] * (1 - tx) * ty +
        src[y1 * sw + x1] * tx * ty;
    }
  }
  return o;
}

function pyramide(kanal, w, h, stufen) {
  const gauss = [{ d: kanal, w, h }];
  for (let i = 1; i < stufen; i++) {
    const v = gauss[i - 1];
    gauss.push(runter(v.d, v.w, v.h));
  }
  const lap = [];
  for (let i = 0; i < stufen - 1; i++) {
    const v = gauss[i];
    const n = gauss[i + 1];
    const up = hoch(n.d, n.w, n.h, v.w, v.h);
    const l = new Float32Array(v.w * v.h);
    for (let p = 0; p < l.length; p++) l[p] = v.d[p] - up[p];
    lap.push({ d: l, w: v.w, h: v.h });
  }
  lap.push(gauss[stufen - 1]);
  return lap;
}

// a und b: Überlappung gleicher Größe. pfad[y] = x-Position des Fadens.
export function naehen(a, b, pfad, stufen = 6, cfg = KONFIG) {
  const { w, h } = a;
  const maskeVoll = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) maskeVoll[y * w + x] = x < pfad[y] ? 1 : 0;
  }
  const maske = [{ d: maskeVoll, w, h }];
  for (let i = 1; i < stufen; i++) {
    const v = maske[i - 1];
    maske.push(runter(v.d, v.w, v.h));
  }
  const ka = zuKanaelen(a);
  const kb = zuKanaelen(b);
  const aus = new Uint8ClampedArray(w * h * 4);
  for (let c = 0; c < 3; c++) {
    const la = pyramide(ka[c], w, h, stufen);
    const lb = pyramide(kb[c], w, h, stufen);
    let bau = null;
    for (let s = stufen - 1; s >= 0; s--) {
      const ms = maske[s].d;
      const st = la[s];
      const misch = new Float32Array(st.w * st.h);
      for (let p = 0; p < misch.length; p++) misch[p] = la[s].d[p] * ms[p] + lb[s].d[p] * (1 - ms[p]);
      if (bau) {
        const up = hoch(bau.d, bau.w, bau.h, st.w, st.h);
        for (let p = 0; p < misch.length; p++) misch[p] += up[p];
      }
      bau = { d: misch, w: st.w, h: st.h };
    }
    for (let p = 0; p < w * h; p++) aus[p * 4 + c] = bau.d[p];
  }
  for (let p = 0; p < w * h; p++) aus[p * 4 + 3] = 255;
  // Ränder festnageln: außen muss die Naht exakt in die Nachbarstücke übergehen. Der Bereich
  // ist so breit wie der Abstand des Fadens zum Rand, er berührt den Faden also nie.
  const m = Math.max(1, Math.round(w * cfg.randAnteil));
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < m; i++) {
      const t = i / m;
      const f = t * t * (3 - 2 * t);
      const li = (y * w + i) * 4;
      const re = (y * w + w - 1 - i) * 4;
      for (let c = 0; c < 3; c++) {
        aus[li + c] = a.d[li + c] * (1 - f) + aus[li + c] * f;
        aus[re + c] = b.d[re + c] * (1 - f) + aus[re + c] * f;
      }
    }
  }
  return { w, h, d: aus };
}

// Ein neues Bild an das letzte anschließen. Beide Bilder gleich groß, überlappung in Pixeln.
// Ergebnis: naht = die fertige Überlappung; neu = das angeglichene neue Bild.
// Das Band setzt sich so zusammen: ... | naht | neu ab x = überlappung | naht | ...
export function anschliessen(letztes, neues, ueberlappung, cfg = KONFIG) {
  const x0 = letztes.w - ueberlappung;
  const ra = ausschnitt(letztes, x0, ueberlappung);
  const gain = zeilenGain(ra, ausschnitt(neues, 0, ueberlappung), cfg);
  const neu = angleichen(neues, gain, neues.w * 0.6);
  const rb = ausschnitt(neu, 0, ueberlappung);
  const { pfad } = analysiere(ra, rb, cfg);
  return { naht: naehen(ra, rb, pfad, 6, cfg), neu, pfad };
}

// Hilfsfunktion: Ausschnitt aus einem Bild.
export function ausschnitt(bild, x0, breite) {
  const { w, h, d } = bild;
  const o = new Uint8ClampedArray(breite * h * 4);
  for (let y = 0; y < h; y++) {
    const start = (y * w + x0) * 4;
    o.set(d.subarray(start, start + breite * 4), y * breite * 4);
  }
  return { w: breite, h, d: o };
}
