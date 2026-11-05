// Import aus der Mediathek. Große Fotos (Lumix, rund 25 MP) gleich beim Dekodieren verkleinern.
// Farben: Das eingebettete Profil entscheidet über den Farbraum der Leinwand (farbe.mjs). Ein sRGB-Foto
// bleibt sRGB, ein Display-P3-Foto bleibt P3. Nur andere Profile (etwa Adobe RGB) werden umgerechnet,
// und das sagt die App dann auch.
import { Z, zeige, erstlaufFertig } from './zustand.mjs';
import { $, melde } from './ui.mjs';
import { T, f } from './texte.mjs';
import { leinwand, ctx2d, alsBlob, freigeben, verkleinere, raumVon, HALT_Q } from './bild.mjs';
import { profilAusDatei, arbeitsraum, wirdUmgerechnet } from './farbe.mjs';
import { sichereRoh } from './naehwerk.mjs';
import { ROH_MAX } from './masse.mjs';
import { protokolliere } from './diagnose.mjs';
import { ladeEnde } from './laden.mjs';
import { SpeicherVoll, NichtGesichert } from './speicher.mjs';

const eingabe = $('#datei-bild');
// In der Blindfahrt bleibt es beim einzelnen Foto.
const nurEinzeln = () => !!(Z.strecke?.blind && !Z.strecke?.ziel);

// Aus dem Hauptmenü: Das neue Projekt entsteht erst, wenn wirklich Fotos gewählt sind.
let vorgemerkt = null;
export function vormerken(anlegen) { vorgemerkt = anlegen; }
eingabe.addEventListener('cancel', () => { vorgemerkt = null; });

eingabe.addEventListener('change', async () => {
  let dateien = [...(eingabe.files || [])];
  eingabe.value = '';
  const anlegen = vorgemerkt;
  vorgemerkt = null;
  try {
    if (!dateien.length) return;
    if (anlegen) {
      try { await anlegen(); } catch (err) {
        protokolliere('neues Projekt', err);
        melde(err instanceof SpeicherVoll ? T.speicherVoll : T.allgemein);
        return;
      }
    }
    if (!Z.strecke) return;
    if (nurEinzeln()) dateien = dateien.slice(0, 1);
    if (dateien.length > 1) await zeige('serie', { dateien });
    else await importieren(dateien[0]);
  } finally {
    ladeEnde();
  }
});

// Öffnet die Auswahl der Mediathek. Das Ergebnis kommt über das change-Ereignis.
export function waehleBild(einzeln = nurEinzeln()) {
  vorgemerkt = null;
  eingabe.multiple = !einzeln;
  eingabe.click();
}

function masseLesen(datei) {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => { ok({ w: img.naturalWidth, h: img.naturalHeight, img, url }); };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Bild nicht lesbar')); };
    img.src = url;
  });
}

// Profil fürs Protokoll und den Halt: nur Name und Art, keine Bytes.
const kurzProfil = (p) => (p && p.art !== 'keins' ? { name: p.name || '', art: p.art } : null);

// Liefert eine Leinwand, längste Seite höchstens ROH_MAX, im Arbeitsfarbraum des Fotos.
// Dazu c.farbraum ('srgb' oder 'display-p3'), c.profil (eingebettetes Profil) und c.umgerechnet.
export async function dekodiere(datei) {
  const profil = await profilAusDatei(datei);
  const raum = await arbeitsraum(profil);
  const { w, h, img, url } = await masseLesen(datei);
  try {
    if (!w || !h) throw new Error('Bild ohne Maße');
    const f = Math.min(1, ROH_MAX / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * f));
    const th = Math.max(1, Math.round(h * f));
    let quelle = null;
    // ImageBitmap nur für sRGB: Ob Safari damit P3 erhält, ist nicht sicher. P3 geht über das Bild-Element.
    if (f < 1 && raum === 'srgb') {
      try { quelle = await createImageBitmap(datei, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'high' }); } catch { quelle = null; }
    }
    let c;
    if (quelle && quelle.width === tw && quelle.height === th) {
      c = leinwand(tw, th, raum);
      ctx2d(c).drawImage(quelle, 0, 0);
    } else {
      // Safari ignoriert die Option womöglich: dann über das Bild selbst verkleinern.
      const q = quelle || img;
      const qw = quelle ? quelle.width : w;
      const qh = quelle ? quelle.height : h;
      c = qw === tw && qh === th ? null : verkleinere(q, qw, qh, tw, th, 0, 0, qw, qh, raum);
      if (!c) { c = leinwand(tw, th, raum); ctx2d(c).drawImage(q, 0, 0, tw, th); }
    }
    freigeben(quelle);
    c.profil = kurzProfil(profil);
    c.umgerechnet = wirdUmgerechnet(profil, raum);
    if (c.umgerechnet) protokolliere('farbe', `${datei.name || 'Foto'}: Profil ${profil.name || profil.art} nach ${raum} umgerechnet`);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const raumName = (r) => (r === 'display-p3' ? 'Display P3' : 'sRGB');

export async function importieren(datei) {
  const herkunft = Z.ansicht;
  try {
    let c;
    try {
      c = await dekodiere(datei);
    } catch (err) {
      protokolliere('import', err);
      melde(T.importFehler);
      return;
    }
    const roh = await alsBlob(c, 'image/jpeg', HALT_Q);
    const erst = !(await erstlaufFertig());
    const index = Z.halte.length;
    const halt = await sichereRoh({ streckeId: Z.strecke.id, index, quelle: 'import', roh, rohB: c.width, rohH: c.height, farbraum: raumVon(c), profil: c.profil });
    if (c.umgerechnet) melde(f(T.farbUmgerechnet, { profil: c.profil?.name || '?', raum: raumName(raumVon(c)) }), [], 6000);
    Z.halte.push(halt);
    await zeige('fein', { halt, rohQuelle: c, neu: true, erstlauf: erst, danach: herkunft === 'sucher' ? 'sucher' : 'strecke' });
  } catch (err) {
    protokolliere('import', err);
    melde(err instanceof SpeicherVoll ? T.speicherVoll : err instanceof NichtGesichert ? T.nichtGesichert : T.allgemein);
  }
}
