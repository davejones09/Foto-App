// IndexedDB mit eigener kleiner Hülle (TECHNIK.md, Abschnitt 4).
// Jede Änderung am Speicherformat: FORMAT erhöhen, Migration ergänzen, Test mit alten Daten.
//
// Ab Format 3 liegen nie Blobs in IndexedDB: WebKit auf dem iPhone verliert sie (unlesbar nach dem
// Speichern). Bilddaten liegen als ArrayBuffer im Speicher "dateien". Halte und Serienfotos enthalten nur
// Metadaten; ihre Bildfelder (roh, bild, naht, vorschau, nahtVorschau) halten einen Verweis
// { schluessel, laenge, typ } oder null. Gelesen wird über blob(meta, feld), das einen frischen Blob baut.

export const DB_NAME = 'nahtlos';
export const FORMAT = 6;
const KAMERA_BREITE = 1296; // Breite eines 4:5-Halts, so waren alle Halte bis Format 3
export const BILDFELDER = ['roh', 'bild', 'naht', 'vorschau', 'nahtVorschau'];

// Migrationen je Ziel-Version. Bekommen die Upgrade-Transaktion. Der Umzug der Blobs aus Format 1 und 2
// läuft danach asynchron in migriereBlobs(), weil eine Upgrade-Transaktion kein await auf Blobs übersteht.
const MIGRATIONEN = {
  1(db) {
    db.createObjectStore('strecken', { keyPath: 'id' });
    const h = db.createObjectStore('halte', { keyPath: 'id' });
    h.createIndex('strecke', 'streckeId');
    db.createObjectStore('einstellungen', { keyPath: 'schluessel' });
  },
  // 2: Zwischenablage für Serien aus der Mediathek. Bestehende Strecken bleiben unberührt.
  2(db) {
    const s = db.createObjectStore('serie', { keyPath: 'id' });
    s.createIndex('strecke', 'streckeId');
  },
  // 3: Bilddaten als ArrayBuffer in eigenem Speicher. Index auf der Länge für die Diagnose (ohne Daten zu laden).
  3(db) {
    const d = db.createObjectStore('dateien', { keyPath: 'schluessel' });
    d.createIndex('laenge', 'laenge');
  },
  // 4: Halte haben eine eigene Breite. Nichts am Aufbau ändert sich; alte Halte bekommen die Breite
  // 1296 in migriereBreiten(), nach dem Blob-Umzug. Im Upgrade selbst nichts umschreiben: Datensätze
  // mit alten Blobs dürfen auf dem iPhone nicht noch einmal geschrieben werden.
  4() {},
  // 5: Collagen als eigener Projekttyp. Nur ein neuer Speicher, an Strecken und Halten ändert sich nichts.
  // { id, name, erstellt, geaendert, format, vorlage, stil, abstand, farbe, fotos: [Foto], felder: [{ foto, t }],
  //   vorschau: Verweis }  Foto: { id, rohB, rohH, farbraum, profil, name, zeit, motiv, roh, vorschau }
  5(db) {
    db.createObjectStore('collagen', { keyPath: 'id' });
  },
  // 6: Reel-Entwurf. Nur ein neuer Speicher, an allem anderen ändert sich nichts. Ein Eintrag 'aktuell':
  // { id, geaendert, stil, laenge, medien: [{ id, typ, name, mime, groesse, teile, start, ende, laenge, eigen, rahmen,
  //   dauer }], musik: { name, mime, groesse, teile, start, alle } | null }
  // Die Bytes liegen in Stücken zu höchstens 8 MB in "dateien" unter entwurf/<id>/<n>.
  6(db) {
    db.createObjectStore('reelentwurf', { keyPath: 'id' });
  },
};

export class SpeicherVoll extends Error {}
export class NichtGesichert extends Error {}

let dbVersprechen = null;

