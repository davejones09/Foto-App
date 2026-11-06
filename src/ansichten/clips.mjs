// Reel aus Clips: Videoclips und Fotos wählen, ordnen, Stil und Länge wählen, bauen, ansehen, teilen.
// Die Auswahl bleibt nur im Arbeitsspeicher: Clips sind oft sehr groß und liegen ohnehin in der Mediathek.
import { registriere, zeige } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, melde } from '../ui.mjs';
import * as aus from '../ausgabe.mjs';
import { protokolliere, serienEintrag } from '../diagnose.mjs';
import { mp4TonProben } from '../metadaten.mjs';
import { REEL_LAENGEN } from '../kennzahlen.mjs';
import { VORLAGEN_IDS } from '../reelvorlagen.mjs';
import { clipPlan, clipMaler, ladeClip, suche, clipWeg, zeichneQuelle, rahmenAusschnitt, eigeneLaenge, GANZ, MEDIEN_MAX } from '../clipreel.mjs';
import { schnittStellen } from '../musik.mjs';
import { ladeSchritt, ladeWarten, ladeEnde } from '../laden.mjs';

const v = $('#v-clips');
const liste = $('.cl-liste', v);
const stileEl = $('.cl-stile', v);
const laengenEl = $('.cl-laengen', v);
const infoEl = $('.cl-info', v);
const bauenKnopf = $('#cl-bauen', v);
const fortEl = $('.cl-fort', v);
const ergebnisEl = $('.cl-ergebnis', v);
const eingabe = $('#datei-clips');

let medien = [];
let stil = GANZ;
let laenge = null;
let zurueck = 'start';
let laeuft = false;
let ergebnisUrl = null;
let zaehler = 0;
let musik = null; // { name, url, puffer, bpm, schlaege, sicher, start, alle }

const zeitText = (s) => `${s.toFixed(1).replace('.', ',')} s`;

function vorschauMalen(canvas, m, bild, qw, qh) {
  const k = canvas.getContext('2d');
  k.save();
  k.fillStyle = '#000';
  k.fillRect(0, 0, canvas.width, canvas.height);
  k.translate(canvas.width / 2, canvas.height / 2);
  zeichneQuelle(k, bild, qw, qh, canvas.width, canvas.height, m.rahmen);
  k.restore();
}

async function vorschaubild(m, canvas) {
  try {
    if (m.typ === 'foto') {
      const q = await createImageBitmap(m.datei);
      vorschauMalen(canvas, m, q, q.width, q.height);
      q.close?.();
    } else {
      const q = await ladeClip(m.url);
      m.dauer = q.duration;
      await suche(q, Math.min(m.start, q.duration - 0.05));
      vorschauMalen(canvas, m, q, q.videoWidth, q.videoHeight);
      clipWeg(q);
    }
  } catch (err) {
    protokolliere('clip vorschau', err);
    m.fehler = true;
  }
}

async function dazu(dateien) {
  const frei = MEDIEN_MAX - medien.length;
  if (dateien.length > frei) melde(f(T.clipsZuViele, { n: MEDIEN_MAX }));
  const liste = dateien.slice(0, Math.max(0, frei));
  for (const [nr, d] of liste.entries()) {
    ladeSchritt(nr + 1, liste.length);
    const typ = d.type.startsWith('image/') ? 'foto' : 'clip';
    const m = { id: ++zaehler, typ, datei: d, url: typ === 'clip' ? URL.createObjectURL(d) : null, dauer: 0, start: 0, leinwand: el('canvas', { width: 90, height: 160 }) };
    medien.push(m);
    await vorschaubild(m, m.leinwand);
    if (m.fehler) {
      medien = medien.filter((x) => x !== m);
      if (m.url) URL.revokeObjectURL(m.url);
      melde(T.clipFehler);
    }
    aufbauen();
  }
}

function entfernen(m) {
  medien = medien.filter((x) => x !== m);
  if (m.url) URL.revokeObjectURL(m.url);
  aufbauen();
}

function schiebe(m, d) {
  const i = medien.indexOf(m);
  const j = i + d;
  if (j < 0 || j >= medien.length) return;
  [medien[i], medien[j]] = [medien[j], medien[i]];
  aufbauen();
}

