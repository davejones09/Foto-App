// Collage im Browser: Fotos einlesen, Vorschau und Ausgabe zeichnen, Sicherung (TECHNIK.md, Collage).
// Keine Farbänderung: Jedes Feld ist das Foto, nur gerahmt. Im Stil „Nahtlos“ überblendet uebergang.mjs
// den schmalen Streifen an einer gemeinsamen Kante, an den Rändern des Streifens steht exakt das Foto.
import * as db from './speicher.mjs';
import { dekodiere } from './einfuhr.mjs';
import { ctx2d, leinwand, pixel, alsBlob, ladeBild, freigeben, verkleinere, raumVon, HALT_Q } from './bild.mjs';
import { auftrag } from './rechner.mjs';
import { anschliessen } from './uebergang.mjs';
import {
  masse, vorlage, vorlagenFuer, feldRechtecke, zerlege, ausschnitt, vorschlag, drehe, zurueckDrehen, variiere, gestaltung, filmLoecher, polaroid,
  FOTOS_MAX,
} from './collage.mjs';
import { blobSauber } from './metadaten.mjs';
import { packe, entpacke, pruefe } from './zip.mjs';
import { APP_VERSION } from './version.mjs';

export const VORSCHAU_LANG = 1200;
export const fotoVon = (c, id) => c.fotos.find((f) => f.id === id) || null;

// Ein Foto in die Collage: Rohbild zuerst gesichert (JPEG 0,95), dazu Vorschau und Motivraster.
export async function fotoEinlesen(collageId, datei) {
  const c = await dekodiere(datei);
  const frei = [];
  try {
    const roh = await alsBlob(c, 'image/jpeg', HALT_Q);
    const f = Math.min(1, VORSCHAU_LANG / Math.max(c.width, c.height));
    const v = verkleinere(c, c.width, c.height, Math.max(1, Math.round(c.width * f)), Math.max(1, Math.round(c.height * f)));
    frei.push(v);
    const vorschau = await alsBlob(v, 'image/jpeg', 0.85);
    const fm = 640 / Math.max(c.width, c.height);
    const m = verkleinere(c, c.width, c.height, Math.max(1, Math.round(c.width * fm)), Math.max(1, Math.round(c.height * fm)), 0, 0, c.width, c.height, 'srgb');
    frei.push(m);
    const px = pixel(m);
    const r = await auftrag('motivraster', { bild: px }, [px.d.buffer]).catch(() => ({ raster: null }));
    return await db.collageFotoHinzu(collageId, {
      id: db.neueId(), rohB: c.width, rohH: c.height, farbraum: raumVon(c), profil: c.profil || null,
      name: datei.name || '', zeit: datei.lastModified || Date.now(), motiv: r.raster || null,
    }, { roh, vorschau });
  } finally {
    freigeben(c);
    for (const x of frei) freigeben(x);
  }
}

// Fehlen Vorlage oder Felder (neue Collage, andere Fotoanzahl), kommen sie hier dazu.
export function vervollstaendige(c) {
  const n = c.fotos.length;
  if (n < 2) return { ...c, felder: c.fotos.map((f) => ({ foto: f.id, t: null })) };
  const v = vorlage(c.vorlage, n);
  const ok = c.felder?.length === n && c.felder.every((x) => fotoVon(c, x.foto));
  const felder = ok && v.id === c.vorlage ? c.felder : (() => {
    const reihe = (c.felder || []).map((x) => x.foto).filter((id) => fotoVon(c, id));
    for (const f of c.fotos) if (!reihe.includes(f.id)) reihe.push(f.id);
    return reihe.slice(0, n).map((id) => ({ foto: id, t: (c.felder || []).find((x) => x.foto === id)?.t || null }));
  })();
  return { ...c, vorlage: v.id, felder };
}

export const vorlagenListe = (c) => vorlagenFuer(c.fotos.length);

