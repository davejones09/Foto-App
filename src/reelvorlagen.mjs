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
  runter: 0.3,
  links: 0.3,
  rush: 0.35,
  kreis: 0.45,
  streifen: 0.5,
  kacheln: 0.5,
  wirbel: 0.4,
  blende: 0.6,
  dunkel: 0.5,
  zoomdurch: 0.35,
  zoomraus: 0.45,
  diagonal: 0.45,
  jalousie: 0.5,
  tuer: 0.5,
};
export const UEBERGANG_IDS = Object.keys(UEBERGAENGE);
export const BEWEGUNGEN = ['keine', 'puls', 'stoss', 'drift', 'wackel', 'atmen', 'schwenk'];

// Stimmungen, in denen die Vorlagen sortiert sind.
export const GRUPPEN = ['energie', 'cinematic', 'ruhig', 'retro', 'minimal', 'reise', 'food', 'hotel'];

// schlaege: Standzeit der Fotos in Schlägen, reihum. arten: Übergänge, reihum. bewegung: was das Foto im Stand macht.
export const VORLAGEN = [
  { id: 'v-beat', gruppe: 'energie', schlaege: [2], arten: ['schnitt'], bewegung: 'puls' },
  { id: 'v-blitz', gruppe: 'energie', schlaege: [2, 1, 1], arten: ['blitz'], bewegung: 'stoss' },
  { id: 'v-slide', gruppe: 'reise', schlaege: [3], arten: ['schieb'], bewegung: 'stoss' },
  { id: 'v-swipe', gruppe: 'reise', schlaege: [3], arten: ['hoch'], bewegung: 'stoss' },
  { id: 'v-rush', gruppe: 'energie', schlaege: [2], arten: ['rush'], bewegung: 'puls' },
  { id: 'v-spot', gruppe: 'hotel', schlaege: [3], arten: ['kreis'], bewegung: 'drift' },
  { id: 'v-streifen', gruppe: 'hotel', schlaege: [3], arten: ['streifen'], bewegung: 'drift' },
  { id: 'v-mosaik', gruppe: 'minimal', schlaege: [3], arten: ['kacheln'], bewegung: 'stoss' },
  { id: 'v-wirbel', gruppe: 'energie', schlaege: [2], arten: ['wirbel'], bewegung: 'stoss' },
  { id: 'v-drop', gruppe: 'energie', schlaege: [4, 2, 2, 1, 1, 1, 1], arten: ['schnitt', 'schnitt', 'blitz'], bewegung: 'wackel' },
  { id: 'v-mix', gruppe: 'energie', schlaege: [2, 2, 1, 1, 3], arten: ['schieb', 'blitz', 'kreis', 'wirbel', 'hoch', 'streifen', 'rush', 'kacheln', 'schnitt'], bewegung: 'stoss' },
  // Beat und Energie
  { id: 'v-puls', gruppe: 'energie', schlaege: [1], arten: ['schnitt'], bewegung: 'puls' },
  { id: 'v-stakkato', gruppe: 'energie', schlaege: [1, 1, 2], arten: ['schnitt', 'schnitt', 'blitz'], bewegung: 'stoss' },
  { id: 'v-hype', gruppe: 'energie', schlaege: [2, 1, 1, 2, 1, 1], arten: ['zoomdurch', 'blitz', 'schieb', 'schnitt'], bewegung: 'wackel' },
  // Cinematic
  { id: 'v-kino', gruppe: 'cinematic', schlaege: [4], arten: ['blende'], bewegung: 'drift' },
  { id: 'v-epos', gruppe: 'cinematic', schlaege: [6, 4], arten: ['dunkel'], bewegung: 'drift' },
  { id: 'v-trailer', gruppe: 'cinematic', schlaege: [4, 4, 2, 2, 1, 1], arten: ['dunkel', 'schnitt', 'blitz'], bewegung: 'stoss' },
  { id: 'v-zoomfahrt', gruppe: 'cinematic', schlaege: [3], arten: ['zoomdurch'], bewegung: 'drift' },
  { id: 'v-weite', gruppe: 'cinematic', schlaege: [5], arten: ['blende', 'links'], bewegung: 'schwenk' },
  // Ruhig und elegant
  { id: 'v-sanft', gruppe: 'ruhig', schlaege: [4], arten: ['blende'], bewegung: 'atmen' },
  { id: 'v-seide', gruppe: 'ruhig', schlaege: [4], arten: ['blende', 'zoomraus'], bewegung: 'drift' },
  { id: 'v-ruhe', gruppe: 'ruhig', schlaege: [6], arten: ['blende'], bewegung: 'keine' },
  { id: 'v-galerie', gruppe: 'ruhig', schlaege: [4], arten: ['links'], bewegung: 'keine' },
  // Retro und Film
  { id: 'v-diashow', gruppe: 'retro', schlaege: [4], arten: ['schnitt'], bewegung: 'keine' },
  { id: 'v-film', gruppe: 'retro', schlaege: [3, 2], arten: ['dunkel', 'schnitt'], bewegung: 'wackel' },
  { id: 'v-jalousie', gruppe: 'retro', schlaege: [3], arten: ['jalousie'], bewegung: 'stoss' },
  { id: 'v-projektor', gruppe: 'retro', schlaege: [3], arten: ['blitz', 'dunkel'], bewegung: 'atmen' },
  // Minimal
  { id: 'v-minimal', gruppe: 'minimal', schlaege: [3], arten: ['schnitt'], bewegung: 'keine' },
  { id: 'v-linie', gruppe: 'minimal', schlaege: [3], arten: ['diagonal'], bewegung: 'keine' },
  { id: 'v-weiss', gruppe: 'minimal', schlaege: [3], arten: ['blitz'], bewegung: 'keine' },
  // Reise-Story
  { id: 'v-reise', gruppe: 'reise', schlaege: [3, 2, 2], arten: ['schieb', 'hoch', 'runter', 'links'], bewegung: 'drift' },
  { id: 'v-postkarte', gruppe: 'reise', schlaege: [4], arten: ['kreis', 'blende'], bewegung: 'drift' },
  { id: 'v-roadtrip', gruppe: 'reise', schlaege: [2, 2, 4], arten: ['schieb', 'links'], bewegung: 'schwenk' },
  // Food
  { id: 'v-food', gruppe: 'food', schlaege: [2, 2, 1, 1], arten: ['zoomraus', 'schnitt', 'blitz'], bewegung: 'stoss' },
  { id: 'v-genuss', gruppe: 'food', schlaege: [3], arten: ['blende', 'zoomdurch'], bewegung: 'atmen' },
  { id: 'v-teller', gruppe: 'food', schlaege: [2], arten: ['kreis'], bewegung: 'puls' },
  // Hotel und Architektur
  { id: 'v-architektur', gruppe: 'hotel', schlaege: [4], arten: ['tuer'], bewegung: 'schwenk' },
  { id: 'v-linien', gruppe: 'hotel', schlaege: [3], arten: ['diagonal', 'streifen'], bewegung: 'drift' },
  { id: 'v-suite', gruppe: 'hotel', schlaege: [4], arten: ['blende', 'runter'], bewegung: 'atmen' },
];
export const VORLAGEN_IDS = VORLAGEN.map((v) => v.id);

