// Anschluss-Kamera für Clips: Das letzte Bild des vorigen Clips liegt halbtransparent im Sucher.
// Man filmt so weiter, dass Linie und Bewegung dort anschließen. Der Wert zeigt, wie gut es passt.
// Der fertige Clip landet sofort im Reel und damit im Entwurf.
import { T, f } from './texte.mjs';
import { $, el, melde } from './ui.mjs';
import { protokolliere } from './diagnose.mjs';
import { merkmal, aehnlich } from './vorhernachher.mjs';
import { deckAusschnitt, ladeClip, suche, clipWeg } from './clipreel.mjs';

const MW = 48;
const MH = 85;
let schicht = null;

function merkmalVon(quelle, qw, qh) {
  const c = new OffscreenCanvas(MW, MH);
  const k = c.getContext('2d', { willReadFrequently: true });
  const a = deckAusschnitt(qw, qh, 9, 16);
  k.drawImage(quelle, a.x, a.y, a.w, a.h, 0, 0, MW, MH);
  return merkmal(k.getImageData(0, 0, MW, MH).data, MW, MH);
}

// Letztes Bild eines Mediums als Bitmap, oder null.
export async function letztesBild(m) {
  if (!m) return null;
  if (m.typ === 'foto') return createImageBitmap(m.datei);
  const v = await ladeClip(m.url);
  try {
    await suche(v, Math.max(0, (m.ende ?? v.duration) - 0.06));
    return await createImageBitmap(v);
  } finally {
    clipWeg(v);
  }
}

const recorderTyp = () => ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));

// oeffnen({ letztes: Medium oder null, neu: async (File) => void }) – neu fügt den Clip ins Reel ein.
export async function anschlussKamera({ letztes, neu }) {
  if (schicht) return;
  const typ = recorderTyp();
  if (!navigator.mediaDevices?.getUserMedia || !typ) { melde(T.akNichtMoeglich); return; }
  let stream;
  const video = { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
  } catch {
    try { stream = await navigator.mediaDevices.getUserMedia({ video, audio: false }); } catch (err) {
      protokolliere('anschluss', err);
      melde(T.akKeineKamera);
      return;
    }
  }
  const vid = el('video', { klasse: 'ak-video', playsinline: true, muted: true, autoplay: true });
  vid.muted = true;
  vid.srcObject = stream;
  const geist = el('canvas', { klasse: 'ak-geist', width: 540, height: 960 });
  const wert = el('div', { klasse: 'ak-wert', 'aria-live': 'polite' });
  const zeit = el('div', { klasse: 'ak-zeit' });
  const ausloeser = el('button', { klasse: 'ak-ausloeser', 'aria-label': T.akAufnehmen });
  const zu = el('button', { klasse: 'neben2 ak-zu', text: T.akFertig });
  const hinweis = el('p', { klasse: 'ak-hinweis', text: letztes ? T.akHinweis : T.akHinweisErster });
  schicht = el('div', { klasse: 'ak' }, vid, geist, wert, hinweis, zeit, el('div', { klasse: 'ak-leiste' }, zu, ausloeser, el('span', { klasse: 'ak-platz' })));
  document.body.append(schicht);
  try { await vid.play(); } catch {}

  let geistMerkmal = null;
  const geistSetzen = async (m) => {
    const k = geist.getContext('2d');
    k.clearRect(0, 0, geist.width, geist.height);
    geistMerkmal = null;
    let b = null;
    try { b = await letztesBild(m); } catch (err) { protokolliere('anschluss', err); }
    if (!b) { wert.hidden = true; return; }
    const a = deckAusschnitt(b.width, b.height, 9, 16);
    k.drawImage(b, a.x, a.y, a.w, a.h, 0, 0, geist.width, geist.height);
    geistMerkmal = merkmalVon(b, b.width, b.height);
    b.close?.();
    wert.hidden = false;
  };
  await geistSetzen(letztes);

  // Anschluss messen, etwa dreimal pro Sekunde
  const messen = setInterval(() => {
    if (!geistMerkmal || vid.readyState < 2) return;
    const s = aehnlich(merkmalVon(vid, vid.videoWidth, vid.videoHeight), geistMerkmal);
    const p = Math.round(Math.max(0, Math.min(1, (s - 0.1) / 0.7)) * 100);
    wert.textContent = String(p);
    wert.dataset.stufe = p >= 70 ? 'gruen' : p >= 40 ? 'gelb' : 'rot';
  }, 330);

  let rec = null;
  let teile = [];
  let start = 0;
  let uhr = 0;
  let nr = 0;
  ausloeser.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    teile = [];
    rec = new MediaRecorder(stream, { mimeType: typ, videoBitsPerSecond: 12_000_000 });
    rec.ondataavailable = (e) => { if (e.data?.size) teile.push(e.data); };
    rec.onstop = async () => {
      clearInterval(uhr);
      schicht?.classList.remove('ak-laeuft');
      zeit.textContent = '';
      const r = rec;
      rec = null;
      const endung = typ.startsWith('video/mp4') ? 'mp4' : 'webm';
      const datei = new File(teile, `anschluss-${Date.now()}-${++nr}.${endung}`, { type: r.mimeType || typ });
      if (!datei.size) { melde(T.akFehler); return; }
      try {
        const m = await neu(datei);
        await geistSetzen(m);
        hinweis.textContent = T.akHinweis;
      } catch (err) {
        protokolliere('anschluss', err);
        melde(T.akFehler);
      }
    };
    rec.start(500);
    start = performance.now();
    schicht.classList.add('ak-laeuft');
    uhr = setInterval(() => { zeit.textContent = f(T.akZeit, { s: ((performance.now() - start) / 1000).toFixed(1).replace('.', ',') }); }, 100);
  });
  const schliessen = () => {
    if (rec) { rec.onstop = null; rec.stop(); rec = null; }
    clearInterval(messen);
    clearInterval(uhr);
    for (const t of stream.getTracks()) t.stop();
    schicht?.remove();
    schicht = null;
    document.removeEventListener('visibilitychange', weg);
  };
  // Geht die App in den Hintergrund, endet die Aufnahme sauber und der Clip wird übernommen.
  const weg = () => { if (document.hidden && rec) rec.stop(); };
  document.addEventListener('visibilitychange', weg);
  zu.addEventListener('click', () => { if (rec) { const r = rec; r.addEventListener('stop', () => setTimeout(schliessen, 300), { once: true }); r.stop(); } else schliessen(); });
}