export function oeffne(name = DB_NAME) {
  if (dbVersprechen) return dbVersprechen;
  dbVersprechen = new Promise((ok, fehler) => {
    const r = indexedDB.open(name, FORMAT);
    r.onupgradeneeded = (e) => {
      const db = r.result;
      for (let v = e.oldVersion + 1; v <= FORMAT; v++) MIGRATIONEN[v](db, r.transaction);
    };
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => db.close();
      ok(db);
    };
    r.onerror = () => fehler(r.error);
    r.onblocked = () => fehler(new Error('Datenbank blockiert'));
  });
  dbVersprechen.catch(() => (dbVersprechen = null));
  return dbVersprechen;
}

function uebersetze(err) {
  if (err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''))) return new SpeicherVoll(err.message);
  return err;
}

async function tx(stores, modus, arbeit) {
  const db = await oeffne();
  return new Promise((ok, fehler) => {
    let ergebnis;
    let t;
    try {
      t = db.transaction(stores, modus);
    } catch (e) {
      fehler(uebersetze(e));
      return;
    }
    t.oncomplete = () => ok(ergebnis);
    t.onerror = () => fehler(uebersetze(t.error));
    t.onabort = () => fehler(uebersetze(t.error || new Error('Transaktion abgebrochen')));
    Promise.resolve(arbeit(t)).then((r) => (ergebnis = r), (e) => { try { t.abort(); } catch {} fehler(uebersetze(e)); });
  });
}

const anfrage = (r) => new Promise((ok, fehler) => { r.onsuccess = () => ok(r.result); r.onerror = () => fehler(r.error); });

export const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

// --- Dateien ---

export const istVerweis = (v) => !!v && typeof v === 'object' && typeof v.schluessel === 'string' && !(typeof Blob !== 'undefined' && v instanceof Blob);
const dateiSchluessel = (besitzer, feld) => `${besitzer}/${feld}`;

function keinBlob(werte) {
  for (const [k, v] of Object.entries(werte || {})) {
    if (typeof Blob !== 'undefined' && v instanceof Blob) throw new Error(`Blob im Feld ${k}: Bilddaten gehören in den Speicher "dateien"`);
  }
}

// Wandelt Bilddaten in ArrayBuffer um. Läuft vor jeder Transaktion: Ein await auf einen Blob innerhalb
// einer Transaktion würde sie beenden.
async function vorbereiten(besitzer, dateien) {
  const eintraege = [];
  const verweise = {};
  for (const [feld, wert] of Object.entries(dateien || {})) {
    if (wert == null) { verweise[feld] = null; continue; }
    let daten;
    let typ = 'image/jpeg';
    if (typeof Blob !== 'undefined' && wert instanceof Blob) { daten = await wert.arrayBuffer(); typ = wert.type || typ; }
    else if (wert instanceof ArrayBuffer) daten = wert;
    else if (ArrayBuffer.isView(wert)) daten = wert.buffer.slice(wert.byteOffset, wert.byteOffset + wert.byteLength);
    else if (wert.daten) { daten = wert.daten instanceof ArrayBuffer ? wert.daten : wert.daten.buffer.slice(0); typ = wert.typ || typ; }
    else throw new Error(`Unbekannte Bilddaten im Feld ${feld}`);
    if (!daten.byteLength) throw new NichtGesichert(`Leere Bilddaten im Feld ${feld}`);
    const schluessel = dateiSchluessel(besitzer, feld);
    eintraege.push({ schluessel, typ, laenge: daten.byteLength, daten });
    verweise[feld] = { schluessel, laenge: daten.byteLength, typ };
  }
  return { eintraege, verweise };
}

