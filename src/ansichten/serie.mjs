// Serie aus der Mediathek: bis zu 10 Fotos sichern, prüfen, in Reihenfolge bringen, Vorschau zeigen, bauen.
// Regel: Jedes Rohbild liegt in der Datenbank, bevor etwas anderes damit passiert. Ein Foto wird erst
// beim Bauen in einer einzigen Transaktion zum Halt, ein Abbruch verliert deshalb nichts.
import { Z, registriere, zeige, neuLaden } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, $$, el, frage, melde, meldungWeg, warte, datumKurz, uhrzeit } from '../ui.mjs';
import { auftrag, generation, WorkerFehler } from '../rechner.mjs';
import { alsBlob, freigeben } from '../bild.mjs';
import { dekodiere } from '../einfuhr.mjs';
import { aufnahmezeitAusDatei } from '../exif.mjs';
import { SERIE_MAX } from '../serie.mjs';
import { vorbereiten, vorbereitenAusBlob, startMerkmale, transformFuer, zeichneAusschnitt } from '../serienwerk.mjs';
import { offeneFertigstellen, fertigstellenMitWiederholung } from '../naehwerk.mjs';
import * as db from '../speicher.mjs';
import { protokolliere, serienEintrag } from '../diagnose.mjs';

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
let startRechts = null;
let planerGen = -1; // Generation des Workers, in der der Serienplan zuletzt vollständig aufgebaut wurde

const fehlerText = (err) => String(err && (err.message || err) || 'unbekannt');

// Der Serienplan lebt im Worker. Startet der Worker neu (Absturz, Zeitgrenze), ist er weg:
// Dann alle Fotos und den Start neu übergeben und den Auftrag einmal wiederholen.
async function planerSicher() {
  const g = generation();
  if (g === planerGen) return;
  await auftrag('serie-neu');
  for (const [id, c] of cache) await auftrag('serie-foto', { foto: { id, zeit: c.rec.zeit, kandidaten: c.kandidaten } });
  await auftrag('serie-start', { rechts: startRechts });
  planerGen = g;
}

async function planer(typ, daten = {}) {
  for (let versuch = 1; ; versuch++) {
    try {
      await planerSicher();
      return await auftrag(typ, daten);
    } catch (err) {
      if (!(err instanceof WorkerFehler) || versuch >= 2) throw err;
      protokolliere('serie', `Worker neu gestartet, Serienplan wird neu aufgebaut: ${fehlerText(err)}`);
    }
  }
}

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
  btnBauen.disabled = sperre || !((plan && fotos.length) || offeneHalte());
  for (const b of modusKnoepfe) {
    b.disabled = sperre;
    b.setAttribute('aria-pressed', String(!eigene && b.dataset.modus === modus));
  }
  v.classList.toggle('baut', baut);
}

async function fotoAufnehmen(rec, quelle) {
  const vorb = quelle ? vorbereiten(quelle) : await vorbereitenAusBlob(rec.roh);
  cache.set(rec.id, { rec, ...vorb });
  await planer('serie-foto', { foto: { id: rec.id, zeit: rec.zeit, kandidaten: vorb.kandidaten } });
}