function infoText(m) {
  const basis = m.typ === 'foto'
    ? f(T.clipInfoFoto, { laenge: zeitText(eigeneLaenge(m)) })
    : f(T.clipInfoClip, { laenge: zeitText(eigeneLaenge(m)), start: zeitText(m.start) });
  return basis + (m.rahmen?.modus === 'ganz' ? T.clipInfoGanz : '');
}

function zeile(m, i) {
  return el('div', { klasse: 'cl-zeile', 'data-typ': m.typ }, m.leinwand,
    el('div', { klasse: 'cl-mitte' },
      el('span', { text: f(T.clipName, { n: i + 1 }) }),
      el('small', { text: infoText(m) }),
      el('button', { klasse: 'link cl-bearbeiten', text: T.clipBearbeiten, onclick: () => editorOeffnen(m) })),
    el('div', { klasse: 'cl-knoepfe' },
      el('button', { klasse: 'neben2', text: '↑', 'aria-label': T.clipHoch, disabled: i === 0, onclick: () => schiebe(m, -1) }),
      el('button', { klasse: 'neben2', text: '↓', 'aria-label': T.clipRunter, disabled: i === medien.length - 1, onclick: () => schiebe(m, 1) }),
      el('button', { klasse: 'neben2 cl-weg', text: '×', 'aria-label': T.clipWeg, onclick: () => entfernen(m) })));
}

// --- Bearbeiten: Ausschnitt und Länge eines Mediums ---
const editor = $('.cl-editor', v);
const eBild = $('#ce-bild', v);
let aktuell = null; // { m, q, qw, qh, video }
let zeichnetGerade = false;
let nochmal = false;

function editorMalen() {
  if (!aktuell) return;
  const { m, q, qw, qh } = aktuell;
  vorschauMalen(eBild, m, q, qw, qh);
}

async function editorZeigeStelle(zeit) {
  if (!aktuell?.video) return;
  if (zeichnetGerade) { nochmal = zeit; return; }
  zeichnetGerade = true;
  await suche(aktuell.q, zeit);
  editorMalen();
  zeichnetGerade = false;
  if (nochmal !== false) { const z = nochmal; nochmal = false; editorZeigeStelle(z); }
}

function editorRegler() {
  const { m, video } = aktuell;
  const r = m.rahmen || (m.rahmen = { x: 0.5, y: 0.5, zoom: 1, modus: 'fuellen' });
  for (const b of $('.ce-modus', v).children) b.setAttribute('aria-pressed', String(b.dataset.modus === r.modus));
  $('.ce-hinweis', v).textContent = r.modus === 'ganz' ? T.clipHinweisGanz : T.clipHinweisFuellen;
  $('.ce-zoom', v).hidden = r.modus === 'ganz';
  $('#ce-zoom', v).value = r.zoom;
  $('.ce-start', v).hidden = !video;
  $('.ce-ende', v).hidden = !video;
  $('.ce-laenge', v).hidden = !!video;
  if (video) {
    const ende = m.ende ?? m.dauer;
    const s = $('#ce-start', v);
    const e = $('#ce-ende', v);
    s.max = Math.max(0, m.dauer - 0.2).toFixed(2);
    e.max = m.dauer.toFixed(2);
    s.value = m.start;
    e.value = ende;
    $('.ce-start-text', v).textContent = f(T.clipStartWert, { s: zeitText(m.start) });
    $('.ce-ende-text', v).textContent = `${f(T.clipEndeWert, { s: zeitText(ende) })} · ${f(T.clipLaengeWert, { s: zeitText(eigeneLaenge(m)) })}`;
  } else {
    $('#ce-laenge', v).value = eigeneLaenge(m);
    $('.ce-laenge-text', v).textContent = f(T.clipLaengeWert, { s: zeitText(eigeneLaenge(m)) });
  }
}

async function editorOeffnen(m) {
  try {
    let q;
    let qw;
    let qh;
    if (m.typ === 'foto') {
      q = await createImageBitmap(m.datei);
      qw = q.width;
      qh = q.height;
    } else {
      q = await ladeClip(m.url);
      qw = q.videoWidth;
      qh = q.videoHeight;
      await suche(q, m.start);
    }
    aktuell = { m, q, qw, qh, video: m.typ === 'clip' };
    editor.hidden = false;
    editorRegler();
    editorMalen();
  } catch (err) {
    protokolliere('clip bearbeiten', err);
    melde(T.clipFehler);
  }
}