// Prüfung nach dem Schreiben: zurücklesen und die Länge vergleichen.
async function pruefe(eintraege) {
  for (const e of eintraege) {
    const r = await tx('dateien', 'readonly', (t) => anfrage(t.objectStore('dateien').get(e.schluessel)));
    const n = r && r.daten && typeof r.daten.byteLength === 'number' ? r.daten.byteLength : -1;
    if (n !== e.laenge) throw new NichtGesichert(`Prüfung nach dem Schreiben gescheitert: ${e.schluessel} (${n} statt ${e.laenge} Bytes)`);
  }
}

// Eine einzelne Datei schreiben und prüfen, etwa das Logo der Signatur.
export async function dateiSchreiben(e) {
  await tx('dateien', 'readwrite', (t) => anfrage(t.objectStore('dateien').put(e)));
  await pruefe([e]);
}

export function datei(schluessel) {
  return tx('dateien', 'readonly', (t) => anfrage(t.objectStore('dateien').get(schluessel)));
}

// Frischer Blob im Speicher für ein Bildfeld, oder null, wenn es fehlt.
export async function blob(meta, feld) {
  const v = meta?.[feld];
  if (!istVerweis(v)) return null;
  const r = await datei(v.schluessel);
  if (!r || !r.daten || r.daten.byteLength !== v.laenge) return null;
  return new Blob([r.daten], { type: r.typ || v.typ || 'image/jpeg' });
}

// Wie blob(), aber mit klarer Fehlermeldung, wenn die Daten fehlen.
export async function blobPflicht(meta, feld) {
  const b = await blob(meta, feld);
  if (!b) throw new Error(`Bilddaten fehlen oder sind unlesbar: ${feld} von Foto ${(meta?.index ?? 0) + 1}`);
  return b;
}

const verweiseVon = (meta) => BILDFELDER.map((f) => meta?.[f]).filter(istVerweis).map((v) => v.schluessel);

// --- Strecken ---

export function strecken() {
  return tx('strecken', 'readonly', (t) => anfrage(t.objectStore('strecken').getAll()))
    .then((l) => l.sort((a, b) => b.erstellt - a.erstellt));
}

export function strecke(id) {
  return tx('strecken', 'readonly', (t) => anfrage(t.objectStore('strecken').get(id)));
}

// art: wofür das Projekt angelegt wurde ('carousel' oder 'reel'). Beide Ausgaben gehen immer.
export async function neueStrecke({ name, blind = false, art = 'carousel' }) {
  const s = { id: neueId(), name, erstellt: Date.now(), blind: !!blind, ziel: false, formatVersion: FORMAT, gesichertBei: 0, art };
  await tx('strecken', 'readwrite', (t) => anfrage(t.objectStore('strecken').put(s)));
  return s;
}

export async function aendereStrecke(id, felder) {
  return tx('strecken', 'readwrite', async (t) => {
    const st = t.objectStore('strecken');
    const s = await anfrage(st.get(id));
    if (!s) throw new Error('Projekt fehlt');
    Object.assign(s, felder);
    await anfrage(st.put(s));
    return s;
  });
}

export function loescheStrecke(id) {
  return tx(['strecken', 'halte', 'serie', 'dateien'], 'readwrite', async (t) => {
    const halte = await anfrage(t.objectStore('halte').index('strecke').getAll(id));
    const wartend = await anfrage(t.objectStore('serie').index('strecke').getAll(id));
    for (const m of [...halte, ...wartend]) for (const k of verweiseVon(m)) t.objectStore('dateien').delete(k);
    for (const h of halte) t.objectStore('halte').delete(h.id);
    for (const f of wartend) t.objectStore('serie').delete(f.id);
    t.objectStore('strecken').delete(id);
  });
}

// --- Collagen (nur Metadaten, Bilddaten in "dateien") ---

const COLLAGE_FELDER = ['vorschau'];
const fotoVerweise = (f) => ['roh', 'vorschau'].map((k) => f?.[k]).filter(istVerweis).map((v) => v.schluessel);

export function collagen() {
  return tx('collagen', 'readonly', (t) => anfrage(t.objectStore('collagen').getAll()))
    .then((l) => l.sort((a, b) => (b.geaendert || b.erstellt) - (a.geaendert || a.erstellt)));
}

