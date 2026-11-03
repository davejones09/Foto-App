// Sucher: Kamera, Rest, Live-Faden, Marken, Signal, Wert, Auslöser.
import { Z, registriere, zeige, letzterHalt, erstlaufFertig } from '../zustand.mjs';
import * as kamera from '../kamera.mjs';
import { auftrag, beschaeftigt, generation } from '../rechner.mjs';
import { bewertung } from '../kern.mjs';
import { T } from '../texte.mjs';
import { $, $$, el, Urls, melde } from '../ui.mjs';
import { leinwand, ctx2d, pixel, ladeBitmap, freigeben } from '../bild.mjs';
import { rohAusVideo, sichereRoh, kleinRest } from '../naehwerk.mjs';
import { KLEIN_B, KLEIN_H, KLEIN_UE } from '../masse.mjs';
import { messung, protokolliere, werte } from '../diagnose.mjs';
import { SpeicherVoll } from '../speicher.mjs';
import { waehleBild } from '../einfuhr.mjs';
import { richtung, ORTE, ORT_NAMEN } from '../ideen.mjs';
import * as ideen from '../ideenquelle.mjs';
import { serieErinnern } from './serie.mjs';

const v = $('#v-sucher');
const video = $('#video');
const rahmen = $('#sucher-rahmen');
const restEl = $('.rest', rahmen);
const restImg = $('img', restEl);
const fadenLinie = $('.faden polyline', restEl);
const markenEl = $('.marken', restEl);
const signal = $('.signal', v);
const wertEl = $('.wert', v);
const bewEl = $('.bewertung', v);
const ansage = $('.ansage', v);
const ausloeser = $('#ausloeser');
const statusEl = $('.kamerastatus', rahmen);
const freigabeEl = $('.freigabe', rahmen);
const fehlerEl = $('.kamerafehler', rahmen);
const linseBtn = $('.linse', rahmen);
const teilwerteEl = $('.teilwerte', rahmen);
const miniImg = $('#zur-strecke img');

const urls = new Urls();
let aktiv = false;
let restDa = false;
let restMarken = [];
let restKopie = null; // kleiner Rest, um ihn nach einem Worker-Neustart erneut zu senden
let restGen = -1;
let kameraLinien = [];
let glatt = null;
let zustandAngezeigt = null;
let zustandKandidat = null;
let kandidatSeit = 0;
let letzteAnalyse = 0;
let bildZaehler = 0;
let fpsZaehler = 0;
let fpsSeit = 0;
let schlechtSeit = 0;
let letzterTipp = 0;
let richtungKandidat = null;
let richtungZaehler = 0;
let richtungAngezeigt = null;
let ansageTimer = null;
let erstPhase = null; // null | 'leer' | 'rest'
let erstSchritt = 0;
let wakeLock = null;
let ausloesend = false;
let schleifeId = 0;

// --- Deckkraft des Rests: Wischen auf dem Rest ---
let deckkraft = 0.55;
try { const d = parseFloat(localStorage.getItem('nahtlos-deckkraft')); if (d >= 0.15 && d <= 0.85) deckkraft = d; } catch {}
const setzeDeckkraft = (d) => {
  deckkraft = Math.min(0.85, Math.max(0.15, d));
  document.documentElement.style.setProperty('--deckkraft', deckkraft.toFixed(3));
};
setzeDeckkraft(deckkraft);
export const aktuelleDeckkraft = () => deckkraft;

{
  let start = null;
  restEl.addEventListener('pointerdown', (e) => {
    start = { y: e.clientY, x: e.clientX, d: deckkraft };
    restEl.setPointerCapture(e.pointerId);
  });
  restEl.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dy = start.y - e.clientY;
    const dx = e.clientX - start.x;
    const weg = Math.abs(dy) > Math.abs(dx) ? dy : dx;
    setzeDeckkraft(start.d + weg / 260);
  });
  const ende = () => {
    if (!start) return;
    start = null;
    try { localStorage.setItem('nahtlos-deckkraft', String(deckkraft)); } catch {}
  };
  restEl.addEventListener('pointerup', ende);
  restEl.addEventListener('pointercancel', ende);
}

