// Vorlagen auswählen: Stimmungen, Würfel für Varianten, eigene Kombinationen und gespeicherte eigene Vorlagen.
// Gemeinsam für Reel aus Clips und Foto-Reel. Die Oberfläche ruft wechsel(stil, variante) bei jeder Änderung.
import { T, f } from './texte.mjs';
import { el, frage, melde } from './ui.mjs';
import * as db from './speicher.mjs';
import { VORLAGEN, GRUPPEN, UEBERGANG_IDS, BEWEGUNGEN, eigeneSetzen, eigeneVorlagen, vorlageAus } from './reelvorlagen.mjs';

export const RHYTHMEN = { ruhig: [4], mittel: [2], schnell: [1], wechselnd: [2, 1, 1], drop: [4, 2, 2, 1, 1, 1, 1], lang: [6, 3] };

export async function eigeneLaden() {
  const l = (await db.einstellung('eigeneVorlagen').catch(() => null)) || [];
  eigeneSetzen(l);
  return l;
}

async function eigeneSpeichern(l) {
  l = l.filter((v) => v.id !== 'e-neu');
  await db.setzeEinstellung('eigeneVorlagen', l);
  eigeneSetzen(l);
}

export const vorlagenName = (id) => (id.startsWith('e-') ? (eigeneVorlagen().find((v) => v.id === id)?.name ?? T.gruppe_eigene) : T[`vorlage_${id.slice(2)}`] ?? id);
const gruppeVon = (id) => (id?.startsWith('e-') ? 'eigene' : VORLAGEN.find((v) => v.id === id)?.gruppe ?? null);

