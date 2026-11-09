// Vorher und nachher: Fotos gemischt wählen, Paare erkennt die App. Ausgabe als Reel mit Wischlinie
// oder als Carousel mit geteiltem Bild. Beide Fotos bleiben unverändert, gezeigt wird je Stelle nur eins.
import { registriere, zeige } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, melde } from '../ui.mjs';
import * as aus from '../ausgabe.mjs';
import { protokolliere } from '../diagnose.mjs';
import { merkmal, paareFinden, vnZustand, paarDauer } from '../vorhernachher.mjs';
import { deckAusschnitt } from '../clipreel.mjs';
import { ladeSchritt, ladeEnde } from '../laden.mjs';
import { signaturLaden, signaturZeichnen } from '../reeltext.mjs';

const v = $('#v-vorher');
const eingabe = $('#datei-vorher');
const paareEl = $('.vn-paare', v);
const infoEl = $('.vn-info', v);
const bauenKnopf = $('#vn-bauen', v);
const fortEl = $('.vn-fort', v);
const ergebnisEl = $('.vn-ergebnis', v);
let fotos = []; // { datei, bild }
let paare = [];
let art = 'reel';
let zurueck = 'start';
let ergebnisUrl = null;

async function einlesen(dateien) {
  for (const x of fotos) x.bild.close?.();
  fotos = [];
  for (const [i, d] of dateien.slice(0, 20).entries()) {
    ladeSchritt(i + 1, Math.min(20, dateien.length));
    try {
      const bild = await createImageBitmap(d);
      const c = new OffscreenCanvas(48, 64);
      const k = c.getContext('2d');
      const a = deckAusschnitt(bild.width, bild.height, 3, 4);
      k.drawImage(bild, a.x, a.y, a.w, a.h, 0, 0, 48, 64);
      fotos.push({ datei: d, bild, m: merkmal(k.getImageData(0, 0, 48, 64).data, 48, 64) });
    } catch (err) {
      protokolliere('vorher', err);
    }
  }
  ladeEnde();
  const r = paareFinden(fotos.map((x) => x.m));
  paare = r.paare;
  infoEl.textContent = paare.length ? `${f(T.vnPaare, { n: paare.length })}${r.rest.length ? ` ${f(T.vnRest, { n: r.rest.length })}` : ''}` : T.vnKeine;
  zeigen();
}

function vorschau(bild) {
  const c = el('canvas', { width: 144, height: 180 });
  const a = deckAusschnitt(bild.width, bild.height, 4, 5);
  c.getContext('2d').drawImage(bild, a.x, a.y, a.w, a.h, 0, 0, 144, 180);
  return c;
}

function zeigen() {
  paareEl.replaceChildren(...paare.map((p) => el('div', { klasse: 'vn-paar' },
    el('div', {}, vorschau(fotos[p.vorher].bild), el('small', { text: T.vnVorher })),
    el('div', {}, vorschau(fotos[p.nachher].bild), el('small', { text: T.vnNachher })),
    el('div', { klasse: 'vn-mitte' }, el('button', { klasse: 'neben2', text: T.vnTauschen, onclick: () => { [p.vorher, p.nachher] = [p.nachher, p.vorher]; zeigen(); } })))));
  bauenKnopf.disabled = !paare.length;
  for (const b of $('.vn-art', v).children) b.setAttribute('aria-pressed', String(b.dataset.art === art));
}

