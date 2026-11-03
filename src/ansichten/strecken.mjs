// Strecken: Liste aller Strecken mit Vorschau, neue Strecke, löschen.
import { Z, registriere, zeige, ladeStrecke, ladeAktive } from '../zustand.mjs';
import { T, f, namensVorschlag } from '../texte.mjs';
import { $, el, frage, melde, Urls, datumKurz } from '../ui.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';
import { einspielenWaehlen } from './ausfahrt.mjs';

const v = $('#v-strecken');
const liste = $('.sl-liste', v);
const leer = $('.sl-leer', v);
const urls = new Urls();

async function eintrag(s) {
  const halte = await db.halte(s.id);
  const vorschau = el('span', { klasse: 'sl-vorschau' });
  if (!(s.blind && !s.ziel)) {
    for (const h of halte.slice(0, 8)) if (h.vorschau) vorschau.append(el('img', { src: urls.von(h.vorschau), alt: '' }));
  }
  const datum = halte.length ? datumKurz(halte[halte.length - 1].zeit) : datumKurz(s.erstellt);
  const knopf = el('button', { klasse: 'sl-oeffnen', onclick: () => oeffnen(s.id) },
    vorschau,
    el('span', { klasse: 'sl-name', text: s.name }),
    el('span', { klasse: 'sl-info', text: `${f(T.streckeKopf, { name: datum, n: halte.length })}${s.blind && !s.ziel ? ' · Blindfahrt' : ''}` }));
  const loeschen = el('button', { klasse: 'sl-loeschen', text: T.loeschen, onclick: () => loeschenFragen(s, halte.length) });
  return el('div', { klasse: 'sl-eintrag' + (Z.strecke?.id === s.id ? ' aktiv' : '') }, knopf, loeschen);
}

async function aufbauen() {
  urls.leeren();
  const l = await db.strecken();
  leer.hidden = l.length > 0;
  liste.replaceChildren(...(await Promise.all(l.map(eintrag))));
}

async function oeffnen(id) {
  await ladeStrecke(id);
  zeige('strecke');
}

async function loeschenFragen(s, n) {
  const r = await frage(f(T.loeschenFrage, { name: s.name, n }), [
    { text: T.behalten, wert: false },
    { text: T.loeschen, wert: true, haupt: true },
  ]);
  if (!r.wert) return;
  try {
    await db.loescheStrecke(s.id);
    if (Z.strecke?.id === s.id) {
      try { localStorage.removeItem('nahtlos-aktiv'); } catch {}
      await db.setzeEinstellung('aktiv', null).catch(() => {});
      await ladeAktive();
    }
  } catch (err) {
    protokolliere('loeschen', err);
    melde(T.allgemein);
  }
  aufbauen();
}

export async function neueStreckeFragen() {
  const r = await frage(T.nameFrage, [
    { text: T.abbrechen, wert: false },
    { text: T.neueStrecke, wert: true, haupt: true },
  ], { eingabe: namensVorschlag(), option: T.blindOption });
  if (!r.wert) return false;
  try {
    const s = await db.neueStrecke({ name: r.text || namensVorschlag(), blind: r.option });
    await ladeStrecke(s.id);
    zeige('sucher');
    return true;
  } catch (err) {
    protokolliere('neue Strecke', err);
    melde(err instanceof db.SpeicherVoll ? T.speicherVoll : T.allgemein);
    return false;
  }
}

$('#sl-neu').addEventListener('click', neueStreckeFragen);
$('#sl-einspielen').addEventListener('click', einspielenWaehlen);
$('#sl-einfuehrung').addEventListener('click', () => zeige('einfuehrung', { danach: 'strecken' }));
$('#sl-zurueck').addEventListener('click', () => zeige('strecke'));

registriere('strecken', {
  betreten: aufbauen,
  verlassen() { setTimeout(() => urls.leeren(), 500); },
});
