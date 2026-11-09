// Text und Signatur über Reels und Collagen. Nur Systemschriften, nichts aus dem Netz.
// Das Bild darunter bleibt unberührt, Text liegt nur darüber.
import * as db from './speicher.mjs';

export const TEXT_STILE = {
  klar: { schrift: '700 {px}px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif', spur: 0 },
  elegant: { schrift: 'italic 500 {px}px ui-serif, "New York", Georgia, serif', spur: 0 },
  rund: { schrift: '700 {px}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif', spur: 0 },
  schreib: { schrift: '500 {px}px ui-monospace, "SF Mono", Menlo, monospace', spur: 0.04 },
  versal: { schrift: '600 {px}px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif', spur: 0.18, gross: true },
};
export const TEXT_LAGEN = { oben: 0.2, mitte: 0.46, unten: 0.68 }; // unten bleibt über der Bedienleiste von Instagram

const klemme = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const weich = (x) => { const t = klemme(x); return t * t * (3 - 2 * t); };

// Umbruch in höchstens drei Zeilen, die in die Breite passen.
export function umbrechen(ctx, text, breite, max = 3) {
  const woerter = text.trim().split(/\s+/).filter(Boolean);
  const zeilen = [];
  let z = '';
  for (const w of woerter) {
    const probe = z ? `${z} ${w}` : w;
    if (ctx.measureText(probe).width <= breite || !z) z = probe;
    else { zeilen.push(z); z = w; }
  }
  if (z) zeilen.push(z);
  if (zeilen.length > max) { zeilen.length = max; zeilen[max - 1] = `${zeilen[max - 1].replace(/\s*\S*$/, '')} …`; }
  return zeilen;
}

