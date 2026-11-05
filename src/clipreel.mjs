// Reel aus Clips: Videoclips und Fotos in einem Reel. Zeitplan als reine Rechnung (in Node getestet),
// gezeichnet wird Bild für Bild: Jedes Bild springt per Suche an die richtige Stelle im Clip, deshalb
// ist das Ergebnis genau, auch wenn das Rechnen länger dauert als das Video. Ohne Ton.

import { FPS, RAHMEN } from './reelstil.mjs';
import { VORLAGEN, UEBERGAENGE, TAKT, vorlagenPlan, vorlagenZustand, bewegung, uebergangLage, kreisMaske, streifenMaske, kachelMaske } from './reelvorlagen.mjs';
import { serienEintrag } from './diagnose.mjs';

export const GANZ = 'c-ganz';
export const MEDIEN_MAX = 30;
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
function ganzPlan(medien) {
  const staende = [];
  let t = 0;
  for (const m of medien) {
    if (t >= REEL_MAX) break;
    const s = Math.min(eigeneLaenge(m), REEL_MAX - t);
    staende.push(s);
    t += s;
  }
  const gesamt = medien.reduce((x, m) => x + eigeneLaenge(m), 0);
  return planAus(staende, staende.slice(1).map(() => 0), staende.slice(1).map(() => 'schnitt'), {
    stil: GANZ, bewegung: 'keine', n: medien.length, maxFotos: medien.length, gekappt: gesamt > REEL_MAX + 1e-9,
  });
}

// Vorlage, in der einzelne Medien eine eigene Länge haben: Der Takt der Vorlage gilt nur für die übrigen.
function eigenPlan(medien, stil) {
  const v = VORLAGEN.find((x) => x.id === stil);
  const staende = medien.map((m, k) => (m.eigen ? eigeneLaenge(m) : v.schlaege[k % v.schlaege.length] * TAKT));
  const arten = staende.slice(1).map((_, k) => v.arten[k % v.arten.length]);
  return planAus(staende, arten.map((x) => UEBERGAENGE[x]), arten, {
    stil, bewegung: v.bewegung, n: medien.length, maxFotos: medien.length, takt: TAKT, eigeneLaengen: true,
  });
}

