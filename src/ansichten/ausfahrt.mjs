// Exportieren: Carousel, Reel (mit Stil), Gesamtbild, Sicherung und Einspielen.
import { Z, registriere, zeige, neuLaden, ladeStrecke } from '../zustand.mjs';
import { T, f } from '../texte.mjs';
import { $, el, melde } from '../ui.mjs';
import { karussellAnzahl, beitraege, reelPlan, REEL_LAENGEN } from '../kennzahlen.mjs';
import * as aus from '../ausgabe.mjs';
import * as db from '../speicher.mjs';
import { protokolliere } from '../diagnose.mjs';
import { STILE, stileFuer } from '../reelstil.mjs';
import { VORLAGEN, GRUPPEN, istVorlage, eigeneVorlagen } from '../reelvorlagen.mjs';
import { eigeneLaden, vorlagenName } from '../vorlagenwahl.mjs';
import { TEXT_STILE, ueberlagern, signaturLaden } from '../reeltext.mjs';
import { schnittStellen } from '../musik.mjs';
import { mp4TonProben } from '../metadaten.mjs';
import { ladeWarten, ladeEnde } from '../laden.mjs';

const v = $('#v-ausfahrt');
const liste = $('.af-liste', v);
const erinnerung = $('.af-erinnerung', v);
let reelLaenge = 30;
let reelStil = 'band';
let reelMusik = null; // { puffer, bpm, schlaege, treffer, name, start, alle }
let reelAuto = true;
let reelVariante = 0;
let reelGruppe = null;
const reelFotos = { art: 'auto', grund: 'unscharf' }; // wie die Fotos ins Hochformat kommen
const reelTitel = { text: '', stil: 'klar', lage: 'unten' };
try {
  const l = Number(localStorage.getItem('nahtlos-reel-laenge'));
  if (REEL_LAENGEN.includes(l)) reelLaenge = l;
  const st = localStorage.getItem('nahtlos-reel-stil');
  if (STILE.includes(st) || istVorlage(st)) reelStil = st;
  if (localStorage.getItem('nahtlos-reel-auto') === '0') reelAuto = false;
  Object.assign(reelFotos, JSON.parse(localStorage.getItem('nahtlos-reel-fotos') || '{}'));
} catch {}
let vorschauStopp = [];
const vorschauenStoppen = () => { for (const s of vorschauStopp) s(); vorschauStopp = []; };
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
  karte.bauen = bauen;
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
      const gruppen = beitraege(dateien.length).map(([a, e]) => dateien.slice(a, e));
      // Dieselben Bilder als Story, nur verkleinert, nie beschnitten
      const stories = [];
      for (const [i, b] of bilder.slice(0, 20).entries()) stories.push(datei(await aus.alsStory(b, '#000000'), `story-${String(i + 1).padStart(2, '0')}.jpg`));
      return {
        knoepfe: [
          ...gruppen.map((g, i) => ({ text: gruppen.length > 1 ? `${T.teilen} ${i + 1}/${gruppen.length}` : T.teilen, dateien: g, haupt: true })),
          { text: T.karussellStory, dateien: stories },
        ],
      };
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
  const autoAn = () => istVorlage(reelStil) && reelAuto;
  const autoKnopf = el('button', {
    text: T.reelAuto, klasse: 'af-auto',
    onclick: () => {
      reelAuto = true;
      try { localStorage.setItem('nahtlos-reel-auto', '1'); } catch {}
      reelAktualisieren();
    },
  });
  const laengenKnoepfe = REEL_LAENGEN.map((l) => el('button', {
    text: f(T.reelSekunden, { s: l }), 'data-laenge': l,
    onclick: () => {
      reelLaenge = l;
      reelAuto = false;
      try {
        localStorage.setItem('nahtlos-reel-laenge', String(l));
        localStorage.setItem('nahtlos-reel-auto', '0');
      } catch {}
      reelAktualisieren();
    },
  }));
  const laengen = el('div', { klasse: 'af-tempi af-laengen', role: 'group' }, autoKnopf, ...laengenKnoepfe);
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
  // Musik fürs Foto-Reel: Vorlagen schneiden auf die Schläge, Band und ruhige Stile laufen darunter.
  const musikPlanDaten = () => (reelMusik ? {
    stellen: schnittStellen(reelMusik.schlaege, reelMusik.treffer, reelMusik.start, reelMusik.alle),
    takt: (60 / reelMusik.bpm) * reelMusik.alle,
    rest: reelMusik.puffer.duration - reelMusik.start,
  } : null);
  const reelPlanJetzt = () => aus.reelStilPlan(halte, { von: auswahl.von, bis: auswahl.bis, laenge: autoAn() ? null : reelLaenge, stil: reelStil, musik: musikPlanDaten(), variante: reelVariante });
  const musikEingabe = el('input', { type: 'file', accept: 'audio/*,.mp3,.m4a,.wav,.aac', hidden: true });
  const musikName = el('span', { klasse: 'cl-musik-name' });
  const musikStartText = el('span');
  const musikStart = el('input', { type: 'range', min: '0', step: '0.1', value: '0' });
  const musikInfo = el('div', { klasse: 'cl-musik-info af-musik-info' },
    el('div', { klasse: 'cl-musik-kopf' }, musikName, el('button', { klasse: 'neben2', text: T.clipWeg, onclick: () => { reelMusik = null; musikZeigen(); reelAktualisieren(); } })),
    el('label', { klasse: 'cl-regler' }, musikStartText, musikStart));
  const musikKnopf = el('button', { klasse: 'neben2 af-musik-waehlen', text: T.musikWaehlen, onclick: () => musikEingabe.click() });
  // Titel am Anfang des Reels
  const titelFeld = el('input', { type: 'text', klasse: 'co-titel-eingabe af-titel-feld', maxlength: '60', autocomplete: 'off', 'aria-label': T.textTitelFeld, value: reelTitel.text });
  titelFeld.addEventListener('input', () => { reelTitel.text = titelFeld.value; });
  const titelStile = el('div', { klasse: 'cl-stile af-textstil' }, ...Object.keys(TEXT_STILE).map((k) => el('button', {
    klasse: 'cl-stil', 'data-textstil': k, text: T[`textstil_${k}`], 'aria-pressed': String(k === reelTitel.stil),
    onclick: (e) => { reelTitel.stil = k; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b.dataset.textstil === k)); },
  })));
  const textEl = el('div', { klasse: 'af-text' }, el('p', { klasse: 'af-gruppe', text: T.textTitel }), titelFeld, titelStile);
  const musikEl = el('div', { klasse: 'af-musik' }, el('p', { klasse: 'af-gruppe', text: T.musikTitel }), musikKnopf, musikInfo, musikEingabe);
  function musikZeigen() {
    musikInfo.hidden = !reelMusik;
    musikKnopf.hidden = !!reelMusik;
    if (!reelMusik) return;
    musikName.textContent = reelMusik.name;
    musikStart.max = Math.max(0, reelMusik.puffer.duration - 3).toFixed(1);
    musikStart.value = reelMusik.start;
    musikStartText.textContent = f(T.musikStart, { s: `${reelMusik.start.toFixed(1).replace('.', ',')} s` });
  }
  musikEingabe.addEventListener('change', async () => {
    const d = musikEingabe.files[0];
    musikEingabe.value = '';
    if (!d) return;
    ladeWarten(T.musikLaedt);
    try {
      const m = await aus.musikLaden(d);
      reelMusik = { ...m, name: d.name, start: 0, alle: m.bpm >= 100 ? 2 : 1 };
    } catch (err) {
      protokolliere('musik', err);
      melde(T.musikFehler);
    } finally {
      ladeEnde();
    }
    musikZeigen();
    reelAktualisieren();
  });
  musikStart.addEventListener('input', () => { reelMusik.start = Number(musikStart.value); musikZeigen(); reelAktualisieren(); });
  musikZeigen();
  // Stil wählen, jede Kachel mit kurzer Live-Vorschau aus den ersten Fotos.
  const kachel = (st, klasse, text) => {
    const cv = el('canvas', { width: 144, height: 256 });
    return el('button', {
      klasse, 'data-stil': st, 'aria-pressed': String(st === reelStil),
      onclick: () => {
        reelStil = st;
        reelVariante = 0;
        try { localStorage.setItem('nahtlos-reel-stil', st); } catch {}
        for (const b of [...stilKnoepfe, ...vorlagenKnoepfe]) b.setAttribute('aria-pressed', String(b.dataset.stil === st));
        reelAktualisieren();
      },
    }, cv, el('span', { text }));
  };
  const stilKnoepfe = STILE.map((st) => kachel(st, 'af-stil', T[`stil_${st}`]));
  // Vorlagen nach Stimmung: Nur die Kacheln der gewählten Stimmung sind zu sehen und laufen.
  const eigene = eigeneVorlagen().filter((v) => v.id !== 'e-neu');
  const gruppeVon = (id) => (id?.startsWith('e-') ? 'eigene' : VORLAGEN.find((v) => v.id === id)?.gruppe);
  if (!reelGruppe) reelGruppe = gruppeVon(reelStil) || 'energie';
  const vorlagenKnoepfe = [...VORLAGEN.map((v) => v.id), ...eigene.map((v) => v.id)].map((st) => {
    const k = kachel(st, 'af-vorlage', vorlagenName(st));
    k.dataset.gruppe = gruppeVon(st);
    return k;
  });
  let vorlagenMoeglich = true;
  const kachelnFiltern = () => {
    for (const k of vorlagenKnoepfe) k.hidden = !vorlagenMoeglich || k.dataset.gruppe !== reelGruppe;
    for (const g of gruppenEl.children) g.setAttribute('aria-pressed', String(g.dataset.gruppe === reelGruppe));
  };
  const gruppenEl = el('div', { klasse: 'cl-stile af-gruppen', role: 'group', 'aria-label': T.vorlagenStimmung },
    ...[...GRUPPEN, ...(eigene.length ? ['eigene'] : [])].map((g) => el('button', {
      klasse: 'cl-stil', 'data-gruppe': g, text: T[`gruppe_${g}`],
      onclick: () => { reelGruppe = g; kachelnFiltern(); },
    })));
  const wuerfelText = el('small');
  const wuerfelEl = el('div', { klasse: 'vw-variante af-variante' },
    el('button', { klasse: 'neben2 vw-wuerfel', text: T.variante, onclick: () => { reelVariante = 1 + Math.floor(Math.random() * 9998); reelAktualisieren(); } }),
    wuerfelText,
    el('button', { klasse: 'link af-original', text: T.varianteZurueck, onclick: () => { reelVariante = 0; reelAktualisieren(); } }));
  const stileEl = el('div', { klasse: 'af-stile', role: 'group', 'aria-label': T.reelStil }, ...stilKnoepfe);
  const vorlagenEl = el('div', { klasse: 'af-stile af-vorlagen', role: 'group', 'aria-label': T.reelVorlagen }, ...vorlagenKnoepfe);
  const vorschauenStarten = () => {
    vorschauenStoppen();
    for (const b of stilKnoepfe) vorschauStopp.push(aus.stilVorschau($('canvas', b), halte, b.dataset.stil, { fotos: reelFotos }));
    for (const b of vorlagenKnoepfe) vorschauStopp.push(aus.stilVorschau($('canvas', b), halte, b.dataset.stil, { nurSichtbar: true, fotos: reelFotos }));
  };
  vorschauenStarten();
  // Fotos im Reel: einmal für alle, wie im Reel aus Clips. Beim Band und der Naht gibt es nur volle Bilder.
  const fotoKnopf = (feld, wert, text) => el('button', {
    'data-wert': wert, text,
    onclick: () => {
      reelFotos[feld] = wert;
      try { localStorage.setItem('nahtlos-reel-fotos', JSON.stringify(reelFotos)); } catch {}
      fotosZeigen();
      vorschauenStarten();
    },
  });
  const fotoArtEl = el('div', { klasse: 'af-tempi af-fotoart', role: 'group' },
    fotoKnopf('art', 'auto', T.fotosAuto), fotoKnopf('art', 'ganz', T.fotosGanz), fotoKnopf('art', 'fuellen', T.fotosFuellen));
  const fotoGrundEl = el('div', { klasse: 'af-tempi af-fotogrund', role: 'group' },
    fotoKnopf('grund', 'unscharf', T.grundUnscharf), fotoKnopf('grund', 'schwarz', T.grundSchwarz), fotoKnopf('grund', 'weiss', T.grundWeiss));
  const fotoInfo = el('p', { klasse: 'rt-info af-fotos-info' });
  const fotosEl = el('div', { klasse: 'af-fotos' }, el('p', { klasse: 'af-gruppe', text: T.fotosTitel }), fotoArtEl, fotoGrundEl, fotoInfo);
  function fotosZeigen() {
    fotosEl.hidden = reelStil === 'band' || reelStil === 'naht';
    for (const b of fotoArtEl.children) b.setAttribute('aria-pressed', String(b.dataset.wert === reelFotos.art));
    for (const b of fotoGrundEl.children) b.setAttribute('aria-pressed', String(b.dataset.wert === reelFotos.grund));
    const ganz = halte.some((h) => aus.fotoGanz(h, reelFotos, reelStil === 'band' ? 'sanft' : reelStil));
    fotoGrundEl.hidden = !ganz;
    fotoInfo.textContent = { auto: T.fotosInfoAutoAlle, ganz: T.fotosInfoGanz, fuellen: T.fotosInfoFuellen }[reelFotos.art];
  }
  fotosZeigen();
  const zusatz = el('div', { klasse: 'af-reel' },
    el('div', { klasse: 'af-links' },
      el('button', { klasse: 'link af-clips', text: T.clipsTitel, onclick: () => zeige('clips') }),
      el('button', { klasse: 'link af-tipps', text: T.tippTitel, onclick: () => zeige('reeltipps') })),
    el('p', { klasse: 'af-gruppe', text: T.reelVorlagen }),
    gruppenEl,
    vorlagenEl,
    wuerfelEl,
    el('p', { klasse: 'af-gruppe', text: T.reelStil }),
    stileEl,
    fotosEl,
    laengen,
    el('div', { klasse: 'af-abschnitt' }, el('span', { text: T.reelVon }), vonSel, el('span', { text: T.reelBis }), bisSel),
    tempoEl, vorschlagEl, musikEl, textEl);
  const reelKarte = punkt({
    titel: f(T.reel, { laenge: reelLaenge }),
    zusatz,
    async bauen(fort, w) {
      const p = reelPlanJetzt();
      let ton = null;
      if (reelMusik) {
        try { ton = await aus.tonKodieren(reelMusik.puffer, reelMusik.start, p.dauer); } catch (err) { protokolliere('musik', err); }
      }
      const signatur = await signaturLaden().catch(() => null);
      const ueber = (male) => ueberlagern(male, { texte: { titel: { ...reelTitel } }, signatur, W: 1080, H: 1920, dauer: p.dauer });
      const blob = await aus.reel(Z.strecke, halte, p, { fortschritt: (x) => fort(x * 0.97), waechter: w, ton, ueber, fotos: reelFotos });
      const mitTon = ton ? mp4TonProben(await blob.arrayBuffer()) === ton.pakete.length : false;
      if (ton && !mitTon) protokolliere('musik', 'Tonspur fehlt im Foto-Reel');
      const titelBlob = await aus.titelbild(halte, p, { fotos: reelFotos });
      fort(1);
      const video = datei(blob, 'reel.mp4');
      const titel = datei(titelBlob, 'reel-cover.jpg');
      return {
        knoepfe: [{ text: T.teilen, dateien: [video], haupt: true }, { text: T.inFotos, dateien: [video, titel] }],
        hinweis: reelMusik ? (mitTon ? `${T.reelHinweis} ${T.musikRechte}` : `${T.reelHinweis} ${T.musikKeinTon}`) : T.reelHinweis,
      };
    },
  });
  function reelAktualisieren() {
    const p = reelPlanJetzt();
    $('.af-titel', reelKarte).textContent = f(T.reel, { laenge: p.laenge });
    autoKnopf.hidden = !istVorlage(reelStil);
    wuerfelEl.hidden = !istVorlage(reelStil);
    wuerfelText.textContent = reelVariante ? f(T.varianteNr, { n: reelVariante }) : T.varianteOriginal;
    $('.af-original', wuerfelEl).hidden = !reelVariante;
    autoKnopf.setAttribute('aria-pressed', String(autoAn()));
    for (const b of laengenKnoepfe) b.setAttribute('aria-pressed', String(!autoAn() && Number(b.dataset.laenge) === reelLaenge));
    const n = p.bis - p.von + 1;
    if (p.vorlage) {
      tempoEl.textContent = p.runden > 1 ? f(T.reelRunden, { n, r: p.runden }) : f(T.reelVorlageInfo, { n, s: p.laenge });
      vorschlagEl.hidden = !p.zuKurz;
      if (p.vorschlag) vorschlagText.textContent = f(T.reelZuKurz, { laenge: p.laenge, von: p.vorschlag.von + 1, bis: p.vorschlag.bis + 1 });
    } else if (p.stil === 'band') {
      tempoEl.textContent = f(T.reelTempo, { n, v: Math.round(p.tempo) });
      vorschlagEl.hidden = !p.zuSchnell;
      if (p.vorschlag) vorschlagText.textContent = f(T.reelZuSchnell, { laenge: p.laenge, von: p.vorschlag.von + 1, bis: p.vorschlag.bis + 1 });
    } else {
      tempoEl.textContent = f(T.reelStand, { n, s: p.stand.toFixed(1).replace('.', ',') });
      vorschlagEl.hidden = !p.zuKurz;
      if (p.vorschlag) vorschlagText.textContent = f(T.reelZuKurz, { laenge: p.laenge, von: p.vorschlag.von + 1, bis: p.vorschlag.bis + 1 });
    }
    reelKarte.dataset.stil = p.stil;
    fotosZeigen();
  }
  kachelnFiltern();
  reelAktualisieren();
  aus.reelWeg().then((w) => {
    // Ein Stil, der im Ausweichweg (Echtzeit) nicht sauber geht, wird ausgeblendet.
    const moeglich = stileFuer(w);
    for (const b of stilKnoepfe) b.hidden = !moeglich.includes(b.dataset.stil);
    // Die Vorlagen brauchen Bild für Bild genaues Rechnen, das geht nur mit WebCodecs.
    vorlagenMoeglich = w?.art === 'webcodecs';
    kachelnFiltern();
    vorlagenEl.hidden = !vorlagenMoeglich;
    gruppenEl.hidden = !vorlagenMoeglich;
    gruppenEl.previousElementSibling.hidden = !vorlagenMoeglich;
    if (w && !(moeglich.includes(reelStil) || (vorlagenMoeglich && istVorlage(reelStil)))) stilKnoepfe[0].click();
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

  // Alles auf einmal: Carousel, Reel und Gesamtbild nacheinander bauen, dann in einem Rutsch sichern.
  const dateienAus = (r) => (Array.isArray(r) ? r.flat() : r.knoepfe.filter((k) => k.haupt).flatMap((k) => k.dateien));
  const alles = punkt({
    titel: T.allesTitel,
    info: T.allesInfo,
    async bauen(fort, w, extra) {
      const teile = [karussell, reelKarte, gesamt];
      const dateien = [];
      for (const [i, k] of teile.entries()) {
        const r = await k.bauen((p) => fort((i + p) / teile.length), w, extra);
        dateien.push(...dateienAus(r));
      }
      return [dateien];
    },
  });
  alles.classList.add('af-alles');

  // Ein Reel-Projekt zeigt das Reel zuerst. Beide Ausgaben gehen immer aus demselben Projekt.
  const erste = Z.strecke.art === 'reel' ? [reelKarte, karussell] : [karussell, reelKarte];
  liste.replaceChildren(...erste, gesamt, alles, sicherung);
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
    if (s.collage) {
      melde(`${s.collage.name}`, [], 2500);
      zeige('collage', { id: s.collage.id });
      return;
    }
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
    await eigeneLaden().catch(() => {});
    try { const st = localStorage.getItem('nahtlos-reel-stil'); if (st?.startsWith('e-') && istVorlage(st)) reelStil = st; } catch {}
    aufbauen();
  },
  verlassen() { vorschauenStoppen(); },
});
