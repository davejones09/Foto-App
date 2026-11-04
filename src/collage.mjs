// Collage: Formate, Vorlagen, Feldrechtecke, Ausschnitte und Nähte. Reine Rechnung, in Node getestet.
// Grundregel: keine Farbänderung. Im Stil „Nahtlos“ wird nur im schmalen Streifen an einer gemeinsamen
// Kante zweier Felder überblendet (uebergang.mjs), sonst ist jedes Feld das unveränderte Foto.

export const BREITE = 2160;
export const FORMATE = { '4:5': [4, 5], '1:1': [1, 1], '9:16': [9, 16] };
export const FOTOS_MIN = 2;
export const FOTOS_MAX = 9;
export const ZOOM_MAX = 6;
export const ABSTAND_MAX = 0.05; // Anteil der Breite
export const FARBEN = ['#ffffff', '#f1ece4', '#1a1b1d', '#000000'];

export const masse = (format, breite = BREITE) => {
  const [a, b] = FORMATE[format] || FORMATE['4:5'];
  return { w: breite, h: Math.round((breite * b) / a) };
};

const d = 1 / 3;
// Felder in Anteilen der Fläche: [x, y, w, h]. Je Fotoanzahl Raster, ein großes Foto mit kleinen und asymmetrische.
export const VORLAGEN = [
  { id: 'z2-spalten', n: 2, felder: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { id: 'z2-zeilen', n: 2, felder: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { id: 'z2-gross-oben', n: 2, felder: [[0, 0, 1, 0.64], [0, 0.64, 1, 0.36]] },
  { id: 'z2-gross-links', n: 2, felder: [[0, 0, 0.62, 1], [0.62, 0, 0.38, 1]] },
  { id: 'z3-spalten', n: 3, felder: [[0, 0, d, 1], [d, 0, d, 1], [2 * d, 0, d, 1]] },
  { id: 'z3-zeilen', n: 3, felder: [[0, 0, 1, d], [0, d, 1, d], [0, 2 * d, 1, d]] },
  { id: 'z3-gross-links', n: 3, felder: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]] },
  { id: 'z3-gross-oben', n: 3, felder: [[0, 0, 1, 0.6], [0, 0.6, 0.5, 0.4], [0.5, 0.6, 0.5, 0.4]] },
  { id: 'z3-versetzt', n: 3, felder: [[0, 0, 0.6, 0.42], [0, 0.42, 0.6, 0.58], [0.6, 0, 0.4, 1]] },
  { id: 'z4-raster', n: 4, felder: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: 'z4-gross-oben', n: 4, felder: [[0, 0, 1, 0.6], [0, 0.6, d, 0.4], [d, 0.6, d, 0.4], [2 * d, 0.6, d, 0.4]] },
  { id: 'z4-gross-links', n: 4, felder: [[0, 0, 0.62, 1], [0.62, 0, 0.38, d], [0.62, d, 0.38, d], [0.62, 2 * d, 0.38, d]] },
  { id: 'z4-versetzt', n: 4, felder: [[0, 0, 0.55, 0.4], [0.55, 0, 0.45, 0.6], [0, 0.4, 0.55, 0.6], [0.55, 0.6, 0.45, 0.4]] },
  { id: 'z5-gross', n: 5, felder: [[0, 0, 0.6, 0.6], [0.6, 0, 0.4, 0.3], [0.6, 0.3, 0.4, 0.3], [0, 0.6, 0.5, 0.4], [0.5, 0.6, 0.5, 0.4]] },
  { id: 'z5-zeilen', n: 5, felder: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, d, 0.5], [d, 0.5, d, 0.5], [2 * d, 0.5, d, 0.5]] },
  { id: 'z5-mosaik', n: 5, felder: [[0, 0, 0.4, 0.35], [0.4, 0, 0.6, 0.55], [0, 0.35, 0.4, 0.65], [0.4, 0.55, 0.3, 0.45], [0.7, 0.55, 0.3, 0.45]] },
  { id: 'z6-raster-2x3', n: 6, felder: [[0, 0, 0.5, d], [0.5, 0, 0.5, d], [0, d, 0.5, d], [0.5, d, 0.5, d], [0, 2 * d, 0.5, d], [0.5, 2 * d, 0.5, d]] },
  { id: 'z6-raster-3x2', n: 6, felder: [[0, 0, d, 0.5], [d, 0, d, 0.5], [2 * d, 0, d, 0.5], [0, 0.5, d, 0.5], [d, 0.5, d, 0.5], [2 * d, 0.5, d, 0.5]] },
  { id: 'z6-gross', n: 6, felder: [[0, 0, 2 * d, 2 * d], [2 * d, 0, d, d], [2 * d, d, d, d], [0, 2 * d, d, d], [d, 2 * d, d, d], [2 * d, 2 * d, d, d]] },
  { id: 'z7-gross-oben', n: 7, felder: [[0, 0, 1, 0.5], [0, 0.5, d, 0.25], [d, 0.5, d, 0.25], [2 * d, 0.5, d, 0.25], [0, 0.75, d, 0.25], [d, 0.75, d, 0.25], [2 * d, 0.75, d, 0.25]] },
  { id: 'z7-mosaik', n: 7, felder: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.25], [0.5, 0.25, 0.25, 0.25], [0.75, 0.25, 0.25, 0.25], [0, 0.5, d, 0.5], [d, 0.5, d, 0.5], [2 * d, 0.5, d, 0.5]] },
  { id: 'z8-raster', n: 8, felder: [0, 1, 2, 3].flatMap((r) => [[0, r * 0.25, 0.5, 0.25], [0.5, r * 0.25, 0.5, 0.25]]) },
  { id: 'z8-gross', n: 8, felder: [[0, 0, 0.5, 0.5], [0.5, 0, 0.25, 0.25], [0.75, 0, 0.25, 0.25], [0.5, 0.25, 0.25, 0.25], [0.75, 0.25, 0.25, 0.25], [0, 0.5, d, 0.5], [d, 0.5, d, 0.5], [2 * d, 0.5, d, 0.5]] },
  { id: 'z9-raster', n: 9, felder: [0, 1, 2].flatMap((r) => [[0, r * d, d, d], [d, r * d, d, d], [2 * d, r * d, d, d]]) },
  { id: 'z9-gross', n: 9, felder: [[0, 0, 2 * d, 0.5], [2 * d, 0, d, 0.25], [2 * d, 0.25, d, 0.25], [0, 0.5, d, 0.25], [d, 0.5, d, 0.25], [2 * d, 0.5, d, 0.25], [0, 0.75, d, 0.25], [d, 0.75, d, 0.25], [2 * d, 0.75, d, 0.25]] },
];

