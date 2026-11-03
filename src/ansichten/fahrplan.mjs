// Fahrplan: gelber Abfahrtsplan mit Zeit, Halt und Anschluss. Halte lassen sich benennen.
// Dazu das Finale der Blindfahrt.
import { Z, registriere, zeige, neuLaden } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, frage, melde, uhrzeit, datumKurz, tagSchluessel } from '../ui.mjs';
import { kennzahlen, TEMPI } from '../kennzahlen.mjs';
import { fahrtAbspielen } from '../ausgabe.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';

const v = $('#v-fahrplan');
const tabelle = $('.fp-tabelle', v);
const zahlen = $('.fp-kennzahlen', v);
const spruch = $('.fp-spruch', v);
const WOCHENTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const haltName = (h) => h.name || f(T.unbenannt, { n: h.index + 1 });

async function benennen(h) {
  const r = await frage(haltName(h), [
    { text: T.abbrechen, wert: false },
    { text: T.uebernehmen, wert: true, haupt: true },
  ], { eingabe: h.name || '' });
  if (!r.wert) return;
  try {
    await db.aendereHalt(h.id, { name: r.text.slice(0, 60) });
    await aufbauen();
  } catch (err) {
    protokolliere('benennen', err);
    melde(T.allgemein);
  }
}

async function aufbauen() {
  await neuLaden();
  const halte = Z.halte;
  const k = kennzahlen(halte);
  zahlen.textContent = f(T.kennzahlen, { n: k.n, x: k.schnitt ?? '–', p: k.p ?? '–' });
  spruch.textContent = k.p == null ? '' : k.p === 100 ? T.puenktlich100 : k.p < 50 ? T.puenktlichSchlecht : '';
  const zeilen = [el('div', { klasse: 'fp-zeile kopfz', role: 'row' }, ...T.spalten.map((s, i) => el('span', { text: s, role: 'columnheader', style: i === 2 ? 'text-align:right' : '' })))];
  let tag = null;
  for (const h of halte) {
    const t = tagSchluessel(h.zeit);
    if (t !== tag) {
      tag = t;
      zeilen.push(el('div', { klasse: 'fp-tagz', text: `${WOCHENTAG[new Date(h.zeit).getDay()]}, ${datumKurz(h.zeit)}`.toUpperCase() }));
    }
    zeilen.push(el('div', { klasse: 'fp-zeile', role: 'row' },
      el('span', { klasse: 'fp-zeit', text: uhrzeit(h.zeit), role: 'cell' }),
      el('button', { klasse: 'fp-name', text: haltName(h), role: 'cell', onclick: () => benennen(h) }),
      el('span', { klasse: 'fp-wert', text: h.wert == null ? '–' : String(h.wert), role: 'cell' })));
  }
  tabelle.replaceChildren(...zeilen);
}

$('#fp-zurueck').addEventListener('click', () => zeige('strecke'));
registriere('fahrplan', { betreten: aufbauen });

// --- Finale der Blindfahrt: die Fahrt läuft einmal im Vollbild ---
const finaleCanvas = $('#v-finale .finale');
let stopp = null;
const beenden = () => { stopp?.(); stopp = null; zeige('strecke'); };
finaleCanvas.addEventListener('click', beenden);
registriere('finale', {
  async betreten() {
    await neuLaden();
    const halte = Z.halte.filter((h) => h.bild);
    if (!halte.length) { zeige('strecke'); return; }
    stopp = fahrtAbspielen(finaleCanvas, Z.strecke, halte, TEMPI[1], { fertig: () => setTimeout(beenden, 1200) });
  },
  verlassen() { stopp?.(); stopp = null; },
});