// Beide Fotos mit demselben Ausschnitt, damit die Linie exakt zwischen gleichen Stellen wischt.
function zeichnePaar(ctx, W, H, p, linie, beschriftung) {
  const vb = fotos[p.vorher].bild;
  const nb = fotos[p.nachher].bild;
  const av = deckAusschnitt(vb.width, vb.height, W, H);
  const an = deckAusschnitt(nb.width, nb.height, W, H);
  const x = Math.round(linie * W);
  ctx.drawImage(vb, av.x, av.y, av.w, av.h, 0, 0, W, H);
  if (x > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, x, H);
    ctx.clip();
    ctx.drawImage(nb, an.x, an.y, an.w, an.h, 0, 0, W, H);
    ctx.restore();
  }
  if (x > 0 && x < W) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - Math.max(1, W / 360), 0, Math.max(2, W / 180), H);
  }
  if (beschriftung) {
    ctx.save();
    const px = Math.round(W * 0.038);
    ctx.font = `600 ${px}px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = px * 0.4;
    ctx.textBaseline = 'top';
    const y = Math.round(H * 0.1);
    ctx.globalAlpha = 1 - linie;
    ctx.textAlign = 'right';
    ctx.fillText(T.vnVorher, W - W * 0.05, y);
    ctx.globalAlpha = linie;
    ctx.textAlign = 'left';
    ctx.fillText(T.vnNachher, W * 0.05, y);
    ctx.restore();
  }
}

async function bauen() {
  bauenKnopf.disabled = true;
  ergebnisEl.replaceChildren();
  fortEl.hidden = false;
  const fort = (p) => { fortEl.textContent = f(T.wirdGebaut, { p: Math.round(p * 100) }); };
  fort(0);
  const beschriftung = $('.vn-beschriftung input', v).checked;
  const signatur = await signaturLaden().catch(() => null);
  try {
    let dateien;
    if (art === 'reel') {
      const W = 1080;
      const H = 1920;
      const dauer = paare.length * paarDauer();
      const male = async (ctx, t) => {
        const z = vnZustand(t, paare.length);
        zeichnePaar(ctx, W, H, paare[z.k], z.linie, beschriftung);
        signaturZeichnen(ctx, W, H, signatur, t, dauer);
      };
      const w = aus.hintergrundWaechter();
      try {
        const blob = await aus.videoAusMaler(male, Math.round(dauer * 30), { fortschritt: fort, waechter: w });
        dateien = [new File([blob], 'vorher-nachher.mp4', { type: blob.type })];
        if (ergebnisUrl) URL.revokeObjectURL(ergebnisUrl);
        ergebnisUrl = URL.createObjectURL(blob);
        ergebnisEl.append(el('video', { src: ergebnisUrl, controls: true, playsinline: true, muted: true, loop: true, klasse: 'cl-video' }));
      } finally {
        w.ende();
      }
    } else {
      // Carousel: je Paar ein geteiltes Bild 4:5, links vorher, rechts nachher
      dateien = [];
      for (const [i, p] of paare.entries()) {
        fort(i / paare.length);
        const c = new OffscreenCanvas(1080, 1350);
        const k = c.getContext('2d');
        // Links vorher, rechts nachher: Die Linie gibt links das zweite Bild frei, deshalb getauscht.
        zeichnePaar(k, 1080, 1350, { vorher: p.nachher, nachher: p.vorher }, 0.5, false);
        if (beschriftung) {
          k.save();
          k.font = '600 40px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
          k.fillStyle = '#ffffff';
          k.shadowColor = 'rgba(0,0,0,0.6)';
          k.shadowBlur = 14;
          k.textBaseline = 'bottom';
          k.textAlign = 'left';
          k.fillText(T.vnNachher, 1080 / 2 + 36, 1350 - 40);
          k.textAlign = 'right';
          k.fillText(T.vnVorher, 1080 / 2 - 36, 1350 - 40);
          k.restore();
        }
        signaturZeichnen(k, 1080, 1350, signatur);
        dateien.push(new File([await c.convertToBlob({ type: 'image/jpeg', quality: 0.95 })], `vorher-nachher-${String(i + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' }));
      }
    }
    fortEl.hidden = true;
    ergebnisEl.append(el('button', { klasse: 'haupt', id: 'vn-teilen', text: T.teilen, onclick: () => aus.teilen(dateien, T.vnTitel).catch((err) => { protokolliere('teilen', err); melde(T.teilenFehler, [{ text: T.stattdessenSpeichern, aktion: () => aus.speichern(dateien) }]); }) }));
  } catch (err) {
    if (err instanceof aus.KeinMp4) fortEl.textContent = T.clipsNichtMoeglich;
    else if (err instanceof aus.Abgebrochen) fortEl.textContent = T.abbruchHintergrund;
    else { protokolliere('vorher', err); fortEl.textContent = T.clipsBauFehler; }
  } finally {
    bauenKnopf.disabled = !paare.length;
  }
}

$('#vn-waehlen', v).addEventListener('click', () => eingabe.click());
eingabe.addEventListener('change', () => {
  const l = [...eingabe.files];
  eingabe.value = '';
  if (!l.length) { ladeEnde(); return; }
  einlesen(l).catch((err) => { protokolliere('vorher', err); melde(T.allgemein); ladeEnde(); });
});
for (const b of $('.vn-art', v).children) b.addEventListener('click', () => { art = b.dataset.art; zeigen(); });
bauenKnopf.addEventListener('click', bauen);
$('#vn-zurueck', v).addEventListener('click', () => zeige(zurueck));

registriere('vorher', {
  betreten(daten = {}, alt) {
    if (alt && alt !== 'vorher') zurueck = alt;
    if (daten.art) art = daten.art === 'carousel' ? 'carousel' : 'reel';
    zeigen();
  },
});
