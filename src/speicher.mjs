// IndexedDB mit eigener kleiner Hülle (TECHNIK.md, Abschnitt 4).
// Jede Änderung am Speicherformat: FORMAT erhöhen, Migration ergänzen, Test mit alten Daten.

export const DB_NAME = 'nahtlos';
export const FORMAT = 1;

// Migrationen je Ziel-Version. Bekommen die Upgrade-Transaktion.
const MIGRATIONEN = {
  1(db) {
    db.createObjectStore('strecken', { keyPath: 'id' });
    const h = db.createObjectStore('halte', { keyPath: 'id' });
    h.createIndex('strecke', 'streckeId');
    db.createObjectStore('einstellungen', { keyPath: 'schluessel' });
  },
};

export class SpeicherVoll extends Error {}

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

// --- Strecken ---

export function strecken() {
  return tx('strecken', 'readonly', (t) => anfrage(t.objectStore('strecken').getAll()))
    .then((l) => l.sort((a, b) => b.erstellt - a.erstellt));
}

export function strecke(id) {
  return tx('strecken', 'readonly', (t) => anfrage(t.objectStore('strecken').get(id)));
}

export async function neueStrecke({ name, blind = false }) {
  const s = { id: neueId(), name, erstellt: Date.now(), blind: !!blind, ziel: false, formatVersion: FORMAT, gesichertBei: 0 };
  await tx('strecken', 'readwrite', (t) => anfrage(t.objectStore('strecken').put(s)));
  return s;
}

export async function aendereStrecke(id, felder) {
  return tx('strecken', 'readwrite', async (t) => {
    const st = t.objectStore('strecken');
    const s = await anfrage(st.get(id));
    if (!s) throw new Error('Strecke fehlt');
    Object.assign(s, felder);
    await anfrage(st.put(s));
    return s;
  });
}

export function loescheStrecke(id) {
  return tx(['strecken', 'halte'], 'readwrite', async (t) => {
    const keys = await anfrage(t.objectStore('halte').index('strecke').getAllKeys(id));
    for (const k of keys) t.objectStore('halte').delete(k);
    t.objectStore('strecken').delete(id);
  });
}

// --- Halte ---

export function halte(streckeId) {
  return tx('halte', 'readonly', (t) => anfrage(t.objectStore('halte').index('strecke').getAll(streckeId)))
    .then((l) => l.sort((a, b) => a.index - b.index));
}

export function halt(id) {
  return tx('halte', 'readonly', (t) => anfrage(t.objectStore('halte').get(id)));
}

// Speichert einen neuen Halt (Rohbild zuerst). Erst nach "complete" der Transaktion zurück.
export function neuerHalt(h) {
  return tx('halte', 'readwrite', (t) => anfrage(t.objectStore('halte').add(h))).then(() => h);
}

export function aendereHalt(id, felder) {
  return tx('halte', 'readwrite', async (t) => {
    const st = t.objectStore('halte');
    const h = await anfrage(st.get(id));
    if (!h) throw new Error('Halt fehlt');
    Object.assign(h, felder);
    await anfrage(st.put(h));
    return h;
  });
}

// Löscht nur den letzten Halt einer Strecke. Der vorherige bleibt unberührt.
export function loescheLetztenHalt(streckeId) {
  return tx('halte', 'readwrite', async (t) => {
    const l = await anfrage(t.objectStore('halte').index('strecke').getAll(streckeId));
    if (!l.length) return null;
    l.sort((a, b) => a.index - b.index);
    const letzter = l[l.length - 1];
    t.objectStore('halte').delete(letzter.id);
    return letzter.id;
  });
}

export function zaehleHalte() {
  return tx('halte', 'readonly', (t) => anfrage(t.objectStore('halte').count()));
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
