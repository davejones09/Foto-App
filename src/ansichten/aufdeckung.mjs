// Aufdeckung: einfrieren, Rest ausblenden, Faden zeichnen, herauszoomen, Stempel.
import { Z, registriere, zeige, neuLaden, erstlaufAbschliessen } from '../zustand.mjs';
import { T } from '../texte.mjs';
import { $, Urls, frage, melde, warte } from '../ui.mjs';
import { bewertung } from '../kern.mjs';
import { rendere, ctx2d, ladeBitmap, freigeben } from '../bild.mjs';
import { fertigstellen } from '../naehwerk.mjs';
import { STANDARD } from '../geometrie.mjs';
import { HALT_B, HALT_H, UEBER, SCHRITT } from '../masse.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';
import { kameraAus } from './sucher.mjs';

const v = $('#v-aufdeckung');
const buehne = $('.buehne', v);
const streifen = $('.streifen', v);
const sVor = $('.s-vor', v);
const sNeu = $('.s-neu', v);
const sNaht = $('.s-naht', v);
const sNahtImg = $('.s-naht img', v);
const sFaden = $('.s-faden', v);
const sFadenLinie = $('.s-faden polyline', v);
const standbild = $('.standbild', v);
const sRest = $('.s-rest', v);
const sRestImg = $('.s-rest img', v);
const stempel = $('.stempel', v);
const ansage = $('.auf-ansage', v);
const aktionen = $('.aktionen', v);
const naehfehler = $('.naehfehler', v);
const btnWeiter = $('#auf-weiter');
const btnFein = $('#auf-fein');
const btnStreichen = $('#auf-streichen');

const urls = new Urls();
let letzteDaten = null;
let erstlaufEnde = false;
let lauf = 0;

function geometrie() {
  const r = buehne.getBoundingClientRect();
  const H = r.height;
  const fw = H * 0.8;
  return { W: r.width, H, fw, off: (r.width - fw) / 2 };
}

const ladeImg = (img, blob) => {
  img.src = urls.von(blob);
  return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
};

function zeigeStandbild(quelle, w, h, t, g) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const cw = Math.round(g.fw * dpr);
  const ch = Math.round(g.H * dpr);
  const c = rendere(quelle, w, h, t || STANDARD, cw, ch);
  standbild.width = cw;
  standbild.height = ch;
  ctx2d(standbild).drawImage(c, 0, 0);
  freigeben(c);
  standbild.style.left = g.off + 'px';
  standbild.style.width = g.fw + 'px';
  standbild.hidden = false;
}

function zuruecksetzen() {
  for (const a of v.getAnimations ? v.getAnimations({ subtree: true }) : []) a.cancel();
  streifen.hidden = true;
  standbild.hidden = true;
  sRest.hidden = true;
  sRest.style.opacity = '1';
  stempel.hidden = true;
  stempel.classList.remove('zeigen');
  aktionen.hidden = true;
  naehfehler.hidden = true;
  ansage.textContent = '';
  sNaht.style.height = '0px';
  sFaden.style.height = '0px';
  sFaden.style.opacity = '1';
  btnFein.hidden = false;
  btnStreichen.hidden = false;
  btnWeiter.textContent = T.weiter;
  erstlaufEnde = false;
}

const animiere = (e, kf, opt) => {
  const a = e.animate(kf, { fill: 'forwards', ...opt });
  return a.finished.catch(() => {});
};

