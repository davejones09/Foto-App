// Kennzahlen einer Strecke und Pläne für die Ausgaben. Reine Rechnung.
import { HALT_B, HALT_H, bandBreite } from './masse.mjs';

// Anschlüsse sind alle Halte ab dem zweiten mit Wert. Pünktlich heißt: Wert ab 70.
export function kennzahlen(halte) {
  const a = halte.filter((h) => h.index > 0 && h.wert != null);
  const schnitt = a.length ? Math.round(a.reduce((s, h) => s + h.wert, 0) / a.length) : null;
  const p = a.length ? Math.round((100 * a.filter((h) => h.wert >= 70).length) / a.length) : null;
  return { n: halte.length, anschluesse: a.length, schnitt, p };
}

// --- Karussell ---
export const KARUSSELL_B = 1080;
export const KARUSSELL_H = 1350;
export const BEITRAG_MAX = 20;

export const karussellAnzahl = (n) => Math.ceil(bandBreite(n) / HALT_B);

// Teilt die Bilder in Beiträge zu höchstens max Bildern, möglichst gleich groß.
export function beitraege(anzahl, max = BEITRAG_MAX) {
  const t = Math.max(1, Math.ceil(anzahl / max));
  const aus = [];
  let start = 0;
  for (let i = 0; i < t; i++) {
    const n = Math.ceil((anzahl - start) / (t - i));
    aus.push([start, start + n]);
    start += n;
  }
  return aus;
}

// --- Fahrt ---
export const FAHRT_B = 1080;
export const FAHRT_H = 1920;
export const FAHRT_FPS = 30;
export const TEMPI = [220, 450, 900]; // Bummelzug, Regionalexpress, Sprinter (Pixel je Sekunde im Video)
export const RAMPE = 1.5;
export const VORLAUF = 0.6;
export const ENDE = 3;

// Bewegung durch das Band: weich anfahren und bremsen, dazwischen gleichmäßig.
export function fahrtPlan(n, tempo) {
  const f = FAHRT_H / HALT_H;
  const weg = Math.max(0, bandBreite(n) * f - FAHRT_B);
  let bewegung;
  let pos;
  if (weg >= tempo * RAMPE) {
    const konst = (weg - tempo * RAMPE) / tempo;
    bewegung = 2 * RAMPE + konst;
    const a = tempo / RAMPE;
    pos = (t) => {
      if (t <= 0) return 0;
      if (t < RAMPE) return 0.5 * a * t * t;
      if (t < RAMPE + konst) return 0.5 * tempo * RAMPE + tempo * (t - RAMPE);
      if (t < bewegung) { const r = bewegung - t; return weg - 0.5 * a * r * r; }
      return weg;
    };
  } else {
    // Kurze Strecke: eine einzige weiche Bewegung
    bewegung = weg > 0 ? Math.max(1.5, (2 * weg) / tempo) : 0;
    pos = (t) => {
      if (bewegung === 0 || t >= bewegung) return weg;
      if (t <= 0) return 0;
      const u = t / bewegung;
      return weg * u * u * (3 - 2 * u);
    };
  }
  const dauer = VORLAUF + bewegung + ENDE;
  return { f, weg, bewegung, dauer, bilder: Math.round(dauer * FAHRT_FPS), x: (t) => pos(t - VORLAUF) };
}

export function dauerText(sek) {
  const s = Math.round(sek);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`;
}

// --- Gesamtbild ---
export function gesamtGroesse(n, flaeche, maxSeite = 32767) {
  const b = bandBreite(n);
  const h = HALT_H;
  const f = Math.min(1, Math.sqrt(flaeche / (b * h)), maxSeite / b);
  return { b: Math.max(1, Math.floor(b * f)), h: Math.max(1, Math.floor(h * f)), f, verkleinert: f < 1 };
}
