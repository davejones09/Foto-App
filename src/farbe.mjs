// Farbprofile (TECHNIK.md, Abschnitt Farbprofil).
// Grundregel: Ein Foto wird nicht still umgerechnet. Die App liest das eingebettete ICC-Profil, arbeitet
// mit einer Leinwand im passenden Farbraum (srgb oder display-p3) und prüft beim ersten Gebrauch selbst,
// ob toBlob das Display-P3-Profil mitschreibt. Fehlt es, setzt die App es selbst ins JPEG.
// Die reinen Teile (Lesen, Erzeugen, Einsetzen) laufen ohne Browser und sind in Node getestet.

const text = (b, o, n) => String.fromCharCode(...b.subarray(o, o + n));

// Primärfarben nach Anpassung an D50, wie sie in rXYZ, gXYZ und bXYZ stehen.
const BEKANNT = {
  srgb: [[0.4361, 0.2225, 0.0139], [0.3851, 0.7169, 0.0971], [0.1431, 0.0606, 0.7141]],
  'display-p3': [[0.5151, 0.2412, -0.0011], [0.2920, 0.6922, 0.0419], [0.1571, 0.0666, 0.7841]],
  'adobe-rgb': [[0.6097, 0.3111, 0.0195], [0.2053, 0.6257, 0.0609], [0.1492, 0.0632, 0.7446]],
  prophoto: [[0.7977, 0.2880, 0.0], [0.1352, 0.7119, 0.0], [0.0313, 0.0001, 0.8249]],
};

function descLesen(b, dv, e) {
  if (!e || e.off + 12 > b.length) return '';
  const typ = text(b, e.off, 4);
  if (typ === 'desc') {
    const n = dv.getUint32(e.off + 8);
    return text(b, e.off + 12, Math.max(0, Math.min(n, b.length - e.off - 12))).replace(/\0+$/, '');
  }
  if (typ === 'mluc') {
    const len = dv.getUint32(e.off + 20);
    const off = dv.getUint32(e.off + 24);
    let s = '';
    for (let i = 0; i + 1 < len && e.off + off + i + 1 < b.length; i += 2) s += String.fromCharCode(dv.getUint16(e.off + off + i));
    return s.replace(/\0+$/, '');
  }
  return '';
}

// Liest ein ICC-Profil. Liefert { name, modell, art } oder null, wenn es keins ist.
// art: 'srgb', 'display-p3', 'weit' (anderes RGB, etwa Adobe RGB) oder 'anders' (Graustufen, CMYK, unklar).
export function iccLesen(b) {
  if (!b || b.length < 132 || text(b, 36, 4) !== 'acsp') return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const modell = text(b, 16, 4).trim();
  const n = Math.min(dv.getUint32(128), 200);
  const tags = {};
  for (let i = 0; i < n && 132 + i * 12 + 12 <= b.length; i++) {
    const o = 132 + i * 12;
    tags[text(b, o, 4)] = { off: dv.getUint32(o + 4), len: dv.getUint32(o + 8) };
  }
  const xyz = (t) => {
    const e = tags[t];
    if (!e || e.off + 20 > b.length || text(b, e.off, 4) !== 'XYZ ') return null;
    return [0, 1, 2].map((k) => dv.getInt32(e.off + 8 + k * 4) / 65536);
  };
  const name = descLesen(b, dv, tags.desc);
  let art = 'anders';
  const prim = [xyz('rXYZ'), xyz('gXYZ'), xyz('bXYZ')];
  if (modell === 'RGB') {
    art = 'weit';
    if (prim.every(Boolean)) {
      for (const [k, ref] of Object.entries(BEKANNT)) {
        const ab = Math.max(...prim.flatMap((p, i) => p.map((v, j) => Math.abs(v - ref[i][j]))));
        if (ab < 0.01) { art = k === 'srgb' || k === 'display-p3' ? k : 'weit'; break; }
      }
    } else if (/srgb/i.test(name)) art = 'srgb';
    else if (/display p3/i.test(name)) art = 'display-p3';
  }
  return { name: name || modell, modell, art };
}

