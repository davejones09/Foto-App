// Ideen für den nächsten Halt. Regelbasiert und offline: keine KI, kein Netz.
// Grundlagen: Höhe, Stärke und Neigung der Linie im Rest, Farben darüber und darunter, Farben der
// letzten 3 Halte, Tageszeit und ein gemerkter Ort. Reine Rechnung, in Node testbar.

export const ORTE = ['strand', 'stadt', 'essen', 'natur', 'unterkunft', 'unterwegs'];
export const ORT_NAMEN = { strand: 'Strand', stadt: 'Stadt', essen: 'Essen', natur: 'Natur', unterkunft: 'Unterkunft', unterwegs: 'Unterwegs' };

// Tags: h Höhe (oben, mitte, unten), n Neigung (flach, steigt, faellt), st Stärke ('keine' = nur Fläche),
// ob/un Farbe über/unter der Linie (hell, dunkel, blau, gruen, warm, grau), ort, zeit (morgen, tag, abend, nacht),
// gegen: Kontrast zu einer Farbe, die die letzten 3 Halte prägte, allg: allgemeiner Tipp.
export const IDEEN = [
  { id: 'tischkante-wand', text: 'Versuch\'s mit einer Tischkante vor einer hellen Wand.', h: 'mitte', ob: 'hell', un: 'dunkel', ort: ['essen', 'unterkunft'] },
  { id: 'horizont-wasser', text: 'Ein Horizont über dunklem Wasser passt genau.', h: 'mitte', ob: 'hell', un: 'dunkel', ort: ['strand', 'natur'] },
  { id: 'fensterbank-himmel', text: 'Eine Fensterbank von innen gegen den hellen Himmel.', h: 'mitte', ob: 'hell', un: 'dunkel', ort: ['unterkunft'] },
  { id: 'mauer-himmel', text: 'Die Oberkante einer Mauer vor dem Himmel.', h: 'mitte', ob: 'hell', un: 'dunkel', ort: ['stadt'] },
  { id: 'parkbank', text: 'Eine Bank im Park, die Sitzfläche auf halber Höhe.', h: 'mitte', un: 'dunkel', ort: ['natur', 'stadt'] },
  { id: 'markise-gehweg', text: 'Eine dunkle Markise über hellem Gehweg.', h: 'mitte', ob: 'dunkel', un: 'hell', ort: ['stadt'] },
  { id: 'baum-sandweg', text: 'Baumkronen über einem hellen Sandweg.', h: 'mitte', ob: 'dunkel', un: 'hell', ort: ['natur', 'strand'] },
  { id: 'regal-theke', text: 'Ein dunkles Holzregal über einer hellen Theke.', h: 'mitte', ob: 'dunkel', un: 'hell', ort: ['essen'] },
  { id: 'tischtuch-raum', text: 'Ein helles Tischtuch, darüber der dunkle Raum.', h: 'mitte', ob: 'dunkel', un: 'hell', ort: ['essen', 'unterkunft'] },
  { id: 'wenig-himmel', text: 'Viel Boden, wenig Himmel: Das iPhone tiefer halten und den Horizont oben mitnehmen.', h: 'oben', ort: ['strand', 'natur'] },
  { id: 'dachrand', text: 'Ein Dachrand oben im Bild, darunter die Fassade.', h: 'oben', ort: ['stadt'] },
  { id: 'regal-oben', text: 'Die Kante eines Regals über Kopfhöhe.', h: 'oben', ort: ['unterkunft', 'essen'] },
  { id: 'bruecke-unten', text: 'Eine Brücke von unten, ihre Unterkante oben im Bild.', h: 'oben', ort: ['stadt', 'unterwegs'] },
  { id: 'bergkamm-wiese', text: 'Ein Bergkamm weit oben, davor viel Wiese.', h: 'oben', un: 'gruen', ort: ['natur'] },
  { id: 'gepaeckablage', text: 'Eine Gepäckablage über den Sitzen, oben im Bild.', h: 'oben', ort: ['unterwegs'] },
  { id: 'schirmrand', text: 'Ein Sonnenschirmrand oben, darunter Liegen und Sand.', h: 'oben', ort: ['strand'] },
  { id: 'strandlinie-unten', text: 'Viel Himmel, wenig Boden: eine Strandlinie ganz unten.', h: 'unten', ob: 'hell', ort: ['strand'] },
  { id: 'tischplatte-unten', text: 'Die Tischplatte ganz unten, darüber Teller und Gläser.', h: 'unten', ort: ['essen'] },
  { id: 'bordstein', text: 'Eine Bordsteinkante unten, darüber die Straße.', h: 'unten', ort: ['stadt'] },
  { id: 'armaturenbrett', text: 'Das Armaturenbrett unten, darüber die Straße durch die Scheibe.', h: 'unten', ort: ['unterwegs'] },
  { id: 'bettkante', text: 'Eine Bettkante ganz unten im Bild.', h: 'unten', ort: ['unterkunft'] },
  { id: 'fensterrahmen-unten', text: 'Ein Fensterrahmen unten, darüber der Blick nach draußen.', h: 'unten', ob: 'hell', ort: ['unterkunft', 'unterwegs'] },
  { id: 'huegel-unten', text: 'Flache Hügel ganz unten, der Rest ist Himmel.', h: 'unten', ob: 'blau', ort: ['natur'] },
  { id: 'steigt-allgemein', text: 'Eine Treppe, ein Geländer oder ein Hang nehmen die Schräge auf.', n: 'steigt' },
  { id: 'dach-seite', text: 'Ein Dach von der Seite, schräg nach oben.', n: 'steigt', ort: ['stadt'] },
  { id: 'weg-bergauf', text: 'Ein Weg, der bergauf führt, von unten links nach oben rechts.', n: 'steigt', ort: ['natur'] },
  { id: 'rolltreppe', text: 'Eine Rolltreppe, schräg nach oben.', n: 'steigt', ort: ['unterwegs', 'stadt'] },
  { id: 'duene', text: 'Eine Düne von der Seite.', n: 'steigt', ort: ['strand'] },
  { id: 'faellt-allgemein', text: 'Ein Hang abwärts oder ein Treppengeländer nach unten nimmt die Schräge auf.', n: 'faellt' },
  { id: 'rampe', text: 'Eine Rampe oder Auffahrt, die nach rechts abfällt.', n: 'faellt', ort: ['stadt', 'unterwegs'] },
  { id: 'ast', text: 'Ein Ast, der nach rechts durchhängt.', n: 'faellt', ort: ['natur'] },
  { id: 'welle', text: 'Eine Welle, die nach rechts ausläuft.', n: 'faellt', ort: ['strand'] },
  { id: 'flaeche-ruhig', text: 'Eine große, ruhige Fläche geht auch: Wand, Himmel, Wasser.', st: 'keine' },
  { id: 'flaeche-farbe', text: 'Dann zählt die Farbe: Such dieselbe Fläche woanders.', st: 'keine' },
  { id: 'flaeche-stoff', text: 'Eine Tischdecke oder ein Laken von nah passt.', st: 'keine', ort: ['essen', 'unterkunft'] },
  { id: 'flaeche-himmel', text: 'Nur Himmel? Dann nochmal Himmel, egal wo.', st: 'keine', ob: 'blau' },
  { id: 'meer-pool', text: 'Blau an Blau: Meer an Pool, Pool an Meer.', ob: 'blau', un: 'blau', ort: ['strand'] },
  { id: 'unten-gruen', text: 'Rasen, Wiese oder ein Park schließen unten an.', un: 'gruen', ort: ['natur', 'stadt'] },
  { id: 'oben-gruen', text: 'Eine Hecke oder Bäume über der Linie.', ob: 'gruen' },
  { id: 'unten-warm', text: 'Holzboden, Terrakotta oder ein Tisch schließen unten an.', un: 'warm', ort: ['essen', 'unterkunft'] },
  { id: 'oben-warm', text: 'Eine Abendwolke oder eine Hauswand in Ocker über der Linie.', ob: 'warm' },
  { id: 'unten-grau', text: 'Asphalt, Beton oder ein Gehweg schließen unten an.', un: 'grau', ort: ['stadt', 'unterwegs'] },
  { id: 'oben-grau', text: 'Ein bedeckter Himmel oder eine Betondecke über der Linie.', ob: 'grau' },
  { id: 'abend-fenster', text: 'Abendlicht: eine Fensterkante gegen den hellen Himmel draußen.', zeit: ['abend'], ob: 'hell' },
  { id: 'nacht-theke', text: 'Nachts zählt das Licht: eine beleuchtete Theke oder ein Schaufenster.', zeit: ['nacht'] },
  { id: 'nacht-laternen', text: 'Laternen in einer Reihe geben nachts eine Linie.', zeit: ['nacht'], ort: ['stadt'] },
  { id: 'morgen-fruehstueck', text: 'Der Frühstückstisch, die Kante auf Höhe der Hilfslinie.', zeit: ['morgen'], ort: ['essen', 'unterkunft'] },
  { id: 'tiefe-sonne', text: 'Tiefe Sonne: Lange Schatten auf dem Boden sind gute Linien.', zeit: ['morgen', 'abend'] },
  { id: 'mittag-schatten', text: 'Harte Mittagsschatten unter Markisen und Dächern.', zeit: ['tag'], ort: ['stadt'] },
  { id: 'wasserkante', text: 'Die Wasserkante, wo der Sand nass wird.', ort: ['strand'], h: 'mitte' },
  { id: 'handtuch', text: 'Ein Handtuch von oben, seine Kante quer durchs Bild.', ort: ['strand'] },
  { id: 'schaufenster', text: 'Eine Schaufensterkante auf der Höhe der Hilfslinie.', ort: ['stadt'] },
  { id: 'schienen', text: 'Ein Geländer oder eine Leitplanke von der Seite.', ort: ['stadt'], un: 'grau' },
  { id: 'tellerrand', text: 'Der Tellerrand von der Seite.', ort: ['essen'] },
  { id: 'glas', text: 'Die Oberfläche eines Getränks im Glas ist auch eine Linie.', ort: ['essen'], h: 'mitte' },
  { id: 'uferlinie', text: 'Ein See, die Uferlinie.', ort: ['natur'], h: 'mitte' },
  { id: 'baumstamm', text: 'Ein liegender Baumstamm.', ort: ['natur'] },
  { id: 'kopfteil', text: 'Die Oberkante des Kopfteils am Bett.', ort: ['unterkunft'] },
  { id: 'badewanne', text: 'Der Rand der Badewanne.', ort: ['unterkunft'], un: 'hell' },
  { id: 'zugfenster', text: 'Ein Fensterrand unterwegs, draußen zieht die Landschaft.', ort: ['unterwegs'] },
  { id: 'bahnsteigkante', text: 'Eine Bordsteinkante mit weißem Streifen.', ort: ['unterwegs'], un: 'grau' },
  { id: 'tragflaeche', text: 'Die Tragfläche aus dem Flugzeugfenster.', ort: ['unterwegs'], h: 'mitte' },
  { id: 'gegen-blau', text: 'Such was Warmes: Ziegel, Holz, Markise.', gegen: 'blau' },
  { id: 'gegen-gruen', text: 'Wie wär\'s mit Stadt: Asphalt, Glas, Beton.', gegen: 'gruen' },
  { id: 'gegen-warm', text: 'Zeit für Wasser oder Himmel.', gegen: 'warm' },
  { id: 'gegen-grau', text: 'Such Farbe: Markt, Blumen, Sonnenschirme.', gegen: 'grau' },
  { id: 'gegen-hell', text: 'Ein dunkler Innenraum bringt Abwechslung.', gegen: 'hell' },
  { id: 'gegen-dunkel', text: 'Geh raus ins Helle.', gegen: 'dunkel' },
  { id: 'tipp-marke', text: 'Such eine Kante auf Höhe der Hilfslinie.', allg: true },
  { id: 'tipp-linien', text: 'Tisch, Mauer, Horizont, Geländer: Alles ist eine Linie.', allg: true },
  { id: 'tipp-naeher', text: 'Geh näher ran, dann wird die Linie größer.', allg: true },
  { id: 'tipp-hoehe', text: 'Das iPhone tiefer oder höher halten. Die Linie wandert mit.', allg: true },
  { id: 'tipp-ort', text: 'Es muss nicht derselbe Ort sein. Es muss nur weitergehen.', allg: true },
];

