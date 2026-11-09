// Reel aus Clips: Videoclips und Fotos in einem Reel. Zeitplan als reine Rechnung (in Node getestet),
// gezeichnet wird Bild für Bild: Jedes Bild springt per Suche an die richtige Stelle im Clip, deshalb
// ist das Ergebnis genau, auch wenn das Rechnen länger dauert als das Video. Ohne Ton.

import { FPS, RAHMEN } from './reelstil.mjs';
import { VORLAGEN, UEBERGAENGE, TAKT, vorlagenPlan, vorlagenZustand, bewegung, uebergangLage, maskePfad, vorlageAus } from './reelvorlagen.mjs';
import { serienEintrag } from './diagnose.mjs';

export const GANZ = 'c-ganz';
export const MEDIEN_MAX = 100;
export const FOTO_STAND_MIN = 0.8;
export const REEL_MAX = 90;
export const FOTO_STAND = 2.5;

// Die eigene Länge eines Mediums: Foto 2,5 s oder wie eingestellt, Clip von Start bis Ende.
export function eigeneLaenge(m) {
  if (m.typ === 'foto') return m.laenge ?? FOTO_STAND;
  return Math.max(0.1, (m.ende ?? m.dauer) - (m.start || 0));
}

function planAus(staende, tr, arten, grund) {
  const beginn = [];
  let t = 0;
  staende.forEach((s, k) => {
    beginn.push(t);
    t += s + (tr[k] || 0);
  });
  const dauer = Math.round(t * FPS) / FPS;
  return {
    vorlage: grund.stil, auto: true, runden: 1, takt: 1, zuKurz: false, gekappt: false, ...grund,
    laenge: Math.round(dauer), dauer, bilder: Math.round(dauer * FPS), staende, beginn, uebergaenge: tr, arten,
    stand: staende.reduce((x, y) => x + y, 0) / Math.max(1, staende.length),
  };
}

// Ganze Clips: harte Schnitte, jeder Clip läuft in seiner eigenen Länge. Bei 90 Sekunden ist Schluss.
// Passt es nicht, rücken zuerst die Fotos ohne eigene Länge zusammen (bis 0,8 s), damit alle drankommen.
export function fotoStandFuer(medien) {
  const frei = medien.filter((m) => m.typ === 'foto' && m.laenge == null);
  if (!frei.length) return FOTO_STAND;
  const rest = medien.filter((m) => !frei.includes(m)).reduce((x, m) => x + eigeneLaenge(m), 0);
  const platz = (REEL_MAX - rest) / frei.length;
  return Math.max(FOTO_STAND_MIN, Math.min(FOTO_STAND, Math.floor(platz * 10) / 10));
}

function ganzPlan(medien) {
  const fs = fotoStandFuer(medien);
  const laenge = (m) => (m.typ === 'foto' && m.laenge == null ? fs : eigeneLaenge(m));
  const staende = [];
  let t = 0;
  for (const m of medien) {
    if (t >= REEL_MAX) break;
    const s = Math.min(laenge(m), REEL_MAX - t);
    staende.push(s);
    t += s;
  }
  const gesamt = medien.reduce((x, m) => x + laenge(m), 0);
  return planAus(staende, staende.slice(1).map(() => 0), staende.slice(1).map(() => 'schnitt'), {
    stil: GANZ, bewegung: 'keine', n: medien.length, maxFotos: medien.length, gekappt: gesamt > REEL_MAX + 1e-9, fotoStand: fs,
  });
}

// Vorlage, in der einzelne Medien eine eigene Länge haben: Der Takt der Vorlage gilt nur für die übrigen.
function eigenPlan(medien, stil, variante = 0) {
  const v = vorlageAus(stil, variante);
  const arten = medien.slice(1).map((_, k) => v.arten[k % v.arten.length]);
  // Ein Fahrzeug-Wechsel schneidet genau an der Spitze, also am eingestellten Ende des Clips:
  // Der hereinkommende Übergang und die erste Hälfte des hinausgehenden zählen mit.
  const staende = medien.map((m, k) => {
    if (!m.eigen) return v.schlaege[k % v.schlaege.length] * TAKT;
    if (m.wechsel?.art !== 'fahrzeug') return eigeneLaenge(m);
    const rein = k > 0 ? UEBERGAENGE[arten[k - 1]] : 0;
    const raus = k < medien.length - 1 ? UEBERGAENGE[arten[k]] / 2 : 0;
    return Math.max(0.3, eigeneLaenge(m) - rein - raus);
  });
  return planAus(staende, arten.map((x) => UEBERGAENGE[x]), arten, {
    stil, bewegung: v.bewegung, n: medien.length, maxFotos: medien.length, takt: TAKT, eigeneLaengen: true,
  });
}

// Schnitte auf die Musik. Ein Schnitt ist die Mitte des Übergangs und liegt auf einem Schlag aus dem Raster.
// Die Vorlage gibt den Rhythmus in Schlägen vor. Eigene Längen und ganze Clips gehen auf den nächsten Schlag,
// ganze Clips eher davor, damit der Clip nicht vor dem Schnitt zu Ende ist.
// Der Übergang landet auf dem Treffer: Das neue Bild steht in dem Moment, in dem der Schlag kommt.
// Beim Suchen zählt die Stärke: Lieber ein kräftiger Akzent etwas daneben als ein schwacher genau am Wunsch.
const MUSIK_UEBERGANG_MAX = 0.24;

