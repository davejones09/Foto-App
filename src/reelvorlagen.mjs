// Reel-Vorlagen: schnelle Schnitte im Takt mit lebhaften Übergängen. Reine Rechnung, in Node getestet;
// gezeichnet wird in ausgabe.mjs. Kein Text, kein Logo. Farben ändern sich nur im Übergang (Blitz).

import { FPS, RAHMEN, weich, schwungKurve } from './reelstil.mjs';

export const TAKT = 0.5; // Sekunden je Schlag, entspricht 120 BPM
const MIN_DAUER = 5;
const STRECKUNG_MAX = 1.8; // darüber laufen die Fotos eine weitere Runde
const STAUCHUNG_MIN = 0.6; // darunter wird es zu hektisch, die App schlägt weniger Fotos vor

export const UEBERGAENGE = {
  schnitt: 0,
  blitz: 0.2,
  schieb: 0.3,
  hoch: 0.3,
  rush: 0.35,
  kreis: 0.45,
  streifen: 0.5,
  kacheln: 0.5,
  wirbel: 0.4,
};

// schlaege: Standzeit der Fotos in Schlägen, reihum. arten: Übergänge, reihum. bewegung: was das Foto im Stand macht.
export const VORLAGEN = [
  { id: 'v-beat', schlaege: [2], arten: ['schnitt'], bewegung: 'puls' },
  { id: 'v-blitz', schlaege: [2, 1, 1], arten: ['blitz'], bewegung: 'stoss' },
  { id: 'v-slide', schlaege: [3], arten: ['schieb'], bewegung: 'stoss' },
  { id: 'v-swipe', schlaege: [3], arten: ['hoch'], bewegung: 'stoss' },
  { id: 'v-rush', schlaege: [2], arten: ['rush'], bewegung: 'puls' },
  { id: 'v-spot', schlaege: [3], arten: ['kreis'], bewegung: 'drift' },
  { id: 'v-streifen', schlaege: [3], arten: ['streifen'], bewegung: 'drift' },
  { id: 'v-mosaik', schlaege: [3], arten: ['kacheln'], bewegung: 'stoss' },
  { id: 'v-wirbel', schlaege: [2], arten: ['wirbel'], bewegung: 'stoss' },
  { id: 'v-drop', schlaege: [4, 2, 2, 1, 1, 1, 1], arten: ['schnitt', 'schnitt', 'blitz'], bewegung: 'wackel' },
  { id: 'v-mix', schlaege: [2, 2, 1, 1, 3], arten: ['schieb', 'blitz', 'kreis', 'wirbel', 'hoch', 'streifen', 'rush', 'kacheln', 'schnitt'], bewegung: 'stoss' },
];
export const VORLAGEN_IDS = VORLAGEN.map((v) => v.id);
export const istVorlage = (id) => VORLAGEN_IDS.includes(id);
const vorlageVon = (id) => VORLAGEN.find((v) => v.id === id);

const klemme = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

// Der Zeitplan einer Runde über alle Fotos, ungestreckt.
function rohzeiten(v, anzahl) {
  const stand = [];
  const art = [];
  const tr = [];
  for (let k = 0; k < anzahl; k++) {
    stand.push(v.schlaege[k % v.schlaege.length] * TAKT);
    if (k < anzahl - 1) {
      art.push(v.arten[k % v.arten.length]);
      tr.push(UEBERGAENGE[art[k]]);
    }
  }
  const summe = (l) => l.reduce((s, x) => s + x, 0);
  return { stand, art, tr, summeStand: summe(stand), summeTr: summe(tr) };
}

function faktor(v, n, laenge) {
  // Weitere Runden, bis die Fotos nicht mehr zu lange stehen.
  for (let runden = 1; ; runden++) {
    const r = rohzeiten(v, n * runden);
    const f = (laenge - r.summeTr) / r.summeStand;
    if (f <= STRECKUNG_MAX || runden >= 40) return { runden, f, r };
  }
}

// laenge = null: Auto, jedes Foto einmal im Originaltakt, mindestens 5 Sekunden.
export function vorlagenPlan(n, { laenge = null, vorlage = 'v-beat' } = {}) {
  const v = vorlageVon(vorlage);
  if (!v) throw new Error(`Unbekannte Vorlage ${vorlage}`);
  const anzahl = Math.max(1, n);
  let runden = 1;
  let f = 1;
  let r = rohzeiten(v, anzahl);
  const auto = laenge == null;
  if (auto) {
    const roh = r.summeStand + r.summeTr;
    if (roh < MIN_DAUER) f = (MIN_DAUER - r.summeTr) / r.summeStand;
  } else {
    ({ runden, f, r } = faktor(v, anzahl, laenge));
  }
  const zuKurz = f < STAUCHUNG_MIN - 1e-9;
  let maxFotos = anzahl;
  if (!auto) {
    maxFotos = 1;
    for (let m = 1; m <= 200; m++) {
      if (faktor(v, m, laenge).f >= STAUCHUNG_MIN - 1e-9) maxFotos = m;
      else break;
    }
  }
  const staende = r.stand.map((s) => s * Math.max(f, 0.01));
  const beginn = [];
  let t = 0;
  staende.forEach((s, k) => {
    beginn.push(t);
    t += s + (r.tr[k] || 0);
  });
  const dauer = Math.round(t * FPS) / FPS;
  return {
    stil: vorlage,
    vorlage,
    auto,
    bewegung: v.bewegung,
    n: anzahl,
    runden,
    laenge: auto ? Math.round(dauer) : laenge,
    dauer,
    bilder: Math.round(dauer * FPS),
    stand: staende.reduce((s, x) => s + x, 0) / staende.length,
    takt: TAKT * Math.max(f, 0.01),
    staende,
    beginn,
    uebergaenge: r.tr,
    arten: r.art,
    zuKurz,
    maxFotos,
  };
}

