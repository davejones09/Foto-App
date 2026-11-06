// Collage-Editor: Vorlage, Format, Stil, Abstand und Rahmenfarbe. Antippen wählt ein Feld, Ziehen verschiebt
// den Ausschnitt, zwei Finger zoomen, Ziehen auf ein anderes Feld tauscht die Fotos. Immer hineingezoomt.
import { registriere, zeige } from '../zustand.mjs';
import { T, f, MONATE } from '../texte.mjs';
import { $, $$, el, frage, melde } from '../ui.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';
import { ladeSchritt, ladeEnde } from '../laden.mjs';
import { ctx2d, leinwand, freigeben } from '../bild.mjs';
import { FARBEN, ABSTAND_MAX, FOTOS_MAX, masse, vorlagenFuer, vorlage, feldRechtecke, feldBei, bewege, belege } from '../collage.mjs';
import * as werk from '../collagewerk.mjs';
import * as aus from '../ausgabe.mjs';
import { projektQuelle, neuArt } from './start.mjs';

const v = $('#v-collage');
const canvas = $('.co-bild', v);
const flaeche = $('.co-flaeche', v);
const hinweis = $('.co-hinweis', v);
const vorlagenEl = $('.co-vorlagen', v);
const abstandEl = $('.co-abstand', v);
const farbenEl = $('.co-farben', v);
const rahmenReihe = $('.co-rahmen', v);
const exportKnopf = $('#co-export');
const entfernenKnopf = $('#co-entfernen');
const eingabe = $('#datei-collage');
const kamera = $('#datei-collage-kamera');

let c = null;
let quellen = new Map();
let sel = -1;
let ziel = -1;
let geo = null;
let W = 0;
let puffer = null;

const collageName = (d = new Date()) => f(T.collageName, { monat: MONATE[d.getMonth()], jahr: d.getFullYear() });

// --- Zeichnen ---
function groesse() {
  const r = flaeche.getBoundingClientRect();
  const { w, h } = masse(c.format, 1000);
  const seite = w / h;
  const bw = Math.max(1, r.width - 32);
  const bh = Math.max(1, r.height - 16);
  const cssW = Math.min(bw, bh * seite);
  canvas.style.width = `${Math.round(cssW)}px`;
  canvas.style.height = `${Math.round(cssW / seite)}px`;
  W = Math.min(1100, Math.max(200, Math.round(cssW * Math.min(2, devicePixelRatio || 1))));
  const H = masse(c.format, W).h;
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  if (!puffer || puffer.width !== W || puffer.height !== H) { freigeben(puffer); puffer = leinwand(W, H, 'srgb'); }
}

let lauf = 0;
let vollGeplant = null;
async function zeichnen({ schnell = false } = {}) {
  if (!c) return;
  const meiner = ++lauf;
  groesse();
  const pctx = ctx2d(puffer);
  pctx.imageSmoothingQuality = 'high';
  const g = await werk.zeichne(pctx, c, W, {
    quelle: async (foto) => quellen.get(foto.id),
    ueberblenden: !schnell && c.stil === 'nahtlos' ? werk.direktUeberblenden : null,
  });
  if (meiner !== lauf) return;
  geo = g;
  const ctx = ctx2d(canvas);
  ctx.drawImage(puffer, 0, 0);
  const rahmen = (i, gestrichelt) => {
    const r = g.r[i];
    if (!r) return;
    ctx.save();
    ctx.lineWidth = Math.max(2, W / 260);
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,.7)';
    ctx.shadowBlur = 4;
    if (gestrichelt) ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
    ctx.strokeRect(r.x + ctx.lineWidth / 2, r.y + ctx.lineWidth / 2, r.w - ctx.lineWidth, r.h - ctx.lineWidth);
    ctx.restore();
  };
  if (sel >= 0) rahmen(sel, false);
  if (ziel >= 0 && ziel !== sel) rahmen(ziel, true);
  canvas.dataset.bereit = schnell ? '0' : '1';
  canvas.dataset.auswahl = String(sel);
}

// Nach dem Ziehen: kurz warten, dann mit weichen Nähten zeichnen.
function spaeterVoll() {
  clearTimeout(vollGeplant);
  vollGeplant = setTimeout(() => zeichnen(), 250);
}

