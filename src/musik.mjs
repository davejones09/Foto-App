// Musik fürs Reel: Schläge erkennen und Schnitte darauf legen. Reine Rechnung, in Node getestet.
// Verfahren: Einsatzkurve aus der Lautstärke (Bässe und Gesamt), Tempo per Autokorrelation,
// Schläge per dynamischer Programmierung (nach Ellis), damit auch leicht schwankendes Tempo passt.

const HOP = 512;
const BPM_MIN = 70;
const BPM_MAX = 180;
const BPM_MITTE = 115;

export function einsatzKurve(samples, rate) {
  const n = Math.floor(samples.length / HOP);
  const env = new Float32Array(n);
  const k = Math.exp((-2 * Math.PI * 150) / rate); // Tiefpass für die Bässe
  let tief = 0;
  let vorG = 0;
  let vorT = 0;
  for (let f = 0; f < n; f++) {
    let g = 0;
    let t = 0;
    for (let i = f * HOP, e = i + HOP; i < e; i++) {
      const s = samples[i];
      tief = k * tief + (1 - k) * s;
      g += s * s;
      t += tief * tief;
    }
    const lg = Math.log(1e-7 + g / HOP);
    const lt = Math.log(1e-7 + t / HOP);
    env[f] = Math.max(0, lg - vorG) + Math.max(0, lt - vorT);
    vorG = lg;
    vorT = lt;
  }
  // Glätten und von Ausreißern befreien
  const aus = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    let c = 0;
    for (let i = Math.max(0, f - 1); i <= Math.min(n - 1, f + 1); i++) { s += env[i]; c++; }
    aus[f] = s / c;
  }
  let summe = 0;
  for (const v of aus) summe += v * v;
  const norm = Math.sqrt(summe / Math.max(1, n)) || 1;
  for (let f = 0; f < n; f++) aus[f] = Math.min(4, aus[f] / norm);
  return { env: aus, proSek: rate / HOP };
}

function tempoSchaetzen(env, proSek) {
  const lagMin = Math.floor((60 / BPM_MAX) * proSek);
  const lagMax = Math.ceil((60 / BPM_MIN) * proSek);
  const n = env.length;
  let mittel = 0;
  for (const v of env) mittel += v;
  mittel /= Math.max(1, n);
  let null0 = 0;
  for (let i = 0; i < n; i++) null0 += (env[i] - mittel) ** 2;
  let bester = lagMin;
  let bestWert = -Infinity;
  let bestRoh = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += (env[i] - mittel) * (env[i + lag] - mittel);
    const roh = null0 > 0 ? s / null0 : 0;
    const bpm = (60 * proSek) / lag;
    const gewicht = Math.exp(-0.5 * (Math.log2(bpm / BPM_MITTE) / 0.9) ** 2);
    if (roh * gewicht > bestWert) {
      bestWert = roh * gewicht;
      bester = lag;
      bestRoh = roh;
    }
  }
  return { lag: bester, sicherheit: Math.max(0, Math.min(1, bestRoh)) };
}

function schlaegeVerfolgen(env, lag) {
  const n = env.length;
  const wert = new Float32Array(n);
  const von = new Int32Array(n).fill(-1);
  const staerke = 400 / lag / lag;
  const lo = Math.round(lag / 2);
  const hi = Math.round(lag * 2);
  for (let t = 0; t < n; t++) {
    let best = 0;
    let bp = -1;
    for (let d = lo; d <= hi; d++) {
      const p = t - d;
      if (p < 0) break;
      const v = wert[p] - staerke * (d - lag) ** 2 * 0.3;
      if (v > best) { best = v; bp = p; }
    }
    wert[t] = env[t] + best;
    von[t] = bp;
  }
  let ende = 0;
  for (let t = Math.max(0, n - hi); t < n; t++) if (wert[t] > wert[ende]) ende = t;
  const aus = [];
  for (let t = ende; t >= 0; t = von[t]) aus.push(t);
  return aus.reverse();
}

