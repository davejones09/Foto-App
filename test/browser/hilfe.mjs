// Gemeinsame Hilfen für Browser-Tests: statischer Server unter Unterpfad, Kamera-Ersatz.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright ist in der Umgebung vorinstalliert (global), deshalb über require.
const { chromium } = createRequire(import.meta.url)('playwright');

export const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ERGEBNISSE = join(WURZEL, 'test', 'ergebnisse');
mkdirSync(ERGEBNISSE, { recursive: true });

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.jpg': 'image/jpeg',
};

export async function server() {
  const s = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/Foto-App/')) { res.writeHead(404); res.end(); return; }
    let p = decodeURIComponent(url.pathname.slice('/Foto-App/'.length)) || 'index.html';
    if (p.endsWith('/')) p += 'index.html';
    if (p.includes('..')) { res.writeHead(400); res.end(); return; }
    try {
      const d = await readFile(join(WURZEL, p));
      res.writeHead(200, { 'content-type': TYPEN[extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(d);
    } catch {
      res.writeHead(404); res.end();
    }
  });
  await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
  return { url: `http://localhost:${s.address().port}/Foto-App/`, schliessen: () => new Promise((ok) => s.close(ok)) };
}

// Kamera-Ersatz: eine bewegte Testszene mit Horizont. szene.linie = Höhe der Linie (0..1).
export const KAMERA = `
(() => {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const k = c.getContext('2d');
  window.__szene = { linie: 0.55, farbeOben: [135, 175, 215], farbeUnten: [30, 75, 110], zeit: 0 };
  function malen() {
    const s = window.__szene;
    s.zeit += 1;
    const y = s.linie * H + Math.sin(s.zeit / 20) * 3;
    k.fillStyle = 'rgb(' + s.farbeOben.join(',') + ')';
    k.fillRect(0, 0, W, y);
    k.fillStyle = 'rgb(' + s.farbeUnten.join(',') + ')';
    k.fillRect(0, y, W, H - y);
    // etwas Struktur
    for (let i = 0; i < 40; i++) {
      k.fillStyle = 'rgba(255,255,255,' + (0.04 + (i % 5) * 0.01) + ')';
      k.fillRect((i * 137 + s.zeit) % W, y + 40 + ((i * 89) % (H - y - 60)), 60, 8);
    }
  }
  malen();
  setInterval(malen, 33);
  const md = navigator.mediaDevices || (navigator.mediaDevices = {});
  window.__gumAufrufe = 0;
  md.getUserMedia = async () => {
    window.__gumAufrufe++;
    if (window.__kameraVerweigert) { const e = new Error('nein'); e.name = 'NotAllowedError'; throw e; }
    return c.captureStream(30); // jedes Mal ein frischer Stream, wie bei einer echten Kamera
  };
  md.enumerateDevices = async () => [{ kind: 'videoinput', label: 'Rückkamera', deviceId: 'a' }];
})();
`;

export async function browser() {
  return chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
}

// Hülle um IDBObjectStore.put und add: Steckt ein Blob oder File im Wert, scheitert der Aufruf und der
// Test (beim Schließen des Kontexts). WebKit verliert Blobs in IndexedDB, deshalb dürfen dort keine liegen.
// Für das Anlegen alter Testdaten (Format 1 und 2) gibt es die Originale unter __putOriginal und __addOriginal.
export const KEINE_BLOBS = `
(() => {
  if (!self.IDBObjectStore || IDBObjectStore.prototype.__putOriginal) return;
  self.__blobFehler = [];
  const findeBlob = (v, pfad, tiefe) => {
    if (v instanceof Blob) return pfad;
    if (!v || typeof v !== 'object' || tiefe > 6 || ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return null;
    for (const k of Object.keys(v)) { const t = findeBlob(v[k], pfad + '.' + k, tiefe + 1); if (t) return t; }
    return null;
  };
  for (const name of ['put', 'add']) {
    const original = IDBObjectStore.prototype[name];
    IDBObjectStore.prototype['__' + name + 'Original'] = original;
    IDBObjectStore.prototype[name] = function (wert, ...rest) {
      const pfad = findeBlob(wert, this.name, 0);
      if (pfad) {
        self.__blobFehler.push(name + ': ' + pfad);
        throw new TypeError('Test: Blob in IndexedDB bei ' + pfad);
      }
      return original.call(this, wert, ...rest);
    };
  }
})();
`;

export async function neueSeite(b, { kontext = null } = {}) {
  const ctx = kontext || (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false }));
  await ctx.addInitScript(KEINE_BLOBS);
  await ctx.addInitScript(KAMERA);
  // Vor dem Schließen prüfen, ob irgendwo ein Blob in IndexedDB geschrieben werden sollte.
  const schliessen = ctx.close.bind(ctx);
  ctx.close = async () => {
    const funde = [];
    for (const p of ctx.pages()) funde.push(...(await p.evaluate(() => self.__blobFehler || []).catch(() => [])));
    await schliessen();
    if (funde.length) throw new Error(`Blob in IndexedDB geschrieben: ${funde.join(', ')}`);
  };
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
  return { ctx, page, fehler };
}

