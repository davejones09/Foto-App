// Ausfahrt: Karussell, Fahrt, Gesamtbild, Sicherung und Einspielen.
import { Z, registriere, zeige, neuLaden, ladeStrecke } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, melde } from '../ui.mjs';
import { karussellAnzahl, beitraege, fahrtPlan, dauerText, TEMPI } from '../kennzahlen.mjs';
import * as aus from '../ausgabe.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';

const v = $('#v-ausfahrt');
const liste = $('.af-liste', v);
const erinnerung = $('.af-erinnerung', v);
let tempoIndex = 1;
try { const t = Number(localStorage.getItem('nahtlos-tempo')); if (t >= 0 && t <= 2) tempoIndex = t; } catch {}
let laeuft = false;

const datei = (blob, name) => new File([blob], name, { type: blob.type });

// Ein Ausgabepunkt: Titel antippen baut, danach "Teilen".
function punkt({ titel, info = '', zusatz = null, bauen, nachTeilen }) {
  const kopf = el('button', { klasse: 'af-titel neben2', text: titel });
  const infoEl = el('p', { text: info });
  infoEl.hidden = !info;
  const status = el('p', { klasse: 'af-status' });
  status.hidden = true;
  const balken = el('div', { klasse: 'balken' }, el('i'));
  balken.hidden = true;
  const reihe = el('div', { klasse: 'af-reihe' });
  const karte = el('section', { klasse: 'af-punkt' }, kopf, infoEl, zusatz, balken, status, reihe);
  const fort = (p) => {
    const pr = Math.round(p * 100);
    $('i', balken).style.width = pr + '%';
    status.textContent = f(T.wirdGebaut, { p: pr });
  };
  async function start() {
    if (laeuft) return;
    laeuft = true;
    kopf.disabled = true;
    reihe.replaceChildren();
    balken.hidden = false;
    status.hidden = false;
    fort(0);
    const w = aus.hintergrundWaechter();
    try {
      const gruppen = await bauen(fort, w, { infoEl });
      status.hidden = true;
      balken.hidden = true;
      zeigeTeilen(gruppen);
    } catch (err) {
      balken.hidden = true;
      if (err instanceof aus.Abgebrochen) {
        status.textContent = T.abbruchHintergrund;
        reihe.replaceChildren(el('button', { klasse: 'haupt', text: T.nochmal, onclick: start }));
      } else {
        protokolliere('ausfahrt', err);
        status.textContent = T.allgemein;
        reihe.replaceChildren(el('button', { klasse: 'haupt', text: T.nochmal, onclick: start }));
      }
    } finally {
      w.ende();
      laeuft = false;
      kopf.disabled = false;
    }
  }
  function zeigeTeilen(gruppen) {
    reihe.replaceChildren(...gruppen.map((g, i) => el('button', {
      klasse: 'haupt',
      text: gruppen.length > 1 ? `${T.teilen} ${i + 1}/${gruppen.length}` : T.teilen,
      onclick: () => teile(g, gruppen),
    })));
  }
  async function teile(g, gruppen) {
    try {
      const r = await aus.teilen(g, Z.strecke.name);
      if (r === 'geteilt') nachTeilen?.();
    } catch (err) {
      protokolliere('teilen', err);
      const knoepfe = [{ text: T.stattdessenSpeichern, aktion: () => { aus.speichern(g); nachTeilen?.(); } }];
      melde(T.teilenFehler, knoepfe);
      // Viele Dateien auf einmal schafft iOS womöglich nicht: in Portionen zu je 10 anbieten.
      if (g.length > 10) {
        const portionen = [];
        for (let i = 0; i < g.length; i += 10) portionen.push(g.slice(i, i + 10));
        zeigeTeilen(gruppen.flatMap((x) => (x === g ? portionen : [x])));
      }
    }
  }
  kopf.addEventListener('click', start);
  return karte;
}