// --- Speichern ---
let speichernGeplant = null;
let titelGeplant = null;
function speichern({ sofort = false } = {}) {
  clearTimeout(speichernGeplant);
  speichernGeplant = null;
  const jetzt = async () => {
    speichernGeplant = null;
    if (!c) return;
    const { format, vorlage: vl, stil, abstand, farbe, felder } = c;
    try {
      await db.aendereCollage(c.id, { format, vorlage: vl, stil, abstand, farbe, felder });
      clearTimeout(titelGeplant);
      const stand = c;
      titelGeplant = setTimeout(() => werk.titelbildSpeichern(stand, quellen).catch((e) => protokolliere('collage', e)), 1200);
    } catch (err) {
      protokolliere('collage', err);
      melde(err instanceof db.SpeicherVoll ? T.speicherVoll : T.allgemein);
    }
  };
  if (sofort) return jetzt();
  speichernGeplant = setTimeout(jetzt, 400);
  return null;
}

// --- Bedienelemente ---
function vorlagenBauen() {
  const liste = c.fotos.length >= 2 ? vorlagenFuer(c.fotos.length) : [];
  vorlagenEl.replaceChildren(...liste.map((vl, i) => {
    const cv = el('canvas', { width: 88, height: 110 });
    const k = cv.getContext('2d');
    k.fillStyle = '#2d2f32';
    k.fillRect(0, 0, 88, 110);
    k.fillStyle = '#a1a4a9';
    for (const r of feldRechtecke(vl, 88, 110, { abstand: 0.05 })) k.fillRect(r.x, r.y, r.w, r.h);
    return el('button', {
      klasse: 'co-vorlage', 'data-vorlage': vl.id, 'aria-label': f(T.vorlageWahl, { n: i + 1 }), 'aria-pressed': String(vl.id === c.vorlage),
      onclick: () => {
        c = { ...c, vorlage: vl.id, felder: belege(c.fotos, vl, c.felder) };
        sel = -1;
        bedienelemente();
        speichern();
        zeichnen();
      },
    }, cv);
  }));
}

function bedienelemente() {
  vorlagenBauen();
  for (const b of $$('.co-formate button', v)) b.setAttribute('aria-pressed', String(b.dataset.format === c.format));
  for (const b of $$('.co-stile button', v)) b.setAttribute('aria-pressed', String(b.dataset.stil === c.stil));
  rahmenReihe.hidden = c.stil !== 'rahmen';
  abstandEl.value = String(Math.round((c.abstand / ABSTAND_MAX) * 50));
  for (const b of $$('.co-farbe', farbenEl)) b.setAttribute('aria-pressed', String(b.dataset.farbe === c.farbe));
  const genug = c.fotos.length >= 2;
  exportKnopf.disabled = !genug;
  entfernenKnopf.disabled = sel < 0;
  hinweis.textContent = genug ? T.collageHinweis : T.collageMehr;
  for (const id of ['#co-mediathek', '#co-kamera']) $(id).disabled = c.fotos.length >= FOTOS_MAX;
}

farbenEl.replaceChildren(...FARBEN.map((farbe, i) => el('button', {
  klasse: 'co-farbe', 'data-farbe': farbe, style: `background:${farbe}`, 'aria-label': f(T.rahmenfarbe, { n: i + 1 }),
  onclick: () => { c = { ...c, farbe }; bedienelemente(); speichern(); zeichnen(); },
})));
for (const b of $$('.co-formate button', v)) {
  b.addEventListener('click', () => {
    c = { ...c, format: b.dataset.format, felder: c.felder.map((x) => ({ ...x, t: null })) };
    bedienelemente();
    speichern();
    zeichnen();
  });
}
for (const b of $$('.co-stile button', v)) {
  b.addEventListener('click', () => {
    c = { ...c, stil: b.dataset.stil, felder: c.felder.map((x) => ({ ...x, t: null })) };
    bedienelemente();
    speichern();
    zeichnen();
  });
}
abstandEl.addEventListener('input', () => {
  c = { ...c, abstand: (Number(abstandEl.value) / 50) * ABSTAND_MAX };
  speichern();
  zeichnen();
});

// --- Gesten ---
const finger = new Map();
let geste = null;
const punkt = (e) => {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * canvas.height };
};
const abstand2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tAktuell = (i) => werk.feldAusschnitt(c, geo, i).t;

function setzeT(i, t) {
  const felder = c.felder.slice();
  felder[i] = { ...felder[i], t };
  c = { ...c, felder };
}

function verschieben(i, { dx = 0, dy = 0, faktor = 1 }) {
  const foto = werk.fotoVon(c, c.felder[i].foto);
  const e = geo.e[i];
  setzeT(i, bewege(foto.rohB, foto.rohH, e.w, e.h, tAktuell(i), { dx, dy, faktor }));
}