// Eigene Vorlagen des Nutzers (Ids beginnen mit „e-“), von der Oberfläche aus den Einstellungen gesetzt.
const EIGENE = new Map();
export function eigeneSetzen(liste) {
  EIGENE.clear();
  for (const v of liste || []) if (v?.id?.startsWith('e-') && gueltig(v)) EIGENE.set(v.id, v);
}
export const eigeneVorlagen = () => [...EIGENE.values()];

export function gueltig(v) {
  return Array.isArray(v.schlaege) && v.schlaege.length > 0 && v.schlaege.every((x) => x > 0 && x <= 16)
    && Array.isArray(v.arten) && v.arten.length > 0 && v.arten.every((a) => a in UEBERGAENGE) && BEWEGUNGEN.includes(v.bewegung);
}

export const istVorlage = (id) => VORLAGEN_IDS.includes(id) || EIGENE.has(id);

// Zufallszahlen aus einem Startwert: Dieselbe Variante sieht immer gleich aus.
function zufall(saat) {
  let x = (saat * 2654435761) >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

// Verwandte Übergänge und Bewegungen: Eine Variante bleibt in der Stimmung der Vorlage.
const FAMILIEN = [
  ['schnitt', 'blitz'],
  ['schieb', 'hoch', 'runter', 'links'],
  ['rush', 'zoomdurch', 'wirbel'],
  ['blende', 'dunkel', 'zoomraus'],
  ['kreis', 'diagonal', 'tuer'],
  ['streifen', 'kacheln', 'jalousie'],
];
const BEWEGUNG_FAMILIEN = [['keine', 'atmen'], ['drift', 'schwenk', 'atmen'], ['puls', 'stoss', 'wackel']];
const verwandt = (x, familien) => familien.find((f) => f.includes(x)) || [x];

// Vorlage mit Variante: andere Reihenfolge der Übergänge, verwandte Übergänge, andere Betonung, andere Bewegung.
export function vorlageAus(id, variante = 0) {
  const v = typeof id === 'object' ? id : (VORLAGEN.find((x) => x.id === id) || EIGENE.get(id));
  if (!v || !variante) return v || null;
  const r = zufall(variante);
  const arten = v.arten.map((a) => (r() < 0.45 ? (() => { const f = verwandt(a, FAMILIEN); return f[Math.floor(r() * f.length)]; })() : a));
  for (let i = arten.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arten[i], arten[j]] = [arten[j], arten[i]]; }
  // Bei nur einer Übergangsart eine verwandte dazunehmen, sonst sähe die Variante gleich aus.
  if (arten.length === 1) { const f = verwandt(arten[0], FAMILIEN).filter((x) => x !== arten[0]); if (f.length) arten.push(f[Math.floor(r() * f.length)]); }
  const dreh = Math.floor(r() * v.schlaege.length);
  const schlaege = [...v.schlaege.slice(dreh), ...v.schlaege.slice(0, dreh)];
  const bf = verwandt(v.bewegung, BEWEGUNG_FAMILIEN);
  const bewegung = r() < 0.5 ? bf[Math.floor(r() * bf.length)] : v.bewegung;
  return { ...v, arten, schlaege, bewegung, variante };
}
const vorlageVon = (id, variante = 0) => vorlageAus(id, variante);

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
export function vorlagenPlan(n, { laenge = null, vorlage = 'v-beat', variante = 0 } = {}) {
  const v = vorlageVon(vorlage, variante);
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
  if (art === 'atmen') return { s: 1.03 + 0.03 * Math.sin(seit * 0.9), qx: 0, qy: 0 };
  if (art === 'schwenk') return { s: 1.12, qx: (lauf - 0.5) * 70, qy: 0 };
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
    case 'runter': {
      const y = schwungKurve(p) * h;
      return { a: { dy: y }, b: { dy: y - h } };
    }
    case 'links': {
      const x = schwungKurve(p) * w;
      return { a: { dx: x }, b: { dx: x - w } };
    }
    case 'blende':
      return { a: {}, b: { alpha: q } };
    case 'dunkel':
      return { a: p < 0.5 ? {} : null, b: p < 0.5 ? null : {}, blitz: 1 - Math.abs(2 * p - 1), farbe: '0, 0, 0' };
    case 'zoomdurch':
      return { a: { faktor: 1 + 2.2 * q * q, alpha: 1 - weich((p - 0.4) / 0.6) }, b: { faktor: 1.25 - 0.25 * q, alpha: weich((p - 0.3) / 0.7) } };
    case 'zoomraus':
      return { a: {}, b: { faktor: 1.35 - 0.35 * q, alpha: q } };
    case 'diagonal':
    case 'jalousie':
    case 'tuer':
      return { a: {}, b: {}, maske: art };
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

// Maske des nächsten Bilds als Pfad. Für alle Maler gleich, damit Vorschau, Clips und Fotos gleich aussehen.
export function maskePfad(ctx, maske, p, W, H) {
  if (maske === 'kreis') {
    const k = kreisMaske(p, W, H);
    ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2);
    return;
  }
  if (maske === 'diagonal') {
    // Schräge Kante von links unten nach rechts oben: Bereich x + (H − y) ≤ d, mit dem Rahmen geschnitten.
    const d = weich(p) * (W + H + 8) - 4;
    const ecken = [[-2, -2], [W + 2, -2], [W + 2, H + 2], [-2, H + 2]];
    const wert = ([x, y]) => x + (H - y) - d;
    const poly = [];
    for (let i = 0; i < 4; i++) {
      const a = ecken[i];
      const b = ecken[(i + 1) % 4];
      const fa = wert(a);
      const fb = wert(b);
      if (fa <= 0) poly.push(a);
      if ((fa < 0) !== (fb < 0)) {
        const t = fa / (fa - fb);
        poly.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    if (poly.length < 3) return;
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (const q of poly.slice(1)) ctx.lineTo(q[0], q[1]);
    ctx.closePath();
    return;
  }
  if (maske === 'tuer') {
    const b = p <= 0 ? 0 : Math.ceil((weich(p) * W) / 2) + (p >= 1 ? 1 : 0);
    if (b > 0) ctx.rect(Math.floor(W / 2 - b), 0, 2 * b, H);
    return;
  }
  const l = maske === 'streifen' ? streifenMaske(p, W, H) : maske === 'jalousie' ? jalousieMaske(p, W, H) : kachelMaske(p, W, H);
  for (const r of l) ctx.rect(r.x, r.y, r.w, r.h);
}

const LAMELLEN = 9;
export function jalousieMaske(p, W, H) {
  const aus = [];
  for (let k = 0; k < LAMELLEN; k++) {
    const y0 = Math.round((k * H) / LAMELLEN);
    const y1 = Math.round(((k + 1) * H) / LAMELLEN);
    const v = weich(klemme((p - (k * 0.35) / (LAMELLEN - 1)) / 0.65));
    aus.push({ x: 0, y: y0, w: W, h: Math.ceil(v * (y1 - y0)) });
  }
  return aus;
}
