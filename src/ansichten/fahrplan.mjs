// Fahrplan: gelber Abfahrtsplan mit Zeit, Halt und Anschluss. Halte lassen sich benennen.
// Dazu das Finale der Blindfahrt.
import { Z, registriere, zeige, neuLaden } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, frage, melde, meldungWeg, uhrzeit, datumKurz, tagSchluessel } from '../ui.mjs';
import { kennzahlen, TEMPI } from '../kennzahlen.mjs';
import { fahrtAbspielen } from '../ausgabe.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';
import { ausbessern, unrettbar } from '../naehwerk.mjs';

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
    const kaputt = !!h.beschaedigt || unrettbar(h);
    zeilen.push(el('div', { klasse: 'fp-zeile' + (kaputt ? ' kaputt' : ''), role: 'row', 'data-index': String(h.index) },
      el('span', { klasse: 'fp-zeit', text: uhrzeit(h.zeit), role: 'cell' }),
      el('button', { klasse: 'fp-name', text: kaputt ? `${haltName(h)} · ${T.beschaedigt}` : haltName(h), role: 'cell', onclick: () => benennen(h) }),
      kaputt
        ? el('button', { klasse: 'fp-loeschen', text: T.loeschen, role: 'cell', onclick: () => beschaedigtLoeschen(h) })
        : el('span', { klasse: 'fp-wert', text: h.wert == null ? '–' : String(h.wert), role: 'cell' })));
  }
  tabelle.replaceChildren(...zeilen);
}

// Beschädigten Halt löschen: Die späteren rücken auf, der Nachfolger wird an den neuen Vorgänger genäht.
async function beschaedigtLoeschen(h) {
  const r = await frage(f(T.beschaedigtLoeschen, { n: h.index + 1 }), [
    { text: T.behalten, wert: false },
    { text: T.loeschen, wert: true, haupt: true },
  ]);
  if (!r.wert) return;
  try {
    await db.loescheHalt(h.id);
    melde(f(T.wirdGebaut, { p: 0 }), [], 0);
    await ausbessern(Z.strecke.id);
    meldungWeg();
  } catch (err) {
    protokolliere('loeschen', err);
    melde(T.allgemein);
  }
  await aufbauen();
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
