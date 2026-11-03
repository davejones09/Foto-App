// Serie aus der Mediathek: bis zu 10 Fotos sichern, prüfen, in Reihenfolge bringen, Vorschau zeigen, bauen.
// Regel: Jedes Rohbild liegt in der Datenbank, bevor etwas anderes damit passiert. Ein Foto wird erst
// beim Bauen in einer einzigen Transaktion zum Halt, ein Abbruch verliert deshalb nichts.
import { Z, registriere, zeige, neuLaden } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, $$, el, frage, melde, datumKurz, uhrzeit } from '../ui.mjs';
import { auftrag } from '../rechner.mjs';
import { alsBlob, freigeben } from '../bild.mjs';
import { dekodiere } from '../einfuhr.mjs';
import { aufnahmezeitAusDatei } from '../exif.mjs';
import { SERIE_MAX } from '../serie.mjs';
import { vorbereiten, vorbereitenAusBlob, startMerkmale, transformFuer, zeichneAusschnitt } from '../serienwerk.mjs';
import { fertigstellen } from '../naehwerk.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';

const v = $('#v-serie');
const liste = $('.se-liste', v);
const status = $('.se-status', v);
const balken = $('.se-balken', v);
const modusKnoepfe = $$('.se-modus button', v);
const btnBauen = $('#se-bauen');
const btnAnhalten = $('#se-anhalten');
const btnVerwerfen = $('#se-verwerfen');
const wahlSchicht = $('#se-wahl');

const cache = new Map(); // Foto-ID -> { rec, proxy, kandidaten }
let fotos = [];
let plan = null;
let modus = 'beste';
let eigene = null; // eigene Reihenfolge nach dem Ziehen
let fest = {}; // per Antippen gewählte Ausschnitte
let baut = false;
let anhalten = false;
let mitStart = false;
let beschaeftigt = false;

function zeigeStatus(text, anteil = null) {
  status.textContent = text;
  balken.hidden = anteil == null;
  if (anteil != null) $('i', balken).style.width = `${Math.round(anteil * 100)}%`;
}

function knoepfe() {
  const sperre = baut || beschaeftigt;
  btnBauen.hidden = baut;
  btnVerwerfen.hidden = baut;
  btnAnhalten.hidden = !baut;
  btnBauen.disabled = sperre || !plan || !fotos.length;
  for (const b of modusKnoepfe) {
    b.disabled = sperre;
    b.setAttribute('aria-pressed', String(!eigene && b.dataset.modus === modus));
  }
  v.classList.toggle('baut', baut);
}

async function fotoAufnehmen(rec, quelle) {
  const vorb = quelle ? vorbereiten(quelle) : await vorbereitenAusBlob(rec.roh);
  cache.set(rec.id, { rec, ...vorb });
  await auftrag('serie-foto', { foto: { id: rec.id, zeit: rec.zeit, kandidaten: vorb.kandidaten } });
}

// Neue Fotos: einzeln dekodieren, Rohbild sichern, dann prüfen.
async function einlesen(dateien) {
  const zuViele = dateien.length > SERIE_MAX;
  const auswahl = dateien.slice(0, SERIE_MAX);
  const vorhanden = await db.serienFotos(Z.strecke.id);
  let reihe = vorhanden.reduce((m, x) => Math.max(m, x.reihe + 1), 0);
  const serieId = db.neueId();
  let kaputt = 0;
  for (let k = 0; k < auswahl.length; k++) {
    zeigeStatus(f(T.seriePruefen, { k: k + 1, n: auswahl.length }), k / auswahl.length);
    const datei = auswahl[k];
    let c;
    try {
      c = await dekodiere(datei);
    } catch (err) {
      protokolliere('serie', err);
      kaputt++;
      continue;
    }
    try {
      const roh = await alsBlob(c, 'image/jpeg', 0.92);
      const aufnahme = await aufnahmezeitAusDatei(datei);
      const rec = {
        id: db.neueId(), streckeId: Z.strecke.id, serieId, reihe: reihe++, roh, rohB: c.width, rohH: c.height,
        aufnahme, zeit: aufnahme ?? datei.lastModified ?? Date.now(), name: datei.name || '', plan: null,
      };
      await db.neuesSerienFoto(rec);
      await fotoAufnehmen(rec, c);
    } finally {
      freigeben(c);
    }
  }
  if (zuViele) melde(T.serieZuViele);
  else if (kaputt) melde(f(T.serieKaputt, { n: kaputt }));
}