// Weitere Vorlagen als Schnittbäume: garantiert lückenlos und durchgehend schneidbar.
// sp = nebeneinander, ze = untereinander, Anteile zuerst. Eine 0 ist ein einzelnes Feld.
const sp = (...t) => ({ art: 'v', t });
const ze = (...t) => ({ art: 'h', t });
const teile = (k, x, y, w, h, aus = []) => {
  if (k === 0) { aus.push([x, y, w, h]); return aus; }
  let pos = 0;
  for (const [anteil, kind] of k.t) {
    if (k.art === 'v') teile(kind, x + pos * w, y, anteil * w, h, aus);
    else teile(kind, x, y + pos * h, w, anteil * h, aus);
    pos += anteil;
  }
  return aus;
};
const gleich = (art, n) => ({ art, t: Array.from({ length: n }, () => [1 / n, 0]) });
const WEITERE = {
  'z2-gross-unten': ze([0.36, 0], [0.64, 0]),
  'z2-gross-rechts': sp([0.38, 0], [0.62, 0]),
  'z3-gross-rechts': sp([0.4, ze([0.5, 0], [0.5, 0])], [0.6, 0]),
  'z3-gross-unten': ze([0.4, sp([0.5, 0], [0.5, 0])], [0.6, 0]),
  'z3-streifen': ze([0.25, 0], [0.5, 0], [0.25, 0]),
  'z4-gross-rechts': sp([0.38, gleich('h', 3)], [0.62, 0]),
  'z4-gross-unten': ze([0.4, gleich('v', 3)], [0.6, 0]),
  'z4-treppe': sp([0.4, ze([0.65, 0], [0.35, 0])], [0.6, ze([0.35, 0], [0.65, 0])]),
  'z4-band': ze([0.25, 0], [0.5, sp([0.5, 0], [0.5, 0])], [0.25, 0]),
  'z5-gross-mitte': ze([0.25, sp([0.5, 0], [0.5, 0])], [0.5, 0], [0.25, sp([0.5, 0], [0.5, 0])]),
  'z5-gross-rechts': sp([0.4, ze([0.5, sp([0.5, 0], [0.5, 0])], [0.5, 0])], [0.6, ze([0.65, 0], [0.35, 0])]),
  'z5-treppe': sp([0.5, ze([0.3, 0], [0.7, 0])], [0.5, ze([0.45, 0], [0.3, 0], [0.25, 0])]),
  'z5-saeule': sp([0.34, 0], [0.66, ze([0.5, sp([0.5, 0], [0.5, 0])], [0.5, sp([0.6, 0], [0.4, 0])])]),
  'z6-gross-oben': ze([0.5, 0], [0.5, ze([0.5, sp([0.5, 0], [0.5, 0])], [0.5, gleich('v', 3)])]),
  'z6-gross-rechts': sp([d, gleich('h', 3)], [2 * d, ze([2 * d, 0], [d, sp([0.5, 0], [0.5, 0])])]),
  'z6-treppe': sp([0.5, ze([0.28, 0], [0.42, 0], [0.3, 0])], [0.5, ze([0.42, 0], [0.28, 0], [0.3, 0])]),
  'z6-mosaik': ze([0.55, sp([0.62, 0], [0.38, ze([0.5, 0], [0.5, 0])])], [0.45, sp([0.38, ze([0.5, 0], [0.5, 0])], [0.62, 0])]),
  'z7-gross-mitte': ze([0.28, gleich('v', 3)], [0.44, 0], [0.28, gleich('v', 3)]),
  'z7-gross-links': sp([0.6, ze([0.6, 0], [0.4, sp([0.5, 0], [0.5, 0])])], [0.4, gleich('h', 4)]),
  'z7-raster': ze([d, sp([0.5, 0], [0.5, 0])], [d, gleich('v', 3)], [d, sp([0.5, 0], [0.5, 0])]),
  'z7-treppe': sp([d, ze([0.4, 0], [0.6, 0])], [d, ze([0.6, 0], [0.4, 0])], [d, gleich('h', 3)]),
  'z7-saeule': sp([0.5, ze([0.6, 0], [0.4, sp([0.5, 0], [0.5, 0])])], [0.5, ze([0.35, sp([0.5, 0], [0.5, 0])], [0.4, 0], [0.25, 0])]),
  'z8-gross-mitte': ze([0.25, gleich('v', 3)], [0.5, sp([0.68, 0], [0.32, ze([0.5, 0], [0.5, 0])])], [0.25, sp([0.5, 0], [0.5, 0])]),
  'z8-raster-3': ze([d, gleich('v', 3)], [d, sp([0.5, 0], [0.5, 0])], [d, gleich('v', 3)]),
  'z8-treppe': sp([0.5, ze([0.2, 0], [0.3, 0], [0.3, 0], [0.2, 0])], [0.5, ze([0.3, 0], [0.2, 0], [0.2, 0], [0.3, 0])]),
  'z8-mosaik': ze([0.5, sp([0.5, 0], [0.5, ze([0.5, sp([0.5, 0], [0.5, 0])], [0.5, 0])])], [0.5, sp([0.5, ze([0.5, 0], [0.5, sp([0.5, 0], [0.5, 0])])], [0.5, 0])]),
  'z9-gross-mitte': ze([0.25, gleich('v', 3)], [0.5, sp([0.25, 0], [0.5, 0], [0.25, 0])], [0.25, gleich('v', 3)]),
  'z9-gross-oben': ze([0.46, 0], [0.54, ze([0.5, sp([0.25, 0], [0.25, 0], [0.25, 0], [0.25, 0])], [0.5, sp([0.25, 0], [0.25, 0], [0.25, 0], [0.25, 0])])]),
  'z9-treppe': sp([d, ze([0.25, 0], [0.4, 0], [0.35, 0])], [d, ze([0.4, 0], [0.35, 0], [0.25, 0])], [d, ze([0.35, 0], [0.25, 0], [0.4, 0])]),
  'z9-mosaik': ze([0.5, sp([0.5, 0], [0.5, ze([0.5, sp([0.5, 0], [0.5, 0])], [0.5, sp([0.5, 0], [0.5, 0])])])], [0.5, sp([d, 0], [d, ze([0.5, 0], [0.5, 0])], [d, 0])]),
};
for (const [id, k] of Object.entries(WEITERE)) {
  const felder = teile(k, 0, 0, 1, 1);
  VORLAGEN.push({ id, n: felder.length, felder });
}
VORLAGEN.sort((p, q) => p.n - q.n);