export function collage(id) {
  return tx('collagen', 'readonly', (t) => anfrage(t.objectStore('collagen').get(id)));
}

export async function neueCollage({ name, format = '4:5', stil = 'rahmen' }) {
  const c = {
    id: neueId(), name, erstellt: Date.now(), geaendert: Date.now(), format, vorlage: null, stil,
    abstand: 0.012, farbe: '#ffffff', fotos: [], felder: [], vorschau: null, formatVersion: FORMAT,
  };
  await tx('collagen', 'readwrite', (t) => anfrage(t.objectStore('collagen').put(c)));
  return c;
}

export async function aendereCollage(id, felder = {}, dateien = null) {
  keinBlob(felder);
  const { eintraege, verweise } = await vorbereiten(id, dateien || {});
  const c = await tx(['collagen', 'dateien'], 'readwrite', async (t) => {
    const st = t.objectStore('collagen');
    const alt = await anfrage(st.get(id));
    if (!alt) throw new Error('Collage fehlt');
    for (const e of eintraege) t.objectStore('dateien').put(e);
    Object.assign(alt, felder, verweise, { geaendert: Date.now() });
    await anfrage(st.put(alt));
    return alt;
  });
  await pruefe(eintraege);
  return c;
}

// Ein Foto kommt dazu: erst die Bilddaten, dann der Eintrag, dann zurücklesen. Scheitert das, ist es nicht da.
export async function collageFotoHinzu(collageId, foto, { roh, vorschau }) {
  keinBlob(foto);
  const { eintraege, verweise } = await vorbereiten(foto.id, { roh, vorschau });
  const f = { ...foto, ...verweise };
  await tx(['collagen', 'dateien'], 'readwrite', async (t) => {
    const st = t.objectStore('collagen');
    const c = await anfrage(st.get(collageId));
    if (!c) throw new Error('Collage fehlt');
    for (const e of eintraege) t.objectStore('dateien').put(e);
    c.fotos.push(f);
    c.geaendert = Date.now();
    await anfrage(st.put(c));
  });
  try {
    await pruefe(eintraege);
  } catch (err) {
    await collageFotoEntfernen(collageId, f.id).catch(() => {});
    throw err;
  }
  return f;
}

export function collageFotoEntfernen(collageId, fotoId) {
  return tx(['collagen', 'dateien'], 'readwrite', async (t) => {
    const st = t.objectStore('collagen');
    const c = await anfrage(st.get(collageId));
    if (!c) return null;
    const f = c.fotos.find((x) => x.id === fotoId);
    if (f) for (const k of fotoVerweise(f)) t.objectStore('dateien').delete(k);
    c.fotos = c.fotos.filter((x) => x.id !== fotoId);
    c.felder = (c.felder || []).filter((x) => x.foto !== fotoId);
    c.geaendert = Date.now();
    await anfrage(st.put(c));
    return c;
  });
}

export function loescheCollage(id) {
  return tx(['collagen', 'dateien'], 'readwrite', async (t) => {
    const c = await anfrage(t.objectStore('collagen').get(id));
    if (!c) return;
    for (const f of c.fotos || []) for (const k of fotoVerweise(f)) t.objectStore('dateien').delete(k);
    for (const feld of COLLAGE_FELDER) if (istVerweis(c[feld])) t.objectStore('dateien').delete(c[feld].schluessel);
    t.objectStore('collagen').delete(id);
  });
}

// --- Halte (nur Metadaten) ---

const LEER = { breite: KAMERA_BREITE, uebergang: null, motiv: null, farbraum: 'srgb', profil: null, nahtFarbraum: null, verfahren: null, biegung: null, roh: null, bild: null, naht: null, vorschau: null, nahtVorschau: null, pfad: null, wert: null, teile: null, name: '', beschaedigt: null };