canvas.addEventListener('pointerdown', (e) => {
  if (!geo || c.fotos.length < 2) return;
  canvas.setPointerCapture(e.pointerId);
  const p = punkt(e);
  finger.set(e.pointerId, p);
  if (finger.size === 1) geste = { art: 'eins', i: feldBei(geo.r, p.x, p.y), start: p, letzt: p, bewegt: false };
  else if (finger.size === 2 && sel >= 0) {
    const [a, b] = [...finger.values()];
    geste = { art: 'zwei', abstand: abstand2(a, b) };
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!finger.has(e.pointerId) || !geste) return;
  const p = punkt(e);
  finger.set(e.pointerId, p);
  if (geste.art === 'zwei' && finger.size >= 2) {
    const [a, b] = [...finger.values()];
    const d = abstand2(a, b);
    if (geste.abstand > 0) verschieben(sel, { faktor: d / geste.abstand });
    geste.abstand = d;
    zeichnen({ schnell: true });
    return;
  }
  if (geste.art !== 'eins') return;
  if (!geste.bewegt && abstand2(p, geste.start) > 8) geste.bewegt = true;
  if (!geste.bewegt || geste.i < 0) return;
  if (geste.i === sel) {
    verschieben(sel, { dx: p.x - geste.letzt.x, dy: p.y - geste.letzt.y });
    geste.letzt = p;
  } else {
    ziel = feldBei(geo.r, p.x, p.y);
  }
  zeichnen({ schnell: true });
});
function ende(e) {
  if (!finger.has(e.pointerId)) return;
  finger.delete(e.pointerId);
  const g = geste;
  if (finger.size > 0) return;
  geste = null;
  if (!g) return;
  if (g.art === 'eins' && !g.bewegt) {
    sel = g.i === sel ? -1 : g.i;
  } else if (g.art === 'eins' && g.i !== sel && ziel >= 0 && ziel !== g.i) {
    // Tauschen: die Fotos wechseln das Feld, der Ausschnitt kommt neu aus der Motivkarte.
    const felder = c.felder.slice();
    const a = felder[g.i].foto;
    felder[g.i] = { foto: felder[ziel].foto, t: null };
    felder[ziel] = { foto: a, t: null };
    c = { ...c, felder };
    sel = ziel;
  }
  ziel = -1;
  bedienelemente();
  speichern();
  zeichnen();
}
canvas.addEventListener('pointerup', ende);
canvas.addEventListener('pointercancel', ende);
canvas.addEventListener('wheel', (e) => {
  if (sel < 0 || !geo) return;
  e.preventDefault();
  verschieben(sel, { faktor: Math.exp(-e.deltaY * 0.0015) });
  zeichnen({ schnell: true });
  spaeterVoll();
  speichern();
}, { passive: false });

// --- Fotos hinzufügen und entfernen ---
let vorgemerkt = null;
async function dateienGewaehlt(liste) {
  const anlegen = vorgemerkt;
  vorgemerkt = null;
  if (!liste.length) return;
  try {
    if (anlegen) c = await anlegen();
    if (!c) return;
    const frei = FOTOS_MAX - c.fotos.length;
    const auswahl = liste.slice(0, Math.max(0, frei));
    let kaputt = 0;
    for (let k = 0; k < auswahl.length; k++) {
      ladeSchritt(k + 1, auswahl.length);
      try {
        await werk.fotoEinlesen(c.id, auswahl[k]);
      } catch (err) {
        protokolliere('collage', err);
        if (err instanceof db.SpeicherVoll) { melde(T.speicherVoll); return; }
        kaputt++;
      }
    }
    if (liste.length > frei) melde(T.collageZuViele);
    else if (kaputt) melde(f(T.collageKaputt, { n: kaputt }));
    await zeige('collage', { id: c.id });
  } catch (err) {
    protokolliere('collage', err);
    melde(err instanceof db.SpeicherVoll ? T.speicherVoll : T.allgemein);
  }
}
for (const inp of [eingabe, kamera]) {
  inp.addEventListener('change', () => {
    const l = [...(inp.files || [])];
    inp.value = '';
    dateienGewaehlt(l).finally(ladeEnde);
  });
  inp.addEventListener('cancel', () => { vorgemerkt = null; });
}
$('#co-mediathek').addEventListener('click', () => { vorgemerkt = null; eingabe.click(); });
$('#co-kamera').addEventListener('click', () => { vorgemerkt = null; kamera.click(); });
entfernenKnopf.addEventListener('click', async () => {
  if (sel < 0) return;
  const fotoId = c.felder[sel].foto;
  try {
    await speichern({ sofort: true });
    await db.collageFotoEntfernen(c.id, fotoId);
    sel = -1;
    await zeige('collage', { id: c.id });
  } catch (err) {
    protokolliere('collage', err);
    melde(T.allgemein);
  }
});

