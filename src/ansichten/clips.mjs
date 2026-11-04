// Reel aus Clips: Videoclips und Fotos wählen, ordnen, Stil und Länge wählen, bauen, ansehen, teilen.
// Die Auswahl bleibt nur im Arbeitsspeicher: Clips sind oft sehr groß und liegen ohnehin in der Mediathek.
import { registriere, zeige } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, melde } from '../ui.mjs';
import * as aus from '../ausgabe.mjs';
import { protokolliere } from '../diagnose.mjs';
import { REEL_LAENGEN } from '../kennzahlen.mjs';
import { VORLAGEN_IDS } from '../reelvorlagen.mjs';
import { clipPlan, clipMaler, ladeClip, suche, clipWeg, deckAusschnitt, GANZ, MEDIEN_MAX } from '../clipreel.mjs';

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

const zeitText = (s) => `${s.toFixed(1).replace('.', ',')} s`;

async function vorschaubild(m, canvas) {
  const k = canvas.getContext('2d');
  try {
    let q;
    if (m.typ === 'foto') {
      q = await createImageBitmap(m.datei);
      const a = deckAusschnitt(q.width, q.height, canvas.width, canvas.height);
      k.drawImage(q, a.x, a.y, a.w, a.h, 0, 0, canvas.width, canvas.height);
      q.close?.();
    } else {
      q = await ladeClip(m.url);
      m.dauer = q.duration;
      await suche(q, Math.min(m.start, q.duration - 0.05));
      const a = deckAusschnitt(q.videoWidth, q.videoHeight, canvas.width, canvas.height);
      k.drawImage(q, a.x, a.y, a.w, a.h, 0, 0, canvas.width, canvas.height);
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
  for (const d of dateien.slice(0, Math.max(0, frei))) {
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

function zeile(m, i) {
  const infoText = () => (m.typ === 'foto' ? T.clipFoto : f(T.clipDauer, { start: zeitText(m.start), dauer: zeitText(m.dauer) }));
  const info = el('small', { text: infoText() });
  const regler = m.typ === 'clip' && m.dauer > 0.5 ? el('input', {
    type: 'range', min: 0, max: Math.max(0, m.dauer - 0.2).toFixed(2), step: 0.1, value: m.start, 'aria-label': T.clipStart,
    oninput: (e) => { m.start = Number(e.target.value); info.textContent = infoText(); planZeigen(); },
    onchange: () => vorschaubild(m, m.leinwand),
  }) : null;
  return el('div', { klasse: 'cl-zeile', 'data-typ': m.typ }, m.leinwand,
    el('div', { klasse: 'cl-mitte' }, el('span', { text: f(T.clipName, { n: i + 1 }) }), info, regler),
    el('div', { klasse: 'cl-knoepfe' },
      el('button', { klasse: 'neben2', text: '↑', 'aria-label': T.clipHoch, disabled: i === 0, onclick: () => schiebe(m, -1) }),
      el('button', { klasse: 'neben2', text: '↓', 'aria-label': T.clipRunter, disabled: i === medien.length - 1, onclick: () => schiebe(m, 1) }),
      el('button', { klasse: 'neben2 cl-weg', text: '×', 'aria-label': T.clipWeg, onclick: () => entfernen(m) })));
}

function planJetzt() {
  return clipPlan(medien, { stil, laenge: stil === GANZ ? null : laenge });
}

function planZeigen() {
  bauenKnopf.disabled = laeuft || medien.length === 0;
  laengenEl.hidden = stil === GANZ;
  for (const b of laengenEl.children) b.setAttribute('aria-pressed', String((b.dataset.laenge ? Number(b.dataset.laenge) : null) === laenge));
  for (const b of stileEl.children) b.setAttribute('aria-pressed', String(b.dataset.stil === stil));
  if (!medien.length) { infoEl.textContent = T.clipsLeer; return; }
  const p = planJetzt();
  let text = f(T.clipsInfo, { n: medien.length, s: p.laenge });
  if (p.gekappt) text += ` ${T.clipsGekappt}`;
  if (p.zuKurz) text += ` ${f(T.clipsZuKurz, { n: p.maxFotos })}`;
  if (p.runden > 1) text += ` ${f(T.clipsRunden, { r: p.runden })}`;
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
    const blob = await aus.videoAusMaler(m.male, p.bilder, { fortschritt: fort, waechter: w });
    const datei = new File([blob], 'reel.mp4', { type: blob.type });
    if (ergebnisUrl) URL.revokeObjectURL(ergebnisUrl);
    ergebnisUrl = URL.createObjectURL(blob);
    ergebnisEl.replaceChildren(
      el('video', { src: ergebnisUrl, controls: true, playsinline: true, muted: true, loop: true, klasse: 'cl-video' }),
      el('p', { klasse: 'rt-info', text: T.clipsOhneTon }),
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

async function teile(datei) {
  try {
    await aus.teilen([datei], T.artReel);
  } catch (err) {
    protokolliere('teilen', err);
    melde(T.teilenFehler, [{ text: T.stattdessenSpeichern, aktion: () => aus.speichern([datei]) }]);
  }
}

stileBauen();
$('#cl-waehlen', v).addEventListener('click', () => eingabe.click());
eingabe.addEventListener('change', () => {
  const l = [...eingabe.files];
  eingabe.value = '';
  dazu(l).catch((err) => { protokolliere('clips', err); melde(T.clipFehler); });
});
bauenKnopf.addEventListener('click', bauen);
$('#cl-zurueck', v).addEventListener('click', () => zeige(zurueck));

registriere('clips', {
  betreten(_, alt) {
    if (alt && alt !== 'clips') zurueck = alt;
    aufbauen();
  },
});