// Stand aus der Datenbank: wartende Fotos, fester Start, gespeicherter Plan.
async function laden() {
  fotos = await db.serienFotos(Z.strecke.id);
  for (const id of [...cache.keys()]) {
    if (!fotos.some((x) => x.id === id)) {
      freigeben(cache.get(id).proxy);
      cache.delete(id);
      await auftrag('serie-entferne', { fotoId: id });
    }
  }
  const fehlend = fotos.filter((x) => !cache.has(x.id));
  for (let k = 0; k < fehlend.length; k++) {
    zeigeStatus(f(T.seriePruefen, { k: k + 1, n: fehlend.length }), k / fehlend.length);
    try {
      await fotoAufnehmen(fehlend[k], null);
    } catch (err) {
      protokolliere('serie', err);
    }
  }
  fotos = fotos.filter((x) => cache.has(x.id));
  if (!fotos.length) return false;
  const letzter = Z.halte[Z.halte.length - 1] || null;
  const start = await startMerkmale(letzter).catch(() => null);
  mitStart = !!start;
  await auftrag('serie-start', { rechts: start });
  // Ein unterbrochener Bau hinterlässt seinen Plan: genau so weitermachen.
  if (fotos.every((x) => x.plan)) {
    eigene = fotos.slice().sort((a, b) => a.plan.pos - b.plan.pos).map((x) => x.id);
    fest = {};
    for (const x of fotos) if (cache.get(x.id).kandidaten[x.plan.ausschnitt]) fest[x.id] = x.plan.ausschnitt;
  }
  return true;
}

async function planen() {
  beschaeftigt = true;
  knoepfe();
  try {
    const r = await auftrag('serie-plane', { modus, reihenfolge: eigene, fest });
    plan = r.plan;
  } finally {
    beschaeftigt = false;
  }
  zeichnen();
}

const wertKlasse = (w) => (w == null ? '' : w >= 70 ? 'gruen' : w >= 40 ? 'gelb' : 'rot');

function zeichnen() {
  if (!plan) return;
  const basis = Z.halte.length;
  const zeilen = plan.reihenfolge.map((id, k) => {
    const c = cache.get(id);
    const a = c.kandidaten[plan.wahl[id]];
    const bild = el('canvas');
    const wert = plan.werte[k];
    const zeit = c.rec.aufnahme ? `${datumKurz(c.rec.aufnahme)} ${uhrzeit(c.rec.aufnahme)}` : T.serieZeitUnbekannt;
    const zeile = el('li', { klasse: 'se-zeile', 'data-id': id, 'data-name': c.rec.name },
      el('button', { klasse: 'se-griff', 'aria-label': T.serieVerschieben, text: '≡' }),
      el('button', { klasse: 'se-bild', 'aria-label': T.serieAusschnitt, onclick: () => wahlOeffnen(id) }, bild),
      el('span', { klasse: 'se-info' }, el('b', { text: f(T.halt, { n: basis + k + 1 }) }), el('small', { text: zeit })),
      el('span', { klasse: `se-wert ${wertKlasse(wert)}`, text: wert == null ? '–' : String(wert) }),
      el('button', { klasse: 'se-weg', 'aria-label': T.serieEntfernen, text: '×', onclick: () => entfernen(id) }));
    zeile._zeichnen = () => zeichneAusschnitt(bild, c.proxy, a);
    return zeile;
  });
  liste.replaceChildren(...zeilen);
  requestAnimationFrame(() => { for (const z of zeilen) z._zeichnen(); });
  for (const z of zeilen) ziehbar(z);
  if (!baut) zeigeStatus(mitStart ? f(T.serieAnschluss, { n: basis }) : '');
  knoepfe();
}

