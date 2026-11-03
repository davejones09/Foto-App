// Kleines ZIP ohne Kompression ("stored"). Statt fflate, weil Blobs so nie ganz in den
// Arbeitsspeicher müssen: Schreiben hängt die Original-Blobs an, Lesen schneidet Blob-Stücke.
// Siehe docs/ENTSCHEIDUNGEN.md.

const TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(daten, crc = 0) {
  let c = ~crc >>> 0;
  for (let i = 0; i < daten.length; i++) c = TABELLE[(c ^ daten[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function bytesVon(inhalt) {
  if (inhalt instanceof Uint8Array) return inhalt;
  if (typeof inhalt === 'string') return enc.encode(inhalt);
  return new Uint8Array(await inhalt.arrayBuffer());
}

function dosZeit(d) {
  const zeit = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const datum = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { zeit, datum };
}

// dateien: [{ name, inhalt: Blob | Uint8Array | string }]. Ergebnis: Blob.
export async function packe(dateien, { fortschritt, datum = new Date() } = {}) {
  const teile = [];
  const zentral = [];
  let offset = 0;
  const { zeit, datum: tag } = dosZeit(datum);
  for (let i = 0; i < dateien.length; i++) {
    const { name, inhalt } = dateien[i];
    const bytes = await bytesVon(inhalt);
    const crc = crc32(bytes);
    const groesse = bytes.length;
    const nameB = enc.encode(name);
    const kopf = new Uint8Array(30 + nameB.length);
    const v = new DataView(kopf.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0800, true); // UTF-8
    v.setUint16(8, 0, true);
    v.setUint16(10, zeit, true);
    v.setUint16(12, tag, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, groesse, true);
    v.setUint32(22, groesse, true);
    v.setUint16(26, nameB.length, true);
    v.setUint16(28, 0, true);
    kopf.set(nameB, 30);
    teile.push(kopf, inhalt instanceof Blob ? inhalt : bytes);
    const z = new Uint8Array(46 + nameB.length);
    const zv = new DataView(z.buffer);
    zv.setUint32(0, 0x02014b50, true);
    zv.setUint16(4, 20, true);
    zv.setUint16(6, 20, true);
    zv.setUint16(8, 0x0800, true);
    zv.setUint16(10, 0, true);
    zv.setUint16(12, zeit, true);
    zv.setUint16(14, tag, true);
    zv.setUint32(16, crc, true);
    zv.setUint32(20, groesse, true);
    zv.setUint32(24, groesse, true);
    zv.setUint16(28, nameB.length, true);
    zv.setUint32(42, offset, true);
    z.set(nameB, 46);
    zentral.push(z);
    offset += kopf.length + groesse;
    if (offset > 0xfffffff0) throw new Error('Sicherung zu groß für ZIP ohne ZIP64');
    fortschritt?.((i + 1) / dateien.length);
  }
  const zGroesse = zentral.reduce((s, z) => s + z.length, 0);
  const ende = new Uint8Array(22);
  const ev = new DataView(ende.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, dateien.length, true);
  ev.setUint16(10, dateien.length, true);
  ev.setUint32(12, zGroesse, true);
  ev.setUint32(16, offset, true);
  return new Blob([...teile, ...zentral, ende], { type: 'application/zip' });
}

// Liest das Inhaltsverzeichnis. Ergebnis: Map name -> { blob, crc, groesse }.
export async function entpacke(blob) {
  const n = blob.size;
  const schwanz = new Uint8Array(await blob.slice(Math.max(0, n - 65557), n).arrayBuffer());
  let e = -1;
  for (let i = schwanz.length - 22; i >= 0; i--) {
    if (schwanz[i] === 0x50 && schwanz[i + 1] === 0x4b && schwanz[i + 2] === 0x05 && schwanz[i + 3] === 0x06) { e = i; break; }
  }
  if (e < 0) throw new Error('Keine ZIP-Datei');
  const ev = new DataView(schwanz.buffer, e);
  const anzahl = ev.getUint16(10, true);
  const zGroesse = ev.getUint32(12, true);
  const zStart = ev.getUint32(16, true);
  const z = new Uint8Array(await blob.slice(zStart, zStart + zGroesse).arrayBuffer());
  const zv = new DataView(z.buffer);
  const aus = new Map();
  let p = 0;
  for (let i = 0; i < anzahl; i++) {
    if (zv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP beschädigt');
    const methode = zv.getUint16(p + 10, true);
    const crc = zv.getUint32(p + 16, true);
    const groesse = zv.getUint32(p + 20, true);
    const nl = zv.getUint16(p + 28, true);
    const xl = zv.getUint16(p + 30, true);
    const kl = zv.getUint16(p + 32, true);
    const lokal = zv.getUint32(p + 42, true);
    const name = dec.decode(z.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + kl;
    if (methode !== 0) throw new Error('Komprimierte ZIP-Einträge werden nicht unterstützt');
    const lk = new DataView(await blob.slice(lokal, lokal + 30).arrayBuffer());
    const start = lokal + 30 + lk.getUint16(26, true) + lk.getUint16(28, true);
    aus.set(name, { blob: blob.slice(start, start + groesse), crc, groesse });
  }
  return aus;
}

export async function pruefe(eintrag) {
  const bytes = new Uint8Array(await eintrag.blob.arrayBuffer());
  return bytes.length === eintrag.groesse && crc32(bytes) === eintrag.crc;
}
