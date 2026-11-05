// Reel aus Clips: Videoclips und Fotos in einem Reel. Zeitplan als reine Rechnung (in Node getestet),
// gezeichnet wird Bild für Bild: Jedes Bild springt per Suche an die richtige Stelle im Clip, deshalb
// ist das Ergebnis genau, auch wenn das Rechnen länger dauert als das Video. Ohne Ton.

import { FPS, RAHMEN } from './reelstil.mjs';
import { vorlagenPlan, vorlagenZustand, bewegung, uebergangLage, kreisMaske, streifenMaske, kachelMaske } from './reelvorlagen.mjs';
import { serienEintrag } from './diagnose.mjs';

export const GANZ = 'c-ganz';
export const MEDIEN_MAX = 30;
export const REEL_MAX = 90;
export const FOTO_STAND = 2.5;

// Ganze Clips: harte Schnitte, jeder Clip läuft ab seinem Startpunkt bis zum Ende. Bei 90 Sekunden ist Schluss.
function ganzPlan(medien) {
  const staende = [];
  const beginn = [];
  let t = 0;
  for (const m of medien) {
    if (t >= REEL_MAX) break;
    const eigen = m.typ === 'foto' ? FOTO_STAND : Math.max(0.1, m.dauer - (m.start || 0));
    const s = Math.min(eigen, REEL_MAX - t);
    beginn.push(t);
    staende.push(s);
    t += s;
  }
  const dauer = Math.round(t * FPS) / FPS;
  return {
    stil: GANZ, vorlage: GANZ, auto: true, bewegung: 'keine', n: medien.length, runden: 1,
    laenge: Math.round(dauer), dauer, bilder: Math.round(dauer * FPS),
    takt: 1, staende, beginn, uebergaenge: staende.slice(1).map(() => 0), arten: staende.slice(1).map(() => 'schnitt'),
    zuKurz: false, maxFotos: medien.length, gekappt: staende.length < medien.length || medien.reduce((s, m) => s + (m.typ === 'foto' ? FOTO_STAND : Math.max(0.1, m.dauer - (m.start || 0))), 0) > REEL_MAX + 1e-9,
  };
}

export function clipPlan(medien, { laenge = null, stil = GANZ } = {}) {
  const plan = stil === GANZ ? ganzPlan(medien) : vorlagenPlan(medien.length, { laenge, vorlage: stil });
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
  const rest = Math.max(0.05, medium.dauer - start);
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

const WARTE_MS = 400;
const FEHLT_MAX = 5;
const stand = new WeakMap();
const standVon = (v) => {
  if (!stand.has(v)) stand.set(v, { bildZeit: null, abstand: 0, fehlt: 0, gesucht: 0, ohneBild: 0, ms: 0 });
  return stand.get(v);
};
export const suchStatistik = (v) => standVon(v);

// Springt an die Zeit t und wartet, bis das neue Bild wirklich dekodiert ist. Große Clips brauchen dafür
// oft länger, und ein zu frühes Zeichnen wiederholt das alte Bild: Das sieht im Reel wie Ruckeln aus.
export async function suche(v, t) {
  const ziel = Math.max(0, Math.min(t, (Number.isFinite(v.duration) ? v.duration : t) - 0.04));
  const st = standVon(v);
  if (v.readyState >= 2 && !v.seeking && gleichesBild(st.bildZeit, st.abstand, ziel)) return;
  if (Math.abs(v.currentTime - ziel) < 1 / 240 && !v.seeking && v.readyState >= 2) return;
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
      if (d > 0.001) st.abstand = st.abstand ? Math.min(st.abstand, d) : d;
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
    const a = deckAusschnitt(q.w, q.h);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2 + dx * kx, H / 2 + dy * kx);
    if (rot) ctx.rotate(rot);
    if (s >= 1 && !rot) {
      const sw = a.w / s;
      const sh = a.h / s;
      const rx = (a.w - sw) / 2;
      const ry = (a.h - sh) / 2;
      const ox = Math.max(-rx, Math.min(rx, (qx * sw) / RAHMEN.w));
      const oy = Math.max(-ry, Math.min(ry, (qy * sh) / RAHMEN.h));
      ctx.drawImage(q.b, a.x + rx + ox, a.y + ry + oy, sw, sh, -W / 2, -H / 2, W, H);
    } else {
      ctx.drawImage(q.b, a.x, a.y, a.w, a.h, (-W * s) / 2, (-H * s) / 2, W * s, H * s);
    }
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