function editorSchliessen() {
  if (!aktuell) return;
  const { m, q, video } = aktuell;
  if (video) clipWeg(q);
  else q.close?.();
  aktuell = null;
  editor.hidden = true;
  vorschaubild(m, m.leinwand);
  aufbauen();
}

function editorEinrichten() {
  $('#ce-fertig', v).addEventListener('click', editorSchliessen);
  $('#ce-zuruecksetzen', v).addEventListener('click', () => {
    const { m } = aktuell;
    m.rahmen = { x: 0.5, y: 0.5, zoom: 1, modus: 'fuellen' };
    m.start = 0;
    delete m.ende;
    delete m.laenge;
    m.eigen = false;
    editorRegler();
    if (aktuell.video) editorZeigeStelle(0);
    else editorMalen();
    planZeigen();
  });
  for (const b of $('.ce-modus', v).children) {
    b.addEventListener('click', () => {
      aktuell.m.rahmen.modus = b.dataset.modus;
      editorRegler();
      editorMalen();
    });
  }
  $('#ce-zoom', v).addEventListener('input', (e) => {
    aktuell.m.rahmen.zoom = Number(e.target.value);
    editorMalen();
  });
  $('#ce-start', v).addEventListener('input', (e) => {
    const { m } = aktuell;
    const ende = m.ende ?? m.dauer;
    m.start = Math.min(Number(e.target.value), Math.max(0, ende - 0.2));
    m.eigen = true;
    editorRegler();
    editorZeigeStelle(m.start);
  });
  $('#ce-ende', v).addEventListener('input', (e) => {
    const { m } = aktuell;
    m.ende = Math.max(Number(e.target.value), m.start + 0.2);
    m.eigen = true;
    editorRegler();
    editorZeigeStelle(m.ende - 0.05);
  });
  $('#ce-laenge', v).addEventListener('input', (e) => {
    aktuell.m.laenge = Number(e.target.value);
    aktuell.m.eigen = true;
    editorRegler();
  });
  // Ziehen, zwei Finger und Mausrad
  const finger = new Map();
  let abstand = 0;
  const umstellen = (dx, dy) => {
    const { m, qw, qh } = aktuell;
    const r = m.rahmen;
    if (r.modus === 'ganz') return;
    const a = rahmenAusschnitt(qw, qh, r);
    const box = eBild.getBoundingClientRect();
    if (qw - a.w > 0.5) r.x = Math.max(0, Math.min(1, r.x - ((dx * a.w) / box.width) / (qw - a.w)));
    if (qh - a.h > 0.5) r.y = Math.max(0, Math.min(1, r.y - ((dy * a.h) / box.height) / (qh - a.h)));
    editorMalen();
  };
  const zoomen = (z) => {
    const r = aktuell.m.rahmen;
    if (r.modus === 'ganz') return;
    r.zoom = Math.max(1, Math.min(3, z));
    $('#ce-zoom', v).value = r.zoom;
    editorMalen();
  };
  eBild.addEventListener('pointerdown', (e) => {
    eBild.setPointerCapture?.(e.pointerId);
    finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    abstand = 0;
  });
  eBild.addEventListener('pointermove', (e) => {
    const p = finger.get(e.pointerId);
    if (!p || !aktuell) return;
    if (finger.size === 1) umstellen(e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX;
    p.y = e.clientY;
    if (finger.size === 2) {
      const [a, b] = [...finger.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (abstand) zoomen(aktuell.m.rahmen.zoom * (d / abstand));
      abstand = d;
    }
  });
  const los = (e) => { finger.delete(e.pointerId); abstand = 0; };
  eBild.addEventListener('pointerup', los);
  eBild.addEventListener('pointercancel', los);
  eBild.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (aktuell) zoomen(aktuell.m.rahmen.zoom * Math.exp(-e.deltaY * 0.002));
  }, { passive: false });
}

// --- Musik ---
const musikRaster = () => (musik ? schnittStellen(musik.schlaege, musik.treffer, musik.start, musik.alle) : null);

