// Tipps für Reels: Grundlagen und Vorschläge nach Anlass, zum Aufklappen.
import { $, el } from '../ui.mjs';
import { T, f } from '../texte.mjs';
import { registriere, zeige } from '../zustand.mjs';
import { ANLAESSE, GRUNDLAGEN } from '../reeltipps.mjs';

const v = $('#v-reeltipps');
const liste = $('.rt-liste', v);
let zurueck = 'start';

const klappe = (id, titel, inhalt, untertitel) => el('details', { klasse: 'rt-klappe', 'data-id': id },
  el('summary', {}, el('span', { text: titel }), untertitel ? el('small', { text: untertitel }) : ''),
  el('div', { klasse: 'rt-inhalt' }, ...inhalt));

const punkte = (l) => el('ul', { klasse: 'rt-punkte' }, ...l.map((x) => el('li', { text: x })));

function idee(i) {
  return el('section', { klasse: 'rt-idee' },
    el('h4', { text: i.titel }),
    el('p', { klasse: 'rt-info', text: f(T.tippLaenge, { von: i.laenge[0], bis: i.laenge[1] }) }),
    el('p', { text: i.zweck }),
    el('h5', { text: T.tippClips }),
    el('ol', { klasse: 'rt-clips' }, ...i.clips.map(([was, sek]) => el('li', {}, el('span', { text: was }), el('small', { text: f(T.reelSekunden, { s: sek }) })))));
}

function aufbauen() {
  liste.replaceChildren(
    el('p', { klasse: 'rt-hinweis', text: T.tippHinweis }),
    klappe('grundlagen', T.tippGrundlagen, GRUNDLAGEN.map((g) => el('section', { klasse: 'rt-grund' }, el('h4', { text: g.titel }), el('p', { text: g.text })))),
    ...ANLAESSE.map((a) => klappe(a.id, a.titel, [
      ...a.ideen.map(idee),
      el('h4', { text: T.tippSoDrehst }),
      punkte(a.tipps),
      a.achtung ? el('p', { klasse: 'rt-achtung' }, el('b', { text: `${T.tippAchtung} ` }), a.achtung) : '',
      el('p', { klasse: 'rt-info', text: f(T.tippAusFotos, { stil: a.stil }) }),
    ].filter(Boolean), f(T.tippVorschlaege, { n: a.ideen.length }))),
  );
}

$('#rt-zurueck').addEventListener('click', () => zeige(zurueck));

registriere('reeltipps', {
  betreten(_, alt) {
    if (alt && alt !== 'reeltipps') zurueck = alt;
    aufbauen();
    liste.scrollTop = 0;
  },
});