// ICC-Bytes aus einem JPEG (APP2 "ICC_PROFILE", auch auf mehrere Abschnitte verteilt). null ohne Profil.
export function iccAusJpeg(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  const teile = [];
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) break;
    const m = b[o + 1];
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { o += 2; continue; }
    if (m === 0xda || m === 0xd9) break; // Bilddaten beginnen
    const len = (b[o + 2] << 8) | b[o + 3];
    if (m === 0xe2 && len > 16 && text(b, o + 4, 12) === 'ICC_PROFILE\0') teile.push({ nr: b[o + 16], d: b.subarray(o + 18, o + 2 + len) });
    o += 2 + len;
  }
  if (!teile.length) return null;
  teile.sort((x, y) => x.nr - y.nr);
  const aus = new Uint8Array(teile.reduce((s, t) => s + t.d.length, 0));
  let p = 0;
  for (const t of teile) { aus.set(t.d, p); p += t.d.length; }
  return aus;
}

// Sucht ein ICC-Profil irgendwo in den ersten Bytes (HEIC, AVIF, WebP, TIFF legen es unkomprimiert ab).
function iccSuchen(b) {
  for (let i = 36; i + 4 <= b.length; i++) {
    if (b[i] !== 0x61 || b[i + 1] !== 0x63 || b[i + 2] !== 0x73 || b[i + 3] !== 0x70) continue; // 'acsp'
    const s = i - 36;
    const groesse = ((b[s] << 24) | (b[s + 1] << 16) | (b[s + 2] << 8) | b[s + 3]) >>> 0;
    if (groesse >= 132 && groesse <= 4 << 20) return b.subarray(s, Math.min(b.length, s + groesse));
  }
  return null;
}