async function betreten(daten) {
  const meinLauf = ++lauf;
  letzteDaten = daten;
  const { halt, rohQuelle = null, langsam = false, erstlauf = false, fertig = false } = daten;
  zuruecksetzen();
  urls.leeren();
  const i = halt.index;
  const vor = i > 0 ? Z.halte[i - 1] : null;
  const g = geometrie();
  const tempo = langsam ? 2 : 1;
  const blind = Z.strecke.blind && !Z.strecke.ziel;

  if (!fertig) {
    if (rohQuelle) zeigeStandbild(rohQuelle, rohQuelle.width, rohQuelle.height, halt.transform, g);
    if (vor?.bild) {
      sRest.style.left = g.off + 'px';
      sRest.style.width = (g.fw * UEBER) / HALT_B + 'px';
      await ladeImg(sRestImg, vor.bild);
      sRest.hidden = false;
      animiere(sRest, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 * tempo, delay: 80, easing: 'ease-out' });
    }
  }

  let h = halt;
  if (!fertig || !h.bild) {
    try {
      h = await fertigstellen(halt, vor, { rohQuelle });
      Z.halte[i] = h;
      if (rohQuelle) { freigeben(rohQuelle); letzteDaten = { ...letzteDaten, rohQuelle: null }; }
    } catch (err) {
      protokolliere('naehen', err);
      if (meinLauf !== lauf) return;
      if (err instanceof db.SpeicherVoll) melde(T.speicherVoll);
      naehfehler.hidden = false;
      return;
    }
  }
  if (meinLauf !== lauf) return;

  if (!vor) {
    // Erster Halt: kurz stehen lassen, dann erscheint der Rest im Sucher.
    await warte(fertig ? 0 : 300);
    if (meinLauf === lauf) zeige('sucher');
    return;
  }

  // Streifen aufbauen: vorheriger Halt | Naht | neuer Halt, Ursprung = Anfang des neuen Halts.
  const vorSx = vor.index > 0 ? UEBER : 0;
  sVor.style.clipPath = vorSx ? `inset(0 0 0 ${UEBER}px)` : 'none';
  sVor.style.webkitClipPath = sVor.style.clipPath;
  await Promise.all([ladeImg(sVor, vor.bild), ladeImg(sNeu, h.bild), ladeImg(sNahtImg, h.naht)]);
  if (meinLauf !== lauf) return;
  const pfad = h.pfad || [];
  const pkt = [];
  for (let y = 0; y < pfad.length; y += 6) pkt.push(`${pfad[y] + 0.5},${y}`);
  if (pfad.length) pkt.push(`${pfad[pfad.length - 1] + 0.5},${pfad.length}`);
  sFadenLinie.setAttribute('points', pkt.join(' '));

  const k = g.fw / HALT_B;
  const start = `translate(${g.off}px, 0px) scale(${k})`;
  const links = -SCHRITT + vorSx;
  const breite = HALT_B - links;
  const k2 = Math.min((g.W * 0.94) / breite, g.H / HALT_H);
  const ende = `translate(${(g.W - breite * k2) / 2 - links * k2}px, ${(g.H - HALT_H * k2) / 2}px) scale(${k2})`;
  streifen.style.transform = start;
  streifen.hidden = false;
  standbild.hidden = true;

  if (fertig) {
    sNaht.style.height = HALT_H + 'px';
    sFaden.style.opacity = '0';
    if (!blind) streifen.style.transform = ende;
  } else {
    await Promise.all([
      animiere(sNaht, [{ height: '0px' }, { height: HALT_H + 'px' }], { duration: 700 * tempo, easing: 'ease-in-out' }),
      animiere(sFaden, [{ height: '0px' }, { height: HALT_H + 'px' }], { duration: 700 * tempo, easing: 'ease-in-out' }),
    ]);
    if (meinLauf !== lauf) return;
    sNaht.style.height = HALT_H + 'px';
    const fadeFaden = animiere(sFaden, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 * tempo, delay: 150 * tempo });
    if (!blind) {
      await animiere(streifen, [{ transform: start }, { transform: ende }], { duration: 520 * tempo, easing: 'cubic-bezier(.45,0,.2,1)' });
      streifen.style.transform = ende;
    } else await warte(300 * tempo);
    await fadeFaden;
    if (meinLauf !== lauf) return;
  }

  $('.st-wert', stempel).textContent = h.wert == null ? '–' : String(h.wert);
  $('.st-text', stempel).textContent = h.wert == null ? '' : bewertung(h.wert);
  stempel.hidden = false;
  if (!fertig) stempel.classList.add('zeigen');

  if (erstlauf && i === 1) {
    erstlaufEnde = true;
    await warte(500);
    ansage.textContent = T.erstNach;
    ansage.classList.add('neu');
    await warte(3000);
    if (meinLauf !== lauf) return;
    ansage.classList.remove('neu');
    void ansage.offsetWidth;
    ansage.textContent = T.erstStrecke;
    ansage.classList.add('neu');
    btnWeiter.textContent = T.erstKnopf;
    btnFein.hidden = true;
    btnStreichen.hidden = true;
  }
  aktionen.hidden = false;
}

btnWeiter.addEventListener('click', async () => {
  if (erstlaufEnde) await erstlaufAbschliessen();
  zeige('sucher');
});

btnFein.addEventListener('click', () => {
  const h = Z.halte[Z.halte.length - 1];
  if (h) zeige('fein', { halt: h });
});

btnStreichen.addEventListener('click', async () => {
  const r = await frage(T.streichenFrage, [
    { text: T.behalten, wert: false },
    { text: T.streichen, wert: true, haupt: true },
  ]);
  if (!r.wert) return;
  try {
    await db.loescheLetztenHalt(Z.strecke.id);
    await neuLaden();
  } catch (err) {
    protokolliere('streichen', err);
    melde(T.allgemein);
  }
  zeige('sucher');
});

$('#nochmal-naehen').addEventListener('click', async () => {
  if (!letzteDaten) return;
  const frisch = await db.halt(letzteDaten.halt.id).catch(() => null);
  if (!frisch) { zeige('sucher'); return; }
  betreten({ ...letzteDaten, halt: frisch, fertig: false });
});

registriere('aufdeckung', {
  betreten,
  verlassen(nach) {
    lauf++;
    if (nach !== 'sucher') kameraAus();
    for (const a of v.getAnimations ? v.getAnimations({ subtree: true }) : []) a.cancel();
  },
});