export async function zustand(page) {
  return page.evaluate(() => window.nahtlos?.zustand());
}

export async function warteAuf(page, fn, arg, timeout = 20000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 100 });
}

// Wartet aufs Hauptmenü, bis die Liste der Projekte aufgebaut ist.
export async function hauptmenue(page) {
  await warteAuf(page, () => document.body.dataset.gestartet === '1' && document.body.dataset.ansicht === 'start' && document.querySelector('#v-start').dataset.bereit === '1', null, 30000);
}

// Erst wenn die App fertig gestartet ist, darf ein Test selbst navigieren.
export async function gestartet(page) {
  await warteAuf(page, () => document.body.dataset.gestartet === '1', null, 30000);
}

// Vom Hauptmenü in den Sucher: das zuletzt bearbeitete Projekt öffnen oder ein neues Carousel anlegen.
export async function zumSucher(page, { neu = false, art = 'carousel' } = {}) {
  await hauptmenue(page);
  if (!neu && (await page.locator('#v-start .zuletzt-eintrag').count())) {
    await page.locator('#v-start .zuletzt-eintrag').first().click();
    await warteAuf(page, () => document.body.dataset.ansicht === 'strecke');
    await page.click('#zum-sucher');
  } else {
    await page.click(`#v-start .neu-karte[data-art="${art}"]`);
    await page.waitForSelector('#dialog:not([hidden])');
    await page.click('#dialog .d-knoepfe button.haupt');
  }
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  const frei = page.locator('#freigeben');
  try { await frei.waitFor({ state: 'visible', timeout: 1500 }); await frei.click(); } catch {}
  await warteAuf(page, () => document.querySelector('#video').videoWidth > 0 && !document.querySelector('#ausloeser').disabled);
}

// Neues Carousel oder Reel über das Hauptmenü, auf Wunsch mit Namen und Überraschungsmodus, dann in den Sucher.
export async function neuesProjekt(page, { name = null, blind = false, art = 'carousel' } = {}) {
  await gestartet(page);
  if (await page.evaluate(() => document.body.dataset.ansicht !== 'start')) {
    await page.evaluate(async () => (await import('./src/zustand.mjs')).zeige('start'));
  }
  await hauptmenue(page);
  await page.click(`#v-start .neu-karte[data-art="${art}"]`);
  await page.waitForSelector('#dialog:not([hidden])');
  if (name) await page.fill('.d-eingabe', name);
  if (blind) await page.check('.d-option input');
  await page.click('#dialog .d-knoepfe button.haupt');
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  const frei = page.locator('#freigeben');
  try { await frei.waitFor({ state: 'visible', timeout: 1500 }); await frei.click(); } catch {}
  await warteAuf(page, () => document.querySelector('#video').videoWidth > 0 && !document.querySelector('#ausloeser').disabled);
}

