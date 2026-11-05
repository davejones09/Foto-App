// Keine Spuren der App in den Ausgaben (Carousel, Reel, Collage, Gesamtbild).
// JPEG: nur JFIF und das Farbprofil bleiben, kein EXIF, kein Kommentar, keine weiteren APP-Abschnitte.
// MP4: Namen in den hdlr-Kästen werden geleert, udta und meta werden zu leeren free-Kästen (gleiche Größe,
// Player überspringen sie). Reine Rechnung, in Node getestet.

const text = (b, o, n) => String.fromCharCode(...b.subarray(o, Math.min(b.length, o + n)));

function verbinde(teile) {
  const aus = new Uint8Array(teile.reduce((s, t) => s + t.length, 0));
  let p = 0;
  for (const t of teile) { aus.set(t, p); p += t.length; }
  return aus;
}

export function jpegSauber(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return b;
  const teile = [b.subarray(0, 2)];
  let o = 2;
  while (o + 4 <= b.length && b[o] === 0xff) {
    const m = b[o + 1];
    if (m === 0xff) { o++; continue; } // Füllbyte
    if (m === 0xda || m === 0xd9) break; // ab hier Bilddaten
    const len = (b[o + 2] << 8) | b[o + 3];
    const seg = b.subarray(o, o + 2 + len);
    const jfif = m === 0xe0 && text(seg, 4, 5) === 'JFIF\0';
    const icc = m === 0xe2 && text(seg, 4, 12) === 'ICC_PROFILE\0';
    const app = m >= 0xe0 && m <= 0xef;
    if (!(m === 0xfe || (app && !jfif && !icc))) teile.push(seg);
    o += 2 + len;
  }
  teile.push(b.subarray(o));
  return verbinde(teile);
}

// Liste der Abschnitte vor den Bilddaten, für Tests und Diagnose.
export function jpegAbschnitte(b) {
  const aus = [];
  let o = 2;
  while (o + 4 <= b.length && b[o] === 0xff) {
    const m = b[o + 1];
    if (m === 0xff) { o++; continue; }
    if (m === 0xda || m === 0xd9) break;
    const len = (b[o + 2] << 8) | b[o + 3];
    aus.push({ marker: m, kennung: m >= 0xe0 && m <= 0xef ? text(b, o + 4, 12).replace(/\0.*$/s, '') : '' });
    o += 2 + len;
  }
  return aus;
}

const BEHAELTER = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'mvex', 'moof', 'traf']);

export function mp4Sauber(eingabe) {
  const b = new Uint8Array(eingabe);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const lauf = (start, ende) => {
    let o = start;
    while (o + 8 <= ende) {
      let groesse = dv.getUint32(o);
      const typ = text(b, o + 4, 4);
      let kopf = 8;
      if (groesse === 1) { groesse = Number(dv.getBigUint64(o + 8)); kopf = 16; } else if (groesse === 0) groesse = ende - o;
      if (groesse < kopf || o + groesse > ende) break;
      if (typ === 'udta' || typ === 'meta') {
        b.set([0x66, 0x72, 0x65, 0x65], o + 4); // 'free', Inhalt geleert
        b.fill(0, o + kopf, o + groesse);
      } else if (typ === 'hdlr') {
        // Version und Flags, pre_defined, handler_type, 3 × reserviert, dann der Name
        for (let i = o + kopf + 24; i < o + groesse; i++) b[i] = 0;
      } else if (BEHAELTER.has(typ)) {
        lauf(o + kopf, o + groesse);
      }
      o += groesse;
    }
  };
  lauf(0, b.length);
  return b;
}

// Zahl der Tonproben im MP4. Prüft nach dem Bauen, ob die Musik wirklich in der Datei liegt.
export function mp4TonProben(eingabe) {
  const b = new Uint8Array(eingabe);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let summe = 0;
  const lauf = (start, ende, spur) => {
    let o = start;
    while (o + 8 <= ende) {
      let groesse = dv.getUint32(o);
      const typ = text(b, o + 4, 4);
      let kopf = 8;
      if (groesse === 1) { groesse = Number(dv.getBigUint64(o + 8)); kopf = 16; } else if (groesse === 0) groesse = ende - o;
      if (groesse < kopf || o + groesse > ende) break;
      if (typ === 'trak') {
        const s = { ton: false, proben: 0 };
        lauf(o + kopf, o + groesse, s);
        if (s.ton) summe += s.proben;
      } else if (typ === 'hdlr' && spur) spur.ton = text(b, o + kopf + 8, 4) === 'soun';
      else if (typ === 'stsz' && spur) spur.proben = dv.getUint32(o + kopf + 8);
      else if (typ === 'moov' || typ === 'mdia' || typ === 'minf' || typ === 'stbl') lauf(o + kopf, o + groesse, spur);
      o += groesse;
    }
  };
  lauf(0, b.length, null);
  return summe;
}

export async function blobSauber(blob) {
  const b = new Uint8Array(await blob.arrayBuffer());
  if (blob.type === 'image/jpeg') return new Blob([jpegSauber(b)], { type: 'image/jpeg' });
  if (blob.type === 'video/mp4') return new Blob([mp4Sauber(b)], { type: 'video/mp4' });
  return blob;
}