export function halte(streckeId) {
  return tx('halte', 'readonly', (t) => anfrage(t.objectStore('halte').index('strecke').getAll(streckeId)))
    .then((l) => l.sort((a, b) => a.index - b.index));
}

export function halt(id) {
  return tx('halte', 'readonly', (t) => anfrage(t.objectStore('halte').get(id)));
}

// Neuer Halt mit Bilddaten (Rohbild zuerst). Kehrt erst zurück, wenn alles geschrieben und
// zurückgelesen ist. Scheitert die Prüfung, wird der Halt wieder entfernt: Er gilt nicht als gesichert.
export async function neuerHalt(meta, dateien = {}) {
  keinBlob(meta);
  const { eintraege, verweise } = await vorbereiten(meta.id, dateien);
  const h = { ...LEER, ...meta, ...verweise };
  await tx(['halte', 'dateien'], 'readwrite', async (t) => {
    for (const e of eintraege) t.objectStore('dateien').put(e);
    await anfrage(t.objectStore('halte').add(h));
  });
  try {
    await pruefe(eintraege);
  } catch (err) {
    await tx(['halte', 'dateien'], 'readwrite', (t) => {
      for (const e of eintraege) t.objectStore('dateien').delete(e.schluessel);
      t.objectStore('halte').delete(h.id);
    }).catch(() => {});
    throw err;
  }
  return h;
}

// Ändert Metadaten und schreibt optional Bildfelder (null löscht ein Feld samt Daten).
export async function aendereHalt(id, felder = {}, dateien = null) {
  keinBlob(felder);
  const { eintraege, verweise } = await vorbereiten(id, dateien || {});
  const h = await tx(['halte', 'dateien'], 'readwrite', async (t) => {
    const st = t.objectStore('halte');
    const alt = await anfrage(st.get(id));
    if (!alt) throw new Error('Foto fehlt');
    for (const [feld, v] of Object.entries(verweise)) {
      if (v === null && istVerweis(alt[feld])) t.objectStore('dateien').delete(alt[feld].schluessel);
    }
    for (const e of eintraege) t.objectStore('dateien').put(e);
    Object.assign(alt, felder, verweise);
    await anfrage(st.put(alt));
    return alt;
  });
  await pruefe(eintraege);
  return h;
}

// Löscht nur den letzten Halt einer Strecke samt Bilddaten. Der vorherige bleibt unberührt.
export function loescheLetztenHalt(streckeId) {
  return tx(['halte', 'dateien'], 'readwrite', async (t) => {
    const l = await anfrage(t.objectStore('halte').index('strecke').getAll(streckeId));
    if (!l.length) return null;
    l.sort((a, b) => a.index - b.index);
    const letzter = l[l.length - 1];
    for (const k of verweiseVon(letzter)) t.objectStore('dateien').delete(k);
    t.objectStore('halte').delete(letzter.id);
    return letzter.id;
  });
}

// Löscht einen beliebigen Halt (etwa einen beschädigten). Die späteren rücken auf. Der direkte
// Nachfolger verliert seine Naht (sie gehörte zum gelöschten Halt) und, falls sein Rohbild da ist,
// auch Bild und Vorschau: Er wird danach gegen seinen neuen Vorgänger neu genäht (ausbessern()).
export function loescheHalt(id) {
  return tx(['halte', 'dateien'], 'readwrite', async (t) => {
    const st = t.objectStore('halte');
    const ziel = await anfrage(st.get(id));
    if (!ziel) return null;
    const l = (await anfrage(st.index('strecke').getAll(ziel.streckeId))).sort((a, b) => a.index - b.index);
    for (const k of verweiseVon(ziel)) t.objectStore('dateien').delete(k);
    st.delete(ziel.id);
    for (const h of l) {
      if (h.index <= ziel.index) continue;
      if (h.index === ziel.index + 1) {
        const weg = h.roh ? ['bild', 'naht', 'vorschau', 'nahtVorschau'] : ['naht', 'nahtVorschau'];
        for (const f of weg) if (istVerweis(h[f])) { t.objectStore('dateien').delete(h[f].schluessel); h[f] = null; }
        h.pfad = null;
        h.wert = null;
        h.teile = null;
      }
      h.index -= 1;
      st.put(h);
    }
    return ziel.id;
  });
}