const FARB_WORT = { hell: 'hell', dunkel: 'dunkel', blau: 'blau', gruen: 'grün', warm: 'warm', grau: 'grau' };
export const KONTRAST_WORT = { blau: 'blau', gruen: 'grün', warm: 'warm', grau: 'grau', hell: 'hell', dunkel: 'dunkel' };

// --- Farben einordnen ---
export function farbKlasse([r, g, b]) {
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max > 0 ? (max - min) / max : 0;
  let ton = 'grau';
  if (sat >= 0.18) {
    let h;
    if (max === r) h = (60 * ((g - b) / (max - min)) + 360) % 360;
    else if (max === g) h = 60 * ((b - r) / (max - min)) + 120;
    else h = 60 * ((r - g) / (max - min)) + 240;
    ton = h >= 170 && h < 265 ? 'blau' : h >= 70 && h < 170 ? 'gruen' : 'warm';
  }
  return { lum: L > 160 ? 'hell' : L < 85 ? 'dunkel' : 'mittel', ton, L };
}

const passt = (tag, k) => !tag || tag === k.lum || tag === k.ton;
const wort = (k) => (k.lum !== 'mittel' ? FARB_WORT[k.lum] : FARB_WORT[k.ton]);

// --- Merkmale des Rests: Linie, Neigung, Farben ---
// bild: Rest als { w, h, d }, gern etwas größer (etwa 91 × 405).
export function restMerkmale(bild) {
  const { w, h, d } = bild;
  const L = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) L[p] = 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2];
  const profil = (x0, x1) => {
    const p = new Float32Array(h);
    for (let y = 1; y < h - 1; y++) {
      let s = 0;
      for (let x = x0; x < x1; x++) s += (L[(y + 1) * w + x] - L[(y - 1) * w + x]) * 0.5;
      p[y] = s / (x1 - x0);
    }
    // leicht glätten
    const g = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      let s = 0; let n = 0;
      for (let k = -2; k <= 2; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += p[yy]; n++; } }
      g[y] = s / n;
    }
    return g;
  };
  const rand = Math.round(h * 0.04);
  const gesamt = profil(0, w);
  let y0 = rand;
  for (let y = rand; y < h - rand; y++) if (Math.abs(gesamt[y]) > Math.abs(gesamt[y0])) y0 = y;
  const spitze = Math.abs(gesamt[y0]);
  const staerke = spitze > 6 ? 'stark' : spitze > 2.5 ? 'schwach' : 'keine';
  let neigung = 'flach';
  let winkel = 0;
  if (staerke !== 'keine') {
    // Höhe der Linie im linken und rechten Drittel, nahe der gefundenen Linie
    const fenster = Math.round(h * 0.12);
    const spitzeIn = (p) => {
      let best = y0;
      for (let y = Math.max(1, y0 - fenster); y <= Math.min(h - 2, y0 + fenster); y++) if (Math.abs(p[y]) > Math.abs(p[best])) best = y;
      return best;
    };
    const drittel = Math.max(1, Math.floor(w / 3));
    const yl = spitzeIn(profil(0, drittel));
    const yr = spitzeIn(profil(w - drittel, w));
    winkel = (Math.atan2(yl - yr, w - drittel) * 180) / Math.PI; // positiv: steigt nach rechts
    neigung = winkel > 8 ? 'steigt' : winkel < -8 ? 'faellt' : 'flach';
  }
  const mittel = (ya, yb) => {
    const s = [0, 0, 0];
    let n = 0;
    for (let y = Math.max(0, ya); y < Math.min(h, yb); y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; }
    return n ? s.map((v) => v / n) : [128, 128, 128];
  };
  const linieY = staerke === 'keine' ? 0.5 : y0 / h;
  const luecke = Math.round(h * 0.03);
  const oben = farbKlasse(mittel(0, Math.round(linieY * h) - luecke));
  const unten = farbKlasse(mittel(Math.round(linieY * h) + luecke, h));
  const hoehe = linieY < 0.38 ? 'oben' : linieY > 0.62 ? 'unten' : 'mitte';
  return { linieY, hoehe, staerke, neigung, winkel, oben, unten };
}