// fest: Schnitte, die der Nutzer selbst gesetzt hat, als Zeit, zu der das neue Bild steht (je Schnitt k).
export function musikPlan(medien, { stil = GANZ, raster, laenge = null, musikRest = REEL_MAX, takt = null, fest = null, variante = 0 }) {
  const stellen = raster.map((r) => (typeof r === 'number' ? { t: r, s: 1 } : r));
  const v = vorlageAus(stil, variante) || null;
  const n = medien.length;
  const ende = Math.min(laenge ?? REEL_MAX, musikRest, REEL_MAX);
  const abstand = takt ?? (stellen.length > 1 ? (stellen[stellen.length - 1].t - stellen[0].t) / (stellen.length - 1) : 0.5);
  const spielraum = Math.max(0.4, abstand);
  const schnitte = [];
  const arten = [];
  const tr = [];
  let vorher = 0;
  let trVorher = 0;
  let schritt = 0;
  let gekappt = false;
  for (let k = 0; ; k++) {
    const m = medien[k % n];
    if (laenge == null && k >= n - 1) break;
    const art = v ? v.arten[k % v.arten.length] : 'schnitt';
    const dauerTr = Math.min(UEBERGAENGE[art], MUSIK_UEBERGANG_MAX);
    // Ein Clip steht nie länger, als er lang ist: Sonst springt er sichtbar an seinen Anfang zurück.
    // Der hereinkommende Übergang zeigt schon den Clip, deshalb zählt er mit.
    const rest = m.typ === 'clip' ? eigeneLaenge(m) - trVorher : Infinity;
    const vorlageWunsch = v ? v.schlaege[k % v.schlaege.length] * abstand : Infinity;
    const eigen = !v || m.eigen || vorlageWunsch > rest;
    const wunsch = !v || m.eigen ? (m.typ === 'clip' ? rest : eigeneLaenge(m)) : Math.min(vorlageWunsch, rest);
    const ziel = vorher + wunsch;
    const frueh = vorher + dauerTr + 0.2;
    while (schritt < stellen.length && stellen[schritt].t < frueh) schritt++;
    let best = null;
    let bestWert = -1;
    let naechste = null;
    let davor = null;
    for (let i = schritt; i < stellen.length; i++) {
      const { t, s } = stellen[i];
      if (t > ende - 0.3) break;
      const d = Math.abs(t - ziel);
      if (naechste == null || d < Math.abs(naechste - ziel)) naechste = t;
      if (t <= ziel + 1e-6) davor = t;
      if (d <= spielraum && !(eigen && t > ziel + 1e-6)) {
        const wert = s * (1 - (0.6 * d) / spielraum);
        if (wert > bestWert) { bestWert = wert; best = t; }
      }
      if (t > ziel + spielraum) break;
    }
    // Ein ganzer Clip darf nicht über sein Ende hinaus stehen: dann lieber der Schlag davor.
    if (best == null) best = eigen && davor != null ? davor : naechste;
    if (fest?.[k] != null) {
      const grenze = m.typ === 'clip' ? vorher + rest : Infinity;
      best = Math.min(Math.max(fest[k], frueh), ende - 0.3, grenze);
      if (best < frueh) best = null;
    }
    if (best == null) { gekappt = laenge == null ? k < n - 1 : false; break; }
    schnitte.push(best - dauerTr / 2);
    arten.push(art);
    tr.push(dauerTr);
    vorher = best;
    trVorher = dauerTr;
  }
  // Das letzte Medium läuft bis zum Ende: eigene Länge beziehungsweise Vorlage, auf den Schlag gelegt.
  const letzteM = medien[schnitte.length % n];
  const v2 = v ? v.schlaege[schnitte.length % v.schlaege.length] * abstand : 0;
  const letzterRest = letzteM.typ === 'clip' ? eigeneLaenge(letzteM) - trVorher : Infinity;
  let schluss = laenge != null ? ende : vorher + (v && !letzteM.eigen ? Math.min(Math.max(v2, abstand * 2), letzterRest) : (letzteM.typ === 'clip' ? letzterRest : eigeneLaenge(letzteM)));
  schluss = Math.min(schluss, ende);
  // Auf den letzten Schlag davor enden, damit auch das Ende im Takt liegt und der Clip nicht zurückspringt.
  if (laenge == null) {
    let davor = null;
    for (const { t: r } of stellen) {
      if (r > schluss + 1e-6) break;
      if (r > vorher + 0.2) davor = r;
    }
    if (davor != null) schluss = davor;
  }
  const beginn = [];
  const staende = [];
  for (let k = 0; k <= schnitte.length; k++) {
    const b = k === 0 ? 0 : schnitte[k - 1] + tr[k - 1] / 2;
    const e = k === schnitte.length ? schluss : schnitte[k] - tr[k] / 2;
    beginn.push(b);
    staende.push(Math.max(0.05, e - b));
  }
  const dauer = Math.round(beginn[beginn.length - 1] + staende[staende.length - 1]) === 0 ? 0 : beginn[beginn.length - 1] + staende[staende.length - 1];
  const d = Math.round(dauer * FPS) / FPS;
  return {
    stil, vorlage: stil, auto: laenge == null, bewegung: v ? v.bewegung : 'keine', n, runden: Math.ceil((schnitte.length + 1) / n), takt: abstand,
    laenge: Math.round(d), dauer: d, bilder: Math.round(d * FPS), staende, beginn, uebergaenge: tr, arten, schnitte,
    stand: staende.reduce((x, y) => x + y, 0) / staende.length,
    zuKurz: false, maxFotos: n, gekappt, musik: true,
  };
}

