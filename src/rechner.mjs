// Verbindung zum Kern-Worker. Ein Auftrag pro Nachricht, Antwort per id.
let worker = null;
let naechsteId = 1;
const offen = new Map();

function starte() {
  worker = new Worker(new URL('./kern.worker.mjs', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const p = offen.get(e.data.id);
    if (!p) return;
    offen.delete(e.data.id);
    if (e.data.ok) p.ok(e.data);
    else p.fehler(new Error(e.data.fehler));
  };
  worker.onerror = (e) => {
    const err = new Error(`Worker: ${e.message || 'Fehler'}`);
    for (const p of offen.values()) p.fehler(err);
    offen.clear();
    worker = null;
  };
}

export function auftrag(typ, daten = {}, transfer = []) {
  if (!worker) starte();
  const id = naechsteId++;
  return new Promise((ok, fehler) => {
    offen.set(id, { ok, fehler });
    worker.postMessage({ id, typ, ...daten }, transfer);
  });
}

export const beschaeftigt = () => offen.size > 0;