// --- Ansage (Erstlauf, Tipps) ---
function sage(text, { dauer = 0 } = {}) {
  clearTimeout(ansageTimer);
  if (ansage.textContent !== text) {
    ansage.textContent = text;
    ansage.classList.remove('neu');
    void ansage.offsetWidth;
    if (text) ansage.classList.add('neu');
  }
  if (dauer) ansageTimer = setTimeout(() => sage(''), dauer);
}

function hervorheben(e) {
  e.classList.remove('hervor');
  void e.offsetWidth;
  e.classList.add('hervor');
  setTimeout(() => e.classList.remove('hervor'), 3400);
}

let erstTimer = null;
function erstlaufSchritt() {
  clearTimeout(erstTimer);
  if (erstPhase === 'leer') { sage(T.erstLeer); return; }
  if (erstPhase !== 'rest') return;
  if (erstSchritt === 0) {
    sage(T.erstRest);
    hervorheben(restEl);
    erstSchritt = 1;
    erstTimer = setTimeout(erstlaufSchritt, 3200);
  } else if (erstSchritt === 1) {
    sage(T.erstSuch);
    erstSchritt = 2;
    erstTimer = setTimeout(erstlaufSchritt, 3800);
  } else if (erstSchritt === 2) {
    erstSchritt = 3;
    if (restMarken.length) {
      sage(T.erstMarken);
      hervorheben(markenEl);
      erstTimer = setTimeout(erstlaufSchritt, 4200);
    } else erstlaufSchritt();
  } else if (erstSchritt === 3) {
    sage(T.erstSignal);
    hervorheben(signal);
    erstSchritt = 4;
    erstTimer = setTimeout(() => { sage(T.erstSuch); erstSchritt = 5; }, 5000);
  }
}

// --- Rest laden ---
async function setzeRest() {
  const h = letzterHalt();
  restDa = false;
  restMarken = [];
  markenEl.replaceChildren();
  fadenLinie.setAttribute('points', '');
  urls.leeren();
  if (!h || !h.bild) {
    restEl.hidden = true;
    miniImg.removeAttribute('src');
    ideen.setzeRest(null);
    ideeKnopf.hidden = true;
    restKopie = null;
    await auftrag('rest', { rest: null });
    restGen = generation();
    return;
  }
  restImg.src = urls.von(h.bild);
  miniImg.src = urls.von(h.vorschau || h.bild);
  restEl.hidden = false;
  const bm = await ladeBitmap(h.bild);
  const c = leinwand(bm.width, bm.height);
  ctx2d(c, true).drawImage(bm, 0, 0);
  freigeben(bm);
  const klein = kleinRest(c);
  ideen.setzeRest(c);
  ideeKnopf.hidden = false;
  freigeben(c);
  restKopie = { w: klein.w, h: klein.h, d: new Uint8ClampedArray(klein.d) };
  const r = await auftrag('rest', { rest: klein }, [klein.d.buffer]);
  restGen = generation();
  restMarken = r.marken || [];
  markenEl.replaceChildren(...restMarken.map((m) => el('i', { klasse: 'marke', style: `top:${(m.y * 100).toFixed(2)}%` })));
  restDa = true;
}

function zeigeWert(an) {
  for (const e of [wertEl, bewEl]) e.style.visibility = an ? '' : 'hidden';
  if (!an) {
    signal.className = 'signal';
    zustandAngezeigt = null;
    wertEl.textContent = '';
    bewEl.textContent = '';
  }
}

const kategorie = (w) => (w >= 90 ? 'top' : w >= 70 ? 'gruen' : w >= 40 ? 'gelb' : 'rot');

function aktualisiereAnzeige(w, jetzt) {
  wertEl.textContent = String(Math.round(w));
  const k = kategorie(w);
  if (k !== zustandKandidat) { zustandKandidat = k; kandidatSeit = jetzt; }
  if (k !== zustandAngezeigt && jetzt - kandidatSeit >= 300) {
    zustandAngezeigt = k;
    signal.className = 'signal ' + (k === 'top' ? 'an-gruen blinkt' : 'an-' + k);
    bewEl.textContent = bewertung(Math.round(w));
  }
  if (zustandAngezeigt === null) {
    // Erster Wert sofort anzeigen
    zustandAngezeigt = k;
    signal.className = 'signal ' + (k === 'top' ? 'an-gruen blinkt' : 'an-' + k);
    bewEl.textContent = bewertung(Math.round(w));
  }
}