async function entpacke(d) {
  if (typeof DecompressionStream !== 'function') return null;
  const s = new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// PNG: iCCP (komprimiertes Profil) oder sRGB-Abschnitt.
async function pngProfil(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let o = 8;
  while (o + 8 <= b.length) {
    const len = dv.getUint32(o);
    const typ = text(b, o + 4, 4);
    if (typ === 'sRGB') return { name: 'sRGB', modell: 'RGB', art: 'srgb' };
    if (typ === 'iCCP') {
      const d = b.subarray(o + 8, o + 8 + len);
      const null0 = d.indexOf(0);
      const name = text(d, 0, Math.max(0, null0));
      try {
        const icc = await entpacke(d.subarray(null0 + 2));
        const p = icc && iccLesen(icc);
        if (p) return p;
      } catch {}
      return { name, modell: 'RGB', art: /display p3/i.test(name) ? 'display-p3' : /srgb/i.test(name) ? 'srgb' : 'weit' };
    }
    if (typ === 'IDAT' || typ === 'IEND') break;
    o += 12 + len;
  }
  return null;
}

// Eingebettetes Profil einer Bilddatei (die ersten Bytes reichen). Ohne Profil: art 'keins' (gilt als sRGB).
export async function profilAusBytes(b) {
  let p = null;
  if (b[0] === 0xff && b[1] === 0xd8) p = iccLesen(iccAusJpeg(b));
  else if (b[0] === 0x89 && text(b, 1, 3) === 'PNG') p = await pngProfil(b);
  else p = iccLesen(iccSuchen(b));
  return p || { name: '', modell: '', art: 'keins' };
}

export async function profilAusDatei(datei) {
  try {
    return await profilAusBytes(new Uint8Array(await datei.slice(0, 2 << 20).arrayBuffer()));
  } catch {
    return { name: '', modell: '', art: 'keins' };
  }
}

// --- Display-P3-Profil erzeugen (ICC v4, wie das Profil der Apple-Geräte) ---

function s15(v) { return Math.round(v * 65536) | 0; }

export function displayP3Profil() {
  const teile = [];
  const tag = (sig, daten) => teile.push({ sig, daten });
  const mluc = (s) => {
    const d = new Uint8Array(28 + s.length * 2);
    const v = new DataView(d.buffer);
    d.set([0x6d, 0x6c, 0x75, 0x63]); // 'mluc'
    v.setUint32(8, 1); v.setUint32(12, 12);
    d.set([0x65, 0x6e, 0x55, 0x53], 16); // en US
    v.setUint32(20, s.length * 2); v.setUint32(24, 28);
    for (let i = 0; i < s.length; i++) v.setUint16(28 + i * 2, s.charCodeAt(i));
    return d;
  };
  const xyz = (x, y, z) => {
    const d = new Uint8Array(20);
    const v = new DataView(d.buffer);
    d.set([0x58, 0x59, 0x5a, 0x20]); // 'XYZ '
    v.setInt32(8, s15(x)); v.setInt32(12, s15(y)); v.setInt32(16, s15(z));
    return d;
  };
  const para = () => {
    const d = new Uint8Array(32);
    const v = new DataView(d.buffer);
    d.set([0x70, 0x61, 0x72, 0x61]); // 'para'
    v.setUint16(8, 3);
    [2.4, 1 / 1.055, 0.055 / 1.055, 1 / 12.92, 0.04045].forEach((p, i) => v.setInt32(12 + i * 4, s15(p)));
    return d;
  };
  const chad = () => {
    const d = new Uint8Array(44);
    const v = new DataView(d.buffer);
    d.set([0x73, 0x66, 0x33, 0x32]); // 'sf32'
    [1.047882, 0.022919, -0.050217, 0.029587, 0.990479, -0.017059, -0.009232, 0.015076, 0.751678].forEach((p, i) => v.setInt32(8 + i * 4, s15(p)));
    return d;
  };
  tag('desc', mluc('Display P3'));
  tag('cprt', mluc('No copyright, use freely'));
  tag('wtpt', xyz(0.964203, 1, 0.824905));
  tag('rXYZ', xyz(0.515121, 0.241196, -0.001053));
  tag('gXYZ', xyz(0.291977, 0.692245, 0.041885));
  tag('bXYZ', xyz(0.157104, 0.066574, 0.784073));
  const kurve = para();
  tag('rTRC', kurve); tag('gTRC', kurve); tag('bTRC', kurve);
  tag('chad', chad());
  const kopf = 128 + 4 + teile.length * 12;
  const lagen = new Map();
  let groesse = kopf;
  for (const t of teile) {
    if (lagen.has(t.daten)) continue;
    lagen.set(t.daten, groesse);
    groesse += Math.ceil(t.daten.length / 4) * 4;
  }
  const b = new Uint8Array(groesse);
  const v = new DataView(b.buffer);
  v.setUint32(0, groesse);
  v.setUint32(8, 0x04300000);
  b.set([0x6d, 0x6e, 0x74, 0x72], 12); // 'mntr'
  b.set([0x52, 0x47, 0x42, 0x20], 16); // 'RGB '
  b.set([0x58, 0x59, 0x5a, 0x20], 20); // 'XYZ '
  [2026, 1, 1, 0, 0, 0].forEach((x, i) => v.setUint16(24 + i * 2, x));
  b.set([0x61, 0x63, 0x73, 0x70], 36); // 'acsp'
  v.setInt32(68, s15(0.9642)); v.setInt32(72, s15(1)); v.setInt32(76, s15(0.8249));
  v.setUint32(128, teile.length);
  teile.forEach((t, i) => {
    const o = 132 + i * 12;
    for (let k = 0; k < 4; k++) b[o + k] = t.sig.charCodeAt(k);
    v.setUint32(o + 4, lagen.get(t.daten));
    v.setUint32(o + 8, t.daten.length);
  });
  for (const [d, o] of lagen) b.set(d, o);
  return b;
}

// Setzt ein ICC-Profil in ein JPEG: vorhandene Profile raus, das neue direkt hinter SOI und APP0.
export function setzeProfil(jpeg, icc) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('kein JPEG');
  if (icc.length > 65519) throw new Error('Profil zu groß');
  const stuecke = [jpeg.subarray(0, 2)];
  let o = 2;
  let eingesetzt = false;
  const neu = new Uint8Array(18 + icc.length);
  neu.set([0xff, 0xe2, ((16 + icc.length) >> 8) & 0xff, (16 + icc.length) & 0xff]);
  for (let i = 0; i < 12; i++) neu[4 + i] = 'ICC_PROFILE\0'.charCodeAt(i);
  neu[16] = 1; neu[17] = 1;
  neu.set(icc, 18);
  while (o + 4 <= jpeg.length && jpeg[o] === 0xff) {
    const m = jpeg[o + 1];
    if (m === 0xda) break;
    const len = (jpeg[o + 2] << 8) | jpeg[o + 3];
    const seg = jpeg.subarray(o, o + 2 + len);
    const istIcc = m === 0xe2 && text(jpeg, o + 4, 12) === 'ICC_PROFILE\0';
    if (!eingesetzt && m !== 0xe0) { stuecke.push(neu); eingesetzt = true; }
    if (!istIcc) stuecke.push(seg);
    o += 2 + len;
  }
  if (!eingesetzt) stuecke.push(neu);
  stuecke.push(jpeg.subarray(o));
  const aus = new Uint8Array(stuecke.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of stuecke) { aus.set(x, p); p += x.length; }
  return aus;
}

