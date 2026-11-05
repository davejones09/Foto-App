// Browser-Fassung am Computer: dieselbe App unter derselben Adresse. Am Computer entfällt der Hinweis zum
// Home-Bildschirm, Texte nennen Maus und Dateien, Teilen wird zu Herunterladen, Dateien lassen sich
// hereinziehen, und Tastenkürzel kommen dazu.
import { T } from './texte.mjs';

const hinweisMobil = /iPhone|iPad|iPod|Android/i;

export function istComputerGeraet({ ua = navigator.userAgent, mausFein = matchMedia('(hover: hover) and (pointer: fine)').matches, breite = innerWidth, beruehrpunkte = navigator.maxTouchPoints } = {}) {
  // iPads melden sich teils als Mac, haben aber Berührungspunkte.
  if (hinweisMobil.test(ua) || (/Macintosh/.test(ua) && beruehrpunkte > 1)) return false;
  return mausFein && breite >= 700;
}

export const IST_DESKTOP = (() => { try { return istComputerGeraet(); } catch { return false; } })();

export const DESKTOP_TEXTE = {
  teilen: 'Herunterladen',
  inFotos: 'Speichern',
  reelHinweis: 'Das Reel liegt danach in deinem Download-Ordner. Lade es in Instagram als Reel hoch. „Speichern“ legt Video und Titelbild zusammen als ZIP ab.',
  quelleMediathek: 'Dateien',
  mediathek: 'Dateien',
  kameraText: 'Für Aufnahmen braucht Nahtlos die Webcam. Deine Fotos bleiben auf diesem Computer.',
  kameraVerweigert: 'Ohne Kamerazugriff sind hier keine Aufnahmen möglich. Erlaube ihn in den Einstellungen deines Browsers und lade die Seite neu.',
  kameraMediathek: 'Fotos als Dateien wählen',
  collageHinweis: 'Klicken wählt ein Feld. Ziehen verschiebt, das Mausrad zoomt. Ziehen auf ein anderes Feld tauscht die Fotos.',
  serieHinweis: 'Am Griff ziehen ändert die Reihenfolge. Klicken öffnet den Ausschnitt.',
  serieFeinHinweis: 'Ziehen verschiebt, das Mausrad zoomt. Klicken setzt das Motiv.',
  serieVerwerfenFrage: 'Auswahl verwerfen? Deine Dateien bleiben unverändert.',
  serieWartet: 'Eine Auswahl wartet noch.',
  serieNaehFehler: 'Das Zusammensetzen hat nicht geklappt. Klicke nochmal auf Zusammensetzen.',
  clipsHinweis: 'Wähle Videoclips und Fotos oder zieh sie einfach hierher. Die Clips werden nicht in der App gespeichert, die Auswahl geht beim Schließen verloren.',
  clipsWaehlen: 'Clips und Fotos auswählen',
};

// Läuft beim Laden dieses Moduls, also bevor irgendein Text in die Seite kommt.
export function desktopTexte() {
  if (!IST_DESKTOP) return;
  Object.assign(T, DESKTOP_TEXTE);
  // Der Rest der Texte, auch in verschachtelten Listen wie der Einführung.
  const tausche = (x) => x.replace(/aus der Mediathek/g, 'aus deinen Dateien').replace(/aus deiner Mediathek/g, 'aus deinen Dateien').replace(/in deiner Mediathek/g, 'in deinen Dateien').replace(/auf deinem iPhone/g, 'auf diesem Computer').replace(/iPhone/g, 'Computer');
  const gehe = (o) => {
    for (const k of Object.keys(o)) {
      if (typeof o[k] === 'string') o[k] = tausche(o[k]);
      else if (o[k] && typeof o[k] === 'object') gehe(o[k]);
    }
  };
  gehe(T);
  document.documentElement.classList.add('desktop');
}

desktopTexte();

// Welche Dateiauswahl die hereingezogenen Dateien bekommt, je nach Ansicht.
export const ZIEL_JE_ANSICHT = {
  clips: '#datei-clips', collage: '#datei-collage', sucher: '#datei-bild', strecke: '#datei-bild', serie: '#datei-bild',
};

export function ablageEinrichten(zeige) {
  if (!IST_DESKTOP) return;
  const hinweis = document.createElement('div');
  hinweis.id = 'ablage';
  hinweis.hidden = true;
  hinweis.textContent = 'Dateien hier ablegen';
  document.body.append(hinweis);
  let tiefe = 0;
  const istDatei = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  addEventListener('dragenter', (e) => {
    if (!istDatei(e)) return;
    e.preventDefault();
    tiefe++;
    hinweis.hidden = false;
  });
  addEventListener('dragover', (e) => { if (istDatei(e)) e.preventDefault(); });
  addEventListener('dragleave', () => {
    tiefe = Math.max(0, tiefe - 1);
    if (!tiefe) hinweis.hidden = true;
  });
  addEventListener('drop', async (e) => {
    if (!istDatei(e)) return;
    e.preventDefault();
    tiefe = 0;
    hinweis.hidden = true;
    const dateien = e.dataTransfer.files;
    if (!dateien.length) return;
    let ansicht = document.body.dataset.ansicht;
    // Im Hauptmenü gibt es noch kein Projekt: Reel aus Clips nimmt alles an.
    if (!ZIEL_JE_ANSICHT[ansicht]) { await zeige('clips'); ansicht = 'clips'; }
    const eingabe = document.querySelector(ZIEL_JE_ANSICHT[ansicht]);
    eingabe.files = dateien;
    eingabe.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

// Leertaste löst aus, Escape geht zurück.
export function kuerzelEinrichten() {
  if (!IST_DESKTOP) return;
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const ziel = e.target;
    if (ziel instanceof HTMLElement && ziel.matches('input, select, textarea, video')) return;
    const offenerDialog = document.querySelector('#dialog:not([hidden])');
    if (offenerDialog) return;
    const ansicht = document.querySelector('.ansicht:not([hidden])');
    if (!ansicht) return;
    if (e.key === ' ' && document.body.dataset.ansicht === 'sucher') {
      e.preventDefault();
      const a = document.querySelector('#ausloeser');
      if (!a.disabled) a.click();
    } else if (e.key === 'Escape') {
      const z = ansicht.querySelector('.zurueck');
      if (z && !z.hidden && !z.disabled) { e.preventDefault(); z.click(); }
    }
  });
}