// Geometrie der Collage bei Breite W: Felder r, Bereiche e (im Stil „Nahtlos“ etwas größer), Schnitte n.
export function geometrie(c, W) {
  const { h } = masse(c.format, W);
  const n = c.fotos.length;
  if (n < 2) return { W, H: h, r: [{ x: 0, y: 0, w: W, h }], n: [], e: [{ x: 0, y: 0, w: W, h }], baum: null };
  const v = variiere(vorlage(c.vorlage, n), c.variante || 0);
  const gest = gestaltung(c.stil, W, h);
  if (gest) {
    // Felder in der Gestaltungsfläche, mit dem Abstand der Art
    const fl = gest.flaeche;
    const zellen = feldRechtecke(v, fl.w, fl.h, { abstand: gest.abstand }).map((q) => ({ x: q.x + fl.x, y: q.y + fl.y, w: q.w, h: q.h }));
    if (c.stil === 'polaroid') {
      const p = zellen.map((z, i) => polaroid(z, i, c.variante || 0));
      const r = p.map((x) => x.foto);
      return { W, H: h, r, n: [], e: r, baum: null, gest, polaroid: p };
    }
    return { W, H: h, r: zellen, n: [], e: zellen, baum: null, gest };
  }
  const nahtlos = c.stil === 'nahtlos';
  const r = feldRechtecke(v, W, h, { abstand: nahtlos ? 0 : c.abstand });
  if (!nahtlos) return { W, H: h, r, n: [], e: r, baum: null };
  const kante = c.kante ?? 1;
  const z = zerlege(r, W, h, { kante });
  // Ganz hart: keine Überblendung, die Felder stoßen aneinander.
  if (z.schnitte.every((x) => x.breite === 0)) return { W, H: h, r, n: [], e: r, baum: null };
  return { W, H: h, r, n: z.schnitte, e: z.bereiche, baum: z.baum };
}

// Ausschnitt eines Felds in Foto-Koordinaten, für das erweiterte Feld (im Stil „Nahtlos“).
export function feldAusschnitt(c, g, i) {
  const feld = c.felder[i];
  const foto = fotoVon(c, feld.foto);
  const e = g.e[i];
  const t = feld.t || vorschlag(foto.rohB, foto.rohH, e.w, e.h, foto.motiv);
  return { foto, ...ausschnitt(foto.rohB, foto.rohH, e.w, e.h, t) };
}

export const direktUeberblenden = async (a, b, breite) => anschliessen(a, b, breite).naht;
export const workerUeberblenden = async (a, b, breite) => (await auftrag('anschliessen', { letztes: a, neues: b, ueberlappung: breite }, [a.d.buffer, b.d.buffer])).naht;

// Zeichnet die Collage. quelle(foto) liefert ein Zeichenobjekt des Fotos (Vorschau oder Rohbild),
// danach(foto, q) gibt es wieder frei. ueberblenden = null: Übergänge hart (schnell, beim Ziehen).
export async function zeichne(ctx, c, W, { quelle, danach = null, ueberblenden = null, fortschritt = null } = {}) {
  const g = geometrie(c, W);
  const schritte = c.felder.length + g.n.length;
  let fertig = 0;
  const weiter = () => fortschritt?.(++fertig / Math.max(1, schritte));
  // Ein Feld in seinem Bereich rendern: Ausschnitt des Fotos, stufenweise verkleinert.
  const feldBild = async (i) => {
    const a = feldAusschnitt(c, g, i);
    const q = await quelle(a.foto);
    const f = q.width / a.foto.rohB;
    const e = g.e[i];
    const bild = verkleinere(q, q.width, q.height, Math.max(1, Math.round(e.w)), Math.max(1, Math.round(e.h)), a.sx * f, a.sy * f, a.sw * f, a.sh * f, 'srgb');
    danach?.(a.foto, q);
    weiter();
    return bild;
  };
  if (!g.baum) {
    const grund = g.gest ? (g.gest.grund ?? c.farbe) : (c.stil === 'rahmen' && c.fotos.length >= 2 ? c.farbe : '#000');
    ctx.fillStyle = grund;
    ctx.fillRect(0, 0, g.W, g.H);
    if (c.stil === 'film') {
      ctx.fillStyle = '#e9e6df';
      const rund = Math.max(1, Math.round(g.W * 0.004));
      for (const l of filmLoecher(g.W, g.H)) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(l.x, l.y, l.w, l.h, rund) : ctx.rect(l.x, l.y, l.w, l.h); ctx.fill(); }
    }
    if (c.stil === 'magazin') magazinKopf(ctx, c, g);
    for (let i = 0; i < c.felder.length; i++) {
      const b = await feldBild(i);
      const r = g.r[i];
      const e = g.e[i];
      if (g.polaroid) {
        const p = g.polaroid[i];
        const z = p.rahmen;
        ctx.save();
        ctx.translate(z.x + z.w / 2, z.y + z.h / 2);
        ctx.rotate(p.drehung);
        ctx.translate(-(z.x + z.w / 2), -(z.y + z.h / 2));
        ctx.shadowColor = 'rgba(0,0,0,0.28)';
        ctx.shadowBlur = Math.round(g.W * 0.012);
        ctx.shadowOffsetY = Math.round(g.W * 0.004);
        ctx.fillStyle = '#fbfaf7';
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.shadowColor = 'transparent';
        ctx.drawImage(b, r.x - e.x, r.y - e.y, r.w, r.h, r.x, r.y, r.w, r.h);
        ctx.restore();
      } else {
        ctx.drawImage(b, r.x - e.x, r.y - e.y, r.w, r.h, r.x, r.y, r.w, r.h);
      }
      freigeben(b);
    }
    return g;
  }
  // Nahtlos: entlang des Schnittbaums zusammensetzen. Jeder Knoten liefert eine Leinwand in seinem Bereich,
  // die beiden Hälften gehen an der Schnittlinie über die volle Länge weich ineinander über.
  const setze = async (k) => {
    if (k.blatt != null) return feldBild(k.blatt);
    const A = await setze(k.a);
    const B = await setze(k.b);
    const b = k.bereich;
    const aus = leinwand(Math.round(b.w), Math.round(b.h), 'srgb');
    const x = ctx2d(aus, true);
    const ba = k.a.bereich;
    const bb = k.b.bereich;
    const o = k.breite;
    if (k.art === 'v') {
      const c0 = k.c - b.x;
      x.drawImage(A, 0, 0, c0, b.h, 0, 0, c0, b.h);
      x.drawImage(B, k.c - bb.x, 0, b.w - c0, b.h, c0, 0, b.w - c0, b.h);
      if (ueberblenden) {
        const sa = pixel(A, k.c - o / 2 - ba.x, 0, o, Math.round(b.h));
        const sb = pixel(B, k.c - o / 2 - bb.x, 0, o, Math.round(b.h));
        const naht = await ueberblenden(sa, sb, o);
        x.putImageData(new ImageData(new Uint8ClampedArray(naht.d), naht.w, naht.h), c0 - o / 2, 0);
      }
    } else {
      const c0 = k.c - b.y;
      x.drawImage(A, 0, 0, b.w, c0, 0, 0, b.w, c0);
      x.drawImage(B, 0, k.c - bb.y, b.w, b.h - c0, 0, c0, b.w, b.h - c0);
      if (ueberblenden) {
        // Waagerecht: drehen (oben landet rechts), unten links überblenden, zurückdrehen.
        const sa = drehe(pixel(A, 0, k.c - o / 2 - ba.y, Math.round(b.w), o));
        const sb = drehe(pixel(B, 0, k.c - o / 2 - bb.y, Math.round(b.w), o));
        const naht = zurueckDrehen(await ueberblenden(sb, sa, o));
        x.putImageData(new ImageData(naht.d, naht.w, naht.h), 0, c0 - o / 2);
      }
    }
    freigeben(A);
    freigeben(B);
    weiter();
    return aus;
  };
  const ganz = await setze(g.baum);
  ctx.drawImage(ganz, 0, 0);
  freigeben(ganz);
  return g;
}

