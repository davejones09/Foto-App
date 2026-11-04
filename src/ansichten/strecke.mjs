// Strecke: das ganze Band zum Durchwischen, darunter die Leiste mit allen Halten.
import { Z, registriere, zeige, neuLaden } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, frage, tagSchluessel, melde, meldungWeg } from '../ui.mjs';
import { altGenaeht, neuNaehen } from '../naehwerk.mjs';
import { protokolliere } from '../diagnose.mjs';
import { BandAnsicht } from '../band.mjs';
import { bandBreite, lagen, breiteVon } from '../masse.mjs';
import * as db from '../speicher.mjs';

const v = $('#v-strecke');
const canvas = $('.band', v);
const leer = $('.band-leer', v);
const blindEl = $('.band-blind', v);
const kopf = $('.st-kopf', v);
const leiste = $('.halteleiste', v);
const leisteInhalt = $('.hl-inhalt', v);
const fenster = $('.hl-fenster', v);

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const band = new BandAnsicht(canvas, {
  beiBewegung(b) {
    const s = b.sicht();
    fenster.style.left = (s.von * 100).toFixed(3) + '%';
    fenster.style.width = (Math.max(0, s.bis - s.von) * 100).toFixed(3) + '%';
    canvas.dataset.sicht = s.von.toFixed(3) + '-' + s.bis.toFixed(3);
  },
});

function leisteBauen(halte) {
  const b = bandBreite(halte) || 1;
  const anf = lagen(halte);
  const teile = [];
  let tag = null;
  halte.forEach((h, i) => {
    const mitte = (anf[i] + breiteVon(h) / 2) / b;
    const t = tagSchluessel(h.zeit);
    if (i > 0 && t !== tag) {
      const d = new Date(h.zeit);
      teile.push(el('i', { klasse: 'hl-tag', style: `left:${(anf[i] / b) * 100}%` },
        el('span', { text: `${WOCHENTAG[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.` })));
    }
    tag = t;
    teile.push(el('i', { klasse: 'hl-halt', style: `left:${mitte * 100}%` }));
  });
  leisteInhalt.replaceChildren(...teile);
}

{
  let ziehen = false;
  const sprung = (e) => {
    const r = leiste.getBoundingClientRect();
    band.springeZu(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };
  leiste.addEventListener('pointerdown', (e) => { ziehen = true; leiste.setPointerCapture(e.pointerId); sprung(e); });
  leiste.addEventListener('pointermove', (e) => { if (ziehen) sprung(e); });
  leiste.addEventListener('pointerup', () => (ziehen = false));
  leiste.addEventListener('pointercancel', () => (ziehen = false));
}

async function betreten() {
  await neuLaden();
  const halte = Z.halte.filter((h) => h.bild);
  kopf.textContent = f(T.streckeKopf, { name: Z.strecke.name, n: Z.halte.length });
  const blind = Z.strecke.blind && !Z.strecke.ziel;
  blindEl.hidden = !blind;
  leer.hidden = blind || halte.length > 0;
  canvas.hidden = blind || !halte.length;
  leiste.hidden = blind || !halte.length;
  $('#zur-ausfahrt').disabled = blind || !halte.length;
  if (blind || !halte.length) { band.setze([]); return; }
  leisteBauen(halte);
  band.setze(halte);
  altAnbieten();
}

// Strecken von früher (mit Farbangleichung) werden nie still neu gerechnet. Die App fragt einmal je Start.
const gefragt = new Set();
function altAnbieten() {
  const s = Z.strecke;
  const alt = altGenaeht(Z.halte);
  if (!alt.length || gefragt.has(s.id)) return;
  gefragt.add(s.id);
  melde(T.altGenaeht, [{ text: T.spaeter, haupt: false }, { text: T.neuNaehen, aktion: () => neuNaehenFragen(s, alt.length) }], 15000);
}

async function neuNaehenFragen(s, n) {
  const r = await frage(f(T.neuNaehenFrage, { n }), [
    { text: T.abbrechen, wert: false },
    { text: T.neuNaehen, wert: true, haupt: true },
  ]);
  if (!r.wert) return;
  try {
    melde(f(T.neuNaehenLaeuft, { p: 0 }), [], 0);
    const e = await neuNaehen(s.id, { fortschritt: (p) => melde(f(T.neuNaehenLaeuft, { p: Math.round(p * 100) }), [], 0) });
    meldungWeg();
    melde(e.gescheitert ? f(T.neuNaehenTeils, { n: e.gescheitert }) : T.neuNaehenFertig);
  } catch (err) {
    protokolliere('neu-naehen', err);
    melde(T.allgemein);
  }
  if (Z.ansicht === 'strecke' && Z.strecke?.id === s.id) await betreten();
}

$('#zum-sucher').addEventListener('click', () => zeige('sucher'));
$('#zum-fahrplan').addEventListener('click', () => zeige('fahrplan'));
$('#zur-ausfahrt').addEventListener('click', () => zeige('ausfahrt'));
$('#zu-strecken').addEventListener('click', () => zeige('start'));
$('#ziel').addEventListener('click', async () => {
  const r = await frage(T.zielFrage, [
    { text: T.weiterfahren, wert: false },
    { text: T.aufdecken, wert: true, haupt: true },
  ]);
  if (!r.wert) return;
  await db.aendereStrecke(Z.strecke.id, { ziel: true });
  await neuLaden();
  zeige('finale');
});

registriere('strecke', {
  betreten,
  verlassen() { band.freigeben(); },
});

export const bandAnsicht = band;
