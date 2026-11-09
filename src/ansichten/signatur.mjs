// Signatur in den Einstellungen: an oder aus, Kürzel oder Logo, Lage und Größe, mit kleiner Vorschau.
import { T } from '../texte.mjs';
import { $, el, melde } from '../ui.mjs';
import { protokolliere } from '../diagnose.mjs';
import { registriere } from '../zustand.mjs';
import { SIGNATUR_LAGEN, signaturLaden, signaturSpeichern, logoSpeichern, signaturZeichnen } from '../reeltext.mjs';

const v = $('#v-einstellungen');
const wurzel = $('.ei-sig', v);
const mehr = $('.ei-sig-mehr', wurzel);
const textEl = $('.ei-sig-text', wurzel);
const dateiEl = $('.ei-sig-datei', wurzel);
const vorschau = $('.ei-sig-vorschau', wurzel);
let sig = null;

function malen() {
  const k = vorschau.getContext('2d');
  const g = k.createLinearGradient(0, 0, 0, vorschau.height);
  g.addColorStop(0, '#7fa6c9');
  g.addColorStop(0.55, '#d9c7a4');
  g.addColorStop(1, '#4b5a3c');
  k.fillStyle = g;
  k.fillRect(0, 0, vorschau.width, vorschau.height);
  signaturZeichnen(k, vorschau.width, vorschau.height, sig, sig.lage === 'ende' ? 9.5 : 0, sig.lage === 'ende' ? 10 : 10);
}

function zeigen() {
  if (!sig) return;
  for (const b of $('.ei-sig-an', wurzel).children) b.setAttribute('aria-pressed', String((b.dataset.an === '1') === !!sig.an));
  mehr.hidden = !sig.an;
  for (const b of $('.ei-sig-art', wurzel).children) b.setAttribute('aria-pressed', String(b.dataset.art === sig.art));
  textEl.hidden = sig.art !== 'text';
  $('.ei-sig-logo-zeile', wurzel).hidden = sig.art !== 'logo';
  if (document.activeElement !== textEl) textEl.value = sig.text || '';
  for (const b of $('.ei-sig-lage', wurzel).children) b.setAttribute('aria-pressed', String(b.dataset.lage === sig.lage));
  for (const b of $('.ei-sig-groesse', wurzel).children) b.setAttribute('aria-pressed', String(b.dataset.groesse === sig.groesse));
  malen();
}

async function aendern(teil) {
  sig = { ...sig, ...teil };
  zeigen();
  try { await signaturSpeichern(sig); } catch (err) { protokolliere('signatur', err); melde(T.allgemein); }
}

$('.ei-sig-lage', wurzel).replaceChildren(...SIGNATUR_LAGEN.map((l) => el('button', {
  klasse: 'cl-stil', 'data-lage': l, text: T[`signatur_${l}`], onclick: () => aendern({ lage: l }),
})));
for (const b of $('.ei-sig-an', wurzel).children) b.addEventListener('click', async () => { await aendern({ an: b.dataset.an === '1' }); if (sig.an && sig.art === 'logo' && !sig.logo) sig = await signaturLaden(); zeigen(); });
for (const b of $('.ei-sig-art', wurzel).children) b.addEventListener('click', async () => { await aendern({ art: b.dataset.art }); sig = await signaturLaden(); zeigen(); });
for (const b of $('.ei-sig-groesse', wurzel).children) b.addEventListener('click', () => aendern({ groesse: b.dataset.groesse }));
textEl.addEventListener('input', () => aendern({ text: textEl.value }));
$('.ei-sig-logo', wurzel).addEventListener('click', () => dateiEl.click());
dateiEl.addEventListener('change', async () => {
  const d = dateiEl.files[0];
  dateiEl.value = '';
  if (!d) return;
  try {
    const probe = await createImageBitmap(d);
    probe.close?.();
    await logoSpeichern(d);
    sig = await signaturLaden();
    zeigen();
  } catch (err) {
    protokolliere('signatur', err);
    melde(T.signaturLogoFehler);
  }
});

registriere('einstellungen', {
  async betreten() {
    sig = await signaturLaden().catch(() => null);
    zeigen();
  },
});
