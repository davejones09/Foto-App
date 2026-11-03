// Feste Maße der Strecke (TECHNIK.md, Abschnitte 3 und 5).
export const HALT_B = 1296;
export const HALT_H = 1620;
export const UEBER = 363; // Überlappung, 28 %
export const SCHRITT = HALT_B - UEBER; // 933
export const KLEIN_B = 96;
export const KLEIN_H = 120;
export const KLEIN_UE = 27;
export const VORSCHAU_H = 240;
export const ROH_MAX = 4000;

export const bandBreite = (n) => (n <= 0 ? 0 : n * SCHRITT + UEBER);

// Die Stücke, aus denen das Band besteht, in Band-Koordinaten.
// art 'bild' oder 'naht', halt = Index, sx/sw = Ausschnitt im Quellbild, x = Lage im Band.
export function stuecke(n) {
  const aus = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) aus.push({ art: 'naht', halt: i, sx: 0, sw: UEBER, x: i * SCHRITT });
    const von = i === 0 ? 0 : UEBER;
    const bis = i === n - 1 ? HALT_B : SCHRITT;
    aus.push({ art: 'bild', halt: i, sx: von, sw: bis - von, x: i * SCHRITT + von });
  }
  return aus;
}

// Stücke, die den Bereich [x0, x1) des Bands berühren.
export function stueckeIm(n, x0, x1) {
  return stuecke(n).filter((s) => s.x < x1 && s.x + s.sw > x0);
}