export function clipPlan(medien, { laenge = null, stil = GANZ, raster = null, musikRest = REEL_MAX, takt = null, tempo = 'normal', fest = null, variante = 0 } = {}) {
  let plan;
  if (raster && raster.length && medien.length) plan = musikPlan(medien, { stil, raster, laenge, musikRest, takt, fest, variante });
  else if (stil === GANZ) plan = ganzPlan(medien);
  else if (medien.some((m) => m.eigen)) plan = eigenPlan(medien, stil, variante);
  else plan = vorlagenPlan(medien.length, { laenge, vorlage: stil, variante });
  // Wie viel des Clips frühere Runden schon gezeigt haben: Die nächste Runde läuft dort weiter.
  const versatz = [];
  const benutzt = new Array(medien.length).fill(0);
  // vorlauf: Ein Clip läuft schon während des Übergangs, in dem er hereinkommt. Danach läuft er dort weiter.
  const vorlauf = [];
  plan.staende.forEach((s, k) => {
    const i = k % medien.length;
    versatz.push(benutzt[i]);
    vorlauf.push(k > 0 ? plan.uebergaenge[k - 1] || 0 : 0);
    benutzt[i] += vorlauf[k] + s + (plan.uebergaenge[k] || 0);
  });
  return { ...plan, versatz, vorlauf, medienZahl: medien.length, tempo };
}

// Stelle im Clip für einen Abschnitt des Plans, seit = Zeit seit seinem Beginn. Läuft am Ende von vorn.
export function clipZeit(medium, versatz, seit) {
  const start = medium.start || 0;
  const rest = Math.max(0.05, (medium.ende ?? medium.dauer) - start);
  return start + (versatz + seit) % rest;
}

// --- Tempo: Rampen und Freeze. Jede Form verbraucht genau so viel Clip wie normales Tempo,
// deshalb ändert sich am Plan nichts und kein Clip läuft über sein Ende. ---
export const TEMPI = ['normal', 'rampe', 'freeze'];
const RAMPE = { an: 0.5, ab: 0.45, start: 0.35 }; // langsam herein, schnell hinaus
const FREEZE = { steht: 0.3, aufholen: 0.6 };

// Zeit im Clip seit seinem Auftauchen (u) nach der Tempoform. U: wie lange er insgesamt zu sehen ist.
// Gibt { t, rate } zurück: verbrauchte Clipzeit und momentane Geschwindigkeit.
export function tempoForm(art, u, U, { anfang = true, schluss = true } = {}) {
  if (art === 'rampe') {
    const k = Math.min(1, U / (RAMPE.an + RAMPE.ab + 0.2));
    const r1 = anfang ? RAMPE.an * k : 0;
    const r2 = schluss ? RAMPE.ab * k : 0;
    const a0 = RAMPE.start;
    // Endgeschwindigkeit so, dass die Rampe am Ende wieder hereinholt, was der Anfang langsamer war.
    const a1 = r2 > 0 ? 1 + (r1 * (1 - a0)) / r2 : 1;
    const v0 = r1 > 0 ? a0 : 1;
    if (r1 > 0 && u <= r1) { const g = v0 + ((1 - v0) * u) / r1; return { t: (u * (v0 + g)) / 2, rate: g }; }
    const t1 = r1 > 0 ? (r1 * (v0 + 1)) / 2 : 0;
    const b = U - r2;
    if (u <= b) return { t: t1 + (u - r1), rate: 1 };
    const tb = t1 + (b - r1);
    const x = Math.min(u, U) - b;
    const g = 1 + ((a1 - 1) * x) / r2;
    return { t: tb + (x * (1 + g)) / 2 + Math.max(0, u - U), rate: g };
  }
  if (art === 'freeze' && anfang) {
    const k = Math.min(1, U / (FREEZE.steht + FREEZE.aufholen + 0.2));
    const f = FREEZE.steht * k;
    const a = FREEZE.aufholen * k;
    const schnell = (f + a) / a;
    if (u <= f) return { t: 0, rate: 0 };
    if (u <= f + a) return { t: (u - f) * schnell, rate: schnell };
    return { t: u, rate: 1 };
  }
  return { t: u, rate: 1 };
}

// Wie lange Abschnitt k insgesamt zu sehen ist: Übergang herein, Stand, Übergang hinaus.
export const sichtbar = (plan, k) => (plan.vorlauf?.[k] || 0) + plan.staende[k] + (plan.uebergaenge[k] || 0);