export const vorlagenFuer = (n) => VORLAGEN.filter((v) => v.n === n);
export const vorlage = (id, n) => VORLAGEN.find((v) => v.id === id && (n == null || v.n === n)) || vorlagenFuer(n)[0] || null;

// Feldrechtecke in Pixeln. Mit Rahmen: Abstand a zwischen den Feldern und als Rand. Nahtlos: a = 0.
export function feldRechtecke(v, W, H, { abstand = 0 } = {}) {
  const a = Math.round(abstand * W);
  const innenW = W - a;
  const innenH = H - a;
  return v.felder.map(([fx, fy, fw, fh]) => {
    const x0 = Math.round(a / 2 + fx * innenW + a / 2);
    const y0 = Math.round(a / 2 + fy * innenH + a / 2);
    const x1 = Math.round(a / 2 + (fx + fw) * innenW - a / 2);
    const y1 = Math.round(a / 2 + (fy + fh) * innenH - a / 2);
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  });
}

// Breite des Übergangs an einer Schnittlinie: 22 % des schmaleren Nachbarn, gerade, 16 bis 362 Pixel.
export const uebergangsBreite = (m) => Math.max(16, Math.min(362, 2 * Math.round(0.11 * m)));

// Jede Vorlage lässt sich durchgehend zerschneiden (Guillotine): erst eine Linie durch die ganze Fläche,
// dann durch jede Hälfte und so weiter. Liefert den Schnittbaum der Felder.
export function baum(r, liste = r.map((_, i) => i)) {
  if (liste.length === 1) return { blatt: liste[0] };
  const rand = (f) => ({ x0: r[f].x, x1: r[f].x + r[f].w, y0: r[f].y, y1: r[f].y + r[f].h });
  for (const art of ['v', 'h']) {
    const kanten = [...new Set(liste.map((f) => (art === 'v' ? rand(f).x1 : rand(f).y1)))].sort((x, y) => x - y);
    for (const c of kanten) {
      const a = liste.filter((f) => (art === 'v' ? rand(f).x1 : rand(f).y1) <= c + 1);
      const b = liste.filter((f) => (art === 'v' ? rand(f).x0 : rand(f).y0) >= c - 1);
      if (a.length && b.length && a.length + b.length === liste.length) return { art, c, a: baum(r, a), b: baum(r, b) };
    }
  }
  throw new Error('Vorlage lässt sich nicht durchgehend schneiden');
}

