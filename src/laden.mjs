// Ladeanzeige nach der Dateiauswahl. Am iPhone bereitet das System die Dateien nach dem Haken noch vor, ohne dass
// die App davon erfährt. Die Anzeige steht deshalb schon beim Öffnen der Auswahl bereit, unter dem Auswahlfenster,
// und verschwindet bei Abbruch oder wenn die Dateien da sind.
import { T, f } from './texte.mjs';
import { $ } from './ui.mjs';

const BEOBACHTET = new Set(['datei-clips', 'datei-bild', 'datei-collage', 'datei-musik', 'datei-vorher', 'datei-rueckblick']);
const NOTAUS_MS = 5 * 60 * 1000;
let notaus = null;

function zeigen(text, anteil = null) {
  const e = $('#laden');
  $('.laden-text', e).textContent = text;
  if (anteil == null) e.removeAttribute('data-stand');
  else {
    e.setAttribute('data-stand', '');
    e.style.setProperty('--stand', `${Math.round(anteil * 100)}%`);
  }
  e.hidden = false;
  clearTimeout(notaus);
  notaus = setTimeout(ladeEnde, NOTAUS_MS);
}

export function ladeWarten(text = T.laden) { zeigen(text); }
export function ladeSchritt(i, n) { zeigen(f(T.ladenSchritt, { i, n }), i / n); }
export function ladeEnde() {
  clearTimeout(notaus);
  $('#laden').hidden = true;
}

const beobachtet = (e) => e.target instanceof HTMLInputElement && BEOBACHTET.has(e.target.id);
document.addEventListener('click', (e) => { if (beobachtet(e)) ladeWarten(); }, true);
document.addEventListener('cancel', (e) => { if (beobachtet(e)) ladeEnde(); }, true);
document.addEventListener('change', (e) => {
  if (!beobachtet(e)) return;
  if (e.target.files?.length) ladeWarten();
  else ladeEnde();
}, true);
