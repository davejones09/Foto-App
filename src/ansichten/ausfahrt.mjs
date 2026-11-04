// Ausfahrt: Karussell, Reel, Gesamtbild, Sicherung und Einspielen.
import { Z, registriere, zeige, neuLaden, ladeStrecke } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, melde } from '../ui.mjs';
import { karussellAnzahl, beitraege, reelPlan, REEL_LAENGEN } from '../kennzahlen.mjs';
import * as aus from '../ausgabe.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';

const v = $('#v-ausfahrt');
const liste = $('.af-liste', v);
const erinnerung = $('.af-erinnerung', v);
let reelLaenge = 30;
try {
  const l = Number(localStorage.getItem('nahtlos-reel-laenge'));
  if (REEL_LAENGEN.includes(l)) reelLaenge = l;
} catch {}
let laeuft = false;

const datei = (blob, name) => new File([blob], name, { type: blob.type });

// Ein Ausgabepunkt: Titel antippen baut, danach "Teilen".
// bauen() liefert Dateigruppen oder { knoepfe: [{ text, dateien, haupt }], hinweis }.
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
      const ergebnis = await bauen(fort, w, { infoEl });
      status.hidden = true;
      balken.hidden = true;
      if (Array.isArray(ergebnis)) zeigeTeilen(ergebnis);
      else zeigeKnoepfe(ergebnis);
    } catch (err) {
      balken.hidden = true;
      if (err instanceof aus.KeinMp4) {
        status.textContent = T.mp4Fehlt;
      } else if (err instanceof aus.Abgebrochen) {
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
  function zeigeKnoepfe({ knoepfe, hinweis }) {
    reihe.replaceChildren(...knoepfe.map((k) => el('button', {
      klasse: k.haupt ? 'haupt' : 'neben2',
      text: k.text,
      onclick: () => teile(k.dateien, null),
    })));
    if (hinweis) { status.textContent = hinweis; status.hidden = false; status.classList.add('af-hinweis'); }
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
      if (gruppen && g.length > 10) {
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
  const name = (Z.strecke.name || 'projekt').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'projekt';
  const seit = Z.halte.length - (Z.strecke.gesichertBei || 0);
  erinnerung.hidden = !(seit > 5);
  erinnerung.textContent = f(T.erinnerung, { n: seit });

  // Carousel: Der Plan (genau aufgehende Slides, Versatz gegen Grenzen im Motiv) rechnet im Hintergrund.
  // Die Vorschau zeigt jede Slide genau so, wie sie exportiert wird. Liegt trotzdem eine Grenze im Motiv,
  // zeigt ein Hinweis die Stelle.
  const anzahl = karussellAnzahl(halte);
  const teile = beitraege(anzahl);
  const grenzHinweis = el('div', { klasse: 'af-grenze' }, el('p', { text: T.karussellGrenze }), el('canvas', { klasse: 'af-grenze-bild' }));
  grenzHinweis.hidden = true;
  const slides = el('div', { klasse: 'af-slides', 'aria-label': T.karussellVorschau });
  const zusatzKarussell = el('div', { klasse: 'af-reel' }, slides, grenzHinweis);
  const karussellPlan = aus.karussellPlanen(halte).catch((err) => { protokolliere('karussell', err); return null; });
  const karussell = punkt({
    titel: f(T.karussell, { n: anzahl }),
    info: teile.length > 1 ? f(T.mehrereBeitraege, { t: teile.length }) : '',
    zusatz: zusatzKarussell,
    async bauen(fort, w) {
      const plan = await karussellPlan;
      const bilder = await aus.karussell(Z.strecke, halte, { fortschritt: fort, waechter: w, plan });
      const dateien = bilder.map((b, i) => datei(b, `carousel-${String(i + 1).padStart(2, '0')}.jpg`));
      return beitraege(dateien.length).map(([a, e]) => dateien.slice(a, e));
    },
  });
  karussellPlan.then(async (plan) => {
    if (!plan) return;
    $('.af-titel', karussell).textContent = f(T.karussell, { n: plan.anzahl });
    const t = beitraege(plan.anzahl).length;
    const info = $('p', karussell);
    info.textContent = t > 1 ? f(T.mehrereBeitraege, { t }) : '';
    info.hidden = t <= 1;
    const leinwaende = Array.from({ length: plan.anzahl }, () => Object.assign(document.createElement('canvas'), { width: 128, height: 160 }));
    slides.replaceChildren(...leinwaende);
    slides.dataset.anzahl = String(plan.anzahl);
    await aus.karussellVorschau(leinwaende, halte, plan).catch((err) => protokolliere('karussell', err));
    slides.dataset.fertig = '1';
    if (plan.treffer.length) {
      grenzHinweis.hidden = false;
      await aus.grenzVorschau($('canvas', grenzHinweis), halte, plan.treffer[0].x).catch((err) => protokolliere('karussell', err));
    }
  });

  // Reel: Länge wählen, Abschnitt wählen, das Tempo ergibt sich.
  const auswahl = { von: 0, bis: Math.max(0, n - 1) };
  const haltName = (i) => (halte[i].name ? `${i + 1} · ${halte[i].name}` : f(T.unbenannt, { n: i + 1 }));
  const optionen = (sel, wert) => sel.replaceChildren(...halte.map((_, i) => el('option', { value: String(i), text: haltName(i), selected: i === wert })));
  const vonSel = el('select', { klasse: 'af-wahl', 'aria-label': T.reelVon });
  const bisSel = el('select', { klasse: 'af-wahl', 'aria-label': T.reelBis });
  optionen(vonSel, auswahl.von);
  optionen(bisSel, auswahl.bis);
  const laengen = el('div', { klasse: 'af-tempi af-laengen', role: 'group' }, ...REEL_LAENGEN.map((l) => el('button', {
    text: f(T.reelSekunden, { s: l }), 'aria-pressed': String(l === reelLaenge),
    onclick: (e) => {
      reelLaenge = l;
      try { localStorage.setItem('nahtlos-reel-laenge', String(l)); } catch {}
      for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target));
      reelAktualisieren();
    },
  })));
  const tempoEl = el('p', { klasse: 'af-tempo' });
  const vorschlagText = el('span');
  const vorschlagEl = el('p', { klasse: 'af-vorschlag' }, vorschlagText, ' ',
    el('button', { klasse: 'neben2 af-vorschlag-ok', text: T.uebernehmen, onclick: () => {
      const p = reelPlanJetzt();
      if (!p.vorschlag) return;
      auswahl.von = p.vorschlag.von;
      auswahl.bis = p.vorschlag.bis;
      vonSel.value = String(auswahl.von);
      bisSel.value = String(auswahl.bis);
      reelAktualisieren();
    } }));
  vorschlagEl.hidden = true;
  vonSel.addEventListener('change', () => {
    auswahl.von = Number(vonSel.value);
    if (auswahl.bis < auswahl.von) { auswahl.bis = auswahl.von; bisSel.value = String(auswahl.bis); }
    reelAktualisieren();
  });
  bisSel.addEventListener('change', () => {
    auswahl.bis = Number(bisSel.value);
    if (auswahl.von > auswahl.bis) { auswahl.von = auswahl.bis; vonSel.value = String(auswahl.von); }
    reelAktualisieren();
  });
  const reelPlanJetzt = () => reelPlan(halte, { von: auswahl.von, bis: auswahl.bis, laenge: reelLaenge });
  const zusatz = el('div', { klasse: 'af-reel' },
    laengen,
    el('div', { klasse: 'af-abschnitt' }, el('span', { text: T.reelVon }), vonSel, el('span', { text: T.reelBis }), bisSel),
    tempoEl, vorschlagEl);
  const reelKarte = punkt({
    titel: f(T.reel, { laenge: reelLaenge }),
    zusatz,
    async bauen(fort, w) {
      const p = reelPlanJetzt();
      const blob = await aus.reel(Z.strecke, halte, p, { fortschritt: (x) => fort(x * 0.97), waechter: w });
      const titelBlob = await aus.titelbild(halte, p);
      fort(1);
      const video = datei(blob, 'reel.mp4');
      const titel = datei(titelBlob, 'reel-cover.jpg');
      return {
        knoepfe: [{ text: T.teilen, dateien: [video], haupt: true }, { text: T.inFotos, dateien: [video, titel] }],
        hinweis: T.reelHinweis,
      };
    },
  });
  function reelAktualisieren() {
    const p = reelPlanJetzt();
    $('.af-titel', reelKarte).textContent = f(T.reel, { laenge: p.laenge });
    tempoEl.textContent = f(T.reelTempo, { n: p.bis - p.von + 1, v: Math.round(p.tempo) });
    vorschlagEl.hidden = !p.zuSchnell;
    if (p.vorschlag) vorschlagText.textContent = f(T.reelZuSchnell, { laenge: p.laenge, von: p.vorschlag.von + 1, bis: p.vorschlag.bis + 1 });
  }
  reelAktualisieren();
  aus.reelWeg().then((w) => {
    if (w) return;
    $('.af-titel', reelKarte).disabled = true;
    tempoEl.textContent = T.mp4Fehlt;
  });

  const plan = aus.gesamtPlan(halte);
  const gesamt = punkt({
    titel: f(T.gesamtbild, { b: plan.b, h: plan.h }),
    info: plan.verkleinert ? f(T.verkleinert, { b: plan.b, h: plan.h }) : '',
    async bauen(fort, w) {
      const r = await aus.gesamtbild(halte, { fortschritt: fort, waechter: w });
      return [[datei(r.blob, 'gesamtbild.jpg')]];
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

  // Ein Reel-Projekt zeigt das Reel zuerst. Beide Ausgaben gehen immer aus demselben Projekt.
  const erste = Z.strecke.art === 'reel' ? [reelKarte, karussell] : [karussell, reelKarte];
  liste.replaceChildren(...erste, gesamt, sicherung);
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
