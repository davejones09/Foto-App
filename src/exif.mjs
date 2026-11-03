// Aufnahmezeit aus den Bilddaten lesen (JPEG mit EXIF). Ohne Treffer: null.
// Gelesen wird DateTimeOriginal, ersatzweise DateTimeDigitized oder DateTime.

const T_EXIF_IFD = 0x8769;
const T_ORIGINAL = 0x9003;
const T_DIGITAL = 0x9004;
const T_DATUM = 0x0132;

function zeitAusText(s) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s || '');
  if (!m) return null;
  const [j, mo, t, h, mi, se] = m.slice(1).map(Number);
  if (j < 1990 || mo < 1 || mo > 12 || t < 1 || t > 31) return null;
  return new Date(j, mo - 1, t, h, mi, se).getTime();
}

function liesIfd(v, tiff, off, klein) {
  const aus = new Map();
  if (off + 2 > v.byteLength) return aus;
  const n = v.getUint16(off, klein);
  for (let i = 0; i < n; i++) {
    const e = off + 2 + i * 12;
    if (e + 12 > v.byteLength) break;
    aus.set(v.getUint16(e, klein), { typ: v.getUint16(e + 2, klein), anzahl: v.getUint32(e + 4, klein), wert: e + 8 });
  }
  return aus;
}

function text(v, tiff, eintrag, klein) {
  if (!eintrag || eintrag.typ !== 2) return null;
  const start = eintrag.anzahl > 4 ? tiff + v.getUint32(eintrag.wert, klein) : eintrag.wert;
  let s = '';
  for (let i = 0; i < eintrag.anzahl - 1 && start + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(start + i));
  return s;
}

// puffer: ArrayBuffer mit dem Anfang der Datei (die ersten 128 KB reichen).
export function aufnahmezeit(puffer) {
  try {
    const v = new DataView(puffer);
    if (v.getUint16(0) !== 0xffd8) return null;
    let p = 2;
    while (p + 4 < v.byteLength) {
      if (v.getUint8(p) !== 0xff) return null;
      const marke = v.getUint8(p + 1);
      const laenge = v.getUint16(p + 2);
      if (marke === 0xda || marke === 0xd9) return null;
      if (marke === 0xe1 && v.getUint32(p + 4) === 0x45786966) { // "Exif"
        const tiff = p + 10;
        const klein = v.getUint16(tiff) === 0x4949;
        const ifd0 = liesIfd(v, tiff, tiff + v.getUint32(tiff + 4, klein), klein);
        const exifZeiger = ifd0.get(T_EXIF_IFD);
        let exif = new Map();
        if (exifZeiger) exif = liesIfd(v, tiff, tiff + v.getUint32(exifZeiger.wert, klein), klein);
        for (const [ifd, tag] of [[exif, T_ORIGINAL], [exif, T_DIGITAL], [ifd0, T_DATUM]]) {
          const z = zeitAusText(text(v, tiff, ifd.get(tag), klein));
          if (z != null) return z;
        }
        return null;
      }
      p += 2 + laenge;
    }
  } catch {}
  return null;
}

export async function aufnahmezeitAusDatei(datei) {
  try {
    return aufnahmezeit(await datei.slice(0, 131072).arrayBuffer());
  } catch {
    return null;
  }
}
