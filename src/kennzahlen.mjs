// Kennzahlen einer Strecke und Pläne für die Ausgaben. Reine Rechnung.
import { HALT_B, HALT_H, SCHRITT, bandBreite } from './masse.mjs';

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

// --- Reel ---
// Man wählt die Länge, das Tempo ergibt sich. Start sofort in Bewegung, nur das Ende läuft weich aus.
export const REEL_LAENGEN = [15, 30, 60, 90];
export const REEL_MAX_TEMPO = 900; // Pixel je Sekunde im Video, darüber wird es unruhig
export const REEL_AUSLAUF = 1.6; // Sekunden weiches Bremsen am Ende
export const REEL_ENDSTATION = 3; // Sekunden Endstation, falls eingeschaltet
export const REEL_RAND = { oben: 250, unten: 250, links: 60, rechts: 60 };

// Bandbereich eines Abschnitts (Halt-Indizes ab 0, beide einschließlich).
export function abschnittBereich(von, bis) {
  return { x0: von * SCHRITT, x1: bis * SCHRITT + HALT_B };
}

function reelBewegung(weg, bewegung) {
  const R = Math.min(REEL_AUSLAUF, bewegung * 0.5);
  const tempo = bewegung > 0 ? weg / (bewegung - R / 2) : 0;
  const pos = (t) => {
    if (t <= 0) return 0;
    if (t >= bewegung) return weg;
    if (t <= bewegung - R) return tempo * t;
    const u = t - (bewegung - R);
    return tempo * (bewegung - R) + tempo * (u - (u * u) / (2 * R));
  };
  return { R, tempo, pos };
}

export function reelPlan(n, { von = 0, bis = n - 1, laenge = 30, endstation = true } = {}) {
  von = Math.max(0, Math.min(n - 1, von));
  bis = Math.max(von, Math.min(n - 1, bis));
  const f = FAHRT_H / HALT_H;
  const { x0, x1 } = abschnittBereich(von, bis);
  const sicht = FAHRT_B / f; // Bandpixel im Bild
  const weg = Math.max(0, (x1 - x0) * f - FAHRT_B);
  const endeDauer = endstation ? REEL_ENDSTATION : 0;
  const bewegung = laenge - endeDauer;
  const { R, tempo, pos } = reelBewegung(weg, bewegung);
  const zuSchnell = tempo > REEL_MAX_TEMPO;
  let vorschlag = null;
  if (zuSchnell) {
    // Längster Abschnitt ab "von", der mit höchstens REEL_MAX_TEMPO auskommt.
    const wegMax = REEL_MAX_TEMPO * (bewegung - R / 2);
    const spanne = (wegMax + FAHRT_B) / f;
    const b = Math.max(von, Math.min(bis - 1, Math.floor((spanne - HALT_B) / SCHRITT) + von));
    vorschlag = { von, bis: b };
  }
  return {
    f, von, bis, x0, x1, sicht, weg, tempo, bewegung, auslauf: R, laenge, endstation,
    dauer: laenge, bilder: Math.round(laenge * FAHRT_FPS), zuSchnell, vorschlag,
    xBand: (t) => x0 + pos(t) / f,
  };
}

// Lage der Endstation-Texte im Reel. Alle Texte halten die Ränder ein (Instagram legt dort Bedienelemente ab).
export function endstationLayout(B = FAHRT_B, H = FAHRT_H, rand = REEL_RAND) {
  const groesse = 64;
  const x = rand.links + 30;
  const mitteY = H / 2;
  const maxBreite = B - rand.rechts - x;
  const zeilen = [
    { art: 'balken', oben: mitteY - groesse * 2.6, unten: mitteY - groesse * 2.6 + groesse * 0.22 },
    { art: 'titel', groesse: groesse * 1.15, y: mitteY - groesse * 1.1 },
    { art: 'name', groesse: groesse * 0.8, y: mitteY + groesse * 0.1 },
    { art: 'zeitraum', groesse: groesse * 0.6, y: mitteY + groesse * 1.1 },
    { art: 'halte', groesse: groesse * 0.6, y: mitteY + groesse * 1.9 },
  ].map((z) => (z.art === 'balken' ? z : { ...z, oben: z.y - z.groesse, unten: z.y + z.groesse * 0.3 }));
  return { x, mitteY, groesse, maxBreite, zeilen };
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
