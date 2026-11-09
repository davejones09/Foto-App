// Ton fürs Reel: Musik und Originalton der Clips, Bild für Bild an derselben Stelle wie das Bild.
// Reine Rechnung auf dekodierten Daten, ohne Web Audio, damit sie überall gleich klingt und testbar ist.
import { vorlagenZustand } from './reelvorlagen.mjs';
import { clipStellen } from './clipreel.mjs';
import { tonAusschnitt } from './musik.mjs';

const BLOCK = 0.005; // Sekunden je Rechenschritt für Stelle und Tempo
export const CLIPTON_MAX = 300 * 1024 * 1024;

// Ton aus einer Clipdatei, oder null, wenn sie keinen hat oder zu groß ist.
export async function clipTonLaden(datei, rate = 48000) {
  if (!datei || datei.size > CLIPTON_MAX) return null;
  try {
    const p = await new OfflineAudioContext(2, 1, rate).decodeAudioData(await datei.arrayBuffer());
    if (!p.length) return null;
    const kanaele = Array.from({ length: p.numberOfChannels }, (_, i) => p.getChannelData(i));
    return { kanaele: [kanaele[0], kanaele[1] ?? kanaele[0]], rate: p.sampleRate };
  } catch {
    return null; // kein Ton im Clip
  }
}

const klemme = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

function probe(k, pos) {
  if (pos < 0) return 0;
  const a = Math.floor(pos);
  if (a + 1 >= k.length) return a < k.length ? k[a] : 0;
  return k[a] + (k[a + 1] - k[a]) * (pos - a);
}

// Originalton aller Clips entlang des Plans. toene[i]: Ton des Mediums i oder null.
export function originalSpur(plan, medien, toene, dauer, rate) {
  const n = Math.ceil(dauer * rate);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const schritt = Math.max(1, Math.round(BLOCK * rate));
  const lage = (t) => {
    const z = vorlagenZustand(plan, t);
    const s = clipStellen(plan, medien, z);
    return { z, s };
  };
  for (let a = 0; a < n; a += schritt) {
    const b = Math.min(n, a + schritt);
    const { z, s } = lage(a / rate);
    const quellen = [];
    const im = z.j != null && z.p != null ? z.p : 0;
    // Gleich laute Überblendung im Übergang
    quellen.push({ i: z.i, zeit: s.zeitI, rate: s.rateI, g: Math.cos((im * Math.PI) / 2) });
    if (z.j != null) quellen.push({ i: z.j, zeit: s.zeitJ, rate: s.rateJ, g: Math.sin((im * Math.PI) / 2) });
    for (const q of quellen) {
      const ton = toene[q.i];
      if (!ton || medien[q.i].typ !== 'clip' || q.g < 1e-4) continue;
      // Steht das Bild fast, schweigt der Ton, statt zu brummen.
      const g = q.g * klemme((q.rate - 0.25) / 0.35);
      if (g < 1e-4) continue;
      const pos0 = q.zeit * ton.rate;
      const vor = (q.rate * ton.rate) / rate;
      const [kl, kr] = ton.kanaele;
      for (let x = a; x < b; x++) {
        const p = pos0 + (x - a) * vor;
        L[x] += g * probe(kl, p);
        R[x] += g * probe(kr, p);
      }
    }
  }
  return [L, R];
}

// anteil: 0 nur Musik, 0,5 beide voll, 1 nur Originalton. Ohne Musik zählt nur der Originalton.
// Spricht jemand im Clip, geht die Musik dort automatisch zurück.
export function mischen({ plan, medien, toene = [], musik = null, anteil = 0.5, rate = 48000 }) {
  const dauer = plan.dauer;
  const n = Math.ceil(dauer * rate);
  const mitOriginal = toene.some((x, i) => x && medien[i]?.typ === 'clip');
  const o = !musik ? 1 : Math.min(1, 2 * anteil);
  const mu = Math.min(1, 2 * (1 - anteil));
  const [oL, oR] = mitOriginal && o > 0 ? originalSpur(plan, medien, toene, dauer, rate) : [null, null];
  const [mL, mR] = musik && mu > 0 ? tonAusschnitt(musik.kanaele, musik.rate, musik.start, dauer, rate) : [null, null];
  if (!oL && !mL) return null;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const auf = Math.exp(-1 / (0.02 * rate));
  const ab = Math.exp(-1 / (0.3 * rate));
  const ausblenden = Math.min(0.8, dauer / 4) * rate;
  let huelle = 0;
  for (let x = 0; x < n; x++) {
    let l = 0;
    let r = 0;
    if (oL) {
      const ol = oL[x] * o;
      const or = oR[x] * o;
      const w = Math.max(Math.abs(ol), Math.abs(or));
      huelle = w > huelle ? auf * huelle + (1 - auf) * w : ab * huelle + (1 - ab) * w;
      // Originalton weich aus- und einblenden, die Musik bringt ihr Ende schon mit.
      const rand = Math.min(1, x / (0.02 * rate), (n - x) / ausblenden);
      l += ol * rand;
      r += or * rand;
    }
    if (mL) {
      const duck = oL ? 1 - 0.6 * klemme((huelle - 0.03) / 0.12) : 1;
      l += mL[x] * mu * duck;
      r += mR[x] * mu * duck;
    }
    // Sanfte Grenze statt hartem Übersteuern
    L[x] = Math.abs(l) > 0.9 ? Math.sign(l) * (0.9 + 0.1 * Math.tanh((Math.abs(l) - 0.9) / 0.1)) : l;
    R[x] = Math.abs(r) > 0.9 ? Math.sign(r) * (0.9 + 0.1 * Math.tanh((Math.abs(r) - 0.9) / 0.1)) : r;
  }
  return [L, R];
}

// 16-Bit-WAV für die Vorschau. Klein genug, schnell erzeugt, spielt überall.
export function wavAus([L, R], rate) {
  const n = L.length;
  const b = new ArrayBuffer(44 + n * 4);
  const d = new DataView(b);
  const s = (o, t) => { for (let i = 0; i < t.length; i++) d.setUint8(o + i, t.charCodeAt(i)); };
  s(0, 'RIFF'); d.setUint32(4, 36 + n * 4, true); s(8, 'WAVE'); s(12, 'fmt ');
  d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 2, true); d.setUint32(24, rate, true);
  d.setUint32(28, rate * 4, true); d.setUint16(32, 4, true); d.setUint16(34, 16, true); s(36, 'data'); d.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    d.setInt16(o, Math.round(klemme(L[i], -1, 1) * 32767), true);
    d.setInt16(o + 2, Math.round(klemme(R[i], -1, 1) * 32767), true);
    o += 4;
  }
  return new Blob([b], { type: 'audio/wav' });
}
