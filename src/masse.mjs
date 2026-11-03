// Maße der Strecke (TECHNIK.md, Abschnitte 3 und 5).
// Jeder Halt hat eine eigene Breite bei fester Höhe 1620. Kamerahalte sind 4:5 (1296 breit),
// Serienfotos behalten ihr Seitenverhältnis zwischen 0,7 und 2:1. Die Überlappung ist immer 363.
export const HALT_B = 1296; // Breite eines Kamerahalts (4:5) und der Sucher-Rahmen
export const HALT_H = 1620;
export const UEBER = 363; // Überlappung zweier Halte
export const SCHRITT = HALT_B - UEBER; // 933, nur für Kamerahalte
export const KLEIN_B = 96;
export const KLEIN_H = 120;
export const KLEIN_UE = 27;
export const VORSCHAU_H = 240;
export const ROH_MAX = 4000;
export const SEITE_MIN = 0.7;
export const SEITE_MAX = 2;

export const breiteVon = (h) => (h && h.breite) || HALT_B;

// Breite für ein Seitenverhältnis (Breite durch Höhe), auf 0,7 bis 2:1 begrenzt.
export const breiteFuerSeite = (seite) => Math.round(HALT_H * Math.min(SEITE_MAX, Math.max(SEITE_MIN, seite)));

// Liste der Breiten. Eine Zahl n steht für n Kamerahalte, eine Liste von Halten für deren Breiten.
export function alsBreiten(x) {
  if (typeof x === 'number') return Array(Math.max(0, x)).fill(HALT_B);
  return x.map((v) => (typeof v === 'number' ? v : breiteVon(v)));
}

// Anfang jedes Halts im Band.
export function lagen(x) {
  const br = alsBreiten(x);
  const aus = [];
  let p = 0;
  for (const w of br) { aus.push(p); p += w - UEBER; }
  return aus;
}

// Summe der einzelnen Breiten abzüglich der Überlappungen.
export function bandBreite(x) {
  const br = alsBreiten(x);
  return br.length ? br.reduce((s, w) => s + w, 0) - UEBER * (br.length - 1) : 0;
}

// Die Stücke, aus denen das Band besteht, in Band-Koordinaten.
// art 'bild' oder 'naht', halt = Index, sx/sw = Ausschnitt im Quellbild, x = Lage im Band.
export function stuecke(x) {
  const br = alsBreiten(x);
  const anf = lagen(br);
  const n = br.length;
  const aus = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) aus.push({ art: 'naht', halt: i, sx: 0, sw: UEBER, x: anf[i] });
    const von = i === 0 ? 0 : UEBER;
    const bis = i === n - 1 ? br[i] : br[i] - UEBER;
    aus.push({ art: 'bild', halt: i, sx: von, sw: bis - von, x: anf[i] + von });
  }
  return aus;
}

// Stücke, die den Bereich [x0, x1) des Bands berühren.
export function stueckeIm(x, x0, x1) {
  return stuecke(x).filter((s) => s.x < x1 && s.x + s.sw > x0);
}