// --- Exportieren: Bild oder Sicherung, danach Teilen in einer frischen Geste ---
exportKnopf.addEventListener('click', async () => {
  const r = await frage(T.collageWas, [
    { text: T.abbrechen, wert: null },
    { text: T.sicherung, wert: 'sicherung' },
    { text: T.collageBild, wert: 'bild', haupt: true },
  ]);
  if (!r.wert) return;
  await speichern({ sofort: true });
  const fort = (p) => melde(f(T.wirdGebaut, { p: Math.round(p * 100) }), [], 0);
  try {
    fort(0);
    let datei;
    if (r.wert === 'bild') {
      const blob = await werk.ausgabe(c, { fortschritt: fort });
      datei = new File([blob], 'collage.jpg', { type: 'image/jpeg' });
    } else {
      const blob = await werk.sicherung(c, { fortschritt: fort });
      const d = new Date();
      const name = (c.name || 'collage').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'collage';
      datei = new File([blob], `${name}-sicherung-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.zip`, { type: 'application/zip' });
    }
    melde(T.collageFertig, [
      { text: T.stattdessenSpeichern, haupt: false, aktion: () => aus.speichern([datei]) },
      { text: T.teilen, aktion: () => aus.teilen([datei], c.name).catch((err) => { protokolliere('teilen', err); melde(T.teilenFehler, [{ text: T.stattdessenSpeichern, aktion: () => aus.speichern([datei]) }]); }) },
    ]);
    v.dataset.export = datei.name;
  } catch (err) {
    protokolliere('collage', err);
    melde(err instanceof db.SpeicherVoll ? T.speicherVoll : T.allgemein);
  }
});

$('#co-zurueck').addEventListener('click', () => zeige('start'));
addEventListener('resize', () => { if (c && !v.hidden) zeichnen(); });

registriere('collage', {
  async betreten({ id } = {}) {
    const roh = id ? await db.collage(id) : null;
    if (!roh) { zeige('start'); return; }
    c = werk.vervollstaendige(roh);
    sel = -1;
    ziel = -1;
    canvas.dataset.bereit = '0';
    $('.co-kopf', v).textContent = c.name;
    try { localStorage.setItem('nahtlos-collage', c.id); } catch {}
    quellen = await werk.vorschauen(c, quellen);
    bedienelemente();
    await zeichnen();
    if (JSON.stringify(roh.felder) !== JSON.stringify(c.felder) || roh.vorlage !== c.vorlage) await speichern({ sofort: true });
    else if (!roh.vorschau && c.fotos.length) werk.titelbildSpeichern(c, quellen).catch((e) => protokolliere('collage', e));
  },
  async verlassen() {
    clearTimeout(vollGeplant);
    if (speichernGeplant) await speichern({ sofort: true });
    const stand = c;
    const q = quellen;
    clearTimeout(titelGeplant);
    if (stand && stand.fotos.length) await werk.titelbildSpeichern(stand, q).catch((e) => protokolliere('collage', e));
    for (const x of q.values()) freigeben(x);
    quellen = new Map();
    c = null;
  },
});

// --- Im Hauptmenü: Karte und Projektliste ---
neuArt('collage', async () => {
  const r = await frage(T.neueCollage, [
    { text: T.abbrechen, wert: null },
    { text: T.quelleMediathek, wert: 'mediathek', sofort: () => eingabe.click() },
    { text: T.quelleKamera, wert: 'kamera', haupt: true, sofort: () => kamera.click() },
  ], { eingabe: collageName() });
  if (!r.wert) return;
  vorgemerkt = () => db.neueCollage({ name: r.text || collageName() });
});

projektQuelle(async () => (await db.collagen()).map((x) => ({
  art: 'collage', id: x.id, name: x.name, n: x.fotos.length, geaendert: x.geaendert || x.erstellt, verdeckt: false,
  titel: x.vorschau ? x : null,
  titelBlob: () => db.blob(x, 'vorschau'),
  oeffnen: () => zeige('collage', { id: x.id }),
  loeschen: () => db.loescheCollage(x.id),
})));

export const aktuelleCollage = () => c;
export { vorlage };