// --- Umsortieren per Ziehen am Griff ---
function ziehbar(zeile) {
  const griff = $('.se-griff', zeile);
  let start = null;
  griff.addEventListener('pointerdown', (e) => {
    if (baut || beschaeftigt) return;
    e.preventDefault();
    griff.setPointerCapture(e.pointerId);
    const zeilen = $$('.se-zeile', liste);
    start = { y: e.clientY, rects: zeilen.map((z) => z.getBoundingClientRect()), index: zeilen.indexOf(zeile) };
    zeile.classList.add('zieht');
  });
  griff.addEventListener('pointermove', (e) => {
    if (!start) return;
    zeile.style.transform = `translateY(${e.clientY - start.y}px)`;
  });
  const ende = (e) => {
    if (!start) return;
    const dy = e.clientY - start.y;
    const r = start.rects[start.index];
    const mitte = r.top + r.height / 2 + dy;
    const ordnung = plan.reihenfolge.slice();
    const [id] = ordnung.splice(start.index, 1);
    const ziel = start.rects.filter((x, i) => i !== start.index && x.top + x.height / 2 < mitte).length;
    ordnung.splice(ziel, 0, id);
    start = null;
    zeile.classList.remove('zieht');
    zeile.style.transform = '';
    if (ordnung.join() === plan.reihenfolge.join()) return;
    eigene = ordnung;
    planen().catch((err) => protokolliere('serie', err));
  };
  griff.addEventListener('pointerup', ende);
  griff.addEventListener('pointercancel', ende);
}

async function entfernen(id) {
  if (baut || beschaeftigt) return;
  await db.loescheSerienFoto(id);
  const c = cache.get(id);
  if (c) freigeben(c.proxy);
  cache.delete(id);
  await auftrag('serie-entferne', { fotoId: id });
  fotos = fotos.filter((x) => x.id !== id);
  if (eigene) eigene = eigene.filter((x) => x !== id);
  delete fest[id];
  if (!fotos.length) { zeige('sucher'); return; }
  await planen();
}

// --- Ausschnitt per Antippen wählen ---
async function wahlOeffnen(id) {
  if (baut || beschaeftigt || !plan) return;
  const r = await auftrag('serie-alternativen', { ordnung: plan.reihenfolge, wahl: plan.wahl, fotoId: id, anzahl: 8 });
  const c = cache.get(id);
  const raster = $('.se-raster', wahlSchicht);
  const knoepfe = r.liste.map((alt) => {
    const bild = el('canvas');
    const b = el('button', {
      klasse: 'se-alt', 'aria-current': String(alt.index === plan.wahl[id]),
      onclick: async () => {
        wahlSchicht.hidden = true;
        fest[id] = alt.index;
        await planen();
      },
    }, bild, el('span', { text: alt.wert == null ? '–' : String(alt.wert) }));
    b._zeichnen = () => zeichneAusschnitt(bild, c.proxy, c.kandidaten[alt.index]);
    return b;
  });
  raster.replaceChildren(...knoepfe);
  wahlSchicht.hidden = false;
  requestAnimationFrame(() => { for (const b of knoepfe) b._zeichnen(); });
}
$('#se-wahl-zu').addEventListener('click', () => (wahlSchicht.hidden = true));

for (const b of modusKnoepfe) {
  b.addEventListener('click', () => {
    modus = b.dataset.modus;
    eigene = null;
    planen().catch((err) => protokolliere('serie', err));
  });
}

