// Reel aus Clips: Videoclips und Fotos wählen, ordnen, Stil und Länge wählen, bauen, ansehen, teilen.
// Die Auswahl bleibt nur im Arbeitsspeicher: Clips sind oft sehr groß und liegen ohnehin in der Mediathek.
import { registriere, zeige } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, melde, frage } from '../ui.mjs';
import * as db from '../speicher.mjs';
import * as aus from '../ausgabe.mjs';
import { protokolliere, serienEintrag } from '../diagnose.mjs';
import { mp4TonProben } from '../metadaten.mjs';
import { REEL_LAENGEN } from '../kennzahlen.mjs';
import { VORLAGEN_IDS, istVorlage, vorlageAus, eigeneSetzen, eigeneVorlagen } from '../reelvorlagen.mjs';
import { fotoRahmen, motivLage, clipPlan, clipMaler, ladeClip, suche, clipWeg, zeichneQuelle, rahmenAusschnitt, eigeneLaenge, GANZ, MEDIEN_MAX, FOTO_STAND } from '../clipreel.mjs';
import { schnittStellen } from '../musik.mjs';
import { ladeSchritt, ladeWarten, ladeEnde } from '../laden.mjs';
import { vorschauSpieler } from '../vorschau.mjs';
import { instaZeichnen } from '../instagram.mjs';
import { vorlagenWahl, eigeneLaden } from '../vorlagenwahl.mjs';
import { TEXT_STILE, ueberlagern, signaturLaden } from '../reeltext.mjs';
import { clipTonLaden, mischen, wavAus } from '../tonmix.mjs';
import { anschlussKamera } from '../anschlusskamera.mjs';

// Erkennung erst laden, wenn ein Wechsel mit Vordergrund sie braucht (rund 13 MB).
const erkennung = () => import('../erkennung.mjs');
const vordergrundMaske = async (c, art) => (await erkennung()).vordergrundMaske(c, art);

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
let erstesMal = true;
let modus = 'einfach';
v.dataset.modus = 'einfach';
let anteil = 0.35; // 0 nur Musik, 0,5 beide voll, 1 nur Originalton
let tempo = 'normal';
let variante = 0;
let fotoArt = 'auto'; // Fotos im Reel: auto, ganz, fuellen
let fotoGrund = 'unscharf';
const wahl = { stil: GANZ, variante: 0 };
let wahlUI = null;
let fest = []; // selbst gesetzte Schnitte, Index = Schnitt
const titel = { text: '', stil: 'klar', lage: 'unten' };
let route = '';
let signatur = null;
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
    const m = neuesMedium(d, typ);
    fest = [];
    medien.push(m);
    await vorschaubild(m, m.leinwand);
    if (m.fehler) {
      medien = medien.filter((x) => x !== m);
      if (m.url) URL.revokeObjectURL(m.url);
      melde(T.clipFehler);
    } else {
      await motivSetzen(m);
      await entwurfDatei(m);
    }
    aufbauen();
  }
}

// Tagesrückblick: aus vielen Dateien die besten zehn, ohne Doppelte, nach Aufnahmezeit.
async function rueckblick(dateien) {
  const { auswahlTreffen } = await import('../rueckblick.mjs');
  const wahl = await auswahlTreffen(dateien, { anzahl: Math.min(10, MEDIEN_MAX - medien.length), fortschritt: (i, n) => ladeSchritt(i, n) });
  await dazu(wahl);
  if (!stil.startsWith('v-') && !stil.startsWith('e-')) { stil = 'v-reise'; variante = 0; stileBauen(); planZeigen(); }
  melde(f(T.rueckblickFertig, { n: wahl.length, m: dateien.length }));
}

// --- Fotos im Reel: einmal für alle ---
const fotosEl = $('.cl-fotos', v);
function fotosZeigen() {
  const fotos = medien.filter((m) => m.typ === 'foto');
  fotosEl.hidden = !fotos.length;
  if (!fotos.length) return;
  for (const b of $('.cl-fotoart', v).children) b.setAttribute('aria-pressed', String(b.dataset.art === fotoArt));
  for (const b of $('.cl-fotogrund', v).children) b.setAttribute('aria-pressed', String(b.dataset.grund === fotoGrund));
  $('.cl-fotogrund', v).hidden = !fotos.some((m) => m.rahmen?.modus === 'ganz');
  const eigene = fotos.filter((m) => m.rahmen && !m.rahmen.auto).length;
  let text = { auto: T.fotosInfoAuto, ganz: T.fotosInfoGanz, fuellen: T.fotosInfoFuellen }[fotoArt];
  if (eigene) text += ` ${f(T.fotosEigene, { n: eigene })}`;
  $('.cl-fotos-info', v).textContent = text;
}
async function fotosAnwenden() {
  for (const m of medien) {
    if (m.typ !== 'foto') continue;
    if (m.rahmen && !m.rahmen.auto) {
      if (m.rahmen.modus === 'ganz') m.rahmen.grund = fotoGrund;
      else continue;
    } else m.rahmen = fotoRahmen(m, fotoArt, fotoGrund);
    await vorschaubild(m, m.leinwand);
  }
  fotosZeigen();
  planZeigen();
}
for (const b of $('.cl-fotoart', v).children) b.addEventListener('click', () => { fotoArt = b.dataset.art; fotosAnwenden(); });
for (const b of $('.cl-fotogrund', v).children) b.addEventListener('click', () => { fotoGrund = b.dataset.grund; fotosAnwenden(); });