// --- Serie: Rohbilder warten hier, bis sie als Halte gebaut sind (nur Metadaten) ---
// { id, streckeId, serieId, reihe, roh: Verweis, rohB, rohH, zeit, aufnahme, name, plan }

export async function neuesSerienFoto(meta, { roh }) {
  keinBlob(meta);
  const { eintraege, verweise } = await vorbereiten(meta.id, { roh });
  const f = { ...meta, ...verweise };
  await tx(['serie', 'dateien'], 'readwrite', async (t) => {
    for (const e of eintraege) t.objectStore('dateien').put(e);
    await anfrage(t.objectStore('serie').add(f));
  });
  try {
    await pruefe(eintraege);
  } catch (err) {
    await tx(['serie', 'dateien'], 'readwrite', (t) => {
      for (const e of eintraege) t.objectStore('dateien').delete(e.schluessel);
      t.objectStore('serie').delete(f.id);
    }).catch(() => {});
    throw err;
  }
  return f;
}

export function serienFotos(streckeId) {
  return tx('serie', 'readonly', (t) => anfrage(t.objectStore('serie').index('strecke').getAll(streckeId)))
    .then((l) => l.sort((a, b) => a.reihe - b.reihe));
}

export function aendereSerienFoto(id, felder) {
  keinBlob(felder);
  return tx('serie', 'readwrite', async (t) => {
    const st = t.objectStore('serie');
    const f = await anfrage(st.get(id));
    if (!f) return null;
    Object.assign(f, felder);
    await anfrage(st.put(f));
    return f;
  });
}

export function loescheSerienFoto(id) {
  return tx(['serie', 'dateien'], 'readwrite', async (t) => {
    const f = await anfrage(t.objectStore('serie').get(id));
    if (f) for (const k of verweiseVon(f)) t.objectStore('dateien').delete(k);
    t.objectStore('serie').delete(id);
  });
}

// Macht aus einem wartenden Foto einen Halt. Eine Transaktion, nur Metadaten: Der Halt übernimmt den
// Verweis auf das schon gesicherte Rohbild, die Bilddaten werden nicht noch einmal geschrieben.
export function serienFotoZuHalt(fotoId, halt) {
  keinBlob(halt);
  return tx(['serie', 'halte'], 'readwrite', async (t) => {
    const f = await anfrage(t.objectStore('serie').get(fotoId));
    if (!f) throw new Error('Serienfoto fehlt');
    const h = { ...LEER, ...halt, roh: f.roh, rohB: f.rohB, rohH: f.rohH, farbraum: f.farbraum || 'srgb', profil: f.profil || null };
    await anfrage(t.objectStore('halte').add(h));
    t.objectStore('serie').delete(fotoId);
    return h;
  });
}

export function zaehleSerienFotos() {
  return tx('serie', 'readonly', (t) => anfrage(t.objectStore('serie').count()));
}

export function zaehleHalte() {
  return tx('halte', 'readonly', (t) => anfrage(t.objectStore('halte').count()));
}

// --- Umzug aus Format 1 und 2: Blobs in ArrayBuffer ---

const hatBlobs = (r) => BILDFELDER.some((f) => typeof Blob !== 'undefined' && r?.[f] instanceof Blob);