const blaetter = (k) => (k.blatt != null ? [k.blatt] : [...blaetter(k.a), ...blaetter(k.b)]);

// Für den Stil „Nahtlos“: Bereiche der Felder (jedes reicht an jeder Schnittlinie um die halbe
// Übergangsbreite hinüber) und die Schnitte selbst, mit ihrer vollen Länge im jeweiligen Bereich.
export function zerlege(r, W, H) {
  const wurzel = baum(r);
  const bereiche = new Array(r.length);
  const schnitte = [];
  const huelle = (l) => {
    const x0 = Math.min(...l.map((i) => r[i].x));
    const y0 = Math.min(...l.map((i) => r[i].y));
    return { x0, y0, x1: Math.max(...l.map((i) => r[i].x + r[i].w)), y1: Math.max(...l.map((i) => r[i].y + r[i].h)) };
  };
  const geh = (k, b) => {
    k.bereich = b;
    if (k.blatt != null) { bereiche[k.blatt] = b; return; }
    const ha = huelle(blaetter(k.a));
    const hb = huelle(blaetter(k.b));
    if (k.art === 'v') {
      const o = uebergangsBreite(Math.min(k.c - ha.x0, hb.x1 - k.c));
      k.breite = o;
      schnitte.push({ art: 'v', pos: k.c, von: b.y, bis: b.y + b.h, breite: o, a: blaetter(k.a), b: blaetter(k.b) });
      geh(k.a, { x: b.x, y: b.y, w: k.c + o / 2 - b.x, h: b.h });
      geh(k.b, { x: k.c - o / 2, y: b.y, w: b.x + b.w - (k.c - o / 2), h: b.h });
    } else {
      const o = uebergangsBreite(Math.min(k.c - ha.y0, hb.y1 - k.c));
      k.breite = o;
      schnitte.push({ art: 'h', pos: k.c, von: b.x, bis: b.x + b.w, breite: o, a: blaetter(k.a), b: blaetter(k.b) });
      geh(k.a, { x: b.x, y: b.y, w: b.w, h: k.c + o / 2 - b.y });
      geh(k.b, { x: b.x, y: k.c - o / 2, w: b.w, h: b.y + b.h - (k.c - o / 2) });
    }
  };
  geh(wurzel, { x: 0, y: 0, w: W, h: H });
  return { baum: wurzel, bereiche, schnitte };
}