// Fotos: Der Ausschnitt folgt dem Motiv statt der Mitte, wie bei Collagen. Ändern lässt er sich trotzdem.
async function motivSetzen(m) {
  if (m.typ !== 'foto' || m.rahmen) return;
  m.rahmen = fotoRahmen(m, fotoArt, fotoGrund);
  try {
    const b = await createImageBitmap(m.datei);
    const f = 640 / Math.max(b.width, b.height);
    const c = new OffscreenCanvas(Math.max(1, Math.round(b.width * f)), Math.max(1, Math.round(b.height * f)));
    c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
    const pw = b.width;
    const ph = b.height;
    b.close?.();
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const { auftrag } = await import('../rechner.mjs');
    const r = await auftrag('motivraster', { bild: { w: c.width, h: c.height, d, farbraum: 'srgb' } }, [d.buffer]).catch(() => ({ raster: null }));
    m.pw = pw;
    m.ph = ph;
    if (r.raster) {
      const l = motivLage(pw, ph, r.raster);
      m.motiv = { x: l.x, y: l.y };
    }
    if (m.rahmen?.auto) m.rahmen = fotoRahmen(m, fotoArt, fotoGrund);
    await vorschaubild(m, m.leinwand);
  } catch (err) {
    protokolliere('motiv', err);
  }
}

function neuesMedium(d, typ, felder = {}) {
  return { id: ++zaehler, eid: db.neueId(), typ, datei: d, url: typ === 'clip' ? URL.createObjectURL(d) : null, dauer: 0, start: 0, leinwand: el('canvas', { width: 90, height: 160 }), ...felder };
}

// --- Entwurf: Alles bleibt erhalten, auch wenn iOS die App schließt ---
const ENTWURF_MAX = 500 * 1024 * 1024;
let entwurfTakt = 0;
let stellt = false; // während der Wiederherstellung nichts zurückschreiben

async function entwurfDatei(m) {
  if (m.datei.size > ENTWURF_MAX) { m.ungesichert = true; melde(T.entwurfZuGross); return; }
  try {
    m.teile = await db.entwurfDateiSpeichern(m.eid, m.datei);
  } catch (err) {
    m.ungesichert = true;
    protokolliere('entwurf', err);
    melde(err instanceof db.SpeicherVoll ? T.entwurfVoll : T.entwurfFehler);
    db.entwurfDateiLoeschen(m.eid).catch(() => {});
  }
}

const entwurfMedium = (m) => ({
  id: m.eid, typ: m.typ, name: m.datei.name, mime: m.datei.type, groesse: m.datei.size, teile: m.teile,
  start: m.start, ende: m.ende ?? null, laenge: m.laenge ?? null, eigen: !!m.eigen, rahmen: m.rahmen ?? null, dauer: m.dauer, text: m.text || '',
  wechsel: m.wechsel ?? null, motiv: m.motiv ?? null, pw: m.pw ?? null, ph: m.ph ?? null,
});

function entwurfSichern(sofort = false) {
  if (stellt) return;
  clearTimeout(entwurfTakt);
  entwurfTakt = setTimeout(() => {
    const leer = !medien.length && !musik;
    const arbeit = leer ? db.loescheReelEntwurf() : db.speichereReelEntwurf({
      stil, variante, laenge, anteil, tempo, fotoArt, fotoGrund, fest: [...fest], titel: { ...titel }, route,
      kombination: stil === 'e-neu' ? { ...vorlageAus('e-neu') } : null,
      medien: medien.filter((m) => m.teile).map(entwurfMedium),
      musik: musik?.teile ? { id: musik.eid, name: musik.name, mime: musik.mime, groesse: musik.groesse, teile: musik.teile, start: musik.start, alle: musik.alle } : null,
    });
    arbeit.catch((err) => protokolliere('entwurf', err));
  }, sofort ? 0 : 300);
}

