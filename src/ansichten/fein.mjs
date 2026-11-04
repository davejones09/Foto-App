// Feinjustieren: das neue Foto unter dem Rest schieben, zoomen, drehen. Nur der letzte Halt.
import { Z, registriere, zeige } from '../zustand.mjs';
import { T } from '../texte.mjs';
import { $, melde, zeigePassung } from '../ui.mjs';
import { auftrag, beschaeftigt } from '../rechner.mjs';
import { leinwand, ctx2d, pixel, ladeBitmap, ladeBild, freigeben, verkleinere } from '../bild.mjs';
import { begrenze, zeichneTransformiert, STANDARD } from '../geometrie.mjs';
import { kleinRest } from '../naehwerk.mjs';
import { HALT_B, KLEIN_B, KLEIN_H, KLEIN_UE } from '../masse.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';

const v = $('#v-fein');
const rahmen = $('#fein-rahmen');
const bildC = $('.fein-bild', rahmen);
const restEl = $('.rest', rahmen);
const restImg = $('img', restEl);
const fadenLinie = $('.faden polyline', restEl);
const wertEl = $('.wert', v);
const bewEl = $('.bewertung', v);
const ladenEl = $('.kamerastatus', rahmen);

let daten = null;
let roh = null; // volle Auflösung, für Übernehmen
let anzeige = null;
let analyse = null;
let rw = 0;
let rh = 0;
let t = { ...STANDARD };
let mitRest = false;
let restUrl = '';
let zeichnenGeplant = false;
let analyseNoetig = false;
const klein = leinwand(KLEIN_B, KLEIN_H);
const kleinCtx = ctx2d(klein, true);
kleinCtx.imageSmoothingQuality = 'high';

function proxy(q, w, h, lang) {
  const f = Math.min(1, lang / Math.max(w, h));
  return verkleinere(q, w, h, Math.max(1, Math.round(w * f)), Math.max(1, Math.round(h * f)));
}

function zeichnen() {
  zeichnenGeplant = false;
  if (!anzeige) return;
  const r = rahmen.getBoundingClientRect();
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const cw = Math.round(r.width * dpr);
  const ch = Math.round(r.height * dpr);
  if (bildC.width !== cw || bildC.height !== ch) { bildC.width = cw; bildC.height = ch; }
  const k = ctx2d(bildC);
  k.imageSmoothingQuality = 'high';
  k.fillStyle = '#000';
  k.fillRect(0, 0, cw, ch);
  zeichneTransformiert(k, anzeige, anzeige.width, anzeige.height, t, cw, ch);
  if (mitRest) { analyseNoetig = true; analysieren(); }
}

const plane = () => { if (!zeichnenGeplant) { zeichnenGeplant = true; requestAnimationFrame(zeichnen); } };

let glatt = null;
async function analysieren() {
  if (!analyseNoetig || beschaeftigt() || !analyse) return;
  analyseNoetig = false;
  kleinCtx.fillStyle = '#000';
  kleinCtx.fillRect(0, 0, KLEIN_B, KLEIN_H);
  zeichneTransformiert(kleinCtx, analyse, analyse.width, analyse.height, t, KLEIN_B, KLEIN_H);
  const b = pixel(klein, 0, 0, KLEIN_UE, KLEIN_H);
  try {
    const r = await auftrag('analyse', { kamera: b }, [b.d.buffer]);
    if (r.leer || !daten) return;
    glatt = glatt == null ? r.wert : glatt * 0.5 + r.wert * 0.5;
    const w = Math.round(glatt);
    zeigePassung(v, w);
    fadenLinie.setAttribute('points', r.pfad.map((x, y) => `${x + 0.5},${y + 0.5}`).join(' '));
  } catch (err) {
    protokolliere('fein', err);
  }
  if (analyseNoetig) analysieren();
}

// --- Gesten: ein Finger schiebt, zwei Finger zoomen und drehen ---
const finger = new Map();
let geste = null;