function tippPruefen(w, jetzt) {
  if (erstPhase) return;
  if (w >= 40) { schlechtSeit = 0; return; }
  if (!schlechtSeit) schlechtSeit = jetzt;
  if (jetzt - schlechtSeit > 15000 && jetzt - letzterTipp > 60000) {
    letzterTipp = jetzt;
    schlechtSeit = jetzt;
    // Dieselbe Quelle wie der Knopf "Idee"
    ideen.naechsteIdee(Z.strecke, Z.halte).then((satz) => { if (satz && aktiv && !richtungAngezeigt) sage(satz, { dauer: 9000 }); });
  }
}

// Liegt eine Kameralinie knapp neben einer Marke: Richtung sagen, in die das iPhone muss.
function richtungPruefen() {
  if (erstPhase || !ideePanel.hidden) return;
  const r = richtung(kameraLinien, restMarken);
  const art = r ? r.richtung : null;
  if (art === richtungKandidat) richtungZaehler++;
  else { richtungKandidat = art; richtungZaehler = 1; }
  if (richtungZaehler < 3 || art === richtungAngezeigt) return; // erst nach drei gleichen Messungen
  richtungAngezeigt = art;
  if (art) sage(art === 'hoeher' ? T.richtungHoeher : T.richtungTiefer);
  else sage('');
}

// --- Knopf "Idee" ---
const ideeKnopf = $('#idee');
const ideePanel = $('.idee', rahmen);
const ideeText = $('.idee-text', ideePanel);
const orteEl = $('.idee-orte', ideePanel);
let ideeLaeuft = false;

async function zeigeIdee() {
  if (ideeLaeuft) return;
  ideeLaeuft = true;
  try {
    const satz = await ideen.naechsteIdee(Z.strecke, Z.halte);
    ideeText.textContent = satz || '';
    ideeText.classList.remove('neu');
    void ideeText.offsetWidth;
    ideeText.classList.add('neu');
  } finally {
    ideeLaeuft = false;
  }
}

async function orteZeigen() {
  const aktuell = await ideen.ort();
  orteEl.replaceChildren(...ORTE.map((o) => el('button', {
    text: ORT_NAMEN[o], 'aria-pressed': String(o === aktuell), 'data-ort': o,
    onclick: async () => {
      const neu = (await ideen.ort()) === o ? null : o;
      await ideen.setzeOrt(neu);
      for (const b of orteEl.children) b.setAttribute('aria-pressed', String(b.dataset.ort === neu));
      zeigeIdee();
    },
  })));
}

ideeKnopf.addEventListener('click', async () => {
  if (!ideePanel.hidden) { ideePanel.hidden = true; return; }
  ideePanel.hidden = false;
  if (richtungAngezeigt) { richtungAngezeigt = null; sage(''); }
  await orteZeigen();
  zeigeIdee();
});
$('#idee-andere').addEventListener('click', zeigeIdee);
$('#idee-zu').addEventListener('click', () => (ideePanel.hidden = true));

// --- Live-Schleife ---
const stufen = [leinwand(384, 480), leinwand(192, 240), leinwand(KLEIN_B, KLEIN_H)];
const stufenCtx = stufen.map((c, i) => ctx2d(c, i === stufen.length - 1));
for (const k of stufenCtx) k.imageSmoothingQuality = 'high';

function kameraKlein() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  let sw = vw, sh = vh, sx = 0, sy = 0;
  if (vw / vh > 0.8) { sw = vh * 0.8; sx = (vw - sw) / 2; } else { sh = vw / 0.8; sy = (vh - sh) / 2; }
  stufenCtx[0].drawImage(video, sx, sy, sw, sh, 0, 0, 384, 480);
  stufenCtx[1].drawImage(stufen[0], 0, 0, 192, 240);
  stufenCtx[2].drawImage(stufen[1], 0, 0, KLEIN_B, KLEIN_H);
  return pixel(stufen[2], 0, 0, KLEIN_UE, KLEIN_H);
}

let teilwerteAn = false;
try { teilwerteAn = localStorage.getItem('nahtlos-teilwerte') === '1'; } catch {}
export function setzeTeilwerte(an) {
  teilwerteAn = an;
  try { localStorage.setItem('nahtlos-teilwerte', an ? '1' : '0'); } catch {}
  teilwerteEl.hidden = !an;
}
export const teilwerteSichtbar = () => teilwerteAn;