// --- Bauen: volle Auflösung, Foto für Foto ---
async function bauen() {
  if (baut || !plan) return;
  baut = true;
  anhalten = false;
  knoepfe();
  const ordnung = plan.reihenfolge.slice();
  const wahl = { ...plan.wahl };
  let fehler = null;
  try {
    // Plan zuerst sichern: Bricht der Bau ab, geht es mit derselben Reihenfolge weiter.
    for (let k = 0; k < ordnung.length; k++) await db.aendereSerienFoto(ordnung[k], { plan: { pos: k, ausschnitt: wahl[ordnung[k]] } });
    for (let k = 0; k < ordnung.length; k++) {
      if (anhalten) break;
      zeigeStatus(f(T.wirdGebaut, { p: Math.round((k / ordnung.length) * 100) }), k / ordnung.length);
      const id = ordnung[k];
      const c = cache.get(id);
      const t = transformFuer(c.kandidaten[wahl[id]], c.proxy, c.rec.rohB, c.rec.rohH);
      const index = Z.halte.length;
      const vor = Z.halte[index - 1] || null;
      const halt = await db.serienFotoZuHalt(id, {
        id: db.neueId(), streckeId: Z.strecke.id, index, zeit: c.rec.aufnahme ?? Date.now(), quelle: 'import',
        transform: t, bild: null, naht: null, vorschau: null, nahtVorschau: null, pfad: null, wert: null, teile: null, name: '',
      });
      Z.halte.push(halt);
      freigeben(c.proxy);
      cache.delete(id);
      await auftrag('serie-entferne', { fotoId: id });
      Z.halte[index] = await fertigstellen(halt, vor);
    }
  } catch (err) {
    fehler = err;
    protokolliere('serie bauen', err);
  } finally {
    baut = false;
  }
  await neuLaden();
  if (fehler) melde(fehler instanceof db.SpeicherVoll ? T.speicherVoll : T.naehFehler);
  const rest = await db.serienFotos(Z.strecke.id);
  if (!rest.length && !fehler) { zeige('strecke'); return; }
  plan = null;
  if (!(await laden())) { zeige('strecke'); return; }
  await planen();
  zeigeStatus(f(T.serieAngehalten, { n: rest.length }));
}

btnBauen.addEventListener('click', () => bauen());
btnAnhalten.addEventListener('click', () => { anhalten = true; btnAnhalten.disabled = true; });
$('#se-zurueck').addEventListener('click', () => { if (!baut) zeige('sucher'); });
btnVerwerfen.addEventListener('click', async () => {
  const r = await frage(T.serieVerwerfenFrage, [
    { text: T.behalten, wert: false },
    { text: T.verwerfen, wert: true, haupt: true },
  ]);
  if (!r.wert) return;
  for (const x of await db.serienFotos(Z.strecke.id)) await db.loescheSerienFoto(x.id);
  for (const c of cache.values()) freigeben(c.proxy);
  cache.clear();
  await auftrag('serie-neu');
  zeige('sucher');
});

registriere('serie', {
  async betreten({ dateien = null } = {}) {
    plan = null;
    eigene = null;
    fest = {};
    btnAnhalten.disabled = false;
    liste.replaceChildren();
    beschaeftigt = true;
    knoepfe();
    try {
      if (!cache.size) await auftrag('serie-neu');
      if (dateien) await einlesen(dateien);
      const da = await laden();
      beschaeftigt = false;
      if (!da) { zeige('sucher'); return; }
      await planen();
    } catch (err) {
      protokolliere('serie', err);
      melde(err instanceof db.SpeicherVoll ? T.speicherVoll : T.allgemein);
    } finally {
      beschaeftigt = false;
      knoepfe();
    }
  },
  verlassen() { wahlSchicht.hidden = true; },
});

// Beim Start: Wartet noch eine Serie?
export async function serieErinnern() {
  try {
    if (!Z.strecke || Z.strecke.blind && !Z.strecke.ziel) return;
    if ((await db.serienFotos(Z.strecke.id)).length) melde(T.serieWartet, [{ text: T.serieOeffnen, aktion: () => zeige('serie') }]);
  } catch (err) {
    protokolliere('serie', err);
  }
}