// Stellen in den Clips zur Reel-Zeit t: zeitI für den laufenden Clip, zeitJ für den, der gerade hereinkommt.
// rateI, rateJ: momentanes Tempo, für Vorschau und Originalton.
export function clipStellen(plan, medien, z) {
  const tempo = plan.tempo || 'normal';
  const m = medien[z.i];
  const k = z.schritt;
  const letzter = k === plan.staende.length - 1;
  const fi = tempoForm(tempo, (plan.vorlauf[k] || 0) + z.seit, sichtbar(plan, k), { anfang: k > 0, schluss: !letzter });
  const zeitI = m.typ === 'foto' ? 0 : clipZeit(m, plan.versatz[k], fi.t);
  if (z.j == null) return { zeitI, zeitJ: 0, rateI: fi.rate, rateJ: 1 };
  const n = medien[z.j];
  const seitJ = Math.max(0, z.seit - plan.staende[k]);
  const fj = tempoForm(tempo, seitJ, sichtbar(plan, k + 1), { anfang: true, schluss: k + 1 < plan.staende.length - 1 });
  return { zeitI, zeitJ: n.typ === 'foto' ? 0 : clipZeit(n, plan.versatz[k + 1], fj.t), rateI: fi.rate, rateJ: fj.rate };
}

// --- Vordergrund bleibt: Wechsel mit Fahrzeug oder stehender Figur ---
// Am Schnitt aus Medium A bleibt dessen Vordergrund (ein Fahrzeug, eine Person) über der neuen Szene liegen.
// Beim Fahrzeug läuft A weiter, bis es aus dem Bild ist; die stehende Figur ist das eingefrorene letzte Bild.
// Das Ausschneiden erledigt die Erkennung (erkennung.mjs), hier steht nur die Rechnung.
export const WECHSEL = ['fahrzeug', 'stehen'];
const STEHEN_AUS = 1.1;
const AUSBLENDEN = 0.35;

// Bester Moment für den Wechsel aus Proben { t, a } (a = Anteil des Fahrzeugs am Bild). Die Spitze ist
// das Bild, in dem das Fahrzeug am meisten bedeckt; aus: wie lange es danach noch im Bild bleibt.
export function spitzeFinden(proben, { mind = 0.15, zeitEnde = Infinity } = {}) {
  let best = null;
  for (const p of proben) if (!best || p.a > best.a + 1e-9) best = p;
  if (!best || best.a < mind) return null;
  let weg = null;
  for (const p of proben) if (p.t > best.t && p.a < Math.max(0.03, best.a * 0.12)) { weg = p.t; break; }
  const bis = Math.min(weg ?? best.t + 1.2, zeitEnde - 0.05);
  const aus = Math.max(0.4, Math.min(1.5, bis - best.t + 0.1));
  return { t: best.t, anteil: best.a, aus: Math.round(aus * 100) / 100 };
}

// Liegt zur Reel-Zeit t ein Vordergrund über dem Bild? Dann { k, a, art, seit, alpha, s }, sonst null.
// k: Schnitt, a: Index des Mediums, dessen Vordergrund bleibt, seit: Zeit seit dem Schnitt (Mitte des Übergangs).
export function vordergrundLage(plan, medien, t) {
  const z = vorlagenZustand(plan, Math.max(0, Math.min(t, plan.dauer)));
  let k;
  let seit;
  if (z.j != null && z.p >= 0.5) { k = z.schritt; seit = z.seit - plan.staende[k] - plan.uebergaenge[k] / 2; }
  else if (z.schritt > 0) { k = z.schritt - 1; seit = (plan.uebergaenge[k] || 0) / 2 + z.seit; }
  else return null;
  const a = k % medien.length;
  const w = medien[a]?.wechsel;
  if (!w || !WECHSEL.includes(w.art)) return null;
  // Endet vor dem nächsten Übergang, damit nie drei Medien gleichzeitig offen sein müssen.
  const platz = (plan.uebergaenge[k] || 0) / 2 + plan.staende[k + 1] - 0.02;
  const aus = Math.min(w.aus ?? STEHEN_AUS, platz);
  if (seit < 0 || seit >= aus) return null;
  const blende = Math.min(AUSBLENDEN, aus / 2);
  const alpha = seit > aus - blende ? Math.max(0, (aus - seit) / blende) : 1;
  return { k, a, art: w.art, seit, alpha, s: w.art === 'stehen' ? 1 + (0.04 * seit) / aus : 1 };
}

// Stelle im Clip von A für den Vordergrund: am Schnitt eingefroren oder weiterlaufend. Ohne Umlauf an den Anfang.
export function vordergrundZeit(plan, medien, lage) {
  const m = medien[lage.a];
  if (m.typ === 'foto') return 0;
  const k = lage.k;
  const u = (plan.vorlauf?.[k] || 0) + plan.staende[k] + (plan.uebergaenge[k] || 0) / 2;
  const f = tempoForm(plan.tempo || 'normal', u, sichtbar(plan, k), { anfang: k > 0, schluss: true });
  const start = m.start || 0;
  const rest = Math.max(0.05, (m.ende ?? m.dauer) - start);
  const roh = (plan.versatz?.[k] || 0) + f.t;
  const schnitt = start + (roh <= rest + 1e-6 ? Math.min(roh, rest) : roh % rest);
  const zeit = lage.art === 'fahrzeug' ? schnitt + lage.seit : schnitt;
  return Math.max(0, Math.min(zeit, (m.dauer || zeit + 1) - 0.05));
}