// Vorschaubilder der Fotos (lange Seite 1200) für den Editor.
export async function vorschauen(c, alt = new Map()) {
  const m = new Map();
  for (const f of c.fotos) {
    if (alt.has(f.id)) { m.set(f.id, alt.get(f.id)); continue; }
    const b = (await db.blob(f, 'vorschau')) || (await db.blobPflicht(f, 'roh'));
    m.set(f.id, await ladeBild(b, f.farbraum || 'srgb'));
  }
  for (const [id, q] of alt) if (!m.has(id)) freigeben(q);
  return m;
}

// Ausgabe: 2160 Pixel breit, sRGB, JPEG 0,95, ohne Metadaten der App. Die Rohbilder werden einzeln
// dekodiert und gleich wieder freigegeben (Speicher am iPhone).
export async function ausgabe(c, { fortschritt } = {}) {
  const g0 = masse(c.format);
  const cv = leinwand(g0.w, g0.h, 'srgb');
  const ctx = ctx2d(cv);
  ctx.imageSmoothingQuality = 'high';
  try {
    await zeichne(ctx, c, g0.w, {
      quelle: async (foto) => ladeBild(await db.blobPflicht(foto, 'roh'), foto.farbraum || 'srgb'),
      danach: (_, q) => freigeben(q),
      ueberblenden: c.stil === 'nahtlos' ? workerUeberblenden : null,
      fortschritt,
    });
    const { signaturLaden, signaturZeichnen } = await import('./reeltext.mjs');
    signaturZeichnen(ctx, g0.w, g0.h, await signaturLaden().catch(() => null));
    return await blobSauber(await alsBlob(cv, 'image/jpeg', 0.95));
  } finally {
    freigeben(cv);
  }
}

// Kleines Titelbild fürs Hauptmenü.
export async function titelbildSpeichern(c, quellen) {
  if (c.fotos.length < 1) return c;
  const W = 432;
  const { h } = masse(c.format, W);
  const cv = leinwand(W, h, 'srgb');
  try {
    await zeichne(ctx2d(cv), c, W, { quelle: async (f) => quellen.get(f.id), ueberblenden: c.stil === 'nahtlos' ? direktUeberblenden : null });
    return await db.aendereCollage(c.id, {}, { vorschau: await alsBlob(cv, 'image/jpeg', 0.8) });
  } finally {
    freigeben(cv);
  }
}

