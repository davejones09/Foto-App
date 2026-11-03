// Kennzahlen einer Strecke und Pläne für die Ausgaben. Reine Rechnung.
import { HALT_B, HALT_H, bandBreite, alsBreiten, lagen } from './masse.mjs';

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

// Karussell ohne Grenze durchs Motiv: Die Bildbreite bleibt 1296, der Anfang rückt um bis zu 15 %
// einer Slide nach rechts (das Stück davor fällt weg). Gewählt wird der Versatz, bei dem die Grenzen
// am wenigsten Motiv treffen. Die Bildanzahl steigt dadurch nie.
export const KARUSSELL_VERSATZ_MAX = 0.15;
export const KARUSSELL_GRENZE_FENSTER = 40; // Bandpixel links und rechts der Grenze
export const KARUSSELL_TREFFER = 0.25; // ab dieser Motivdichte (Anteil der stärksten Stelle) trifft die Grenze das Motiv
export const PROFIL_SCHRITT = 4; // Bandpixel je Eintrag im Motivprofil

// Motivprofil des Bands aus den Spaltenprofilen der Halte. profile[i]: Float32Array über die Breite von
// Halt i (beliebige Auflösung). In der Überlappung zählt das stärkere.
export function bandProfil(x, profile, schritt = PROFIL_SCHRITT) {
  const br = alsBreiten(x);
  const anf = lagen(br);
  const aus = new Float32Array(Math.ceil(bandBreite(br) / schritt));
  profile.forEach((p, i) => {
    if (!p || !p.length) return;
    const f = br[i] / p.length;
    for (let c = 0; c < p.length; c++) {
      const k = Math.floor((anf[i] + (c + 0.5) * f) / schritt);
      if (k >= 0 && k < aus.length && p[c] > aus[k]) aus[k] = p[c];
    }
  });
  return aus;
}

export function karussellPlan(x, profil = null, { schritt = PROFIL_SCHRITT } = {}) {
  const B = bandBreite(x);
  const S = HALT_B;
  const grenzenBei = (o) => {
    const n = Math.ceil((B - o) / S);
    return { anzahl: n, grenzen: Array.from({ length: Math.max(0, n - 1) }, (_, k) => o + (k + 1) * S) };
  };
  if (!profil || !profil.length) return { versatz: 0, ...grenzenBei(0), treffer: [] };
  let max = 0;
  for (const v of profil) if (v > max) max = v;
  if (max <= 0) return { versatz: 0, ...grenzenBei(0), treffer: [] };
  const fenster = Math.max(1, Math.round(KARUSSELL_GRENZE_FENSTER / schritt));
  const dichte = (xb) => {
    const k = Math.round(xb / schritt);
    let s = 0;
    let n = 0;
    for (let j = k - fenster; j <= k + fenster; j++) if (j >= 0 && j < profil.length) { s += profil[j] / max; n++; }
    return n ? s / n : 0;
  };
  const kosten = (o) => grenzenBei(o).grenzen.reduce((s, g) => s + dichte(g), 0);
  const basis = kosten(0);
  let versatz = 0;
  let best = basis;
  for (let o = 2; o <= Math.floor(KARUSSELL_VERSATZ_MAX * S); o += 2) {
    const k = kosten(o) + 0.02 * (o / S); // bei gleichem Ergebnis lieber weniger abschneiden
    if (k < best - 1e-9) { best = k; versatz = o; }
  }
  if (basis - best < 0.05) versatz = 0; // lohnt sich nicht: nichts abschneiden
  const plan = grenzenBei(versatz);
  const treffer = plan.grenzen.map((g) => ({ x: g, dichte: dichte(g) })).filter((t) => t.dichte >= KARUSSELL_TREFFER);
  return { versatz, ...plan, treffer };
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

// Bandbereich eines Abschnitts (Halt-Indizes ab 0, beide einschließlich). x: Breitenliste oder Halte.
export function abschnittBereich(x, von, bis) {
  const br = alsBreiten(x);
  const anf = lagen(br);
  return { x0: anf[von], x1: anf[bis] + br[bis] };
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

export function reelPlan(x, { von = 0, bis = null, laenge = 30, endstation = true } = {}) {
  const br = alsBreiten(x);
  const n = br.length;
  if (bis == null) bis = n - 1;
  von = Math.max(0, Math.min(n - 1, von));
  bis = Math.max(von, Math.min(n - 1, bis));
  const f = FAHRT_H / HALT_H;
  const { x0, x1 } = abschnittBereich(br, von, bis);
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
    let b = von;
    while (b + 1 < bis && abschnittBereich(br, von, b + 1).x1 - x0 <= spanne) b++;
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