// --- Im Browser: was kann dieses Gerät? ---

let p3Leinwand = null;
// Kann eine Leinwand in Display P3 rechnen?
export function p3Moeglich() {
  if (p3Leinwand !== null) return p3Leinwand;
  p3Leinwand = false;
  try {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    const k = c.getContext('2d', { colorSpace: 'display-p3' });
    const raum = k?.getContextAttributes?.().colorSpace || k?.getImageData(0, 0, 1, 1).colorSpace;
    p3Leinwand = raum === 'display-p3';
    c.width = 0; c.height = 0;
  } catch {}
  return p3Leinwand;
}

function bildAus(blob) {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Bild nicht lesbar')); };
    img.src = url;
  });
}

// Zwei Farbfelder in P3: eines, das auch sRGB kann, und reines P3-Rot. Kodieren, zurücklesen, vergleichen.
async function p3Probe(einsetzen) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 16;
  const k = c.getContext('2d', { colorSpace: 'display-p3' });
  k.fillStyle = 'rgb(200 100 50)'; k.fillRect(0, 0, 16, 16);
  k.fillStyle = 'color(display-p3 1 0 0)'; k.fillRect(16, 0, 16, 16);
  const soll = [...k.getImageData(8, 8, 1, 1).data.slice(0, 3), ...k.getImageData(24, 8, 1, 1).data.slice(0, 3)];
  let blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 1));
  if (!blob) throw new Error('toBlob lieferte nichts');
  let bytes = new Uint8Array(await blob.arrayBuffer());
  const profil = iccLesen(iccAusJpeg(bytes));
  if (einsetzen) { bytes = setzeProfil(bytes, displayP3Profil()); blob = new Blob([bytes], { type: 'image/jpeg' }); }
  const img = await bildAus(blob);
  const d = document.createElement('canvas');
  d.width = 32; d.height = 16;
  const dk = d.getContext('2d', { colorSpace: 'display-p3' });
  dk.drawImage(img, 0, 0);
  const ist = [...dk.getImageData(8, 8, 1, 1).data.slice(0, 3), ...dk.getImageData(24, 8, 1, 1).data.slice(0, 3)];
  const ab = (von, bis) => Math.max(...ist.slice(von, bis).map((v, i) => Math.abs(v - soll[von + i])));
  return { profil, soll, ist, innen: ab(0, 3), aussen: ab(3, 6) };
}

let test = null;
// Einmal je Start: { p3, speichern: 'nativ' | 'nachgesetzt' | 'nein', profil, werte }.
// 'nativ': toBlob schreibt das Profil selbst. 'nachgesetzt': die App setzt es ein. 'nein': P3 geht verloren.
export function farbTest() {
  if (test) return test;
  test = (async () => {
    if (!p3Moeglich()) return { p3: false, speichern: 'nein', profil: null, werte: null };
    try {
      const roh = await p3Probe(false);
      if (roh.innen <= 6 && roh.aussen <= 6) return { p3: true, speichern: 'nativ', profil: roh.profil?.name || '', werte: roh };
      if (roh.innen <= 6) return { p3: true, speichern: 'nein', profil: roh.profil?.name || '', werte: roh }; // nach sRGB umgerechnet
      const neu = await p3Probe(true);
      if (neu.innen <= 6 && neu.aussen <= 6) return { p3: true, speichern: 'nachgesetzt', profil: roh.profil?.name || '', werte: neu };
      return { p3: true, speichern: 'nein', profil: roh.profil?.name || '', werte: neu };
    } catch (e) {
      return { p3: true, speichern: 'nein', profil: null, werte: null, fehler: String(e.message || e) };
    }
  })();
  return test;
}

// Arbeitsfarbraum für ein Foto mit diesem Profil. P3 nur, wenn das Gerät P3 auch speichern kann.
export async function arbeitsraum(profil) {
  if (!profil || profil.art === 'srgb' || profil.art === 'keins' || profil.art === 'anders') return 'srgb';
  const t = await farbTest();
  return t.p3 && t.speichern !== 'nein' ? 'display-p3' : 'srgb';
}

// Wird das Foto beim Einlesen umgerechnet? Dann sagt die App es (nicht still).
export function wirdUmgerechnet(profil, raum) {
  if (!profil || profil.art === 'keins' || profil.art === raum) return false;
  return true;
}