// Ergebnis: { bpm, schlaege (Sekunden), sicher }. Bei unklarem Takt ist sicher = false.
export function schlaegeErkennen(samples, rate) {
  const { env, proSek } = einsatzKurve(samples, rate);
  if (env.length < proSek * 3) return { bpm: 0, schlaege: [], sicher: false };
  const { lag, sicherheit } = tempoSchaetzen(env, proSek);
  const roh = schlaegeVerfolgen(env, lag).map((f) => (f * HOP) / rate);
  const abstaende = roh.slice(1).map((t, i) => t - roh[i]).sort((a, b) => a - b);
  // Mittelwert ohne Ausreißer: Der Median wäre am Raster der Einsatzkurve (23 ms) zu grob.
  const rand = Math.floor(abstaende.length * 0.1);
  const kern = abstaende.slice(rand, abstaende.length - rand);
  const mittel = kern.length ? kern.reduce((s, x) => s + x, 0) / kern.length : 60 / 120;
  return { bpm: Math.round((60 / mittel) * 10) / 10, schlaege: roh, sicher: sicherheit >= 0.12 && roh.length >= 4 };
}

// Gleichmäßiges Raster, falls kein Takt erkennbar ist oder die Musik still beginnt.
export const rasterSchlaege = (dauer, bpm = 120) => Array.from({ length: Math.floor((dauer * bpm) / 60) }, (_, k) => (k * 60) / bpm);

// --- Treffer: die Stellen, an denen man den Schnitt wirklich spürt ---

const FFT_N = 1024;
const FFT_HOP = 256;
const TREFFER_VORLAUF = FFT_N / 2 - FFT_HOP; // Der Anstieg zeigt sich schon, wenn der Schlag ins Fenster kommt.