async function analysieren(jetzt) {
  if (restKopie && restGen !== generation()) {
    // Worker wurde neu gestartet: Rest erneut übergeben
    const k = { w: restKopie.w, h: restKopie.h, d: new Uint8ClampedArray(restKopie.d) };
    await auftrag('rest', { rest: k }, [k.d.buffer]);
    restGen = generation();
  }
  const b = kameraKlein();
  if (!b) return;
  bildZaehler++;
  const mitLinien = restMarken.length > 0 && bildZaehler % 3 === 0;
  const t0 = performance.now();
  const r = await auftrag('analyse', { kamera: b, mitLinien }, [b.d.buffer]);
  if (!aktiv || r.leer) return;
  messung('analyse', performance.now() - t0);
  fpsZaehler++;
  if (jetzt - fpsSeit > 1000) { werte.fps = Math.round((fpsZaehler * 1000) / (jetzt - fpsSeit)); fpsZaehler = 0; fpsSeit = jetzt; }
  glatt = glatt == null ? r.wert : glatt * 0.75 + r.wert * 0.25;
  aktualisiereAnzeige(glatt, performance.now());
  tippPruefen(glatt, jetzt);
  fadenLinie.setAttribute('points', r.pfad.map((x, y) => `${x + 0.5},${y + 0.5}`).join(' '));
  if (r.linien) { kameraLinien = r.linien; richtungPruefen(); }
  const marken = markenEl.children;
  for (let i = 0; i < restMarken.length && i < marken.length; i++) {
    const trifft = kameraLinien.some((l) => Math.abs(l.y - restMarken[i].y) <= 0.03);
    marken[i].classList.toggle('trifft', trifft);
  }
  if (teilwerteAn) {
    const t = r.teile;
    teilwerteEl.textContent = `wert ${r.wert}\nfarbe ${t.farbe.toFixed(2)}\nlinien ${t.linien.toFixed(2)}\nstruktur ${t.struktur.toFixed(2)}\n${werte.fps} fps · ${werte.analyseMs.toFixed(1)} ms`;
  }
}

function schleife() {
  const meine = ++schleifeId;
  const naechstes = () => {
    if (meine !== schleifeId || !aktiv) return;
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(tick);
    else requestAnimationFrame(tick);
  };
  const tick = () => {
    if (meine !== schleifeId || !aktiv) return;
    const jetzt = performance.now();
    if (restDa && !ausloesend && jetzt - letzteAnalyse >= 83 && !beschaeftigt() && video.readyState >= 2) {
      letzteAnalyse = jetzt;
      analysieren(jetzt).catch((e) => protokolliere('analyse', e));
    }
    naechstes();
  };
  naechstes();
}

// --- Kamera ---
function zeigeKameraSchicht(art) {
  statusEl.hidden = art !== 'laden';
  freigabeEl.hidden = art !== 'freigabe' && art !== 'verweigert';
  fehlerEl.hidden = art !== 'fehler';
  if (art === 'freigabe' || art === 'verweigert') {
    $('.frei-text', freigabeEl).textContent = art === 'verweigert' ? T.kameraVerweigert : T.kameraText;
    $('#freigeben').hidden = art === 'verweigert';
  }
  ausloeser.disabled = art !== null;
}

async function kameraStarten({ direkt = false } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) { zeigeKameraSchicht('fehler'); return; }
  if (!direkt) {
    let bekannt = false;
    try { bekannt = localStorage.getItem('nahtlos-kamera') === 'ok'; } catch {}
    const st = await kamera.freigabeStatus();
    if (st === 'denied') { zeigeKameraSchicht('verweigert'); return; }
    if (st !== 'granted' && !bekannt) { zeigeKameraSchicht('freigabe'); return; }
  }
  zeigeKameraSchicht('laden');
  try {
    await kamera.starte(video);
    if (!aktiv || document.hidden) { kamera.stoppe(video); return; }
    try { localStorage.setItem('nahtlos-kamera', 'ok'); } catch {}
    zeigeKameraSchicht(null);
    wachHalten();
    linsenPruefen();
    schleife();
  } catch (err) {
    protokolliere('kamera', err);
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      try { localStorage.removeItem('nahtlos-kamera'); } catch {}
      zeigeKameraSchicht(direkt ? 'verweigert' : 'freigabe');
    } else zeigeKameraSchicht('fehler');
  }
}