async function entwurfLaden() {
  let e;
  try { e = await db.reelEntwurf(); } catch (err) { protokolliere('entwurf', err); return; }
  if (!e || (!e.medien?.length && !e.musik)) return;
  stellt = true;
  let fehlt = 0;
  try {
    if (e.stil === 'e-neu' && e.kombination) eigeneSetzen([...eigeneVorlagen(), { ...e.kombination, id: 'e-neu' }]);
    stil = e.stil ?? GANZ;
    variante = e.variante ?? 0;
    Object.assign(titel, e.titel || {});
    route = e.route || '';
    laenge = e.laenge ?? null;
    anteil = e.anteil ?? anteil;
    tempo = e.tempo ?? 'normal';
    fotoArt = e.fotoArt ?? 'auto';
    fotoGrund = e.fotoGrund ?? 'unscharf';
    for (const [nr, x] of e.medien.entries()) {
      ladeSchritt(nr + 1, e.medien.length);
      const b = await db.entwurfDateiLesen(x.id, x.teile, x.mime);
      if (!b) { fehlt++; continue; }
      const d = new File([b], x.name, { type: x.mime });
      const m = neuesMedium(d, x.typ, {
        eid: x.id, teile: x.teile, start: x.start || 0, dauer: x.dauer || 0, eigen: !!x.eigen, text: x.text || '',
        ...(x.ende != null ? { ende: x.ende } : {}), ...(x.laenge != null ? { laenge: x.laenge } : {}), ...(x.rahmen ? { rahmen: x.rahmen } : {}),
        ...(x.wechsel ? { wechsel: x.wechsel } : {}), ...(x.motiv ? { motiv: x.motiv } : {}), ...(x.pw ? { pw: x.pw, ph: x.ph } : {}),
      });
      await vorschaubild(m, m.leinwand);
      if (m.fehler) { fehlt++; if (m.url) URL.revokeObjectURL(m.url); continue; }
      medien.push(m);
      aufbauen();
    }
    if (e.musik) {
      const b = await db.entwurfDateiLesen(e.musik.id, e.musik.teile, e.musik.mime);
      if (b) await musikDazu(new File([b], e.musik.name, { type: e.musik.mime }), { eid: e.musik.id, teile: e.musik.teile, start: e.musik.start, alle: e.musik.alle });
      else fehlt++;
    }
  } finally {
    stellt = false;
    ladeEnde();
  }
  fest = (await db.reelEntwurf().catch(() => null))?.fest ?? [];
  stileBauen();
  musikZeigen();
  aufbauen();
  melde(fehlt ? f(T.entwurfTeilweise, { n: fehlt }) : T.entwurfZurueck);
  if (fehlt) entwurfSichern();
}

async function neuBeginnen() {
  const r = await frage(T.entwurfNeuFrage, [{ text: T.abbrechen, wert: false }, { text: T.entwurfNeu, wert: true, haupt: true }]);
  if (!r.wert) return;
  vorschauAus();
  for (const m of medien) if (m.url) URL.revokeObjectURL(m.url);
  medien = [];
  if (musik) URL.revokeObjectURL(musik.url);
  musik = null;
  $('.cl-musik-probe', v).removeAttribute('src');
  stil = GANZ;
  variante = 0;
  Object.assign(titel, { text: '', stil: 'klar', lage: 'unten' });
  laenge = null;
  tempo = 'normal';
  stileBauen();
  fest = [];
  ergebnisEl.replaceChildren();
  clearTimeout(entwurfTakt);
  await db.loescheReelEntwurf().catch((err) => protokolliere('entwurf', err));
  musikZeigen();
  aufbauen();
}

function entfernen(m) {
  fest = [];
  medien = medien.filter((x) => x !== m);
  if (m.url) URL.revokeObjectURL(m.url);
  db.entwurfDateiLoeschen(m.eid).catch(() => {});
  aufbauen();
}

function schiebe(m, d) {
  const i = medien.indexOf(m);
  const j = i + d;
  if (j < 0 || j >= medien.length) return;
  fest = [];
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
  const art = m.wechsel?.art || '';
  for (const b of $('.ce-wechsel', v).children) {
    b.setAttribute('aria-pressed', String(b.dataset.wechsel === art));
    b.hidden = b.dataset.wechsel === 'fahrzeug' && !video;
    b.disabled = wechselSucht;
  }
  if (!wechselSucht) {
    const letzter = medien.indexOf(m) === medien.length - 1;
    $('.ce-wechsel-info', v).textContent = letzter && art ? T.wechselLetzter
      : art === 'fahrzeug' ? T.wechselInfoFahrzeug : art === 'stehen' ? T.wechselInfoStehen : T.wechselInfoNormal;
  }
}

