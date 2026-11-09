// Hauptmenü und Einstellungen. Die App startet hier, nicht im Sucher.
// Neu erstellen: Carousel, Reel oder Collage. Carousel und Reel nutzen dasselbe Projekt (das Band):
// Karte wählen, Fotos aufnehmen oder aus der Mediathek wählen, Vorschau, Export.
import { Z, registriere, zeige, ladeStrecke } from '../zustand.mjs';
import { T, f, namensVorschlag } from '../texte.mjs';
import { $, $$, el, frage, melde, Urls } from '../ui.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';
import { waehleBild, vormerken } from '../einfuhr.mjs';
import { einspielenWaehlen } from './ausfahrt.mjs';

const v = $('#v-start');
const zuletztEl = $('.zuletzt', v);
const leerEl = $('.zuletzt-leer', v);
const urls = new Urls();

export const artName = (art) => ({ reel: T.artReel, collage: T.artCollage }[art] || T.artCarousel);

// Alle Projekte, zuletzt bearbeitete zuerst. Liefert je Projekt Art, Anzahl Fotos und Titelbild-Quelle.
// Weitere Projektarten (Collage) hängen sich über projektQuellen an.
const projektQuellen = [async () => {
  const aus = [];
  for (const s of await db.strecken()) {
    const halte = await db.halte(s.id);
    const geaendert = Math.max(s.erstellt || 0, s.geaendert || 0, ...halte.map((h) => h.zeit || 0));
    const verdeckt = s.blind && !s.ziel;
    aus.push({
      art: s.art || 'carousel', id: s.id, name: s.name, n: halte.length, geaendert, verdeckt,
      titel: verdeckt ? null : halte.find((h) => h.vorschau) || null,
      oeffnen: async () => { await ladeStrecke(s.id); zeige('strecke'); },
      loeschen: () => db.loescheStrecke(s.id),
      strecke: s,
    });
  }
  return aus;
}];
export const projektQuelle = (fn) => projektQuellen.push(fn);

export async function projektListe() {
  const l = (await Promise.all(projektQuellen.map((q) => q().catch((e) => { protokolliere('projekte', e); return []; })))).flat();
  return l.sort((a, b) => b.geaendert - a.geaendert);
}

export async function titelBild(p, urlsListe) {
  if (!p.titel) return null;
  const b = p.titelBlob ? await p.titelBlob() : await db.blob(p.titel, 'vorschau').catch(() => null);
  return b ? urlsListe.von(b) : null;
}

async function aufbauen() {
  v.dataset.bereit = '0';
  urls.leeren();
  let l = [];
  try { l = await projektListe(); } catch (e) { protokolliere('start', e); }
  leerEl.hidden = l.length > 0;
  $('#start-alle').hidden = l.length === 0;
  const eintraege = [];
  for (const p of l.slice(0, 8)) {
    const src = await titelBild(p, urls);
    eintraege.push(el('button', { klasse: 'zuletzt-eintrag', 'data-id': p.id, onclick: () => p.oeffnen() },
      el('span', { klasse: 'zuletzt-bild' }, src ? el('img', { src, alt: '' }) : null),
      el('span', { klasse: 'zuletzt-name', text: p.name }),
      el('span', { klasse: 'zuletzt-info', text: f(T.projektInfo, { art: artName(p.art), n: p.n }) })));
  }
  zuletztEl.replaceChildren(...eintraege);
  v.dataset.bereit = '1';
}

// Neues Carousel oder Reel: Name, auf Wunsch Überraschungsmodus, dann Kamera oder Mediathek.
// Bei der Mediathek entsteht das Projekt erst, wenn wirklich Fotos gewählt sind.
export async function neuesBandProjekt(art = 'carousel') {
  const r = await frage(f(T.neuesProjekt, { art: artName(art) }), [
    { text: T.abbrechen, wert: null },
    ...(art === 'reel' ? [{ text: T.quelleClips, wert: 'clips' }] : []),
    { text: T.quelleVorher, wert: 'vorher' },
    { text: T.quelleMediathek, wert: 'mediathek', sofort: (x) => waehleBild(!!x.option) },
    { text: T.quelleKamera, wert: 'kamera', haupt: true },
  ], { eingabe: namensVorschlag(), option: T.blindOption });
  if (!r.wert) return false;
  if (r.wert === 'clips') { await zeige('clips'); return true; }
  if (r.wert === 'vorher') { await zeige('vorher', { art }); return true; }
  const anlegen = async () => {
    const s = await db.neueStrecke({ name: r.text || namensVorschlag(), blind: r.option, art });
    await ladeStrecke(s.id);
    return s;
  };
  try {
    if (r.wert === 'kamera') { await anlegen(); await zeige('sucher'); }
    else vormerken(anlegen);
    return true;
  } catch (err) {
    protokolliere('neues Projekt', err);
    melde(err instanceof db.SpeicherVoll ? T.speicherVoll : T.allgemein);
    return false;
  }
}

const neuHandler = { carousel: () => neuesBandProjekt('carousel'), reel: () => neuesBandProjekt('reel') };
export const neuArt = (art, fn) => { neuHandler[art] = fn; };

for (const k of $$('.neu-karte', v)) k.addEventListener('click', () => neuHandler[k.dataset.art]?.());
$('#start-alle').addEventListener('click', () => zeige('strecken'));
$('#start-projekte').addEventListener('click', () => zeige('strecken'));
$('#start-einstellungen').addEventListener('click', () => zeige('einstellungen'));
$('#start-tipps').addEventListener('click', () => zeige('reeltipps'));

registriere('start', {
  betreten: aufbauen,
  verlassen() { setTimeout(() => urls.leeren(), 500); },
});

// --- Einstellungen ---
$('#ei-zurueck').addEventListener('click', () => zeige('start'));
$('#ei-einspielen').addEventListener('click', einspielenWaehlen);
$('#ei-einfuehrung').addEventListener('click', () => zeige('einfuehrung', { danach: 'einstellungen' }));
// Die Ansicht „einstellungen“ registriert ansichten/signatur.mjs.

// Für die Diagnose aus app.mjs: der Knopf in den Einstellungen.
export function diagnoseKnopf(oeffnen) { $('#ei-diagnose').addEventListener('click', oeffnen); }