// Diagnose über die Einstellungen öffnen.
export async function oeffneDiagnose(page) {
  await gestartet(page);
  await page.evaluate(async () => (await import('./src/zustand.mjs')).zeige('einstellungen'));
  await page.waitForSelector('#v-einstellungen:not([hidden])');
  await page.click('#ei-diagnose');
  await page.waitForSelector('#diagnose:not([hidden])');
}

// Im Sucher: Kamera freigeben, falls gefragt, und warten, bis sie läuft.
export async function kameraBereit(page) {
  const frei = page.locator('#freigeben');
  try { await frei.waitFor({ state: 'visible', timeout: 1500 }); await frei.click(); } catch {}
  await warteAuf(page, () => document.querySelector('#video').videoWidth > 0 && !document.querySelector('#ausloeser').disabled);
}

// Öffnet das zuletzt bearbeitete Projekt aus dem Hauptmenü (Vorschau des Bands).
export async function zumProjekt(page) {
  await gestartet(page);
  if (await page.evaluate(() => document.body.dataset.ansicht !== 'start')) {
    await page.evaluate(async () => (await import('./src/zustand.mjs')).zeige('start'));
  }
  await hauptmenue(page);
  await page.locator('#v-start .zuletzt-eintrag').first().click();
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke');
}

// Öffnet die App, wählt "im Browser testen", überspringt die Einführung, landet im Hauptmenü
// und geht von dort in den Sucher (zuletzt bearbeitetes Projekt oder ein neues Carousel).
export async function oeffne(page, url, opt = {}) {
  await page.goto(url);
  await bisHauptmenue(page);
  await zumSucher(page, opt);
}

export async function bisHauptmenue(page) {
  const trotzdem = page.locator('#trotzdem');
  if (await trotzdem.isVisible().catch(() => false)) await trotzdem.click();
  await warteAuf(page, () => ['start', 'einfuehrung'].includes(document.body.dataset.ansicht), null, 30000);
  if (await page.evaluate(() => document.body.dataset.ansicht === 'einfuehrung')) await page.click('#einf-ueberspringen');
  await hauptmenue(page);
}

// Neu laden und wieder in den Sucher des aktiven Projekts.
export async function neuGeladen(page) {
  await page.reload();
  await bisHauptmenue(page);
  await zumSucher(page);
}

export async function ausloesen(page) {
  const vorher = (await zustand(page)).halte;
  await page.click('#ausloeser');
  await warteAuf(page, (n) => window.nahtlos.zustand().fertig > n, vorher, 30000);
}

// Testfoto im Browser zeichnen: Linie links flach auf a, rechts flach auf b.
export async function fotoJpeg(page, { w = 1600, h = 1200, a, b, oben, unten, seed = 1 }) {
  const b64 = await page.evaluate(async ({ w, h, a, b, oben, unten, seed }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const k = c.getContext('2d');
    k.fillStyle = oben;
    k.fillRect(0, 0, w, h);
    k.beginPath();
    k.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const u = x / w;
      const t = u < 0.3 ? 0 : u > 0.7 ? 1 : (u - 0.3) / 0.4;
      k.lineTo(x, (a + (b - a) * t * t * (3 - 2 * t)) * h);
    }
    k.lineTo(w, h);
    k.closePath();
    k.fillStyle = unten;
    k.fill();
    let r = seed;
    const z = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 120; i++) { k.fillStyle = `rgba(255,255,255,${0.04 + z() * 0.05})`; k.fillRect(z() * w, z() * h, 30 + z() * 60, 6); }
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    const u = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768));
    return btoa(s);
  }, { w, h, a, b, oben, unten, seed });
  return Buffer.from(b64, 'base64');
}