// Was zur Zeit t zu sehen ist. k: Foto im Stand, j: nächstes Foto im Übergang mit Fortschritt p und dessen Art.
export function vorlagenZustand(plan, t) {
  const zeit = klemme(t, 0, plan.dauer);
  const { beginn, staende, uebergaenge, n } = plan;
  let lo = 0;
  let hi = beginn.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (beginn[m] <= zeit) lo = m;
    else hi = m - 1;
  }
  const s = lo;
  const seit = zeit - beginn[s];
  const aus = { schritt: s, i: s % n, j: null, p: null, art: null, seit, seitJ: 0, lauf: klemme(seit / (staende[s] + (uebergaenge[s] || 0))), laufJ: 0 };
  if (s < beginn.length - 1 && seit > staende[s] && uebergaenge[s] > 0) {
    aus.j = (s + 1) % n;
    aus.p = klemme((seit - staende[s]) / uebergaenge[s]);
    aus.art = plan.arten[s];
    aus.seitJ = 0;
  }
  return aus;
}

// Bewegung im Stand: Maßstab (immer mindestens 1, damit nie ein Rand sichtbar wird) und Versatz im Ausschnitt.
export function bewegung(art, seit, takt, lauf) {
  if (art === 'puls') {
    const phase = (seit / takt) % 1;
    return { s: 1.02 + 0.09 * Math.exp(-phase * 5), qx: 0, qy: 0 };
  }
  if (art === 'stoss') return { s: 1 + 0.14 * Math.exp(-seit / 0.14) + 0.03 * lauf, qx: 0, qy: 0 };
  if (art === 'drift') return { s: 1 + 0.07 * lauf, qx: 0, qy: 0 };
  if (art === 'wackel') {
    const d = Math.exp(-seit / 0.25);
    return { s: 1.08 + 0.08 * Math.exp(-seit / 0.15), qx: Math.sin(seit * 47) * 22 * d, qy: Math.cos(seit * 39) * 16 * d };
  }
  return { s: 1, qx: 0, qy: 0 };
}

// Lage beider Fotos im Übergang. a: bisheriges, b: nächstes (null = noch nicht zu sehen). blitz: Weiß-Deckung.
export function uebergangLage(art, p) {
  const q = weich(p);
  const w = RAHMEN.w;
  const h = RAHMEN.h;
  switch (art) {
    case 'blitz':
      return { a: p < 0.5 ? {} : null, b: p < 0.5 ? null : {}, blitz: 1 - Math.abs(2 * p - 1) };
    case 'schieb': {
      const x = -schwungKurve(p) * w;
      return { a: { dx: x }, b: { dx: x + w } };
    }
    case 'hoch': {
      const y = -schwungKurve(p) * h;
      return { a: { dy: y }, b: { dy: y + h } };
    }
    case 'rush':
      return { a: { faktor: 1 + 1.4 * q * q }, b: { faktor: 0.6 + 0.4 * q, alpha: weich(p * 1.6) } };
    case 'wirbel':
      // Der Maßstab wächst mit dem Winkel so, dass der gedrehte Rahmen immer ganz gefüllt ist.
      return { a: { rot: 0.5 * p * p, faktor: 1 + p * p }, b: { rot: -0.5 * (1 - q), faktor: 1 + (1 - q), alpha: weich((p - 0.35) / 0.65) } };
    case 'kreis':
    case 'streifen':
    case 'kacheln':
      return { a: {}, b: {}, maske: art };
    default:
      return { a: null, b: {} };
  }
}

// Masken in Rahmenpixeln, ganzzahlig, damit keine Haarlinien entstehen.
export function kreisMaske(p, W, H, mitteX = 0.5, mitteY = 0.5) {
  const fern = Math.hypot(Math.max(mitteX, 1 - mitteX) * W, Math.max(mitteY, 1 - mitteY) * H);
  return { x: mitteX * W, y: mitteY * H, r: weich(p) * (fern + 2) };
}

const STREIFEN = 6;
export function streifenMaske(p, W, H) {
  const aus = [];
  for (let k = 0; k < STREIFEN; k++) {
    const x0 = Math.round((k * W) / STREIFEN);
    const x1 = Math.round(((k + 1) * W) / STREIFEN);
    const v = weich(klemme((p - (k * 0.5) / (STREIFEN - 1)) / 0.5));
    const hoehe = Math.ceil(v * H);
    aus.push({ x: x0, y: k % 2 ? H - hoehe : 0, w: x1 - x0, h: hoehe });
  }
  return aus;
}

const SP = 4;
const ZE = 7;
// Feste, gemischte Reihenfolge der Kacheln.
const ORDNUNG = Array.from({ length: SP * ZE }, (_, k) => k).sort((a, b) => ((a * 37 + 11) % 29) - ((b * 37 + 11) % 29) || a - b);
export function kachelMaske(p, W, H) {
  const zahl = Math.ceil(klemme(p) * ORDNUNG.length);
  return ORDNUNG.slice(0, zahl).map((k) => {
    const sp = k % SP;
    const ze = Math.floor(k / SP);
    const x = Math.round((sp * W) / SP);
    const y = Math.round((ze * H) / ZE);
    return { x, y, w: Math.round(((sp + 1) * W) / SP) - x, h: Math.round(((ze + 1) * H) / ZE) - y };
  });
}
