// Vorher und nachher: Paare finden, Reihenfolge bestimmen, Wischlinie. Reine Rechnung, in Node getestet.
// Die Fotos selbst bleiben unverändert, gezeigt wird immer eins von beiden, getrennt durch eine Linie.

const N = 24; // Merkmal: 24 × 24 Helligkeit, ohne Farbe, damit Bearbeitung kaum zählt

// Merkmal eines Fotos aus RGBA-Pixeln (beliebige Größe, wird gemittelt).
export function merkmal(rgba, w, h) {
  const g = new Float64Array(N * N);
  const z = new Float64Array(N * N);
  let satSumme = 0;
  for (let y = 0; y < h; y++) {
    const gy = Math.min(N - 1, Math.floor((y * N) / h));
    for (let x = 0; x < w; x++) {
      const gx = Math.min(N - 1, Math.floor((x * N) / w));
      const i = (y * w + x) * 4;
      const r = rgba[i];
      const gg = rgba[i + 1];
      const b = rgba[i + 2];
      g[gy * N + gx] += 0.299 * r + 0.587 * gg + 0.114 * b;
      z[gy * N + gx]++;
      satSumme += Math.max(r, gg, b) - Math.min(r, gg, b);
    }
  }
  for (let k = 0; k < g.length; k++) g[k] /= Math.max(1, z[k]);
  // Struktur: Abweichung von der Nachbarschaft, normiert. So zählt die Form, nicht Helligkeit oder Kontrast.
  const kante = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x;
    const r = x < N - 1 ? g[k + 1] : g[k];
    const u = y < N - 1 ? g[k + N] : g[k];
    kante[k] = (r - g[k]) + (u - g[k]);
  }
  const norm = (a) => {
    let m = 0;
    for (const v of a) m += v;
    m /= a.length;
    let s = 0;
    for (const v of a) s += (v - m) ** 2;
    s = Math.sqrt(s / a.length) || 1;
    return Float64Array.from(a, (v) => (v - m) / s);
  };
  let mh = 0;
  for (const v of g) mh += v;
  mh /= g.length;
  let kontrast = 0;
  for (const v of g) kontrast += (v - mh) ** 2;
  return { form: norm(g), kante: norm(kante), kontrast: Math.sqrt(kontrast / g.length), saettigung: satSumme / (w * h) };
}

// Ähnlichkeit zweier Merkmale, -1 bis 1.
export function aehnlich(a, b) {
  let s1 = 0;
  let s2 = 0;
  for (let k = 0; k < a.form.length; k++) { s1 += a.form[k] * b.form[k]; s2 += a.kante[k] * b.kante[k]; }
  return 0.5 * (s1 / a.form.length) + 0.5 * (s2 / a.kante.length);
}

// Paare finden: immer das ähnlichste freie Paar zuerst. Rest bleibt ohne Partner.
// Vorher ist das flachere Bild (weniger Kontrast und Farbe), wie bei einer unbearbeiteten Aufnahme.
export function paareFinden(merkmale, { schwelle = 0.55 } = {}) {
  const kandidaten = [];
  for (let i = 0; i < merkmale.length; i++) for (let j = i + 1; j < merkmale.length; j++) {
    kandidaten.push({ i, j, s: aehnlich(merkmale[i], merkmale[j]) });
  }
  kandidaten.sort((a, b) => b.s - a.s);
  const vergeben = new Set();
  const paare = [];
  for (const k of kandidaten) {
    if (k.s < schwelle) break;
    if (vergeben.has(k.i) || vergeben.has(k.j)) continue;
    vergeben.add(k.i);
    vergeben.add(k.j);
    const flach = (m) => m.kontrast + 0.5 * m.saettigung;
    const [vorher, nachher] = flach(merkmale[k.i]) <= flach(merkmale[k.j]) ? [k.i, k.j] : [k.j, k.i];
    paare.push({ vorher, nachher, aehnlichkeit: k.s });
  }
  paare.sort((a, b) => Math.min(a.vorher, a.nachher) - Math.min(b.vorher, b.nachher));
  const rest = merkmale.map((_, i) => i).filter((i) => !vergeben.has(i));
  return { paare, rest };
}

// Zeitplan des Reels: je Paar erst vorher, dann wischt die Linie, dann nachher.
export const VN = { vorher: 1.1, wisch: 1.3, nachher: 1.4 };
export const paarDauer = () => VN.vorher + VN.wisch + VN.nachher;

// Lage zur Zeit t: Paar k und Linie (0 = ganz vorher, 1 = ganz nachher).
export function vnZustand(t, anzahl) {
  const d = paarDauer();
  const k = Math.min(anzahl - 1, Math.max(0, Math.floor(t / d)));
  const s = t - k * d;
  const p = s <= VN.vorher ? 0 : s >= VN.vorher + VN.wisch ? 1 : (s - VN.vorher) / VN.wisch;
  const q = p * p * (3 - 2 * p);
  return { k, linie: q };
}