// Ein Textblock mit Ein- und Ausblenden. sicht: 0 bis 1.
export function textZeichnen(ctx, W, H, text, { stil = 'klar', lage = 'unten', groesse = 0.065, sicht = 1 } = {}) {
  if (!text?.trim() || sicht <= 0) return;
  const s = TEXT_STILE[stil] || TEXT_STILE.klar;
  const px = Math.round(W * groesse);
  ctx.save();
  ctx.font = s.schrift.replace('{px}', px);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(px * s.spur)}px`;
  const zeilen = umbrechen(ctx, s.gross ? text.toUpperCase() : text, W * 0.8);
  const hoehe = px * 1.18;
  const y0 = H * (TEXT_LAGEN[lage] ?? TEXT_LAGEN.unten) - ((zeilen.length - 1) * hoehe) / 2 + (1 - weich(sicht)) * H * 0.025;
  ctx.globalAlpha = weich(sicht);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = Math.round(px * 0.35);
  ctx.shadowOffsetY = Math.round(px * 0.05);
  ctx.fillStyle = '#ffffff';
  zeilen.forEach((z, i) => ctx.fillText(z, W / 2, y0 + i * hoehe));
  ctx.restore();
}

// Sichtbarkeit eines Textes zwischen von und bis, mit weichem Rand.
export const sichtbarkeit = (t, von, bis, rand = 0.35) => Math.min(klemme((t - von) / rand), klemme((bis - t) / rand));

// texte: { titel: { text, stil, lage }, zeilen: [{ von, bis, text }] }
export function textUeber(texte, W, H) {
  const titel = texte?.titel;
  const zeilen = (texte?.zeilen || []).filter((z) => z.text?.trim());
  if (!titel?.text?.trim() && !zeilen.length) return null;
  return (ctx, t) => {
    if (titel?.text?.trim()) textZeichnen(ctx, W, H, titel.text, { stil: titel.stil, lage: titel.lage, groesse: 0.072, sicht: sichtbarkeit(t, 0.15, 2.9) });
    for (const z of zeilen) {
      // Der Titel hat Vorrang am Anfang
      const von = Math.max(z.von + 0.1, titel?.text?.trim() ? 3 : 0);
      if (t >= von && t <= z.bis) textZeichnen(ctx, W, H, z.text, { stil: titel?.stil, lage: titel?.lage === 'unten' ? 'oben' : 'unten', groesse: 0.05, sicht: sichtbarkeit(t, von, z.bis - 0.05, 0.25) });
    }
  };
}

// --- Signatur: eigenes Logo oder Kürzel, dezent in einer Ecke oder am Ende ---
export const SIGNATUR_LAGEN = ['or', 'ol', 'ur', 'ul', 'ende'];
export const SIGNATUR_STANDARD = { an: false, art: 'text', text: '', lage: 'or', groesse: 'klein', deckkraft: 0.85 };

export async function signaturLaden() {
  const s = { ...SIGNATUR_STANDARD, ...((await db.einstellung('signatur').catch(() => null)) || {}) };
  let logo = null;
  if (s.an && s.art === 'logo') {
    try {
      const r = await db.datei('signatur/logo');
      if (r?.daten) logo = await createImageBitmap(new Blob([r.daten], { type: r.typ || 'image/png' }));
    } catch { logo = null; }
  }
  return { ...s, logo };
}

export async function signaturSpeichern(s) {
  const { logo, ...rest } = s;
  await db.setzeEinstellung('signatur', rest);
}

export async function logoSpeichern(datei) {
  const daten = await datei.arrayBuffer();
  await db.dateiSchreiben({ schluessel: 'signatur/logo', typ: datei.type || 'image/png', laenge: daten.byteLength, daten });
}

// Zeichnet die Signatur. dauer: Länge des Reels (für „am Ende“), null bei Bildern.
export function signaturZeichnen(ctx, W, H, sig, t = null, dauer = null) {
  if (!sig?.an) return;
  if (sig.art === 'logo' && !sig.logo) return;
  if (sig.art === 'text' && !sig.text?.trim()) return;
  const ende = sig.lage === 'ende';
  let sicht = 1;
  if (ende) {
    if (dauer == null) return signaturZeichnen(ctx, W, H, { ...sig, lage: 'ur' });
    sicht = sichtbarkeit(t, dauer - 1.6, dauer + 1, 0.4);
    if (sicht <= 0) return;
  }
  const basis = (sig.groesse === 'mittel' ? 0.2 : 0.13) * (ende ? 1.8 : 1);
  const rand = Math.round(W * 0.045);
  const oben = sig.lage?.startsWith('o');
  const links = sig.lage?.endsWith('l');
  ctx.save();
  ctx.globalAlpha = (sig.deckkraft ?? 0.85) * weich(sicht);
  if (sig.art === 'logo') {
    const bw = Math.round(W * basis);
    const bh = Math.round((bw * sig.logo.height) / sig.logo.width);
    const x = ende ? (W - bw) / 2 : links ? rand : W - rand - bw;
    const y = ende ? (H - bh) / 2 : oben ? rand + (dauer != null ? H * 0.04 : 0) : H - rand - bh - (dauer != null ? H * 0.16 : 0);
    ctx.drawImage(sig.logo, x, y, bw, bh);
  } else {
    const px = Math.round(W * (sig.groesse === 'mittel' ? 0.065 : 0.045) * (ende ? 1.8 : 1));
    ctx.font = `600 ${px}px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(px * 0.08)}px`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = Math.round(px * 0.4);
    ctx.textBaseline = 'middle';
    ctx.textAlign = ende ? 'center' : links ? 'left' : 'right';
    const x = ende ? W / 2 : links ? rand : W - rand;
    // In Reels liegt oben die Leiste von Instagram, unten die Bedienung: etwas Abstand.
    const y = ende ? H / 2 : oben ? rand + px / 2 + (dauer != null ? H * 0.04 : 0) : H - rand - px / 2 - (dauer != null ? H * 0.16 : 0);
    ctx.fillText(sig.text.trim(), x, y);
  }
  ctx.restore();
}

// Maler mit Text und Signatur darüber.
export function ueberlagern(male, { texte = null, signatur = null, W, H, dauer = null }) {
  const text = textUeber(texte, W, H);
  if (!text && !signatur?.an) return male;
  return async (ctx, t, opt) => {
    await male(ctx, t, opt);
    text?.(ctx, t);
    signaturZeichnen(ctx, W, H, signatur, t, dauer);
  };
}