// --- Fotos im Reel: einmal für alle festlegen statt jedes einzeln ---
// art: auto (Hochformat füllt, Quer und Quadrat ganz), fuellen (Ausschnitt nach dem Motiv), ganz (ganzes Foto).
// grund: Hintergrund beim ganzen Foto, unscharf (das Foto selbst, stark weichgezeichnet), schwarz oder weiss.
// Der Rahmen merkt sich mit auto, dass er nicht von Hand gesetzt ist; nur solche ändert die Wahl.
export const FOTO_ARTEN = ['auto', 'ganz', 'fuellen'];
export const FOTO_GRUENDE = ['unscharf', 'schwarz', 'weiss'];
export function fotoRahmen(m, art = 'auto', grund = 'unscharf') {
  const quer = m.pw && m.ph ? m.pw / m.ph > 0.9 : false;
  const wahl = art === 'auto' ? (quer ? 'ganz' : 'fuellen') : art;
  if (wahl === 'ganz') return { x: 0.5, y: 0.5, zoom: 1, modus: 'ganz', grund, auto: true };
  return { x: m.motiv?.x ?? 0.5, y: m.motiv?.y ?? 0.5, zoom: 1, modus: 'fuellen', auto: true };
}

// Passt Quelle (qw × qh) in den Rahmen: mittiger Ausschnitt, der ihn füllt.
export function deckAusschnitt(qw, qh, rw = RAHMEN.w, rh = RAHMEN.h) {
  const quer = qw / qh > rw / rh;
  const w = quer ? (qh * rw) / rh : qw;
  const h = quer ? qh : (qw * rh) / rw;
  return { x: (qw - w) / 2, y: (qh - h) / 2, w, h };
}

// Ausschnitt mit den Einstellungen des Nutzers: Zoom ab 1 und Lage im freien Raum (0 bis 1, 0,5 = Mitte).
export function rahmenAusschnitt(qw, qh, rahmen) {
  const a = deckAusschnitt(qw, qh);
  const z = Math.max(1, rahmen?.zoom ?? 1);
  const w = a.w / z;
  const h = a.h / z;
  return { x: (qw - w) * (rahmen?.x ?? 0.5), y: (qh - h) * (rahmen?.y ?? 0.5), w, h };
}

let unscharf = null;
// Zeichnet die Quelle um den Nullpunkt des Kontexts. „Ganz zeigen“: Das Medium passt komplett hinein,
// dahinter liegt eine stark vergrößerte, dadurch unscharfe Fassung. Das Original bleibt unberührt.
export function zeichneQuelle(ctx, bild, qw, qh, W, H, rahmen, { s = 1, qx = 0, qy = 0, gedreht = false } = {}) {
  if (rahmen?.modus === 'ganz') {
    if (rahmen.grund === 'schwarz' || rahmen.grund === 'weiss') {
      ctx.fillStyle = rahmen.grund === 'weiss' ? '#fff' : '#000';
      ctx.fillRect((-W * s) / 2, (-H * s) / 2, W * s, H * s);
      const f = Math.min(W / qw, H / qh) * s;
      ctx.drawImage(bild, 0, 0, qw, qh, (-qw * f) / 2, (-qh * f) / 2, qw * f, qh * f);
      return;
    }
    if (!unscharf) {
      unscharf = document.createElement('canvas');
      unscharf.width = 18;
      unscharf.height = 32;
    }
    const a = deckAusschnitt(qw, qh);
    const u = unscharf.getContext('2d');
    u.drawImage(bild, a.x, a.y, a.w, a.h, 0, 0, 18, 32);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(unscharf, (-W * s) / 2, (-H * s) / 2, W * s, H * s);
    const f = Math.min(W / qw, H / qh) * s;
    ctx.drawImage(bild, 0, 0, qw, qh, (-qw * f) / 2, (-qh * f) / 2, qw * f, qh * f);
    return;
  }
  const a = rahmenAusschnitt(qw, qh, rahmen);
  if (s >= 1 && !gedreht) {
    const sw = a.w / s;
    const sh = a.h / s;
    const rx = (a.w - sw) / 2;
    const ry = (a.h - sh) / 2;
    const ox = Math.max(-rx, Math.min(rx, (qx * sw) / RAHMEN.w));
    const oy = Math.max(-ry, Math.min(ry, (qy * sh) / RAHMEN.h));
    ctx.drawImage(bild, a.x + rx + ox, a.y + ry + oy, sw, sh, -W / 2, -H / 2, W, H);
  } else {
    ctx.drawImage(bild, a.x, a.y, a.w, a.h, (-W * s) / 2, (-H * s) / 2, W * s, H * s);
  }
}

const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Lädt einen Clip in ein verstecktes Video-Element und liefert ihn bereit zum Suchen.
export async function ladeClip(url) {
  const v = document.createElement('video');
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.setAttribute('muted', '');
  v.preload = 'auto';
  v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.append(v);
  const bereit = new Promise((ok, nein) => {
    v.addEventListener('loadeddata', ok, { once: true });
    v.addEventListener('error', () => nein(new Error('Clip lässt sich nicht öffnen')), { once: true });
    setTimeout(() => nein(new Error('Clip lädt nicht')), 20000);
  });
  v.src = url;
  v.load();
  try {
    await bereit;
    // iOS dekodiert manche Clips erst, nachdem sie einmal gelaufen sind.
    try { await v.play(); v.pause(); } catch {}
    if (!Number.isFinite(v.duration)) {
      await new Promise((ok) => {
        v.addEventListener('durationchange', ok, { once: true });
        v.currentTime = 1e7;
        setTimeout(ok, 3000);
      });
      v.currentTime = 0;
    }
    return v;
  } catch (err) {
    v.remove();
    throw err;
  }
}

export function clipWeg(v) {
  v.pause();
  v.removeAttribute('src');
  v.load();
  v.remove();
}

