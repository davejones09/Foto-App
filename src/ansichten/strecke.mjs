// Strecke: das ganze Band zum Durchwischen, darunter die Leiste mit allen Halten.
import { Z, registriere, zeige, neuLaden } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, frage, tagSchluessel } from '../ui.mjs';
import { BandAnsicht } from '../band.mjs';
import { bandBreite, SCHRITT, HALT_B } from '../masse.mjs';
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
  const b = bandBreite(halte.length) || 1;
  const teile = [];
  let tag = null;
  halte.forEach((h, i) => {
    const mitte = (i * SCHRITT + HALT_B / 2) / b;
    const t = tagSchluessel(h.zeit);
    if (i > 0 && t !== tag) {
      const d = new Date(h.zeit);
      teile.push(el('i', { klasse: 'hl-tag', style: `left:${((i * SCHRITT) / b) * 100}%` },
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
}

$('#zum-sucher').addEventListener('click', () => zeige('sucher'));
$('#zum-fahrplan').addEventListener('click', () => zeige('fahrplan'));
$('#zur-ausfahrt').addEventListener('click', () => zeige('ausfahrt'));
$('#zu-strecken').addEventListener('click', () => zeige('strecken'));
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
