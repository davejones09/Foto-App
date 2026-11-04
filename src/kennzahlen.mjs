// Kennzahlen einer Strecke und Pläne für die Ausgaben. Reine Rechnung.
import { HALT_B, HALT_H, bandBreite, alsBreiten, lagen } from './masse.mjs';

// Passungen sind alle Halte ab dem zweiten mit Wert. Nur fürs Projekt, nie in einer Ausgabe.
export function kennzahlen(halte) {
  const a = halte.filter((h) => h.index > 0 && h.wert != null);
  const schnitt = a.length ? Math.round(a.reduce((s, h) => s + h.wert, 0) / a.length) : null;
  return { n: halte.length, anschluesse: a.length, schnitt };
}

// --- Karussell ---
export const KARUSSELL_B = 1080;
export const KARUSSELL_H = 1350;
export const BEITRAG_MAX = 20;


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

// Carousel ohne Abschluss-Slide: Das Band geht genau in ganze Slides auf, keine Slide hat leere Flächen.
// Erst vergrößern (höchstens 8 %, oben und unten gleich viel weg). Reicht das nicht, gewinnt die Slide-Anzahl,
// die am wenigsten Bild kostet, und der Rest fällt am Anfang und Ende weg, möglichst ohne Motive zu treffen.
// Dazu der Motivversatz: Grenzen rücken weg vom Motiv, solange das spürbar hilft und wenig Bild kostet.
// Slide k zeigt das Band von versatz + k·sicht bis versatz + (k + 1)·sicht, in der Höhe von y0 bis y0 + hoehe.
export const KARUSSELL_ZOOM_MAX = 1.08;
export const KARUSSELL_VERSATZ_MAX = 0.15; // Motivversatz: höchstens so viel zusätzlich (Anteil einer Slide)
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

// Grundplan ohne Motiv: Anzahl n und kleinster Zoom, bei dem n Slides genau passen.
// sichtbar = Anteil der Bandfläche, der im Carousel bleibt.
export function karussellGrund(B, S = HALT_B) {
  let best = null;
  const nMax = Math.max(1, Math.ceil(B / S));
  for (let n = 1; n <= nMax; n++) {
    const zoom = Math.max(1, (n * S) / B);
    if (zoom > KARUSSELL_ZOOM_MAX + 1e-9) continue;
    const sichtbar = (n * S) / (B * zoom * zoom);
    if (!best || sichtbar > best.sichtbar + 1e-12) best = { n, zoom, sichtbar };
  }
  // Kürzer als eine Slide auch mit 8 % Zoom: eine Slide, so groß wie nötig. Nie leere Flächen.
  if (!best) best = { n: 1, zoom: S / B, sichtbar: B / S };
  return best;
}

function planAus(B, S, n, zoom, versatz, dichte) {
  const sicht = S / zoom;
  const hoehe = HALT_H / zoom;
  const grenzen = Array.from({ length: Math.max(0, n - 1) }, (_, k) => versatz + (k + 1) * sicht);
  return {
    anzahl: n, zoom, versatz, sicht, hoehe, y0: (HALT_H - hoehe) / 2, grenzen,
    verlust: 1 - (n * sicht * hoehe) / (B * HALT_H),
    treffer: dichte ? grenzen.map((g) => ({ x: g, dichte: dichte(g) })).filter((t) => t.dichte >= KARUSSELL_TREFFER) : [],
  };
}

export const karussellAnzahl = (x) => karussellGrund(bandBreite(x)).n;

// Ausschnitt einer Slide im Band.
export const slideAusschnitt = (plan, k) => ({ x0: plan.versatz + k * plan.sicht, y0: plan.y0, w: plan.sicht, h: plan.hoehe });

export function karussellPlan(x, profil = null, { schritt = PROFIL_SCHRITT } = {}) {
  const B = bandBreite(x);
  const S = HALT_B;
  const g = karussellGrund(B, S);
  const rest = (z) => Math.max(0, B - (g.n * S) / z); // was am Anfang und Ende wegfällt
  const mitte = planAus(B, S, g.n, g.zoom, rest(g.zoom) / 2, null);
  let max = 0;
  if (profil) for (const v of profil) if (v > max) max = v;
  if (!profil || !profil.length || max <= 0 || g.n < 1) return mitte;
  const fenster = Math.max(1, Math.round(KARUSSELL_GRENZE_FENSTER / schritt));
  const dichte = (xb) => {
    const k = Math.round(xb / schritt);
    let s = 0;
    let n = 0;
    for (let j = k - fenster; j <= k + fenster; j++) if (j >= 0 && j < profil.length) { s += profil[j] / max; n++; }
    return n ? s / n : 0;
  };
  // Am Anfang und Ende: Motive, die beim Wegschneiden getroffen würden, zählen ebenfalls.
  const randKosten = (v, z) => (v > 0 ? 0.5 * dichte(v) : 0) + (B - v - (g.n * S) / z > 0 ? 0.5 * dichte(v + (g.n * S) / z) : 0);
  const kosten = (z, v) => planAus(B, S, g.n, z, v, null).grenzen.reduce((s, x) => s + dichte(x), 0) + randKosten(v, z);
  const basis = kosten(g.zoom, mitte.versatz);
  let best = { k: basis, z: g.zoom, v: mitte.versatz };
  // Zusätzlicher Spielraum für den Motivversatz: höchstens 15 % einer Slide, und der Zoom bleibt bei 8 %.
  const zMax = Math.max(g.zoom, Math.min(KARUSSELL_ZOOM_MAX, (g.n * S) / Math.max(1, (g.n * S) / g.zoom - KARUSSELL_VERSATZ_MAX * S)));
  for (let z = g.zoom; z <= zMax + 1e-9; z += 0.0025) {
    const r = rest(z);
    for (let v = 0; v <= r + 1e-9; v += 2) {
      const extra = (planAus(B, S, g.n, z, v, null).verlust - mitte.verlust);
      const k = kosten(z, v) + 0.5 * extra + 0.002 * Math.abs(v - r / 2) / S; // bei gleichem Ergebnis: wenig Bild weg, mittig
      if (k < best.k - 1e-9) best = { k, z, v };
    }
  }
  if (basis - best.k < 0.05) return planAus(B, S, g.n, g.zoom, mitte.versatz, dichte); // lohnt sich nicht
  return planAus(B, S, g.n, best.z, best.v, dichte);
}

// --- Fahrt ---
export const FAHRT_B = 1080;
export const FAHRT_H = 1920;
export const FAHRT_FPS = 30;
export const TEMPI = [220, 450, 900]; // langsam, mittel, schnell (Pixel je Sekunde im Video)
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

export function reelPlan(x, { von = 0, bis = null, laenge = 30 } = {}) {
  const br = alsBreiten(x);
  const n = br.length;
  if (bis == null) bis = n - 1;
  von = Math.max(0, Math.min(n - 1, von));
  bis = Math.max(von, Math.min(n - 1, bis));
  const f = FAHRT_H / HALT_H;
  const { x0, x1 } = abschnittBereich(br, von, bis);
  const sicht = FAHRT_B / f; // Bandpixel im Bild
  const weg = Math.max(0, (x1 - x0) * f - FAHRT_B);
  const bewegung = laenge;
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
    f, von, bis, x0, x1, sicht, weg, tempo, bewegung, auslauf: R, laenge,
    dauer: laenge, bilder: Math.round(laenge * FAHRT_FPS), zuSchnell, vorschlag,
    xBand: (t) => x0 + pos(t) / f,
  };
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