const klemme = (v, a, b) => (v < a ? a : v > b ? b : v);

// Ausschnitt eines Fotos (pw × ph) für ein Feld (fw × fh). t = { x, y, zoom }: Mitte in Anteilen des Fotos,
// zoom ab 1 (füllt gerade so). Immer hineingezoomt, nie leere Bereiche: Der Ausschnitt bleibt im Foto.
export function ausschnitt(pw, ph, fw, fh, t = {}) {
  const zoom = klemme(t.zoom || 1, 1, ZOOM_MAX);
  const s = Math.max(fw / pw, fh / ph) * zoom;
  const sw = Math.min(pw, fw / s);
  const sh = Math.min(ph, fh / s);
  const cx = klemme((t.x ?? 0.5) * pw, sw / 2, pw - sw / 2);
  const cy = klemme((t.y ?? 0.5) * ph, sh / 2, ph - sh / 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh, t: { x: cx / pw, y: cy / ph, zoom } };
}

// Verschieben um dx, dy Feldpixel und Zoomen um den Faktor f, danach wieder ins Foto geklemmt.
export function bewege(pw, ph, fw, fh, t, { dx = 0, dy = 0, faktor = 1 } = {}) {
  const a = ausschnitt(pw, ph, fw, fh, t);
  const s = fw / a.sw;
  const zoom = klemme(a.t.zoom * faktor, 1, ZOOM_MAX);
  return ausschnitt(pw, ph, fw, fh, { x: a.t.x - dx / s / pw, y: a.t.y - dy / s / ph, zoom }).t;
}

