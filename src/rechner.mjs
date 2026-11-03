// Verbindung zum Kern-Worker. Ein Auftrag pro Nachricht, Antwort per id.
// Jeder Auftrag hat eine Zeitgrenze. Antwortet der Worker nicht (Absturz, Speichermangel), wird er
// beendet und beim nächsten Auftrag frisch gestartet. Alle offenen Aufträge scheitern dann mit WorkerFehler.
// Zustand im Worker (Sucher-Rest, Serienplan) ist danach weg: generation() zeigt, ob neu aufgebaut werden muss.
import { protokolliere } from './diagnose.mjs';

export class WorkerFehler extends Error {}

const ZEITGRENZE = {
  anschliessen: 60000,
  'serie-plane': 60000,
  'serie-alternativen': 30000,
  'serie-foto': 30000,
  analyse: 15000,
  standard: 20000,
};

let worker = null;
let gen = 0;
let naechsteId = 1;
const offen = new Map();

function testZeitgrenze() {
  try { return Number(localStorage.getItem('nahtlos-test-zeitgrenze')) || 0; } catch { return 0; }
}

function beenden(grund) {
  const w = worker;
  worker = null;
  try { w?.terminate(); } catch {}
  const err = grund instanceof WorkerFehler ? grund : new WorkerFehler(String(grund?.message || grund));
  const liste = [...offen.values()];
  offen.clear();
  for (const p of liste) p.fehler(err);
  protokolliere('worker', err.message);
}

function starte() {
  worker = new Worker(new URL('./kern.worker.mjs', import.meta.url), { type: 'module' });
  gen++;
  worker.onmessage = (e) => {
    const p = offen.get(e.data.id);
    if (!p) return;
    offen.delete(e.data.id);
    if (e.data.ok) p.ok(e.data);
    else p.fehler(new Error(e.data.fehler));
  };
  worker.onerror = (e) => beenden(new WorkerFehler(`Worker abgestürzt: ${e.message || 'unbekannt'}`));
  worker.onmessageerror = () => beenden(new WorkerFehler('Worker-Nachricht unlesbar'));
}

// Startet den Worker, falls nötig, und liefert seine Generation (zählt bei jedem Neustart hoch).
export function generation() {
  if (!worker) starte();
  return gen;
}

export function auftrag(typ, daten = {}, transfer = [], { zeitgrenze = null } = {}) {
  if (!worker) starte();
  const id = naechsteId++;
  const ms = zeitgrenze || testZeitgrenze() || ZEITGRENZE[typ] || ZEITGRENZE.standard;
  return new Promise((ok, fehler) => {
    const timer = setTimeout(() => {
      if (offen.has(id)) beenden(new WorkerFehler(`Worker antwortet nicht: ${typ} nach ${ms} ms`));
    }, ms);
    offen.set(id, {
      ok: (v) => { clearTimeout(timer); ok(v); },
      fehler: (e) => { clearTimeout(timer); fehler(e); },
    });
    try {
      worker.postMessage({ id, typ, ...daten }, transfer);
    } catch (err) {
      offen.get(id)?.fehler(err);
      offen.delete(id);
    }
  });
}

export const beschaeftigt = () => offen.size > 0;