function aufbauen() {
  const halte = Z.halte.filter((h) => h.bild);
  const n = halte.length;
  const name = (Z.strecke.name || 'Strecke').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'strecke';
  const seit = Z.halte.length - (Z.strecke.gesichertBei || 0);
  erinnerung.hidden = !(seit > 5);
  erinnerung.textContent = f(T.erinnerung, { n: seit });

  const anzahl = karussellAnzahl(n);
  const teile = beitraege(anzahl);
  const karussell = punkt({
    titel: f(T.karussell, { n: anzahl }),
    info: teile.length > 1 ? f(T.mehrereBeitraege, { t: teile.length }) : '',
    async bauen(fort, w) {
      const bilder = await aus.karussell(Z.strecke, halte, { fortschritt: fort, waechter: w });
      const dateien = bilder.map((b, i) => datei(b, `${name}-${String(i + 1).padStart(2, '0')}.jpg`));
      return teile.map(([a, e]) => dateien.slice(a, e));
    },
  });

  // Fahrt mit Tempowahl
  const tempoTitel = () => f(T.fahrt, { tempo: T.tempi[tempoIndex], dauer: dauerText(fahrtPlan(n, TEMPI[tempoIndex]).dauer) });
  const tempi = el('div', { klasse: 'af-tempi', role: 'group' }, ...T.tempi.map((t, i) => el('button', {
    text: t, 'aria-pressed': String(i === tempoIndex),
    onclick: (e) => {
      tempoIndex = i;
      try { localStorage.setItem('nahtlos-tempo', String(i)); } catch {}
      for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target));
      $('.af-titel', fahrt).textContent = tempoTitel();
    },
  })));
  const fahrt = punkt({
    titel: tempoTitel(),
    zusatz: tempi,
    async bauen(fort, w) {
      const blob = await aus.fahrt(Z.strecke, halte, TEMPI[tempoIndex], { fortschritt: fort, waechter: w });
      return [[datei(blob, `${name}-fahrt.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`)]];
    },
  });

  const plan = aus.gesamtPlan(n);
  const gesamt = punkt({
    titel: f(T.gesamtbild, { b: plan.b, h: plan.h }),
    info: plan.verkleinert ? f(T.verkleinert, { b: plan.b, h: plan.h }) : '',
    async bauen(fort, w) {
      const r = await aus.gesamtbild(halte, { fortschritt: fort, waechter: w });
      return [[datei(r.blob, `${name}-gesamt.jpg`)]];
    },
  });

  const sicherung = punkt({
    titel: T.sicherung,
    async bauen(fort) {
      const blob = await aus.sicherung(Z.strecke, Z.halte, { fortschritt: fort });
      const d = new Date();
      return [[datei(blob, `${name}-sicherung-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.zip`)]];
    },
    async nachTeilen() {
      await db.aendereStrecke(Z.strecke.id, { gesichertBei: Z.halte.length });
      await neuLaden();
      erinnerung.hidden = true;
    },
  });

  const einspielenKnopf = el('section', { klasse: 'af-punkt' }, el('button', { klasse: 'af-titel neben2', text: T.einspielen, onclick: einspielenWaehlen }));
  liste.replaceChildren(karussell, fahrt, gesamt, sicherung, einspielenKnopf);
  if (typeof VideoEncoder === 'undefined' && typeof MediaRecorder === 'undefined') fahrt.hidden = true;
}

// --- Einspielen ---
const eingabe = $('#datei-sicherung');
export function einspielenWaehlen() { eingabe.click(); }
eingabe.addEventListener('change', async () => {
  const d = eingabe.files?.[0];
  eingabe.value = '';
  if (!d) return;
  melde(f(T.wirdGebaut, { p: 0 }), [], 0);
  try {
    const s = await aus.einspielen(d, { fortschritt: (p) => melde(f(T.wirdGebaut, { p: Math.round(p * 100) }), [], 0) });
    melde(`${s.name}`, [], 2500);
    await ladeStrecke(s.id);
    zeige('strecke');
  } catch (err) {
    protokolliere('einspielen', err);
    melde(err instanceof db.SpeicherVoll ? T.speicherVoll : T.allgemein, [], 5000);
  }
});

$('#af-zurueck').addEventListener('click', () => zeige('strecke'));

registriere('ausfahrt', {
  async betreten() {
    await neuLaden();
    aufbauen();
  },
});