// Bewegung auf Clips: Harte Zoom-Stöße und Pulse sehen auf Fotos lebhaft aus, auf laufendem Video aber wie
// Ruckeln. Deshalb sanft und durchgehend ab dem Moment, in dem der Clip hereinkommt.
export function clipBewegung(art, seitEintritt, takt, lauf) {
  if (art === 'wackel' || art === 'drift') return bewegung(art, seitEintritt, takt, lauf);
  if (art === 'keine') return { s: 1, qx: 0, qy: 0 };
  return { s: 1 + 0.05 * Math.exp(-seitEintritt / 0.4), qx: 0, qy: 0 };
}

// Liegt die Zeit noch im Bild, das gerade zu sehen ist? Dann bringt Suchen nichts, etwa bei 24-fps-Clips.
export function gleichesBild(bildZeit, bildAbstand, ziel) {
  return bildZeit != null && bildAbstand > 0 && ziel >= bildZeit - 0.001 && ziel < bildZeit + bildAbstand - 0.001;
}

// Wer genau auf die Grenze zwischen zwei Bildern springt, landet je nach Rundung mal davor, mal dahinter:
// Dann erscheint ein Bild doppelt und das nächste fehlt. Das Ziel liegt deshalb knapp hinter der Grenze.
export const HINTER_GRENZE = 1 / 240;
export const sprungZiel = (t, dauer) => Math.max(0, Math.min(t + HINTER_GRENZE, (Number.isFinite(dauer) ? dauer : t + 1) - 0.04));

// Dem Bildabstand erst trauen, wenn genug Bilder gemessen sind. Sonst kann ein einziger großer Sprung am Anfang
// dafür sorgen, dass dauerhaft jedes zweite Bild übersprungen wird.
export const ABSTAND_PROBEN = 8;

const WARTE_MS = 400;
const FEHLT_MAX = 5;
const stand = new WeakMap();
const standVon = (v) => {
  if (!stand.has(v)) stand.set(v, { bildZeit: null, abstand: 0, proben: 0, fehlt: 0, gesucht: 0, ohneBild: 0, ms: 0 });
  return stand.get(v);
};
export const suchStatistik = (v) => standVon(v);

// Springt an die Zeit t und wartet, bis das neue Bild wirklich dekodiert ist. Große Clips brauchen dafür
// oft länger, und ein zu frühes Zeichnen wiederholt das alte Bild: Das sieht im Reel wie Ruckeln aus.
export async function suche(v, t) {
  const ziel = sprungZiel(t, v.duration);
  const st = standVon(v);
  if (v.readyState >= 2 && !v.seeking && st.proben >= ABSTAND_PROBEN && gleichesBild(st.bildZeit, st.abstand, ziel)) return;
  if (Math.abs(v.currentTime - ziel) < 0.001 && !v.seeking && v.readyState >= 2) return;
  const t0 = performance.now();
  st.gesucht++;
  const seeked = new Promise((ok) => v.addEventListener('seeked', ok, { once: true }));
  const nutzeBild = v.requestVideoFrameCallback && st.fehlt < FEHLT_MAX;
  const bild = nutzeBild ? new Promise((ok) => v.requestVideoFrameCallback((_, m) => ok(m))) : null;
  v.currentTime = ziel;
  const auszeit = () => new Promise((ok) => setTimeout(() => ok('auszeit'), 4000));
  await Promise.race([seeked, auszeit()]);
  if (!nutzeBild) {
    // Ohne Rückmeldung vom Browser: kurz warten, damit das Bild sicher da ist.
    await warte(80);
  } else {
    const m = await Promise.race([bild, warte(WARTE_MS).then(() => null)]);
    if (m) {
      st.fehlt = 0;
      const neu = m.mediaTime ?? v.currentTime;
      const d = st.bildZeit == null ? 0 : Math.abs(neu - st.bildZeit);
      if (d > 0.001) {
        st.abstand = st.abstand ? Math.min(st.abstand, d) : d;
        st.proben++;
      }
      st.bildZeit = neu;
    } else {
      st.fehlt++;
      st.ohneBild++;
    }
  }
  st.ms += performance.now() - t0;
}

// Zeichnet das Reel. medien: [{ typ, url, datei, dauer, start }].
// Clip in der Vorschau laufen lassen statt Bild für Bild zu suchen. Gesprungen wird nur, wenn er davonläuft.
export function liveFolgen(v, zeit, rate = 1) {
  const ziel = Math.max(0, Math.min(zeit, (v.duration || 0) - 0.05));
  if (rate < 0.07) { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - ziel) > 0.06 && !v.seeking) v.currentTime = ziel; return; }
  const r = Math.min(4, rate);
  if (Math.abs(v.playbackRate - r) > 0.02) v.playbackRate = r;
  if (v.paused) {
    if (Math.abs(v.currentTime - ziel) > 0.06) v.currentTime = ziel;
    v.play().catch(() => {});
  } else if (!v.seeking && Math.abs(v.currentTime - ziel) > 0.3) {
    v.currentTime = ziel;
  }
}

