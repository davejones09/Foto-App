// Live-Analyse und Nähen im Worker. Bilder kommen als { w, h, d } mit übertragenem Puffer.
import { analysiere, anschliessen, hauptlinien } from './kern.mjs';

let rest = null;
let restLinien = [];
let haenger = false;

const bild = (b) => ({ w: b.w, h: b.h, d: new Uint8ClampedArray(b.d.buffer || b.d) });

self.onmessage = (e) => {
  const { id, typ } = e.data;
  try {
    if (typ === 'test-haenger') {
      haenger = !!e.data.an;
      self.postMessage({ id, ok: true });
    } else if (typ === 'rest') {
      rest = e.data.rest ? bild(e.data.rest) : null;
      restLinien = rest ? hauptlinien(rest, 3) : [];
      self.postMessage({ id, ok: true, marken: restLinien });
    } else if (typ === 'analyse') {
      const a = e.data.rest ? bild(e.data.rest) : rest;
      if (!a) { self.postMessage({ id, ok: true, leer: true }); return; }
      const b = bild(e.data.kamera);
      const t0 = performance.now();
      const r = analysiere(a, b);
      const linien = e.data.mitLinien ? hauptlinien(b, 3) : null;
      self.postMessage({ id, ok: true, wert: r.wert, teile: r.teile, pfad: Array.from(r.pfad), linien, ms: performance.now() - t0 });
    } else if (typ === 'anschliessen') {
      if (haenger) return; // Test: simuliert einen Absturz mitten im Nähen
      const t0 = performance.now();
      const { naht, neu, pfad } = anschliessen(bild(e.data.letztes), bild(e.data.neues), e.data.ueberlappung);
      self.postMessage(
        { id, ok: true, naht, neu, pfad: Array.from(pfad), ms: performance.now() - t0 },
        [naht.d.buffer, neu.d.buffer],
      );
    } else {
      throw new Error(`Unbekannter Auftrag ${typ}`);
    }
  } catch (err) {
    self.postMessage({ id, ok: false, fehler: String(err && err.stack || err) });
  }
};