function gesteStart() {
  const p = [...finger.values()];
  const masse = HALT_B / rahmen.getBoundingClientRect().width;
  if (p.length === 1) geste = { art: 1, x: p[0].x, y: p[0].y, t: { ...t }, masse };
  else if (p.length >= 2) {
    const [a, b] = p;
    geste = {
      art: 2, t: { ...t }, masse,
      mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
      d: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      w: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }
}

rahmen.addEventListener('pointerdown', (e) => {
  if (!daten) return;
  rahmen.setPointerCapture(e.pointerId);
  finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  gesteStart();
});
rahmen.addEventListener('pointermove', (e) => {
  if (!finger.has(e.pointerId) || !geste) return;
  finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const p = [...finger.values()];
  let neu;
  if (geste.art === 1) {
    neu = { ...geste.t, dx: geste.t.dx + (p[0].x - geste.x) * geste.masse, dy: geste.t.dy + (p[0].y - geste.y) * geste.masse };
  } else if (p.length >= 2) {
    const [a, b] = p;
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const w = Math.atan2(b.y - a.y, b.x - a.x);
    neu = {
      zoom: geste.t.zoom * (d / geste.d),
      drehung: geste.t.drehung + ((w - geste.w) * 180) / Math.PI,
      dx: geste.t.dx + ((a.x + b.x) / 2 - geste.mx) * geste.masse,
      dy: geste.t.dy + ((a.y + b.y) / 2 - geste.my) * geste.masse,
    };
  }
  if (!neu) return;
  t = begrenze(neu, rw, rh);
  plane();
});
const fingerWeg = (e) => {
  finger.delete(e.pointerId);
  gesteStart();
  if (!finger.size) geste = null;
};
rahmen.addEventListener('pointerup', fingerWeg);
rahmen.addEventListener('pointercancel', fingerWeg);
// Mausrad für Tests am Rechner: zoomen, mit Umschalt drehen.
rahmen.addEventListener('wheel', (e) => {
  if (!daten) return;
  e.preventDefault();
  t = begrenze(e.shiftKey ? { ...t, drehung: t.drehung - e.deltaY * 0.02 } : { ...t, zoom: t.zoom * Math.exp(-e.deltaY * 0.002) }, rw, rh);
  plane();
}, { passive: false });

async function betreten(d) {
  daten = d;
  glatt = null;
  wertEl.textContent = '';
  bewEl.textContent = '';
  zeigePassung(v, null);
  fadenLinie.setAttribute('points', '');
  ladenEl.hidden = false;
  const { halt } = d;
  try {
    // Im Farbraum des Fotos laden: Dieses Rohbild geht danach ins Fertigstellen.
    roh = d.rohQuelle || (await ladeBild(await db.blobPflicht(halt, 'roh'), halt.farbraum || 'srgb'));
    rw = roh.width;
    rh = roh.height;
    anzeige = proxy(roh, rw, rh, 1800);
    analyse = proxy(roh, rw, rh, 520);
    t = begrenze({ ...(halt.transform || STANDARD) }, rw, rh);
    const vor = halt.index > 0 ? Z.halte[halt.index - 1] : null;
    mitRest = !!vor?.bild;
    restEl.hidden = !mitRest;
    for (const e of [wertEl, bewEl]) e.style.visibility = mitRest ? '' : 'hidden';
    if (mitRest) {
      if (restUrl) URL.revokeObjectURL(restUrl);
      const vorBild = await db.blobPflicht(vor, 'bild');
      restUrl = URL.createObjectURL(vorBild);
      restImg.src = restUrl;
      const bm = await ladeBitmap(vorBild);
      const c = leinwand(bm.width, bm.height);
      ctx2d(c, true).drawImage(bm, 0, 0);
      freigeben(bm);
      const kr = kleinRest(c);
      freigeben(c);
      await auftrag('rest', { rest: kr }, [kr.d.buffer]);
    }
  } catch (err) {
    protokolliere('fein', err);
    melde(T.importFehler);
    daten = null;
    zeige('sucher');
    return;
  }
  ladenEl.hidden = true;
  plane();
}

function aufraeumen() {
  freigeben(anzeige);
  freigeben(analyse);
  anzeige = null;
  analyse = null;
  daten = null;
  finger.clear();
  geste = null;
}

$('#fein-ok').addEventListener('click', async () => {
  if (!daten) return;
  const d = daten;
  try {
    const h = await db.aendereHalt(d.halt.id, { transform: t });
    Z.halte[h.index] = h;
    const q = roh;
    aufraeumen();
    zeige('aufdeckung', { halt: h, rohQuelle: q, langsam: !!d.erstlauf && h.index === 1, erstlauf: !!d.erstlauf });
  } catch (err) {
    protokolliere('fein', err);
    melde(err instanceof db.SpeicherVoll ? T.speicherVoll : T.allgemein);
  }
});

$('#fein-abbrechen').addEventListener('click', () => {
  if (!daten) return;
  const d = daten;
  const q = roh;
  aufraeumen();
  if (d.neu || !d.halt.bild) zeige('aufdeckung', { halt: d.halt, rohQuelle: q, langsam: !!d.erstlauf && d.halt.index === 1, erstlauf: !!d.erstlauf });
  else { freigeben(q); zeige('aufdeckung', { halt: d.halt, fertig: true }); }
});

registriere('fein', {
  betreten,
  verlassen() { if (daten) aufraeumen(); },
});
