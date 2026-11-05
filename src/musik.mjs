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

// Schläge ab dem Musikstart, auf Reel-Zeit umgerechnet, nur jeder „alle“-te.
export function schnittRaster(schlaege, musikStart = 0, alle = 1) {
  return schlaege.map((t) => t - musikStart).filter((t) => t > 0.05).filter((_, i) => i % alle === alle - 1);
}