// Wechsel mit Vordergrund: Fahrzeug suchen oder prüfen, ob im letzten Bild etwas steht.
let wechselSucht = false;
let erkennungBekannt = false;
async function wechselSetzen(art) {
  if (!aktuell || wechselSucht) return;
  const { m } = aktuell;
  if (!art) { delete m.wechsel; editorRegler(); planZeigen(); return; }
  wechselSucht = true;
  editorRegler();
  const info = $('.ce-wechsel-info', v);
  info.textContent = erkennungBekannt ? T.wechselSucht : T.erkennungLaedt;
  try {
    const e = await erkennung();
    await e.erkenner();
    erkennungBekannt = true;
    if (art === 'fahrzeug') {
      const r = await e.fahrzeugSuchen(m, (p) => { info.textContent = `${T.wechselSucht} ${Math.round(p * 100)} %`; });
      if (!r) { melde(T.wechselKeinFahrzeug); return; }
      m.wechsel = { art, t: r.t, aus: r.aus, bis: r.bis };
      m.ende = Math.min(m.dauer, Math.max(r.t, 0.3));
      if (m.start > m.ende - 0.3) m.start = Math.max(0, m.ende - 2);
      m.eigen = true;
      melde(f(T.wechselGefunden, { s: zeitText(r.t), aus: zeitText(r.aus) }));
      editorZeigeStelle(m.ende - 0.05);
    } else {
      m.wechsel = { art, aus: 1.1 };
      if (aktuell.video) await suche(aktuell.q, Math.max(0, (m.ende ?? m.dauer) - 0.06));
      const a = await e.vordergrundIm(aktuell.q, m);
      if (aktuell.video) editorZeigeStelle((m.ende ?? m.dauer) - 0.06);
      if (a < 0.02) melde(T.wechselKeinVordergrund);
    }
  } catch (err) {
    protokolliere('erkennung', err);
    melde(T.erkennungFehler);
  } finally {
    wechselSucht = false;
    if (aktuell) editorRegler();
    planZeigen();
  }
}