// live: für die Vorschau. Clips laufen in Echtzeit mit, statt für jedes Bild exakt gesucht zu werden.
// maske: async (Leinwand, art) => Leinwand beliebiger Größe (wird auf W × H gezogen), deckend wo der Vordergrund ist (aus erkennung.mjs).
export function clipMaler(medien, plan, { W = RAHMEN.w, H = RAHMEN.h, live = false, maske = null } = {}) {
  const kx = W / RAHMEN.w;
  const clips = new Map(); // beim Bauen höchstens zwei gleichzeitig offen, in der Vorschau drei
  const offen = live ? 3 : 2;
  const genutzt = new Set();
  const berichte = (i, v) => {
    const st = suchStatistik(v);
    if (!st.gesucht) return;
    serienEintrag(`Clip ${i + 1}: ${v.videoWidth}x${v.videoHeight}, ${v.duration.toFixed(1)} s, Bildabstand ${Math.round(st.abstand * 1000)} ms, ${st.gesucht} Sprünge, ${st.ohneBild} ohne neues Bild, je ${Math.round(st.ms / st.gesucht)} ms`);
  };
  const fotos = new Map();
  async function quelle(i) {
    const m = medien[i];
    if (m.typ === 'foto') {
      if (!fotos.has(i)) {
        for (const [k, b] of fotos) { if (fotos.size < 3) break; b.close?.(); fotos.delete(k); }
        fotos.set(i, await createImageBitmap(m.datei));
      }
      return { b: fotos.get(i), w: fotos.get(i).width, h: fotos.get(i).height };
    }
    if (!clips.has(i)) {
      for (const [k, v] of clips) { if (clips.size < offen) break; if (!live) berichte(k, v); clipWeg(v); clips.delete(k); }
      clips.set(i, await ladeClip(m.url));
    }
    const v = clips.get(i);
    return { b: v, w: v.videoWidth, h: v.videoHeight, video: true };
  }
  async function zeichne(ctx, i, zeitImClip, rate, { s = 1, dx = 0, dy = 0, rot = 0, qx = 0, qy = 0, alpha = 1 }, exakt = false) {
    const q = await quelle(i);
    if (q.video && laufend && !exakt) { genutzt.add(i); liveFolgen(q.b, zeitImClip, rate); } else if (q.video) {
      if (!q.b.paused) q.b.pause();
      await suche(q.b, zeitImClip);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2 + dx * kx, H / 2 + dy * kx);
    if (rot) ctx.rotate(rot);
    zeichneQuelle(ctx, q.b, q.w, q.h, W, H, medien[i].rahmen, { s, qx, qy, gedreht: !!rot });
    ctx.restore();
  }
  // Steht die Vorschau, wird genau gesucht wie beim Bauen. Nur beim Abspielen laufen die Clips mit.
  let laufend = live;
  async function male(ctx, t, { steht = false } = {}) {
    laufend = live && !steht;
    genutzt.clear();
    try { await maleBild(ctx, t); } finally {
      if (live) for (const [k, v] of clips) if (!genutzt.has(k) && !v.paused) v.pause();
    }
  }
  async function maleBild(ctx, t) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const z = vorlagenZustand(plan, t);
    const { zeitI, zeitJ, rateI, rateJ } = clipStellen(plan, medien, z);
    const b = medien[z.i].typ === 'foto'
      ? bewegung(plan.bewegung, z.seit, plan.takt, z.lauf)
      : clipBewegung(plan.bewegung, plan.vorlauf[z.schritt] + z.seit, plan.takt, z.lauf);
    if (z.j == null) { await zeichne(ctx, z.i, zeitI, rateI, b); await vordergrund(ctx, t); return; }
    // Wechsel mit Vordergrund: harter Schnitt in der Mitte, das Bleibende legt sich darüber.
    const mitWechsel = maske && WECHSEL.includes(medien[z.i].wechsel?.art);
    const u = mitWechsel ? (z.p < 0.5 ? { a: {} } : { b: {} }) : uebergangLage(z.art, z.p);
    const bn = medien[z.j].typ === 'foto'
      ? bewegung(plan.bewegung, 0, plan.takt, 0)
      : clipBewegung(plan.bewegung, Math.max(0, z.seit - plan.staende[z.schritt]), plan.takt, 0);
    const mit = (basis, teil) => ({ ...basis, ...teil, s: basis.s * (teil.faktor ?? 1) });
    if (u.a) await zeichne(ctx, z.i, zeitI, rateI, mit(b, u.a));
    if (u.maske && u.b) {
      ctx.save();
      ctx.beginPath();
      maskePfad(ctx, u.maske, z.p, W, H);
      ctx.clip();
      await zeichne(ctx, z.j, zeitJ, rateJ, bn);
      ctx.restore();
    } else if (u.b) {
      await zeichne(ctx, z.j, zeitJ, rateJ, mit(bn, u.b));
    }
    if (u.blitz) {
      ctx.fillStyle = `rgba(${u.farbe ?? '255, 255, 255'}, ${u.blitz})`;
      ctx.fillRect(0, 0, W, H);
    }
    await vordergrund(ctx, t);
  }

  // --- Vordergrund, der über der neuen Szene bleibt ---
  let ebene = null;
  let klein = null;
  const stehend = new Map(); // Schnitt -> ausgeschnittene Figur (einmal gerechnet)
  const zuletzt = new Map(); // Schnitt -> letzte Maske des Fahrzeugs (für die Vorschau)
  const offenRechnet = new Set();
  const leinwand = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
  async function ausschneiden(lage, zeit, exakt) {
    ebene ??= leinwand(W, H);
    klein ??= leinwand(288, 512);
    const e = ebene.getContext('2d');
    e.globalCompositeOperation = 'source-over';
    e.clearRect(0, 0, W, H);
    await zeichne(e, lage.a, zeit, lage.art === 'fahrzeug' ? 1 : 0, { s: 1 }, exakt);
    klein.getContext('2d').drawImage(ebene, 0, 0, 288, 512);
    return maske(klein, lage.art);
  }
  function auflegen(ctx, bild, m, lage) {
    const e = ebene.getContext('2d');
    if (bild !== ebene) { e.globalCompositeOperation = 'source-over'; e.clearRect(0, 0, W, H); e.drawImage(bild, 0, 0); }
    e.globalCompositeOperation = 'destination-in';
    e.drawImage(m, 0, 0, W, H);
    e.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = lage.alpha;
    ctx.translate(W / 2, H / 2);
    ctx.scale(lage.s, lage.s);
    ctx.drawImage(ebene, -W / 2, -H / 2);
    ctx.restore();
  }
  async function vordergrund(ctx, t) {
    if (!maske) return;
    const lage = vordergrundLage(plan, medien, t);
    if (!lage) return;
    const zeit = vordergrundZeit(plan, medien, lage);
    try {
      if (lage.art === 'stehen') {
        // Einmal genau ausschneiden und als fertiges Bild merken.
        if (!stehend.has(lage.k)) {
          if (laufend && offenRechnet.has(lage.k)) return;
          const arbeit = (async () => {
            const m = await ausschneiden(lage, zeit, true);
            if (!m) return null;
            const fertig = leinwand(W, H);
            const f = fertig.getContext('2d');
            f.drawImage(ebene, 0, 0);
            f.globalCompositeOperation = 'destination-in';
            f.drawImage(m, 0, 0, W, H);
            return fertig;
          })();
          if (laufend) { offenRechnet.add(lage.k); arbeit.then((b) => stehend.set(lage.k, b)).catch(() => stehend.set(lage.k, null)); return; }
          stehend.set(lage.k, await arbeit);
        }
        const b = stehend.get(lage.k);
        if (!b) return;
        ebene ??= leinwand(W, H);
        const e = ebene.getContext('2d');
        e.clearRect(0, 0, W, H);
        e.drawImage(b, 0, 0);
        ctx.save();
        ctx.globalAlpha = lage.alpha;
        ctx.translate(W / 2, H / 2);
        ctx.scale(lage.s, lage.s);
        ctx.drawImage(ebene, -W / 2, -H / 2);
        ctx.restore();
        return;
      }
      // Fahrzeug: Beim Bauen jedes Bild genau, in der Vorschau die jeweils letzte fertige Maske.
      if (!laufend) {
        const m = await ausschneiden(lage, zeit, false);
        if (m) auflegen(ctx, ebene, m, lage);
        return;
      }
      ebene ??= leinwand(W, H);
      klein ??= leinwand(288, 512);
      const e = ebene.getContext('2d');
      e.globalCompositeOperation = 'source-over';
      e.clearRect(0, 0, W, H);
      await zeichne(e, lage.a, zeit, 1, { s: 1 });
      if (!offenRechnet.has(lage.k)) {
        offenRechnet.add(lage.k);
        const k2 = klein.getContext('2d');
        k2.drawImage(ebene, 0, 0, 288, 512);
        maske(klein, lage.art).then((m) => { if (m) zuletzt.set(lage.k, m); }).catch(() => {}).finally(() => offenRechnet.delete(lage.k));
      }
      const m = zuletzt.get(lage.k);
      if (m) auflegen(ctx, ebene, m, lage);
    } catch (err) {
      serienEintrag(`Vordergrund ${lage.k + 1}: ${err?.message || err}`);
    }
  }
  function ende() {
    for (const [k, v] of clips) { if (!live) berichte(k, v); clipWeg(v); }
    clips.clear();
    for (const b of fotos.values()) b.close?.();
    fotos.clear();
  }
  function pause() { for (const v of clips.values()) v.pause(); }
  return { male, ende, pause };
}