function fftBetrag(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let l = 2; l <= n; l <<= 1) {
    const w = (-2 * Math.PI) / l;
    for (let i = 0; i < n; i += l) {
      for (let k = 0; k < l / 2; k++) {
        const c = Math.cos(w * k);
        const d = Math.sin(w * k);
        const a = i + k;
        const b = a + l / 2;
        const tr = re[b] * c - im[b] * d;
        const ti = re[b] * d + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}

// Akzente der Musik mit Stärke 0 bis 1. Bässe zählen dreifach, denn dort sitzt der Schlag, den man spürt.
export function trefferFinden(samples, rate) {
  const rahmen = Math.max(0, Math.floor((samples.length - FFT_N) / FFT_HOP));
  if (rahmen < 8) return [];
  const fenster = Float32Array.from({ length: FFT_N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_N));
  const halb = FFT_N / 2;
  const grenze = Math.max(2, Math.round((150 / rate) * FFT_N));
  const re = new Float32Array(FFT_N);
  const im = new Float32Array(FFT_N);
  const vorher = new Float32Array(halb);
  const kurve = new Float32Array(rahmen);
  for (let f = 0; f < rahmen; f++) {
    for (let i = 0; i < FFT_N; i++) { re[i] = samples[f * FFT_HOP + i] * fenster[i]; im[i] = 0; }
    fftBetrag(re, im);
    let bass = 0;
    let rest = 0;
    for (let k = 1; k < halb; k++) {
      const w = Math.log1p(10 * Math.hypot(re[k], im[k]));
      const d = w - vorher[k];
      if (d > 0 && f > 0) { if (k < grenze) bass += d; else rest += d; }
      vorher[k] = w;
    }
    // Je Band gemittelt: Sonst überstimmen die vielen hohen Frequenzen jeden Bass.
    kurve[f] = (3 * bass) / (grenze - 1) + rest / (halb - grenze);
  }
  const proSek = rate / FFT_HOP;
  const umfeld = Math.round(proSek * 0.5);
  const nah = Math.round(proSek * 0.06);
  const spitzen = [];
  for (let f = 1; f < rahmen - 1; f++) {
    const a = Math.max(0, f - nah);
    const b = Math.min(rahmen - 1, f + nah);
    let groesstes = true;
    for (let i = a; i <= b && groesstes; i++) if (kurve[i] > kurve[f]) groesstes = false;
    if (!groesstes || kurve[f] <= 0) continue;
    let summe = 0;
    const u0 = Math.max(0, f - umfeld);
    const u1 = Math.min(rahmen - 1, f + umfeld);
    for (let i = u0; i <= u1; i++) summe += kurve[i];
    if (kurve[f] > (1.5 * summe) / (u1 - u0 + 1)) spitzen.push(f);
  }
  const sortiert = spitzen.map((f) => kurve[f]).sort((x, y) => x - y);
  const oben = sortiert[Math.floor(sortiert.length * 0.95)] || 1;
  return spitzen.map((f) => ({
    t: Math.max(0, (f * FFT_HOP + TREFFER_VORLAUF) / rate),
    s: Math.min(1, kurve[f] / oben),
  }));
}

// Stellen für Schnitte ab dem Musikstart, in Reel-Zeit: jeder „alle“-te Schlag, auf den Akzent davor oder
// danach gezogen, dazu starke Akzente neben dem Raster. Die Zählung beginnt dort, wo die Musik am stärksten trifft.
export function schnittStellen(schlaege, treffer = [], musikStart = 0, alle = 1) {
  const staerkster = (t, breite) => {
    let best = null;
    for (const h of treffer) if (Math.abs(h.t - t) <= breite && (!best || h.s > best.s)) best = h;
    return best;
  };
  let phase = 0;
  let bestSumme = -1;
  for (let p = 0; p < alle; p++) {
    let summe = 0;
    for (let i = p; i < schlaege.length; i += alle) summe += staerkster(schlaege[i], 0.07)?.s ?? 0;
    if (summe > bestSumme) { bestSumme = summe; phase = p; }
  }
  const stellen = [];
  for (let i = phase; i < schlaege.length; i += alle) {
    const h = staerkster(schlaege[i], 0.08);
    stellen.push(h ? { t: h.t, s: h.s } : { t: schlaege[i], s: 0.15 });
  }
  for (const h of treffer) {
    if (h.s >= 0.6 && !stellen.some((x) => Math.abs(x.t - h.t) < 0.12)) stellen.push({ t: h.t, s: h.s });
  }
  return stellen
    .map((x) => ({ t: x.t - musikStart, s: x.s }))
    .filter((x) => x.t > 0.05)
    .sort((x, y) => x.t - y.t);
}

// --- Ton direkt aus den dekodierten Daten, ohne Web-Audio-Rendering ---

// Mono auf niedrigere Abtastrate, für die Schlagerkennung.
export function monoKlein(kanaele, rate, zielRate) {
  const n = kanaele[0].length;
  const m = Math.ceil((n * zielRate) / rate);
  const aus = new Float32Array(m);
  const schritt = rate / zielRate;
  for (let i = 0; i < m; i++) {
    const a = Math.floor(i * schritt);
    const b = Math.min(n, Math.max(a + 1, Math.floor((i + 1) * schritt)));
    let s = 0;
    for (const k of kanaele) for (let j = a; j < b; j++) s += k[j];
    aus[i] = s / ((b - a || 1) * kanaele.length);
  }
  return aus;
}

// Ausschnitt in Stereo auf der Zielrate, mit weichem Ende. Mono wird auf beide Seiten gelegt,
// ist die Musik zu kurz, bleibt der Rest still.
export function tonAusschnitt(kanaele, rate, start, dauer, zielRate) {
  const n = Math.ceil(dauer * zielRate);
  const quellen = [kanaele[0], kanaele[1] ?? kanaele[0]];
  const aus = Math.min(0.8, dauer / 4);
  const ergebnis = quellen.map((q) => {
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = start * rate + (i * rate) / zielRate;
      const a = Math.floor(p);
      if (a >= q.length) break;
      const b = Math.min(a + 1, q.length - 1);
      z[i] = q[a] + (q[b] - q[a]) * (p - a);
    }
    const ab = Math.floor((dauer - aus) * zielRate);
    for (let i = ab; i < n; i++) z[i] *= Math.max(0, (n - i) / (n - ab));
    return z;
  });
  return ergebnis;
}

export function spitze(kanaele) {
  let s = 0;
  for (const k of kanaele) for (let i = 0; i < k.length; i++) { const w = Math.abs(k[i]); if (w > s) s = w; }
  return s;
}