// Prägten die letzten 3 Halte dieselbe Farbe? Liefert die Klasse oder null.
export function monotonie(farben) {
  if (!farben || farben.length < 3) return null;
  const k = farben.slice(-3).map(farbKlasse);
  if (k.every((x) => x.ton === k[0].ton)) return k[0].ton;
  if (k[0].lum !== 'mittel' && k.every((x) => x.lum === k[0].lum)) return k[0].lum;
  return null;
}

export function tageszeit(stunde) {
  if (stunde >= 5 && stunde < 10) return 'morgen';
  if (stunde >= 10 && stunde < 17) return 'tag';
  if (stunde >= 17 && stunde < 22) return 'abend';
  return 'nacht';
}

export function beschreibung(m) {
  if (m.staerke === 'keine') return 'Kaum Linien im Rest, nur Fläche.';
  const hoehe = { oben: 'im oberen Drittel', mitte: 'auf halber Höhe', unten: 'im unteren Drittel' }[m.hoehe];
  const neigung = m.neigung === 'steigt' ? ', steigt nach rechts' : m.neigung === 'faellt' ? ', fällt nach rechts' : '';
  return `Linie ${hoehe}${neigung}, oben ${wort(m.oben)}, unten ${wort(m.unten)}.`;
}

// Punkte für eine Idee. null heißt: passt nicht.
function bewerte(idee, m) {
  if (idee.gegen) return m.monoton === idee.gegen ? 20 : null;
  if (idee.allg) return 0.5;
  let p = 1;
  if (idee.st) { if (m.staerke !== idee.st) return null; p += 3; } else if (m.staerke === 'keine') return null;
  if (idee.h) { if (idee.h !== m.hoehe) return null; p += 2; }
  if (idee.n) { if (idee.n !== m.neigung) return null; p += 3; } else if (m.neigung !== 'flach') p -= 4; // schräge Linie: Schrägen zuerst
  if (idee.zeit) { if (!idee.zeit.includes(m.zeit)) return null; p += 2; }
  if (idee.ort) { if (m.ort && !idee.ort.includes(m.ort)) return null; p += m.ort ? 3 : -0.5; }
  for (const [tag, k] of [[idee.ob, m.oben], [idee.un, m.unten]]) {
    if (!tag) continue;
    if (!passt(tag, k)) return null;
    p += 2;
  }
  return p;
}