// zustand: { stil, variante }. extra: zusätzliche Knöpfe vor den Gruppen (etwa „Ganze Clips“).
// erweitert(): ob Bausteine und Speichern zu sehen sind.
export function vorlagenWahl({ zustand, wechsel, extra = [], erweitert = () => true, klasse = 'cl-stil' }) {
  let gruppe = gruppeVon(zustand.stil) || 'energie';
  let bau = null; // Bausteine der gerade bearbeiteten eigenen Kombination
  const wurzel = el('div', { klasse: 'vw' });
  const gruppenEl = el('div', { klasse: 'cl-stile vw-gruppen', role: 'group', 'aria-label': T.vorlagenStimmung });
  const listeEl = el('div', { klasse: 'cl-stile vw-liste', role: 'group', 'aria-label': T.reelVorlagen });
  const varianteEl = el('div', { klasse: 'vw-variante' });
  const bauEl = el('div', { klasse: 'vw-bau nur-erweitert' });
  wurzel.append(gruppenEl, listeEl, varianteEl, bauEl);

  const setze = (stil, variante = 0) => {
    zustand.stil = stil;
    letzterStil = stil;
    zustand.variante = variante;
    wechsel();
    zeigen();
  };

  function knopf(text, gedrueckt, onclick, daten = {}) {
    return el('button', { klasse, text, 'aria-pressed': String(gedrueckt), onclick, ...daten });
  }

  let letzterStil = zustand.stil;
  function zeigen() {
    // Kam der Stil von außen (Entwurf, Neu beginnen), passt die Stimmung dazu.
    if (zustand.stil !== letzterStil) { gruppe = gruppeVon(zustand.stil) || gruppe; letzterStil = zustand.stil; }
    const eigene = eigeneVorlagen().filter((v) => v.id !== 'e-neu');
    const istVorlage = zustand.stil?.startsWith('v-') || zustand.stil?.startsWith('e-');
    gruppenEl.replaceChildren(
      ...extra.map((x) => knopf(x.text, zustand.stil === x.stil, () => setze(x.stil), { 'data-stil': x.stil })),
      ...GRUPPEN.map((g) => knopf(T[`gruppe_${g}`], istVorlage && gruppe === g, () => {
        gruppe = g;
        const erste = VORLAGEN.find((v) => v.gruppe === g);
        if (gruppeVon(zustand.stil) !== g) setze(erste.id); else zeigen();
      }, { 'data-gruppe': g })),
      ...(eigene.length || erweitert() ? [knopf(T.gruppe_eigene, istVorlage && gruppe === 'eigene', () => {
        gruppe = 'eigene';
        if (eigene.length) setze(eigene[0].id);
        else { bau = { schlaege: RHYTHMEN.mittel, arten: ['blende'], bewegung: 'drift' }; zeigen(); }
      }, { 'data-gruppe': 'eigene' })] : []),
    );
    listeEl.hidden = !istVorlage && gruppe !== 'eigene';
    if (gruppe === 'eigene') {
      listeEl.replaceChildren(...eigene.map((v) => knopf(v.name, zustand.stil === v.id, () => setze(v.id), { 'data-stil': v.id })),
        ...(erweitert() ? [knopf(T.vorlageNeu, !!bau && !zustand.stil?.startsWith('e-'), () => { bau = { schlaege: RHYTHMEN.mittel, arten: ['blende'], bewegung: 'drift' }; bauAnwenden(); })] : []));
    } else {
      listeEl.replaceChildren(...VORLAGEN.filter((v) => v.gruppe === gruppe).map((v) => knopf(T[`vorlage_${v.id.slice(2)}`], zustand.stil === v.id, () => setze(v.id), { 'data-stil': v.id })));
    }
    // Würfel: neue Variante derselben Vorlage
    varianteEl.replaceChildren();
    varianteEl.hidden = !istVorlage;
    if (istVorlage) {
      varianteEl.append(
        el('button', { klasse: 'neben2 vw-wuerfel', text: T.variante, onclick: () => setze(zustand.stil, 1 + Math.floor(Math.random() * 9998)) }),
        el('small', { text: zustand.variante ? f(T.varianteNr, { n: zustand.variante }) : T.varianteOriginal }),
        zustand.variante ? el('button', { klasse: 'link', text: T.varianteZurueck, onclick: () => setze(zustand.stil, 0) }) : null,
      );
    }
    bauZeigen(istVorlage);
  }

  // --- Bausteine: eigene Kombination ---
  function bauAnwenden() {
    zustand.stil = 'e-neu';
    letzterStil = 'e-neu';
    zustand.variante = 0;
    eigeneSetzen([...eigeneVorlagen(), { id: 'e-neu', name: T.vorlageNeu, ...bau }]);
    wechsel();
    zeigen();
  }

  function bauZeigen(istVorlage) {
    bauEl.replaceChildren();
    if (!istVorlage) return;
    const v = vorlageAus(zustand.stil, zustand.variante);
    if (!v) return;
    const aktuell = bau && zustand.stil === 'e-neu' ? bau : { schlaege: v.schlaege, arten: v.arten, bewegung: v.bewegung };
    const aendern = (teil) => { bau = { ...aktuell, ...teil }; bauAnwenden(); };
    const rhythmus = Object.entries(RHYTHMEN).find(([, r]) => JSON.stringify(r) === JSON.stringify(aktuell.schlaege))?.[0];
    bauEl.append(
      el('p', { klasse: 'af-gruppe', text: T.bausteine }),
      el('small', { klasse: 'vw-hinweis', text: T.bausteineHinweis }),
      el('p', { klasse: 'vw-titel', text: T.bausteinRhythmus }),
      el('div', { klasse: 'cl-stile vw-rhythmus' }, ...Object.keys(RHYTHMEN).map((r) => knopf(T[`rhythmus_${r}`], r === rhythmus, () => aendern({ schlaege: RHYTHMEN[r] }), { 'data-rhythmus': r }))),
      el('p', { klasse: 'vw-titel', text: T.bausteinUebergang }),
      el('div', { klasse: 'cl-stile vw-uebergaenge vw-umbruch' }, ...UEBERGANG_IDS.map((u) => knopf(T[`uebergang_${u}`], aktuell.arten.includes(u), () => {
        const drin = aktuell.arten.includes(u);
        const arten = drin ? aktuell.arten.filter((x) => x !== u) : [...new Set([...aktuell.arten, u])];
        if (!arten.length) return;
        aendern({ arten });
      }, { 'data-uebergang': u }))),
      el('p', { klasse: 'vw-titel', text: T.bausteinBewegung }),
      el('div', { klasse: 'cl-stile vw-bewegung' }, ...BEWEGUNGEN.map((b) => knopf(T[`bewegung_${b}`], aktuell.bewegung === b, () => aendern({ bewegung: b }), { 'data-bewegung': b }))),
      el('div', { klasse: 'vw-speichern-zeile' },
        el('button', { klasse: 'neben2 vw-speichern', text: T.vorlageSpeichern, onclick: speichern }),
        zustand.stil?.startsWith('e-') && zustand.stil !== 'e-neu' ? el('button', { klasse: 'link vw-loeschen', text: T.vorlageLoeschen, onclick: loeschen }) : null),
    );
  }

  async function speichern() {
    const v = vorlageAus(zustand.stil, zustand.variante);
    const vorschlag = zustand.stil === 'e-neu' ? T.vorlageMeinLook
      : zustand.stil.startsWith('e-') ? v.name : `${vorlagenName(zustand.stil)}${zustand.variante ? ` ${zustand.variante}` : ''}`;
    const r = await frage(T.vorlageName, [{ text: T.abbrechen, wert: false }, { text: T.speichernKnopf, wert: true, haupt: true }], { eingabe: vorschlag });
    if (!r.wert || !r.text) return;
    const liste = eigeneVorlagen().filter((x) => x.id !== 'e-neu');
    const neu = { id: `e-${db.neueId()}`, name: r.text.slice(0, 40), schlaege: v.schlaege, arten: v.arten, bewegung: v.bewegung };
    try {
      await eigeneSpeichern([...liste, neu]);
    } catch {
      melde(T.allgemein);
      return;
    }
    bau = null;
    gruppe = 'eigene';
    melde(f(T.vorlageGespeichert, { name: neu.name }));
    setze(neu.id, 0);
  }

  async function loeschen() {
    const id = zustand.stil;
    const r = await frage(f(T.vorlageLoeschenFrage, { name: vorlagenName(id) }), [{ text: T.abbrechen, wert: false }, { text: T.loeschen, wert: true, haupt: true }]);
    if (!r.wert) return;
    await eigeneSpeichern(eigeneVorlagen().filter((x) => x.id !== id && x.id !== 'e-neu'));
    const rest = eigeneVorlagen().filter((x) => x.id !== 'e-neu');
    if (rest.length) setze(rest[0].id);
    else { gruppe = 'energie'; setze('v-beat'); }
  }

  zeigen();
  return { el: wurzel, zeigen, setzeGruppe: (g) => { gruppe = g; zeigen(); } };
}