// Bester Ausschnitt eines Fotos für 9:16 nach der Motivkarte: Lage im freien Raum (0 bis 1).
// raster: { w, h, d } mit Gewichten. Ohne Spiel oder ohne Karte die Mitte.
export function motivLage(pw, ph, raster, W = RAHMEN.w, H = RAHMEN.h) {
  const a = deckAusschnitt(pw, ph, W, H);
  const quer = a.w < pw - 1;
  const spiel = quer ? pw - a.w : ph - a.h;
  if (!raster || spiel <= 1) return { x: 0.5, y: 0.5 };
  let best = { wert: -1, u: 0.5 };
  for (let k = 0; k <= 40; k++) {
    const u = k / 40;
    const v0 = u * spiel;
    const v1 = v0 + (quer ? a.w : a.h);
    let wert = 0;
    for (let ry = 0; ry < raster.h; ry++) for (let rx = 0; rx < raster.w; rx++) {
      const c = quer ? ((rx + 0.5) / raster.w) * pw : ((ry + 0.5) / raster.h) * ph;
      if (c >= v0 && c <= v1) wert += raster.d[ry * raster.w + rx];
    }
    wert -= 1e-6 * Math.abs(u - 0.5);
    if (wert > best.wert) best = { wert, u };
  }
  return quer ? { x: best.u, y: 0.5 } : { x: 0.5, y: best.u };
}
