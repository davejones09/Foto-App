// Alle Projekte: Liste mit Vorschau, öffnen, löschen. Neue Projekte entstehen im Hauptmenü.
import { Z, registriere, zeige, keinProjekt } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, frage, melde, Urls, datumKurz } from '../ui.mjs';
import { protokolliere } from '../diagnose.mjs';
import { projektListe, artName, titelBild } from './start.mjs';

const v = $('#v-strecken');
const liste = $('.sl-liste', v);
const leer = $('.sl-leer', v);
const urls = new Urls();

async function eintrag(p) {
  const src = await titelBild(p, urls);
  const vorschau = el('span', { klasse: 'sl-vorschau' }, src ? el('img', { src, alt: '' }) : null);
  const info = `${f(T.projektInfo, { art: artName(p.art), n: p.n })} · ${datumKurz(p.geaendert)}${p.verdeckt ? ` · ${T.ueberraschung}` : ''}`;
  const knopf = el('button', { klasse: 'sl-oeffnen', onclick: () => p.oeffnen() },
    vorschau,
    el('span', { klasse: 'sl-name', text: p.name }),
    el('span', { klasse: 'sl-info', text: info }));
  const loeschen = el('button', { klasse: 'sl-loeschen', text: T.loeschen, onclick: () => loeschenFragen(p) });
  return el('div', { klasse: 'sl-eintrag' + (Z.strecke?.id === p.id ? ' aktiv' : ''), 'data-id': p.id }, knopf, loeschen);
}

async function aufbauen() {
  urls.leeren();
  const l = await projektListe();
  leer.hidden = l.length > 0;
  liste.replaceChildren(...(await Promise.all(l.map(eintrag))));
}

async function loeschenFragen(p) {
  const r = await frage(f(T.loeschenFrage, { name: p.name, n: p.n }), [
    { text: T.behalten, wert: false },
    { text: T.loeschen, wert: true, haupt: true },
  ]);
  if (!r.wert) return;
  try {
    await p.loeschen();
    if (Z.strecke?.id === p.id) await keinProjekt();
  } catch (err) {
    protokolliere('loeschen', err);
    melde(T.allgemein);
  }
  aufbauen();
}

$('#sl-zurueck').addEventListener('click', () => zeige('start'));

registriere('strecken', {
  betreten: aufbauen,
  verlassen() { setTimeout(() => urls.leeren(), 500); },
});