async function editorOeffnen(m) {
  vorschauPause();
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
    $('#ce-text', v).value = m.text || '';
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
  $('#ce-text', v).addEventListener('input', (e) => { if (aktuell) aktuell.m.text = e.target.value; });
  $('#ce-zuruecksetzen', v).addEventListener('click', () => {
    const { m } = aktuell;
    m.rahmen = m.typ === 'foto' ? fotoRahmen(m, fotoArt, fotoGrund) : { x: 0.5, y: 0.5, zoom: 1, modus: 'fuellen' };
    m.start = 0;
    delete m.ende;
    delete m.laenge;
    m.eigen = false;
    delete m.wechsel;
    editorRegler();
    if (aktuell.video) editorZeigeStelle(0);
    else editorMalen();
    planZeigen();
  });
  for (const b of $('.ce-wechsel', v).children) b.addEventListener('click', () => wechselSetzen(b.dataset.wechsel));
  for (const b of $('.ce-modus', v).children) {
    b.addEventListener('click', () => {
      aktuell.m.rahmen.modus = b.dataset.modus;
      delete aktuell.m.rahmen.auto;
      if (b.dataset.modus === 'ganz') aktuell.m.rahmen.grund ??= fotoGrund;
      editorRegler();
      editorMalen();
    });
  }
  $('#ce-zoom', v).addEventListener('input', (e) => {
    aktuell.m.rahmen.zoom = Number(e.target.value);
    delete aktuell.m.rahmen.auto;
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
    delete r.auto;
    const a = rahmenAusschnitt(qw, qh, r);
    const box = eBild.getBoundingClientRect();
    if (qw - a.w > 0.5) r.x = Math.max(0, Math.min(1, r.x - ((dx * a.w) / box.width) / (qw - a.w)));
    if (qh - a.h > 0.5) r.y = Math.max(0, Math.min(1, r.y - ((dy * a.h) / box.height) / (qh - a.h)));
    editorMalen();
  };
  const zoomen = (z) => {
    const r = aktuell.m.rahmen;
    if (r.modus === 'ganz') return;
    delete r.auto;
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

async function musikDazu(datei, alt = null) {
  infoEl.textContent = T.musikLaedt;
  ladeWarten(T.musikLaedt);
  try {
    const m = await aus.musikLaden(datei);
    if (musik) { URL.revokeObjectURL(musik.url); if (!alt) db.entwurfDateiLoeschen(musik.eid).catch(() => {}); }
    musik = {
      ...m, name: datei.name, mime: datei.type, groesse: datei.size, url: URL.createObjectURL(datei),
      eid: alt?.eid ?? db.neueId(), teile: alt?.teile ?? null, start: alt?.start ?? 0, alle: alt?.alle ?? (m.bpm >= 100 ? 2 : 1),
    };
    $('.cl-musik-probe', v).src = musik.url;
    welleCache = null;
    if (!alt) {
      fest = [];
      try { musik.teile = await db.entwurfDateiSpeichern(musik.eid, datei); } catch (err) { protokolliere('entwurf', err); }
    }
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
  // Eine Vorlage, die es nicht mehr gibt (gelöscht, ungespeicherte Kombination): ganze Clips.
  if (stil !== GANZ && !istVorlage(stil)) { stil = GANZ; variante = 0; wahl.stil = GANZ; wahl.variante = 0; wahlUI?.zeigen(); }
  const raster = musikRaster();
  return clipPlan(medien, {
    stil,
    laenge: stil === GANZ && !musik ? null : laenge,
    raster,
    takt: musik ? (60 / musik.bpm) * musik.alle : null,
    tempo,
    variante,
    fest: musik ? fest : null,
    musikRest: musik ? musik.puffer.duration - musik.start : undefined,
  });
}

function planZeigen() {
  entwurfSichern();
  textZeigen();
  $('#cl-neu', v).hidden = !medien.length && !musik;
  bauenKnopf.disabled = laeuft || medien.length === 0;
  laengenEl.hidden = stil === GANZ && !musik;
  for (const b of laengenEl.children) b.setAttribute('aria-pressed', String((b.dataset.laenge ? Number(b.dataset.laenge) : null) === laenge));
  for (const b of $('.cl-tempo', v).children) b.setAttribute('aria-pressed', String(b.dataset.tempo === tempo));
  tonZeigen();
  if (!medien.length) { infoEl.textContent = T.clipsLeer; vorschauAktualisieren(null); welleZeigen(null); return; }
  const p = planJetzt();
  vorschauAktualisieren(p);
  welleZeigen(p);
  let text = f(T.clipsInfo, { n: medien.length, s: p.laenge });
  if (p.fotoStand && p.fotoStand < FOTO_STAND) text += ` ${f(T.fotosKuerzer, { s: zeitText(p.fotoStand) })}`;
  if (p.gekappt) text += ` ${musik ? T.musikKurz : T.clipsGekappt}`;
  if (p.zuKurz) text += ` ${f(T.clipsZuKurz, { n: p.maxFotos })}`;
  if (p.runden > 1) text += ` ${f(T.clipsRunden, { r: p.runden })}`;
  if (p.eigeneLaengen && laenge) text += ` ${T.clipsEigene}`;
  infoEl.textContent = text;
  bauenKnopf.disabled = laeuft || p.zuKurz;
}

// --- Sofort-Vorschau ---
const vorschauEl = $('.cl-vorschau', v);
const vorschauCanvas = $('#cl-vorschau', v);
const vorschauKnopf = $('.cl-vorschau-knopf', v);
const zeitleiste = $('.cl-zeitleiste', v);
let spieler = null;
let vorschauPlan = null;
let vorschauTakt = 0;

// Titel am Anfang, je Abschnitt der Text seines Mediums.
function texteFuer(p) {
  const zeilen = p.staende.map((s, k) => ({ von: p.beginn[k], bis: p.beginn[k] + s, text: medien[k % medien.length]?.text || '' }));
  return { titel: { ...titel }, zeilen };
}

function malerMitText(p, W, H, live) {
  const m = clipMaler(medien.slice(), p, { W, H, live, maske: medien.some((x) => x.wechsel) ? vordergrundMaske : null });
  const stationen = route.split(',');
  return { ...m, male: ueberlagern(m.male, { texte: texteFuer(p), signatur, W, H, dauer: p.dauer, route: { stationen, beginn: p.beginn } }) };
}

function vorschauDaten(p) {
  return {
    maler: () => malerMitText(p, vorschauCanvas.width, vorschauCanvas.height, true),
    dauer: p.dauer,
  };
}

// --- Ton: Originalton der Clips und Musik, für Vorschau und fertiges Reel gleich gemischt ---
const tonVon = (m) => (m.typ === 'clip' ? (m.tonV ??= clipTonLaden(m.datei)) : Promise.resolve(null));
const hatClips = () => medien.some((m) => m.typ === 'clip');

async function tonMischen(p, rate) {
  const toene = await Promise.all(medien.map(tonVon));
  const mk = musik ? { ...aus.musikKanaele(musik.puffer), start: musik.start } : null;
  return mischen({ plan: p, medien, toene, musik: mk, anteil, rate });
}

let vorschauTonUrl = null;
let tonZaehler = 0;
async function vorschauTonNeu(p) {
  const nr = ++tonZaehler;
  let url = null;
  try {
    const spur = await tonMischen(p, 24000);
    if (nr !== tonZaehler) return;
    if (spur) url = URL.createObjectURL(wavAus(spur, 24000));
  } catch (err) {
    protokolliere('vorschau ton', err);
  }
  if (nr !== tonZaehler) { if (url) URL.revokeObjectURL(url); return; }
  const alt = vorschauTonUrl;
  vorschauTonUrl = url;
  spieler?.tonSetzen(url, 0);
  if (alt) setTimeout(() => URL.revokeObjectURL(alt), 1000);
}

function tonZeigen() {
  const blk = $('.cl-ton', v);
  blk.hidden = !hatClips();
  $('#cl-ton', v).value = anteil;
  const pr = (x) => Math.round(x * 100);
  $('.cl-ton-text', v).textContent = musik
    ? f(T.tonAnteil, { m: pr(Math.min(1, 2 * (1 - anteil))), o: pr(Math.min(1, 2 * anteil)) })
    : f(T.tonOhneMusik, { o: 100 });
  $('#cl-ton', v).disabled = !musik;
}

function vorschauStand() {
  const spielt = !!spieler?.spielt;
  vorschauKnopf.hidden = spielt;
  vorschauKnopf.setAttribute('aria-label', spielt ? T.vorschauAnhalten : T.vorschauAbspielen);
}

// Jede Änderung am Plan landet nach einem Augenblick in der Vorschau, ohne dass sie neu startet.
function vorschauAktualisieren(p) {
  const sichtbar = !!p && medien.length > 0 && !p.zuKurz;
  vorschauEl.hidden = !sichtbar;
  if (!sichtbar) { vorschauAus(); return; }
  vorschauPlan = p;
  clearTimeout(vorschauTakt);
  vorschauTakt = setTimeout(() => {
    if (!spieler) {
      spieler = vorschauSpieler(vorschauCanvas, {
        ...vorschauDaten(vorschauPlan),
        beiZeit: (t, d) => {
          welleKopf(t);
          zeitleiste.firstElementChild.style.width = `${(100 * t) / d}%`;
          zeitleiste.setAttribute('aria-valuenow', t.toFixed(1));
          zeitleiste.setAttribute('aria-valuemax', d.toFixed(1));
        },
      });
      spieler.zeigen();
    } else spieler.neu(vorschauDaten(vorschauPlan));
    vorschauStand();
    vorschauTonNeu(vorschauPlan);
  }, spieler ? 150 : 0);
}

function vorschauAus() {
  clearTimeout(vorschauTakt);
  tonZaehler++;
  spieler?.ende();
  spieler = null;
  if (vorschauTonUrl) URL.revokeObjectURL(vorschauTonUrl);
  vorschauTonUrl = null;
  vorschauStand();
}

function vorschauPause() {
  spieler?.anhalten();
  vorschauStand();
}

function vorschauUmschalten() {
  if (!spieler) return;
  if (spieler.spielt) spieler.anhalten();
  else spieler.spielen();
  vorschauStand();
}

function zeitleisteZiehen(e) {
  if (!spieler || !vorschauPlan) return;
  const r = zeitleiste.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  spieler.springe(x * vorschauPlan.dauer);
}

function aufbauen() {
  liste.replaceChildren(...medien.map(zeile));
  fotosZeigen();
  planZeigen();
}

function stileBauen() {
  wahl.stil = stil;
  wahl.variante = variante;
  if (!wahlUI) {
    wahlUI = vorlagenWahl({
      zustand: wahl,
      extra: [{ stil: GANZ, text: T.clipsGanz }],
      erweitert: () => modus === 'erweitert',
      wechsel: () => { stil = wahl.stil; variante = wahl.variante; planZeigen(); },
    });
    stileEl.replaceWith(wahlUI.el);
  } else wahlUI.zeigen();
  laengenEl.replaceChildren(
    el('button', { text: T.reelAuto, onclick: () => { laenge = null; planZeigen(); } }),
    ...REEL_LAENGEN.map((l) => el('button', { 'data-laenge': l, text: f(T.reelSekunden, { s: l }), onclick: () => { laenge = l; planZeigen(); } })),
  );
}

async function bauen() {
  if (laeuft) return;
  laeuft = true;
  vorschauPause();
  bauenKnopf.disabled = true;
  ergebnisEl.replaceChildren();
  fortEl.hidden = false;
  const fort = (p) => { fortEl.textContent = f(T.wirdGebaut, { p: Math.round(p * 100) }); };
  fort(0);
  const w = aus.hintergrundWaechter();
  const p = planJetzt();
  const m = malerMitText(p, 1080, 1920, false);
  try {
    const ton = musik || hatClips() ? await tonBauen(p) : null;
    const blob = await aus.videoAusMaler(m.male, p.bilder, { fortschritt: fort, waechter: w, ton });
    const pruefung = ton ? await tonPruefen(blob, ton) : null;
    const hatTon = !!pruefung?.ok;
    const datei = new File([blob], 'reel.mp4', { type: blob.type });
    if (ergebnisUrl) URL.revokeObjectURL(ergebnisUrl);
    ergebnisUrl = URL.createObjectURL(blob);
    ergebnisEl.replaceChildren(
      el('video', { src: ergebnisUrl, controls: true, playsinline: true, muted: !hatTon, loop: true, klasse: 'cl-video' }),
      el('p', { klasse: 'rt-info', text: hatTon ? (musik ? T.musikRechte : T.clipsMitTon) : (musik ? T.musikKeinTon : T.clipsOhneTon) }),
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
async function tonBauen(p) {
  try {
    const spur = await tonMischen(p, aus.TON_RATE);
    if (!spur) return null;
    return await aus.tonKodierenKanaele(spur);
  } catch (err) {
    if (!musik) return null; // Clips ohne Ton: einfach stumm
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
  db.entwurfDateiLoeschen(musik.eid).catch(() => {});
  musik = null;
  $('.cl-musik-probe', v).removeAttribute('src');
  musikZeigen();
  planZeigen();
});
$('#cl-musik-start', v).addEventListener('input', (e) => {
  musik.start = Number(e.target.value);
  fest = [];
  musikZeigen();
  planZeigen();
});
$('.cl-alle', v).replaceChildren(...[1, 2, 4].map((n) => el('button', {
  'data-alle': n, text: T[`musikAlle${n}`], onclick: () => { musik.alle = n; fest = []; musikZeigen(); planZeigen(); },
})));
$('#cl-waehlen', v).addEventListener('click', () => eingabe.click());
// Nahtlos weiterfilmen: Jeder neue Clip landet sofort im Reel und im Entwurf.
$('#cl-weiterfilmen', v).addEventListener('click', () => {
  vorschauPause();
  anschlussKamera({
    letztes: medien[medien.length - 1] || null,
    neu: async (datei) => {
      try { await dazu([datei]); } finally { ladeEnde(); }
      return medien[medien.length - 1];
    },
  }).catch((err) => { protokolliere('weiterfilmen', err); melde(T.akFehler); });
});
eingabe.addEventListener('change', () => {
  const l = [...eingabe.files];
  eingabe.value = '';
  dazu(l).catch((err) => { protokolliere('clips', err); melde(T.clipFehler); }).finally(ladeEnde);
});
bauenKnopf.addEventListener('click', bauen);
const rueckEingabe = $('#datei-rueckblick');
$('#cl-rueckblick', v).addEventListener('click', () => { melde(T.rueckblickHinweis); rueckEingabe.click(); });
rueckEingabe.addEventListener('change', () => {
  const l = [...rueckEingabe.files].slice(0, 40);
  rueckEingabe.value = '';
  if (!l.length) { ladeEnde(); return; }
  rueckblick(l).catch((err) => { protokolliere('rueckblick', err); melde(T.clipFehler); }).finally(ladeEnde);
});
$('.cl-insta-knopf', v).addEventListener('click', (e) => {
  const an = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', String(an));
  const c = $('.cl-insta', v);
  c.hidden = !an;
  const k = c.getContext('2d');
  k.clearRect(0, 0, c.width, c.height);
  if (an) instaZeichnen(k, c.width, c.height, 'reel');
});
for (const b of $('.cl-modus', v).children) b.addEventListener('click', () => modusSetzen(b.dataset.modus, true));
for (const b of $('.cl-tempo', v).children) b.addEventListener('click', () => { tempo = b.dataset.tempo; planZeigen(); });
$('#cl-ton', v).addEventListener('input', (e) => { anteil = Number(e.target.value); tonZeigen(); });
$('#cl-ton', v).addEventListener('change', () => planZeigen());
$('#cl-neu', v).addEventListener('click', neuBeginnen);
vorschauCanvas.addEventListener('click', vorschauUmschalten);
vorschauKnopf.addEventListener('click', vorschauUmschalten);
zeitleiste.addEventListener('pointerdown', (e) => {
  zeitleiste.setPointerCapture(e.pointerId);
  zeitleisteZiehen(e);
});
zeitleiste.addEventListener('pointermove', (e) => { if (e.buttons) zeitleisteZiehen(e); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { vorschauPause(); if (medien.length || musik) entwurfSichern(true); } });
$('#cl-zurueck', v).addEventListener('click', () => zeige(zurueck));

function textZeigen() {
  const r = $('#cl-route', v);
  if (document.activeElement !== r) r.value = route;
  const feld = $('#cl-titel', v);
  if (document.activeElement !== feld) feld.value = titel.text;
  for (const b of $('.cl-textstil', v).children) b.setAttribute('aria-pressed', String(b.dataset.textstil === titel.stil));
  for (const b of $('.cl-textlage', v).children) b.setAttribute('aria-pressed', String(b.dataset.lage === titel.lage));
}
$('.cl-textstil', v).replaceChildren(...Object.keys(TEXT_STILE).map((k) => el('button', {
  klasse: 'cl-stil', 'data-textstil': k, text: T[`textstil_${k}`], onclick: () => { titel.stil = k; textZeigen(); planZeigen(); },
})));
for (const b of $('.cl-textlage', v).children) b.addEventListener('click', () => { titel.lage = b.dataset.lage; textZeigen(); planZeigen(); });
$('#cl-titel', v).addEventListener('input', (e) => { titel.text = e.target.value; planZeigen(); });
$('#cl-route', v).addEventListener('input', (e) => { route = e.target.value; planZeigen(); });

function modusSetzen(neu, merken = false) {
  modus = neu === 'erweitert' ? 'erweitert' : 'einfach';
  wahlUI?.zeigen();
  v.dataset.modus = modus;
  for (const b of $('.cl-modus', v).children) b.setAttribute('aria-pressed', String(b.dataset.modus === modus));
  if (merken) db.setzeEinstellung('reelModus', modus).catch(() => {});
  planZeigen();
}

// --- Wellenform mit Schnittmarken (erweitert) ---
const welle = $('#cl-welle', v);
let welleCache = null; // { start, dauer, bild }
let wellePlan = null;
let ziehe = null; // { k, t }
let kopf = 0;

function welleSpitzen(start, dauer) {
  if (welleCache && welleCache.start === start && welleCache.dauer === dauer) return welleCache.bild;
  const c = document.createElement('canvas');
  c.width = welle.width;
  c.height = welle.height;
  const k = c.getContext('2d');
  const d = musik.puffer.getChannelData(0);
  const rate = musik.puffer.sampleRate;
  const mitte = c.height / 2;
  k.fillStyle = 'rgba(255,255,255,0.35)';
  for (let x = 0; x < c.width; x += 2) {
    const a = Math.floor((start + (x / c.width) * dauer) * rate);
    const b = Math.min(d.length, Math.floor((start + ((x + 2) / c.width) * dauer) * rate));
    let m = 0;
    for (let i = a; i < b; i += 4) { const w = Math.abs(d[i]); if (w > m) m = w; }
    const h = Math.max(1, m * (c.height - 8));
    k.fillRect(x, mitte - h / 2, 1.5, h);
  }
  welleCache = { start, dauer, bild: c };
  return c;
}

const markenZeiten = (p) => p.schnitte.map((s, k) => (ziehe?.k === k ? ziehe.t : s + p.uebergaenge[k] / 2));

function welleMalen() {
  const p = wellePlan;
  if (!p || !musik) return;
  const k = welle.getContext('2d');
  const W = welle.width;
  const H = welle.height;
  k.clearRect(0, 0, W, H);
  k.drawImage(welleSpitzen(musik.start, p.dauer), 0, 0);
  const x = (t) => (t / p.dauer) * W;
  for (const st of musikRaster() || []) {
    if (st.t > p.dauer) break;
    k.fillStyle = `rgba(255, 212, 0, ${0.25 + 0.6 * st.s})`;
    k.fillRect(x(st.t) - 1, H - 6 - 10 * st.s, 2, 6 + 10 * st.s);
  }
  markenZeiten(p).forEach((t, i) => {
    const gesetzt = fest[i] != null || ziehe?.k === i;
    k.fillStyle = gesetzt ? '#FFD400' : '#ffffff';
    k.fillRect(x(t) - 1.5, 0, 3, H);
    k.beginPath();
    k.arc(x(t), 9, 9, 0, Math.PI * 2);
    k.fill();
  });
  k.fillStyle = 'rgba(255,255,255,0.9)';
  k.fillRect(x(kopf) - 1, 0, 2, H);
}

function welleKopf(t) {
  kopf = t;
  if (!$('.cl-welle', v).hidden) welleMalen();
}

function welleZeigen(p) {
  const blk = $('.cl-welle', v);
  blk.hidden = !musik || !p || p.zuKurz || !p.schnitte.length;
  $('#cl-welle-auto', v).hidden = !fest.some((x) => x != null);
  wellePlan = p;
  if (!blk.hidden) welleMalen();
}

function welleZeit(e) {
  const r = welle.getBoundingClientRect();
  return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * wellePlan.dauer;
}

function einrasten(t) {
  let best = t;
  let d = Infinity;
  for (const st of musikRaster() || []) {
    const a = Math.abs(st.t - t);
    if (a < d) { d = a; best = st.t; }
  }
  return best;
}

function welleEinrichten() {
  welle.addEventListener('pointerdown', (e) => {
    if (!wellePlan) return;
    const t = welleZeit(e);
    const r = welle.getBoundingClientRect();
    const proPx = wellePlan.dauer / r.width;
    let k = -1;
    let d = Infinity;
    markenZeiten(wellePlan).forEach((m, i) => { const a = Math.abs(m - t); if (a < d) { d = a; k = i; } });
    if (k < 0 || d > 22 * proPx) { spieler?.springe(t); return; }
    welle.setPointerCapture(e.pointerId);
    vorschauPause();
    ziehe = { k, t: einrasten(t) };
    spieler?.springe(ziehe.t + 0.02);
    welleMalen();
  });
  welle.addEventListener('pointermove', (e) => {
    if (!ziehe) return;
    const t = einrasten(welleZeit(e));
    if (t === ziehe.t) return;
    ziehe.t = t;
    spieler?.springe(t + 0.02);
    welleMalen();
  });
  const los = () => {
    if (!ziehe) return;
    fest[ziehe.k] = ziehe.t;
    ziehe = null;
    planZeigen();
  };
  welle.addEventListener('pointerup', los);
  welle.addEventListener('pointercancel', () => { ziehe = null; welleMalen(); });
  welle.addEventListener('dblclick', (e) => {
    if (!wellePlan) return;
    const t = welleZeit(e);
    let k = -1;
    let d = Infinity;
    markenZeiten(wellePlan).forEach((m, i) => { const a = Math.abs(m - t); if (a < d) { d = a; k = i; } });
    if (k >= 0 && fest[k] != null) { fest[k] = null; planZeigen(); }
  });
  $('#cl-welle-auto', v).addEventListener('click', () => { fest = []; planZeigen(); });
}

welleEinrichten();

registriere('clips', {
  verlassen() { vorschauAus(); },
  async betreten(_, alt) {
    if (alt && alt !== 'clips') zurueck = alt;
    signatur = await signaturLaden().catch(() => null);
    if (erstesMal) await eigeneLaden();
    if (erstesMal) modusSetzen(await db.einstellung('reelModus').catch(() => null) || 'einfach');
    musikZeigen();
    aufbauen();
    if (!erstesMal) return;
    erstesMal = false;
    if (!medien.length && !musik) await entwurfLaden();
  },
});