// Motivkarte verkleinern auf ein Raster für den Vorschlag (bleibt im Foto-Datensatz).
export function motivRaster(karte, breite = 24) {
  const { w, h, sal } = karte;
  const rw = Math.max(1, Math.min(breite, w));
  const rh = Math.max(1, Math.round((h * rw) / w));
  const d = new Array(rw * rh).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[Math.min(rh - 1, Math.floor((y * rh) / h)) * rw + Math.min(rw - 1, Math.floor((x * rw) / w))] += sal[y * w + x];
  const max = Math.max(1e-9, ...d);
  return { w: rw, h: rh, d: d.map((v) => Math.round((v / max) * 1000) / 1000) };
}

// Vorschlag aus der Motivkarte: Der Ausschnitt (Zoom 1) liegt so, dass möglichst viel Motiv im Feld ist.
export function vorschlag(pw, ph, fw, fh, raster = null) {
  const a = ausschnitt(pw, ph, fw, fh, { x: 0.5, y: 0.5, zoom: 1 });
  if (!raster) return a.t;
  const quer = a.sw < pw - 1; // seitlich ist Spiel
  const spiel = quer ? pw - a.sw : ph - a.sh;
  if (spiel <= 1) return a.t;
  let best = { wert: -1, u: 0.5 };
  for (let k = 0; k <= 40; k++) {
    const u = k / 40;
    const x0 = quer ? u * spiel : 0;
    const y0 = quer ? 0 : u * spiel;
    let wert = 0;
    for (let ry = 0; ry < raster.h; ry++) {
      const cy = ((ry + 0.5) / raster.h) * ph;
      if (cy < y0 || cy > y0 + a.sh) continue;
      for (let rx = 0; rx < raster.w; rx++) {
        const cx = ((rx + 0.5) / raster.w) * pw;
        if (cx >= x0 && cx <= x0 + a.sw) wert += raster.d[ry * raster.w + rx];
      }
    }
    wert -= 1e-6 * Math.abs(u - 0.5); // bei gleichem Wert die Mitte
    if (wert > best.wert) best = { wert, u };
  }
  const t = quer ? { x: (best.u * spiel + a.sw / 2) / pw, y: 0.5, zoom: 1 } : { x: 0.5, y: (best.u * spiel + a.sh / 2) / ph, zoom: 1 };
  return ausschnitt(pw, ph, fw, fh, t).t;
}

// Welches Feld liegt unter dem Punkt (Pixel der Collage)?
export function feldBei(r, x, y) {
  for (let i = 0; i < r.length; i++) if (x >= r[i].x && x < r[i].x + r[i].w && y >= r[i].y && y < r[i].y + r[i].h) return i;
  return -1;
}

// Streifen um 90° drehen und zurück: waagerechte Nähte rechnet derselbe Übergang wie senkrechte.
export function drehe(b) {
  const { w, h, d } = b;
  const aus = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = (y * w + x) * 4;
    const z = (x * h + (h - 1 - y)) * 4;
    aus[z] = d[q]; aus[z + 1] = d[q + 1]; aus[z + 2] = d[q + 2]; aus[z + 3] = d[q + 3];
  }
  return { w: h, h: w, d: aus };
}

export function zurueckDrehen(b) {
  const { w, h, d } = b;
  const aus = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = (y * w + x) * 4;
    const z = ((w - 1 - x) * h + y) * 4;
    aus[z] = d[q]; aus[z + 1] = d[q + 1]; aus[z + 2] = d[q + 2]; aus[z + 3] = d[q + 3];
  }
  return { w: h, h: w, d: aus };
}

// Felder einer neuen Vorlage belegen: vorhandene Zuordnung behalten, solange es passt, sonst Fotos der
// Reihe nach. Ausschnitte kommen neu aus dem Vorschlag, weil sich das Seitenverhältnis ändert.
export function belege(fotos, v, alt = []) {
  const reihenfolge = [...alt.map((f) => f.foto).filter((id) => fotos.some((x) => x.id === id))];
  for (const f of fotos) if (!reihenfolge.includes(f.id)) reihenfolge.push(f.id);
  return v.felder.map((_, i) => ({ foto: reihenfolge[i] ?? fotos[i % fotos.length].id, t: null }));
}
