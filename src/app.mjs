// Start der App: Installationshinweis, Service Worker, Wiederaufnahme, Diagnose.
import { installiereHandler, protokolliere, alleFehler, werte, serienProtokoll } from './diagnose.mjs';
installiereHandler();

import { APP_VERSION } from './version.mjs';
import { T, f } from './texte.mjs';
import { $, texteEinsetzen, melde, meldungWeg } from './ui.mjs';
import { Z, zeige, ladeAktive, neuLaden } from './zustand.mjs';
import * as db from './speicher.mjs';
import { ausbessern, unrettbar } from './naehwerk.mjs';
import { auftrag } from './rechner.mjs';
import { setzeTeilwerte, teilwerteSichtbar } from './ansichten/sucher.mjs';
import { diagnoseKnopf } from './ansichten/start.mjs';
import './ansichten/collage.mjs';
import './ansichten/aufdeckung.mjs';
import './ansichten/fein.mjs';
import './ansichten/strecke.mjs';
import './ansichten/strecken.mjs';
import './ansichten/ausfahrt.mjs';
import './ansichten/fahrplan.mjs';
import { serieErinnern } from './ansichten/serie.mjs';
import { einfuehrungNoetig } from './ansichten/einfuehrung.mjs';
import { startVideo } from './startvideo.mjs';
import { fotoVergleich, farbBericht } from './vergleich.mjs';

texteEinsetzen();
$('#version').textContent = 'v' + APP_VERSION;
document.documentElement.dataset.version = APP_VERSION;

const istStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

// --- Service Worker ---
let neueVersionBereit = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => protokolliere('sw', e));
  let hatteController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hatteController) neueVersionBereit = true;
    hatteController = true;
  });
  // Neue Version erst beim nächsten Zurückkommen laden, nie mitten in der Arbeit.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && neueVersionBereit && Z.ansicht === 'sucher') location.reload();
  });
}

// --- Diagnose: fünfmal auf die Versionsnummer ---
{
  let tipps = [];
  $('#version').addEventListener('click', () => {
    const jetzt = Date.now();
    tipps = tipps.filter((t) => jetzt - t < 2500);
    tipps.push(jetzt);
    if (tipps.length >= 5) { tipps = []; diagnoseOeffnen(); }
  });
}

// Speicher "dateien", beschädigte Halte und Lesetest der aktiven Strecke für den Bericht.
async function speicherBericht() {
  const zeilen = [];
  try {
    const st = await db.dateienStatistik();
    zeilen.push(`Dateien: ${st.anzahl} Einträge, ${(st.bytes / 1048576).toFixed(1)} MB`);
  } catch (e) { zeilen.push(`Dateien: Fehler ${e.message}`); }
  try {
    const b = await db.beschaedigteHalte();
    zeilen.push(`Beschädigte Fotos: ${b.length}${b.length ? ` (${b.map((h) => `Foto ${h.index + 1}: ${(h.beschaedigt?.felder || ['bild', 'roh']).join(', ')}${h.beschaedigt?.grund ? ` – ${h.beschaedigt.grund}` : ''}`).join('; ')})` : ''}`);
  } catch (e) { zeilen.push(`Beschädigte Fotos: Fehler ${e.message}`); }
  if (Z.strecke) {
    try {
      const t = await db.lesetest(Z.strecke.id);
      const gut = t.filter((x) => !x.fehlt.length).length;
      zeilen.push(`Lesetest: ${gut} von ${t.length} Fotos vollständig lesbar`);
      for (const x of t) zeilen.push(`  Foto ${x.index + 1}: ${x.ok} Dateien ok${x.fehlt.length ? `, unlesbar: ${x.fehlt.join(', ')}` : ''}${x.beschaedigt.length ? `, beim Umzug verloren: ${x.beschaedigt.join(', ')}` : ''}`);
    } catch (e) { zeilen.push(`Lesetest: Fehler ${e.message}`); }
  }
  return zeilen;
}