export async function alteBlobs() {
  const [h, s] = await Promise.all([
    tx('halte', 'readonly', (t) => anfrage(t.objectStore('halte').getAllKeys())),
    tx('serie', 'readonly', (t) => anfrage(t.objectStore('serie').getAllKeys())),
  ]);
  const aus = [];
  for (const [store, keys] of [['halte', h], ['serie', s]]) {
    for (const k of keys) {
      const r = await tx(store, 'readonly', (t) => anfrage(t.objectStore(store).get(k)));
      if (hatBlobs(r)) aus.push({ store, id: k });
    }
  }
  return aus;
}

// Zieht jeden alten Blob in den Speicher "dateien" um, einen Datensatz nach dem anderen.
// Unlesbare Blobs brechen nicht ab: Das Feld wird leer, der Halt als beschädigt markiert.
export async function migriereBlobs({ fortschritt } = {}) {
  const liste = await alteBlobs();
  let beschaedigt = 0;
  for (let i = 0; i < liste.length; i++) {
    const { store, id } = liste[i];
    const alt = await tx(store, 'readonly', (t) => anfrage(t.objectStore(store).get(id)));
    if (!alt || !hatBlobs(alt)) continue;
    const dateien = {};
    const kaputt = [];
    let grund = '';
    for (const feld of BILDFELDER) {
      const v = alt[feld];
      if (!(v instanceof Blob)) continue;
      try {
        const daten = await v.arrayBuffer();
        if (!daten.byteLength) throw new Error('leer');
        dateien[feld] = { daten, typ: v.type || 'image/jpeg' };
      } catch (err) {
        kaputt.push(feld);
        grund = `${feld}: ${err && err.message || err}`;
      }
    }
    const { eintraege, verweise } = await vorbereiten(id, dateien);
    await tx([store, 'dateien'], 'readwrite', async (t) => {
      const st = t.objectStore(store);
      const r = await anfrage(st.get(id));
      if (!r) return;
      for (const e of eintraege) t.objectStore('dateien').put(e);
      for (const f of BILDFELDER) if (r[f] instanceof Blob) r[f] = null;
      Object.assign(r, verweise);
      if (kaputt.length) r.beschaedigt = { felder: kaputt, grund, zeit: Date.now() };
      st.put(r);
    });
    await pruefe(eintraege);
    if (kaputt.length) beschaedigt++;
    fortschritt?.((i + 1) / liste.length);
  }
  return { umgezogen: liste.length, beschaedigt };
}

// Format 4: Halte ohne Breite waren alle 4:5, also 1296 breit.
export async function migriereBreiten() {
  const keys = await tx('halte', 'readonly', (t) => anfrage(t.objectStore('halte').getAllKeys()));
  let n = 0;
  for (const k of keys) {
    const geaendert = await tx('halte', 'readwrite', async (t) => {
      const st = t.objectStore('halte');
      const r = await anfrage(st.get(k));
      if (!r || r.breite || hatBlobs(r)) return false;
      r.breite = KAMERA_BREITE;
      await anfrage(st.put(r));
      return true;
    });
    if (geaendert) n++;
  }
  return n;
}

// --- Diagnose ---

// Anzahl und Gesamtgröße der Einträge in "dateien", über den Index, ohne Bilddaten zu laden.
export function dateienStatistik() {
  return tx('dateien', 'readonly', (t) => new Promise((ok, fehler) => {
    let anzahl = 0;
    let bytes = 0;
    const r = t.objectStore('dateien').index('laenge').openKeyCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (!c) { ok({ anzahl, bytes }); return; }
      anzahl++;
      bytes += c.key;
      c.continue();
    };
    r.onerror = () => fehler(r.error);
  }));
}

export async function beschaedigteHalte() {
  const alle = await tx('halte', 'readonly', (t) => anfrage(t.objectStore('halte').getAll()));
  return alle.filter((h) => h.beschaedigt || (!h.bild && !h.roh));
}