function musikZeigen() {
  $('.cl-musik-info', v).hidden = !musik;
  $('#cl-musik-waehlen', v).hidden = !!musik;
  if (!musik) return;
  $('.cl-musik-name', v).textContent = musik.name;
  $('.cl-musik-takt', v).textContent = musik.sicher ? f(T.musikTakt, { bpm: Math.round(musik.bpm) }) : T.musikUnsicher;
  const s = $('#cl-musik-start', v);
  s.max = Math.max(0, musik.puffer.duration - 3).toFixed(1);
  s.value = musik.start;
  $('.cl-musik-start', v).textContent = f(T.musikStart, { s: zeitText(musik.start) });
  for (const b of $('.cl-alle', v).children) b.setAttribute('aria-pressed', String(Number(b.dataset.alle) === musik.alle));
}

async function musikDazu(datei) {
  infoEl.textContent = T.musikLaedt;
  ladeWarten(T.musikLaedt);
  try {
    const m = await aus.musikLaden(datei);
    if (musik) URL.revokeObjectURL(musik.url);
    musik = { ...m, name: datei.name, url: URL.createObjectURL(datei), start: 0, alle: m.bpm >= 100 ? 2 : 1 };
    $('.cl-musik-probe', v).src = musik.url;
  } catch (err) {
    protokolliere('musik', err);
    melde(T.musikFehler);
  } finally {
    ladeEnde();
  }
  musikZeigen();
  planZeigen();
}

function planJetzt() {
  const raster = musikRaster();
  return clipPlan(medien, {
    stil,
    laenge: stil === GANZ && !musik ? null : laenge,
    raster,
    takt: musik ? (60 / musik.bpm) * musik.alle : null,
    musikRest: musik ? musik.puffer.duration - musik.start : undefined,
  });
}

function planZeigen() {
  bauenKnopf.disabled = laeuft || medien.length === 0;
  laengenEl.hidden = stil === GANZ && !musik;
  for (const b of laengenEl.children) b.setAttribute('aria-pressed', String((b.dataset.laenge ? Number(b.dataset.laenge) : null) === laenge));
  for (const b of stileEl.children) b.setAttribute('aria-pressed', String(b.dataset.stil === stil));
  if (!medien.length) { infoEl.textContent = T.clipsLeer; return; }
  const p = planJetzt();
  let text = f(T.clipsInfo, { n: medien.length, s: p.laenge });
  if (p.gekappt) text += ` ${musik ? T.musikKurz : T.clipsGekappt}`;
  if (p.zuKurz) text += ` ${f(T.clipsZuKurz, { n: p.maxFotos })}`;
  if (p.runden > 1) text += ` ${f(T.clipsRunden, { r: p.runden })}`;
  if (p.eigeneLaengen && laenge) text += ` ${T.clipsEigene}`;
  infoEl.textContent = text;
  bauenKnopf.disabled = laeuft || p.zuKurz;
}

function aufbauen() {
  liste.replaceChildren(...medien.map(zeile));
  planZeigen();
}

function stileBauen() {
  const ids = [GANZ, ...VORLAGEN_IDS];
  stileEl.replaceChildren(...ids.map((id) => el('button', {
    'data-stil': id, klasse: 'cl-stil', text: id === GANZ ? T.clipsGanz : T[`vorlage_${id.slice(2)}`],
    onclick: () => { stil = id; planZeigen(); },
  })));
  laengenEl.replaceChildren(
    el('button', { text: T.reelAuto, onclick: () => { laenge = null; planZeigen(); } }),
    ...REEL_LAENGEN.map((l) => el('button', { 'data-laenge': l, text: f(T.reelSekunden, { s: l }), onclick: () => { laenge = l; planZeigen(); } })),
  );
}