async function bericht() {
  const s = await db.schaetzung();
  const mb = (b) => (b == null ? '?' : (b / 1048576).toFixed(1) + ' MB');
  let strecken = [];
  try { strecken = await db.strecken(); } catch {}
  const zeilen = [
    `Nahtlos ${APP_VERSION}`,
    `Zeit: ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    `Standalone: ${istStandalone()}`,
    `Bildschirm: ${screen.width}x${screen.height} @${devicePixelRatio}`,
    `Stream: ${werte.stream || '-'}`,
    `Analyse: ${werte.fps} Bilder/s, ${werte.analyseMs.toFixed(1)} ms`,
    `Nähen: ${werte.naehenMs ? werte.naehenMs.toFixed(0) + ' ms' : '-'}`,
    `Speicher: ${mb(s.belegt)} von ${mb(s.frei)}, dauerhaft: ${s.dauerhaft}`,
    await farbBericht().catch((e) => `Farbe: Fehler ${e.message}`),
    `Projekte: ${strecken.length}, aktiv: ${Z.halte.length} Fotos`,
    ...(await speicherBericht()),
    `Ansicht: ${Z.ansicht}`,
    ...(vergleiche.length ? ['', ...vergleiche] : []),
    '',
    `Fehler (${alleFehler().length}):`,
    ...alleFehler().slice().reverse().map((f) => `${f.zeit} [${f.art}] ${f.text}`),
    '',
    `Serie (${serienProtokoll().length}):`,
    ...serienProtokoll().slice(-30).map((e) => `${e.zeit} ${e.text}`),
  ];
  return zeilen.join('\n');
}

async function diagnoseOeffnen() {
  const d = $('#diagnose');
  $('.dg-text', d).textContent = 'Diagnose läuft …';
  d.hidden = false;
  $('.dg-text', d).textContent = await bericht();
  $('#dg-faden').checked = teilwerteSichtbar();
  d.hidden = false;
}
$('#dg-schliessen').addEventListener('click', () => ($('#diagnose').hidden = true));
diagnoseKnopf(diagnoseOeffnen);

// Fotovergleich: ein Foto aus der Mediathek wie beim Bauen durchrechnen, ohne etwas zu speichern.
const vergleiche = [];
$('#dg-vergleich').addEventListener('click', () => $('#dg-datei').click());
$('#dg-datei').addEventListener('change', async (e) => {
  const datei = e.target.files?.[0];
  e.target.value = '';
  if (!datei) return;
  const feld = $('.dg-text', $('#diagnose'));
  feld.textContent = T.vergleichLaeuft;
  try {
    const r = await fotoVergleich(datei);
    vergleiche.push(r.text);
    if (vergleiche.length > 4) vergleiche.shift();
  } catch (err) {
    protokolliere('vergleich', err);
    vergleiche.push(`Fotovergleich: Fehler ${err && err.message || err}`);
  }
  feld.textContent = await bericht();
  feld.scrollTop = feld.scrollHeight;
});
$('#dg-faden').addEventListener('change', (e) => setzeTeilwerte(e.target.checked));
$('#dg-kopieren').addEventListener('click', async () => {
  const text = await bericht();
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {}
  if (!ok) {
    // Ausweichweg: Text markieren und kopieren
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
  }
  melde(ok ? T.kopiert : T.allgemein);
});

// --- Start ---
async function start() {
  try { navigator.storage?.persist?.().catch(() => {}); } catch {}
  if (localStorage.getItem('nahtlos-test-haenger') === '1') await auftrag('test-haenger', { an: true });
  // Umzug aus Format 1 und 2: Blobs in den Speicher "dateien". Unlesbare markieren den Halt als beschädigt.
  try {
    const alt = await db.alteBlobs();
    if (alt.length) {
      melde(f(T.umzug, { p: 0 }), [], 0);
      const r = await db.migriereBlobs({ fortschritt: (p) => melde(f(T.umzug, { p: Math.round(p * 100) }), [], 0) });
      protokolliere('umzug', `${r.umgezogen} Datensätze umgezogen, ${r.beschaedigt} mit unlesbaren Bildern`);
      meldungWeg();
    }
  } catch (e) { protokolliere('umzug', e); }
  try { await db.migriereBreiten(); } catch (e) { protokolliere('umzug', e); }
  await ladeAktive();
  // Unterbrochenes Nähen fertigstellen und Fehlendes nachrechnen, in allen Strecken.
  for (const s of await db.strecken()) {
    try { await ausbessern(s.id); } catch (e) { protokolliere('wiederaufnahme', e); }
  }
  await neuLaden();
  // Die App startet im Hauptmenü. Beim allerersten Start kommt davor die Einführung.
  if (await einfuehrungNoetig()) await zeige('einfuehrung', { danach: 'start' });
  else await zeige('start');
  document.body.dataset.gestartet = '1';
  const kaputt = Z.halte.filter((h) => h.beschaedigt || unrettbar(h)).length;
  if (kaputt) melde(f(T.beschaedigtHinweis, { n: kaputt }), [{ text: T.spaeter, haupt: false }, { text: T.fahrplan, aktion: () => zeige('fahrplan') }], 15000);
  else serieErinnern();
}

function weiterNachHinweis() {
  start().catch((e) => {
    protokolliere('start', e);
    melde(T.allgemein, [{ text: T.neuLaden, aktion: () => location.reload() }]);
  });
}

let imBrowser = false;
try { imBrowser = sessionStorage.getItem('nahtlos-browser') === '1'; } catch {}
if (!istStandalone() && !imBrowser && !new URLSearchParams(location.search).has('startvideo')) {
  document.getElementById('startvideo')?.remove();
  zeige('install');
  $('#trotzdem').addEventListener('click', () => {
    try { sessionStorage.setItem('nahtlos-browser', '1'); } catch {}
    weiterNachHinweis();
  }, { once: true });
} else {
  startVideo({ erzwingen: new URLSearchParams(location.search).has('startvideo') });
  weiterNachHinweis();
}

// Für Browser-Tests: Zustand lesen.
window.nahtlos = {
  version: APP_VERSION,
  zustand: () => ({
    ansicht: Z.ansicht,
    halte: Z.halte.length,
    fertig: Z.halte.filter((h) => h.bild).length,
    strecke: Z.strecke?.name,
    blind: Z.strecke?.blind,
    naehenMs: werte.naehenMs,
    letzter: Z.halte.length ? (({ rohB, rohH, wert, quelle, transform }) => ({ rohB, rohH, wert, quelle, transform }))(Z.halte[Z.halte.length - 1]) : null,
  }),
};