// Lesetest: jedes Bildfeld jedes Halts zurücklesen und die Länge prüfen. Liest eine Datei nach der anderen.
export async function lesetest(streckeId) {
  const aus = [];
  for (const h of await halte(streckeId)) {
    const fehlt = [];
    let ok = 0;
    for (const f of BILDFELDER) {
      const v = h[f];
      if (!istVerweis(v)) continue;
      const r = await datei(v.schluessel).catch(() => null);
      if (r && r.daten && r.daten.byteLength === v.laenge) ok++;
      else fehlt.push(f);
    }
    aus.push({ index: h.index, ok, fehlt, beschaedigt: h.beschaedigt?.felder || [] });
  }
  return aus;
}

// --- Einstellungen (klein, nicht kritisch) ---

export function einstellung(schluessel, standard = null) {
  return tx('einstellungen', 'readonly', (t) => anfrage(t.objectStore('einstellungen').get(schluessel)))
    .then((r) => (r ? r.wert : standard));
}

export function setzeEinstellung(schluessel, wert) {
  return tx('einstellungen', 'readwrite', (t) => anfrage(t.objectStore('einstellungen').put({ schluessel, wert })));
}

export async function schaetzung() {
  const aus = { belegt: null, frei: null, dauerhaft: null };
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      aus.belegt = e.usage;
      aus.frei = e.quota;
    }
    if (navigator.storage?.persisted) aus.dauerhaft = await navigator.storage.persisted();
  } catch {}
  return aus;
}

// --- Reel-Entwurf: Clips, Fotos und Musik, damit nichts verloren geht, wenn iOS die App schließt ---

export const ENTWURF_STUECK = 8 * 1024 * 1024;
const entwurfTeil = (id, n) => `entwurf/${id}/${n}`;

export function reelEntwurf() {
  return tx('reelentwurf', 'readonly', (t) => anfrage(t.objectStore('reelentwurf').get('aktuell')));
}

export function speichereReelEntwurf(entwurf) {
  keinBlob(entwurf);
  return tx('reelentwurf', 'readwrite', (t) => anfrage(t.objectStore('reelentwurf').put({ ...entwurf, id: 'aktuell', geaendert: Date.now() })));
}

// Datei in Stücken ablegen. Jedes Stück wird einzeln gelesen, geschrieben und geprüft, damit nie die ganze
// Datei auf einmal im Speicher liegt. Gibt die Zahl der Stücke zurück.
export async function entwurfDateiSpeichern(id, datei) {
  const n = Math.max(1, Math.ceil(datei.size / ENTWURF_STUECK));
  for (let i = 0; i < n; i++) {
    const daten = await datei.slice(i * ENTWURF_STUECK, Math.min(datei.size, (i + 1) * ENTWURF_STUECK)).arrayBuffer();
    const e = { schluessel: entwurfTeil(id, i), typ: 'application/octet-stream', laenge: daten.byteLength, daten };
    await tx('dateien', 'readwrite', (t) => anfrage(t.objectStore('dateien').put(e)));
    await pruefe([e]);
  }
  return n;
}

export async function entwurfDateiLesen(id, teile, typ) {
  const stuecke = [];
  for (let i = 0; i < teile; i++) {
    const r = await datei(entwurfTeil(id, i));
    if (!r?.daten?.byteLength) return null;
    stuecke.push(r.daten);
  }
  return new Blob(stuecke, { type: typ });
}

export function entwurfDateiLoeschen(id) {
  const bereich = IDBKeyRange.bound(`entwurf/${id}/`, `entwurf/${id}/\uffff`);
  return tx('dateien', 'readwrite', (t) => anfrage(t.objectStore('dateien').delete(bereich)));
}

export function loescheReelEntwurf() {
  return tx(['reelentwurf', 'dateien'], 'readwrite', (t) => {
    t.objectStore('dateien').delete(IDBKeyRange.bound('entwurf/', 'entwurf/\uffff'));
    return anfrage(t.objectStore('reelentwurf').delete('aktuell'));
  });
}
