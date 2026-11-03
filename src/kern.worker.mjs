// Live-Analyse und Nähen im Worker. Bilder kommen als { w, h, d } mit übertragenem Puffer.
import { analysiere, anschliessen, hauptlinien } from './kern.mjs';
import { SerienPlaner } from './serie.mjs';

let rest = null;
let restLinien = [];
let haenger = new Set(); // Test: diese Aufträge bleiben unbeantwortet, wie bei einem Absturz
let planer = new SerienPlaner();

const bild = (b) => ({ w: b.w, h: b.h, d: new Uint8ClampedArray(b.d.buffer || b.d) });

self.onmessage = (e) => {
  const { id, typ } = e.data;
  try {
    if (haenger.has(typ)) return;
    if (typ === 'test-haenger') {
      haenger = new Set(e.data.an ? (e.data.typen || ['anschliessen']) : []);
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
      const t0 = performance.now();
      const { naht, neu, pfad } = anschliessen(bild(e.data.letztes), bild(e.data.neues), e.data.ueberlappung);
      self.postMessage(
        { id, ok: true, naht, neu, pfad: Array.from(pfad), ms: performance.now() - t0 },
        [naht.d.buffer, neu.d.buffer],
      );
    } else if (typ === 'serie-neu') {
      planer = new SerienPlaner();
      self.postMessage({ id, ok: true });
    } else if (typ === 'serie-foto') {
      planer.setze(e.data.foto);
      self.postMessage({ id, ok: true });
    } else if (typ === 'serie-entferne') {
      planer.entferne(e.data.fotoId);
      self.postMessage({ id, ok: true });
    } else if (typ === 'serie-start') {
      planer.setzeStart(e.data.rechts);
      self.postMessage({ id, ok: true });
    } else if (typ === 'serie-plane') {
      const t0 = performance.now();
      const plan = planer.plane(e.data);
      self.postMessage({ id, ok: true, plan, ms: performance.now() - t0 });
    } else if (typ === 'serie-alternativen') {
      self.postMessage({ id, ok: true, liste: planer.alternativen(e.data.ordnung, e.data.wahl, e.data.fotoId, e.data.anzahl) });
    } else {
      throw new Error(`Unbekannter Auftrag ${typ}`);
    }
  } catch (err) {
    self.postMessage({ id, ok: false, fehler: String(err && err.stack || err) });
  }
};
