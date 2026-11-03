// Import aus der Mediathek. Große Fotos (Lumix, rund 25 MP) gleich beim Dekodieren verkleinern.
import { Z, zeige, erstlaufFertig } from './zustand.mjs';
import { $, melde } from './ui.mjs';
import { T } from './texte.mjs';
import { leinwand, ctx2d, alsBlob, freigeben, verkleinere } from './bild.mjs';
import { sichereRoh } from './naehwerk.mjs';
import { ROH_MAX } from './masse.mjs';
import { protokolliere } from './diagnose.mjs';
import { SpeicherVoll } from './speicher.mjs';

const eingabe = $('#datei-bild');
eingabe.addEventListener('change', () => {
  const datei = eingabe.files?.[0] || null;
  eingabe.value = '';
  if (datei) importieren(datei);
});

// Öffnet die Auswahl der Mediathek. Das Ergebnis kommt über das change-Ereignis.
export function waehleBild() { eingabe.click(); }

function masseLesen(datei) {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => { ok({ w: img.naturalWidth, h: img.naturalHeight, img, url }); };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Bild nicht lesbar')); };
    img.src = url;
  });
}

// Liefert eine Leinwand, längste Seite höchstens ROH_MAX.
export async function dekodiere(datei) {
  const { w, h, img, url } = await masseLesen(datei);
  try {
    if (!w || !h) throw new Error('Bild ohne Maße');
    const f = Math.min(1, ROH_MAX / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * f));
    const th = Math.max(1, Math.round(h * f));
    let quelle = null;
    if (f < 1) {
      try { quelle = await createImageBitmap(datei, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'high' }); } catch { quelle = null; }
    }
    let c;
    if (quelle && quelle.width === tw && quelle.height === th) {
      c = leinwand(tw, th);
      ctx2d(c).drawImage(quelle, 0, 0);
    } else {
      // Safari ignoriert die Option womöglich: dann über das Bild selbst verkleinern.
      const q = quelle || img;
      const qw = quelle ? quelle.width : w;
      const qh = quelle ? quelle.height : h;
      c = qw === tw && qh === th ? null : verkleinere(q, qw, qh, tw, th);
      if (!c) { c = leinwand(tw, th); ctx2d(c).drawImage(q, 0, 0, tw, th); }
    }
    freigeben(quelle);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function importieren(datei) {
  try {
    let c;
    try {
      c = await dekodiere(datei);
    } catch (err) {
      protokolliere('import', err);
      melde(T.importFehler);
      return;
    }
    const roh = await alsBlob(c, 'image/jpeg', 0.92);
    const erst = !(await erstlaufFertig());
    const index = Z.halte.length;
    const halt = await sichereRoh({ streckeId: Z.strecke.id, index, quelle: 'import', roh, rohB: c.width, rohH: c.height });
    Z.halte.push(halt);
    await zeige('fein', { halt, rohQuelle: c, neu: true, erstlauf: erst });
  } catch (err) {
    protokolliere('import', err);
    melde(err instanceof SpeicherVoll ? T.speicherVoll : T.allgemein);
  }
}