// Schnitte auf die Musik. Ein Schnitt ist die Mitte des Übergangs und liegt auf einem Schlag aus dem Raster.
// Die Vorlage gibt den Rhythmus in Schlägen vor. Eigene Längen und ganze Clips gehen auf den nächsten Schlag,
// ganze Clips eher davor, damit der Clip nicht vor dem Schnitt zu Ende ist.
export function musikPlan(medien, { stil = GANZ, raster, laenge = null, musikRest = REEL_MAX }) {
  const v = VORLAGEN.find((x) => x.id === stil) || null;
  const n = medien.length;
  const ende = Math.min(laenge ?? REEL_MAX, musikRest, REEL_MAX);
  const abstand = raster.length > 1 ? (raster[raster.length - 1] - raster[0]) / (raster.length - 1) : 0.5;
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
    const dauerTr = UEBERGAENGE[art];
    // Ein Clip steht nie länger, als er lang ist: Sonst springt er sichtbar an seinen Anfang zurück.
    const rest = m.typ === 'clip' ? eigeneLaenge(m) : Infinity;
    const vorlageWunsch = v ? v.schlaege[k % v.schlaege.length] * abstand : Infinity;
    const eigen = !v || m.eigen || vorlageWunsch > rest;
    const wunsch = !v || m.eigen ? eigeneLaenge(m) : Math.min(vorlageWunsch, rest);
    const ziel = vorher + wunsch;
    const frueh = vorher + trVorher / 2 + dauerTr / 2 + 0.2;
    let best = null;
    while (schritt < raster.length && raster[schritt] < frueh) schritt++;
    for (let i = schritt; i < raster.length; i++) {
      const r = raster[i];
      if (r > ende - 0.3) break;
      if (best == null || Math.abs(r - ziel) < Math.abs(best - ziel)) best = r;
      if (r > ziel) break;
    }
    // Ein ganzer Clip darf nicht über sein Ende hinaus stehen: dann lieber der Schlag davor.
    if (best != null && eigen && best > ziel + 1e-6) {
      let davor = null;
      for (let i = schritt; i < raster.length && raster[i] <= ziel; i++) davor = raster[i];
      if (davor != null) best = davor;
    }
    if (best == null) { gekappt = laenge == null ? k < n - 1 : false; break; }
    schnitte.push(best);
    arten.push(art);
    tr.push(dauerTr);
    vorher = best;
    trVorher = dauerTr;
  }
  // Das letzte Medium läuft bis zum Ende: eigene Länge beziehungsweise Vorlage, auf den Schlag gelegt.
  const letzteM = medien[schnitte.length % n];
  const v2 = v ? v.schlaege[schnitte.length % v.schlaege.length] * abstand : 0;
  const letzterRest = letzteM.typ === 'clip' ? eigeneLaenge(letzteM) : Infinity;
  let schluss = laenge != null ? ende : vorher + (v && !letzteM.eigen ? Math.min(Math.max(v2, abstand * 2), letzterRest) : eigeneLaenge(letzteM));
  schluss = Math.min(schluss, ende);
  // Auf den letzten Schlag davor enden, damit auch das Ende im Takt liegt und der Clip nicht zurückspringt.
  if (laenge == null) {
    let davor = null;
    for (const r of raster) {
      if (r > schluss + 1e-6) break;
      if (r > vorher + trVorher / 2 + 0.2) davor = r;
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

export function clipPlan(medien, { laenge = null, stil = GANZ, raster = null, musikRest = REEL_MAX } = {}) {
  let plan;
  if (raster && raster.length && medien.length) plan = musikPlan(medien, { stil, raster, laenge, musikRest });
  else if (stil === GANZ) plan = ganzPlan(medien);
  else if (medien.some((m) => m.eigen)) plan = eigenPlan(medien, stil);
  else plan = vorlagenPlan(medien.length, { laenge, vorlage: stil });
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
  return { ...plan, versatz, vorlauf, medienZahl: medien.length };
}

// Stelle im Clip für einen Abschnitt des Plans, seit = Zeit seit seinem Beginn. Läuft am Ende von vorn.
export function clipZeit(medium, versatz, seit) {
  const start = medium.start || 0;
  const rest = Math.max(0.05, (medium.ende ?? medium.dauer) - start);
  return start + (versatz + seit) % rest;
}

// Stellen in den Clips zur Reel-Zeit t: zeitI für den laufenden Clip, zeitJ für den, der gerade hereinkommt.
export function clipStellen(plan, medien, z) {
  const m = medien[z.i];
  const zeitI = m.typ === 'foto' ? 0 : clipZeit(m, plan.versatz[z.schritt] + plan.vorlauf[z.schritt], z.seit);
  if (z.j == null) return { zeitI, zeitJ: 0 };
  const n = medien[z.j];
  const seitJ = Math.max(0, z.seit - plan.staende[z.schritt]);
  return { zeitI, zeitJ: n.typ === 'foto' ? 0 : clipZeit(n, plan.versatz[z.schritt + 1], seitJ) };
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
export function clipMaler(medien, plan, { W = RAHMEN.w, H = RAHMEN.h } = {}) {
  const kx = W / RAHMEN.w;
  const clips = new Map(); // höchstens zwei gleichzeitig offen
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
      for (const [k, v] of clips) { if (clips.size < 2) break; berichte(k, v); clipWeg(v); clips.delete(k); }
      clips.set(i, await ladeClip(m.url));
    }
    const v = clips.get(i);
    return { b: v, w: v.videoWidth, h: v.videoHeight, video: true };
  }
  async function zeichne(ctx, i, zeitImClip, { s = 1, dx = 0, dy = 0, rot = 0, qx = 0, qy = 0, alpha = 1 }) {
    const q = await quelle(i);
    if (q.video) await suche(q.b, zeitImClip);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2 + dx * kx, H / 2 + dy * kx);
    if (rot) ctx.rotate(rot);
    zeichneQuelle(ctx, q.b, q.w, q.h, W, H, medien[i].rahmen, { s, qx, qy, gedreht: !!rot });
    ctx.restore();
  }
  async function male(ctx, t) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const z = vorlagenZustand(plan, t);
    const { zeitI, zeitJ } = clipStellen(plan, medien, z);
    const b = medien[z.i].typ === 'foto'
      ? bewegung(plan.bewegung, z.seit, plan.takt, z.lauf)
      : clipBewegung(plan.bewegung, plan.vorlauf[z.schritt] + z.seit, plan.takt, z.lauf);
    if (z.j == null) { await zeichne(ctx, z.i, zeitI, b); return; }
    const u = uebergangLage(z.art, z.p);
    const bn = medien[z.j].typ === 'foto'
      ? bewegung(plan.bewegung, 0, plan.takt, 0)
      : clipBewegung(plan.bewegung, Math.max(0, z.seit - plan.staende[z.schritt]), plan.takt, 0);
    const mit = (basis, teil) => ({ ...basis, ...teil, s: basis.s * (teil.faktor ?? 1) });
    if (u.a) await zeichne(ctx, z.i, zeitI, mit(b, u.a));
    if (u.maske && u.b) {
      ctx.save();
      ctx.beginPath();
      if (u.maske === 'kreis') {
        const k = kreisMaske(z.p, W, H);
        ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2);
      } else {
        const l = u.maske === 'streifen' ? streifenMaske(z.p, W, H) : kachelMaske(z.p, W, H);
        for (const r of l) ctx.rect(r.x, r.y, r.w, r.h);
      }
      ctx.clip();
      await zeichne(ctx, z.j, zeitJ, bn);
      ctx.restore();
    } else if (u.b) {
      await zeichne(ctx, z.j, zeitJ, mit(bn, u.b));
    }
    if (u.blitz) {
      ctx.fillStyle = `rgba(255, 255, 255, ${u.blitz})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  function ende() {
    for (const [k, v] of clips) { berichte(k, v); clipWeg(v); }
    clips.clear();
    for (const b of fotos.values()) b.close?.();
    fotos.clear();
  }
  return { male, ende };
}