// Wählt die beste noch nicht benutzte passende Idee. benutzt: Set mit IDs dieser Strecke.
// Sind alle passenden durch, beginnt die Runde von vorn. zufall(): Zahl in [0, 1) für Gleichstände.
export function waehleIdee(m, { benutzt = new Set(), zufall = Math.random, nurTipp = false } = {}) {
  let kandidaten = IDEEN.map((idee) => ({ idee, p: bewerte(idee, m) })).filter((x) => x.p != null);
  if (nurTipp) kandidaten = kandidaten.filter((x) => !x.idee.gegen);
  // Kontrast zuerst, solange die letzten Halte gleich aussehen
  const kontrast = kandidaten.filter((x) => x.idee.gegen);
  let pool = kontrast.filter((x) => !benutzt.has(x.idee.id)).length ? kontrast : kandidaten;
  let frei = pool.filter((x) => !benutzt.has(x.idee.id));
  let neueRunde = false;
  if (!frei.length) { frei = kandidaten.filter((x) => !x.idee.gegen); neueRunde = true; }
  if (!frei.length) return null;
  const best = Math.max(...frei.map((x) => x.p));
  const spitze = frei.filter((x) => x.p >= best - 1e-9);
  const wahl = spitze[Math.floor(zufall() * spitze.length) % spitze.length].idee;
  let satz;
  if (wahl.gegen) satz = `Die letzten drei Fotos waren alle ${KONTRAST_WORT[wahl.gegen]}. ${wahl.text}`;
  else if (wahl.allg) satz = wahl.text;
  else satz = `${beschreibung(m)} ${wahl.text}`;
  return { idee: wahl, satz, neueRunde, passend: kandidaten.map((x) => x.idee.id) };
}

// --- Richtung: Liegt eine Kameralinie knapp neben einer Marke? ---
// y wächst nach unten. Hält man das iPhone höher (oder kippt es nach oben), wandert alles im Bild
// nach unten. Liegt die Linie also über der Marke (kleineres y), muss das iPhone höher.
export const RICHTUNG_MIN = 0.03; // ab hier wird die Marke ohnehin grün
export const RICHTUNG_MAX = 0.12;

export function richtung(kameraLinien, marken) {
  let best = null;
  for (const m of marken || []) {
    for (const l of kameraLinien || []) {
      const d = l.y - m.y;
      const a = Math.abs(d);
      if (a < RICHTUNG_MIN || a > RICHTUNG_MAX) continue;
      if (!best || a < best.abstand) best = { richtung: d < 0 ? 'hoeher' : 'tiefer', abstand: a, marke: m.y, linie: l.y };
    }
  }
  // Trifft schon eine Linie eine Marke, braucht es keinen Hinweis.
  for (const m of marken || []) for (const l of kameraLinien || []) if (Math.abs(l.y - m.y) < RICHTUNG_MIN) return null;
  return best;
}