kamera.beiStreamEnde(() => { if (aktiv && !document.hidden) kameraStarten({ direkt: true }); });

async function wachHalten() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); wakeLock?.addEventListener?.('release', () => (wakeLock = null)); } catch {}
}
function wachFreigeben() { try { wakeLock?.release(); } catch {} wakeLock = null; }

let linsen = [];
async function linsenPruefen() {
  linsen = await kamera.rueckkameras();
  linseBtn.hidden = linsen.length < 2;
  if (linsen.length >= 2) {
    const i = Math.max(0, linsen.findIndex((d) => d.deviceId === kamera.aktuellesGeraet()));
    $('span', linseBtn).textContent = `${i + 1}/${linsen.length}`;
  }
}
linseBtn.addEventListener('click', async () => {
  if (linsen.length < 2) return;
  const i = linsen.findIndex((d) => d.deviceId === kamera.aktuellesGeraet());
  const n = linsen[(i + 1) % linsen.length];
  kamera.setzeGeraet(n.deviceId);
  kamera.stoppe(video);
  await kameraStarten({ direkt: true });
});

$('#freigeben').addEventListener('click', () => kameraStarten({ direkt: true }));
$('#kamera-neu').addEventListener('click', () => { kamera.stoppe(video); kameraStarten({ direkt: true }); });

document.addEventListener('visibilitychange', () => {
  if (Z.ansicht !== 'sucher') return;
  if (document.hidden) {
    schleifeId++;
    kamera.stoppe(video);
    wachFreigeben();
  } else if (aktiv) kameraStarten({ direkt: true });
});

// --- Auslösen ---
async function ausloesen() {
  if (ausloesend || !video.videoWidth) return;
  ausloesend = true;
  ausloeser.disabled = true;
  try {
    video.pause();
    const erst = !(await erstlaufFertig());
    const roh = await rohAusVideo(video);
    const index = Z.halte.length;
    const halt = await sichereRoh({ streckeId: Z.strecke.id, index, quelle: 'kamera', roh: roh.blob, rohB: roh.w, rohH: roh.h });
    Z.halte.push(halt);
    await zeige('aufdeckung', { halt, rohQuelle: roh.leinwand, langsam: erst && index === 1, erstlauf: erst });
  } catch (err) {
    protokolliere('aufnahme', err);
    video.play().catch(() => {});
    melde(err instanceof SpeicherVoll ? T.speicherVoll : T.allgemein);
  } finally {
    ausloesend = false;
    ausloeser.disabled = false;
  }
}
ausloeser.addEventListener('click', ausloesen);

$('#zur-strecke').addEventListener('click', () => zeige('strecke'));
$('#mediathek').addEventListener('click', waehleBild);
$('#frei-mediathek').addEventListener('click', waehleBild);

// --- Ansicht ---
registriere('sucher', {
  async betreten(daten, alt) {
    aktiv = true;
    if (alt === 'serie') serieErinnern();
    glatt = null;
    zustandAngezeigt = null;
    schlechtSeit = 0;
    kameraLinien = [];
    richtungKandidat = null;
    richtungAngezeigt = null;
    ideePanel.hidden = true;
    sage('');
    teilwerteEl.hidden = !teilwerteAn;
    $('#version').hidden = false;
    const erst = !(await erstlaufFertig());
    const n = Z.halte.length;
    erstPhase = erst ? (n === 0 ? 'leer' : n === 1 ? 'rest' : null) : null;
    erstSchritt = 0;
    zeigeWert(n > 0);
    if (n === 0) bewEl.textContent = '';
    await setzeRest().catch((e) => protokolliere('rest', e));
    if (!erst && n === 0) sage(T.erstLeer);
    erstlaufSchritt();
    if (video.srcObject && kamera.laeuft()) {
      zeigeKameraSchicht(null);
      await video.play().catch(() => {});
      schleife();
    } else await kameraStarten();
  },
  verlassen(nach) {
    aktiv = false;
    schleifeId++;
    clearTimeout(erstTimer);
    // Für die Aufdeckung bleibt der Stream kurz an, sonst aus.
    if (nach !== 'aufdeckung') kamera.stoppe(video);
    wachFreigeben();
  },
});

export function kameraAus() { kamera.stoppe(video); }