// --- Sicherung: eigener Projekttyp im selben ZIP-Format ---
const EINSTELLUNGEN = ['name', 'erstellt', 'format', 'vorlage', 'stil', 'abstand', 'farbe', 'kante', 'variante', 'titel'];

export async function sicherung(c, { fortschritt } = {}) {
  const dateien = [];
  const manifest = { format: 'nahtlos-sicherung', typ: 'collage', formatVersion: db.FORMAT, app: APP_VERSION, erstellt: Date.now(), collage: {}, fotos: [], felder: c.felder };
  for (const k of EINSTELLUNGEN) manifest.collage[k] = c[k];
  for (let i = 0; i < c.fotos.length; i++) {
    const f = c.fotos[i];
    const eintrag = { id: f.id, rohB: f.rohB, rohH: f.rohH, farbraum: f.farbraum, profil: f.profil, name: f.name, zeit: f.zeit, motiv: f.motiv, dateien: {} };
    for (const feld of ['roh', 'vorschau']) {
      const b = await db.blob(f, feld).catch(() => null);
      if (!b) continue;
      const name = `fotos/${String(i).padStart(2, '0')}/${feld}.jpg`;
      eintrag.dateien[feld] = name;
      dateien.push({ name, inhalt: new Uint8Array(await b.arrayBuffer()) });
    }
    manifest.fotos.push(eintrag);
  }
  dateien.unshift({ name: 'manifest.json', inhalt: JSON.stringify(manifest, null, 1) });
  return packe(dateien, { fortschritt });
}

// Spielt eine Collage-Sicherung unter neuen IDs ein. eintraege: Ergebnis von entpacke().
export async function einspielen(manifest, eintraege, { fortschritt } = {}) {
  const neu = await db.neueCollage({ name: manifest.collage.name, format: manifest.collage.format, stil: manifest.collage.stil });
  try {
    const zuordnung = new Map();
    for (let i = 0; i < manifest.fotos.length; i++) {
      const e = manifest.fotos[i];
      const bilder = {};
      for (const feld of ['roh', 'vorschau']) {
        const z = e.dateien?.[feld] && eintraege.get(e.dateien[feld]);
        if (!z) continue;
        if (!(await pruefe(z))) throw new Error(`Beschädigt: ${e.dateien[feld]}`);
        bilder[feld] = { daten: await z.blob.arrayBuffer(), typ: 'image/jpeg' };
      }
      if (!bilder.roh) throw new Error('Foto ohne Rohbild');
      const id = db.neueId();
      zuordnung.set(e.id, id);
      await db.collageFotoHinzu(neu.id, { id, rohB: e.rohB, rohH: e.rohH, farbraum: e.farbraum || 'srgb', profil: e.profil || null, name: e.name || '', zeit: e.zeit, motiv: e.motiv || null }, bilder);
      fortschritt?.((i + 1) / manifest.fotos.length);
    }
    const einst = {};
    for (const k of ['vorlage', 'abstand', 'farbe', 'erstellt', 'kante', 'variante', 'titel']) if (manifest.collage[k] != null) einst[k] = manifest.collage[k];
    einst.felder = (manifest.felder || []).filter((f) => zuordnung.has(f.foto)).map((f) => ({ foto: zuordnung.get(f.foto), t: f.t || null }));
    return await db.aendereCollage(neu.id, einst);
  } catch (err) {
    await db.loescheCollage(neu.id).catch(() => {});
    throw err;
  }
}

export { entpacke, FOTOS_MAX };

// Magazin: Titel in Serifenschrift über einer feinen Linie. Systemschrift, nichts aus dem Netz.
function magazinKopf(ctx, c, g) {
  const fl = g.gest.flaeche;
  const titel = (c.titel ?? c.name ?? '').trim();
  ctx.save();
  ctx.fillStyle = '#1c1b19';
  ctx.textBaseline = 'alphabetic';
  let groesse = Math.round(g.W * 0.075);
  const schrift = (px) => `600 ${px}px ui-serif, "New York", Georgia, serif`;
  ctx.font = schrift(groesse);
  while (groesse > 12 && ctx.measureText(titel).width > fl.w) { groesse -= 2; ctx.font = schrift(groesse); }
  const y = Math.round(g.gest.kopf * 0.62);
  ctx.fillText(titel, fl.x, y);
  ctx.fillRect(fl.x, Math.round(g.gest.kopf * 0.8), fl.w, Math.max(1, Math.round(g.W * 0.002)));
  ctx.restore();
}

// Hintergrund der Collage, etwa für die Story-Fassung.
export function grundFarbe(c) {
  const g = gestaltung(c.stil, 1000, 1000);
  if (g) return g.grund ?? c.farbe;
  return c.stil === 'rahmen' ? c.farbe : '#000000';
}
