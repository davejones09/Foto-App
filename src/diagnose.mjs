// Fehlerprotokoll und Messwerte für das Diagnosefenster (TECHNIK.md, Abschnitt 7).
const MAX = 50;
const SCHLUESSEL = 'nahtlos-fehler';
let fehler = [];
try { fehler = JSON.parse(localStorage.getItem(SCHLUESSEL) || '[]'); } catch {}

export const werte = { stream: '', fps: 0, analyseMs: 0, naehenMs: 0, analysen: 0 };

export function protokolliere(art, nachricht) {
  const text = String(nachricht && (nachricht.stack || nachricht.message) || nachricht).slice(0, 600);
  fehler.push({ zeit: new Date().toISOString(), art, text });
  if (fehler.length > MAX) fehler = fehler.slice(-MAX);
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(fehler)); } catch {}
}

export const alleFehler = () => fehler.slice();

// Serienprotokoll: je Foto Dauer und Fehler. Liegt in localStorage, damit es einen Absturz übersteht.
const SERIE_SCHLUESSEL = 'nahtlos-serie-log';
let serienLog = [];
try { serienLog = JSON.parse(localStorage.getItem(SERIE_SCHLUESSEL) || '[]'); } catch {}

export function serienEintrag(text) {
  serienLog.push({ zeit: new Date().toISOString(), text: String(text).slice(0, 400) });
  if (serienLog.length > 60) serienLog = serienLog.slice(-60);
  try { localStorage.setItem(SERIE_SCHLUESSEL, JSON.stringify(serienLog)); } catch {}
}

export const serienProtokoll = () => serienLog.slice();

export function leereFehler() {
  fehler = [];
  try { localStorage.removeItem(SCHLUESSEL); } catch {}
}

export function messung(name, ms) {
  if (name === 'analyse') {
    werte.analyseMs = werte.analyseMs ? werte.analyseMs * 0.9 + ms * 0.1 : ms;
    werte.analysen++;
  } else if (name === 'naehen') werte.naehenMs = ms;
}

export function installiereHandler() {
  addEventListener('error', (e) => protokolliere('error', e.error || `${e.message} @ ${e.filename}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => protokolliere('unhandledrejection', e.reason));
}