// Neue Fotos: einzeln dekodieren, Rohbild sichern, dann prüfen.
async function einlesen(dateien) {
  const zuViele = dateien.length > SERIE_MAX;
  const auswahl = dateien.slice(0, SERIE_MAX);
  const vorhanden = await db.serienFotos(Z.strecke.id);
  let reihe = vorhanden.reduce((m, x) => Math.max(m, x.reihe + 1), 0);
  const serieId = db.neueId();
  let kaputt = 0;
  const pause = vorhanden.length + auswahl.length >= 12 ? 500 : 100;
  for (let k = 0; k < auswahl.length; k++) {
    if (k) await warte(pause); // dem Browser Zeit zum Aufräumen geben
    zeigeStatus(f(T.seriePruefen, { k: k + 1, n: auswahl.length }), k / auswahl.length);
    const datei = auswahl[k];
    const t0 = performance.now();
    let c;
    try {
      c = await dekodiere(datei);
    } catch (err) {
      protokolliere('serie', err);
      serienEintrag(`Einlesen ${k + 1}/${auswahl.length}: Fehler beim Öffnen: ${fehlerText(err)}`);
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
      serienEintrag(`Einlesen ${k + 1}/${auswahl.length}: ${c.width}x${c.height}, ${Math.round(performance.now() - t0)} ms`);
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
      await planer('serie-entferne', { fotoId: id });
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
  startRechts = await startMerkmale(letzter).catch(() => null);
  mitStart = !!startRechts;
  await planer('serie-start', { rechts: startRechts });
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
    const r = await planer('serie-plane', { modus, reihenfolge: eigene, fest });
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
  await planer('serie-entferne', { fotoId: id });
  fotos = fotos.filter((x) => x.id !== id);
  if (eigene) eigene = eigene.filter((x) => x !== id);
  delete fest[id];
  if (!fotos.length) { zeige('sucher'); return; }
  await planen();
}

// --- Ausschnitt per Antippen wählen ---
async function wahlOeffnen(id) {
  if (baut || beschaeftigt || !plan) return;
  const r = await planer('serie-alternativen', { ordnung: plan.reihenfolge, wahl: plan.wahl, fotoId: id, anzahl: 8 });
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
const offeneHalte = () => Z.halte.some((h) => !h.bild);

async function bauen() {
  if (baut || (!plan && !offeneHalte())) return;
  baut = true;
  anhalten = false;
  knoepfe();
  const ordnung = plan ? plan.reihenfolge.slice() : [];
  const wahl = plan ? { ...plan.wahl } : {};
  const n = ordnung.length;
  const pause = n >= 12 ? 500 : 150;
  let fehler = null;
  try {
    // 1. Was ein früherer Fehler halbfertig zurückließ, zuerst fertigstellen. Scheitert das,
    //    bricht der Bau hier ab und fasst kein weiteres Foto an.
    const offen = Z.halte.filter((h) => !h.bild).length;
    if (offen) {
      zeigeStatus(f(T.wirdGebaut, { p: 0 }), 0);
      const t0 = performance.now();
      try {
        await offeneFertigstellen(Z.strecke.id);
        serienEintrag(`Nachgeholt: ${offen} offene Halte, ${Math.round(performance.now() - t0)} ms`);
      } catch (err) {
        serienEintrag(`Nachholen gescheitert, kein weiteres Foto angefasst: ${fehlerText(err)}`);
        throw err;
      } finally {
        await neuLaden();
      }
    }
    // 2. Plan sichern: Bricht der Bau ab, geht es mit derselben Reihenfolge weiter.
    for (let k = 0; k < n; k++) await db.aendereSerienFoto(ordnung[k], { plan: { pos: k, ausschnitt: wahl[ordnung[k]] } });
    // 3. Foto für Foto: in einer Transaktion zum Halt, dann fertigstellen (frisch aus der Datenbank).
    for (let k = 0; k < n; k++) {
      if (anhalten) break;
      if (k) await warte(pause); // dem Browser Zeit zum Aufräumen geben
      zeigeStatus(f(T.wirdGebaut, { p: Math.round((k / n) * 100) }), k / n);
      const t0 = performance.now();
      const id = ordnung[k];
      const c = cache.get(id);
      const t = transformFuer(c.kandidaten[wahl[id]], c.proxy, c.rec.rohB, c.rec.rohH);
      const halt = await db.serienFotoZuHalt(id, {
        id: db.neueId(), streckeId: Z.strecke.id, index: Z.halte.length, zeit: c.rec.aufnahme ?? Date.now(), quelle: 'import',
        transform: t, bild: null, naht: null, vorschau: null, nahtVorschau: null, pfad: null, wert: null, teile: null, name: '',
      });
      freigeben(c.proxy);
      cache.delete(id);
      await neuLaden();
      await planer('serie-entferne', { fotoId: id }).catch(() => {});
      try {
        await fertigstellenMitWiederholung(halt.id);
      } catch (err) {
        serienEintrag(`Foto ${k + 1}/${n}: Fehler nach ${Math.round(performance.now() - t0)} ms: ${fehlerText(err)}`);
        throw err;
      } finally {
        await neuLaden();
      }
      serienEintrag(`Foto ${k + 1}/${n}: ${Math.round(performance.now() - t0)} ms`);
    }
  } catch (err) {
    fehler = err;
    protokolliere('serie bauen', err);
  } finally {
    baut = false;
  }
  await neuLaden();
  const meldung = fehler instanceof db.SpeicherVoll ? T.speicherVoll : T.serieNaehFehler;
  if (fehler) melde(meldung);
  const rest = await db.serienFotos(Z.strecke.id);
  if (!rest.length && !fehler) { zeige('strecke'); return; }
  plan = null;
  if (!(await laden())) {
    if (!fehler) { zeige('strecke'); return; }
    // Nur noch der halbfertige Halt ist offen: Bauen bleibt möglich und holt ihn nach.
    liste.replaceChildren();
    zeigeStatus(meldung);
    knoepfe();
    return;
  }
  await planen();
  zeigeStatus(fehler ? meldung : f(T.serieAngehalten, { n: rest.length }));
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
  planerGen = -1;
  zeige('sucher');
});

registriere('serie', {
  async betreten({ dateien = null } = {}) {
    meldungWeg(); // eine stehende Erinnerung würde sonst die Knöpfe verdecken
    plan = null;
    eigene = null;
    fest = {};
    btnAnhalten.disabled = false;
    liste.replaceChildren();
    beschaeftigt = true;
    knoepfe();
    try {
      if (!cache.size) planerGen = -1;
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
    if ((await db.serienFotos(Z.strecke.id)).length) melde(T.serieWartet, [{ text: T.spaeter, haupt: false }, { text: T.serieOeffnen, aktion: () => zeige('serie') }], 10000);
  } catch (err) {
    protokolliere('serie', err);
  }
}