async function bauen() {
  if (laeuft) return;
  laeuft = true;
  bauenKnopf.disabled = true;
  ergebnisEl.replaceChildren();
  fortEl.hidden = false;
  const fort = (p) => { fortEl.textContent = f(T.wirdGebaut, { p: Math.round(p * 100) }); };
  fort(0);
  const w = aus.hintergrundWaechter();
  const p = planJetzt();
  const m = clipMaler(medien, p);
  try {
    const ton = musik ? await tonBauen(p.dauer) : null;
    const blob = await aus.videoAusMaler(m.male, p.bilder, { fortschritt: fort, waechter: w, ton });
    const pruefung = ton ? await tonPruefen(blob, ton) : null;
    const hatTon = !!pruefung?.ok;
    const datei = new File([blob], 'reel.mp4', { type: blob.type });
    if (ergebnisUrl) URL.revokeObjectURL(ergebnisUrl);
    ergebnisUrl = URL.createObjectURL(blob);
    ergebnisEl.replaceChildren(
      el('video', { src: ergebnisUrl, controls: true, playsinline: true, muted: !hatTon, loop: true, klasse: 'cl-video' }),
      el('p', { klasse: 'rt-info', text: hatTon ? T.musikRechte : (musik ? T.musikKeinTon : T.clipsOhneTon) }),
      pruefung ? el('small', { klasse: 'cl-ton-pruefung', text: pruefung.text }) : null,
      el('button', { klasse: 'haupt', id: 'cl-teilen', text: T.teilen, onclick: () => teile(datei) }),
    );
    fortEl.hidden = true;
  } catch (err) {
    if (err instanceof aus.KeinMp4) fortEl.textContent = T.clipsNichtMoeglich;
    else if (err instanceof aus.Abgebrochen) fortEl.textContent = T.abbruchHintergrund;
    else {
      protokolliere('clip reel', err);
      fortEl.textContent = T.clipsBauFehler;
    }
  } finally {
    m.ende();
    w.ende();
    laeuft = false;
    planZeigen();
  }
}

// Scheitert der Ton, wird das Reel trotzdem fertig, aber mit klarem Hinweis und Eintrag in der Diagnose.
async function tonBauen(dauer) {
  try {
    return await aus.tonKodieren(musik.puffer, musik.start, dauer);
  } catch (err) {
    protokolliere('musik', err);
    return null;
  }
}

async function tonPruefen(blob, ton) {
  const proben = mp4TonProben(await blob.arrayBuffer());
  const gehoert = await aus.tonHoeren(ton);
  const zahl = (x) => (x == null ? '–' : x.toFixed(2));
  const text = f(T.musikPruefung, { n: proben, von: ton.pakete.length, pegel: zahl(ton.pegel), gehoert: zahl(gehoert) });
  serienEintrag(text);
  const ok = proben === ton.pakete.length && (gehoert == null || gehoert > 0.001);
  if (!ok) protokolliere('musik', text);
  return { ok, text };
}

async function teile(datei) {
  try {
    await aus.teilen([datei], T.artReel);
  } catch (err) {
    protokolliere('teilen', err);
    melde(T.teilenFehler, [{ text: T.stattdessenSpeichern, aktion: () => aus.speichern([datei]) }]);
  }
}


stileBauen();
editorEinrichten();
const musikEingabe = $('#datei-musik');
$('#cl-musik-waehlen', v).addEventListener('click', () => musikEingabe.click());
musikEingabe.addEventListener('change', () => {
  const d = musikEingabe.files[0];
  musikEingabe.value = '';
  if (d) musikDazu(d);
  else ladeEnde();
});
$('#cl-musik-weg', v).addEventListener('click', () => {
  URL.revokeObjectURL(musik.url);
  musik = null;
  $('.cl-musik-probe', v).removeAttribute('src');
  musikZeigen();
  planZeigen();
});
$('#cl-musik-start', v).addEventListener('input', (e) => {
  musik.start = Number(e.target.value);
  musikZeigen();
  planZeigen();
});
$('.cl-alle', v).replaceChildren(...[1, 2, 4].map((n) => el('button', {
  'data-alle': n, text: T[`musikAlle${n}`], onclick: () => { musik.alle = n; musikZeigen(); planZeigen(); },
})));
$('#cl-waehlen', v).addEventListener('click', () => eingabe.click());
eingabe.addEventListener('change', () => {
  const l = [...eingabe.files];
  eingabe.value = '';
  dazu(l).catch((err) => { protokolliere('clips', err); melde(T.clipFehler); }).finally(ladeEnde);
});
bauenKnopf.addEventListener('click', bauen);
$('#cl-zurueck', v).addEventListener('click', () => zeige(zurueck));

registriere('clips', {
  betreten(_, alt) {
    if (alt && alt !== 'clips') zurueck = alt;
    musikZeigen();
    aufbauen();
  },
});
