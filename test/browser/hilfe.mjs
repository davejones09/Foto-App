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

export async function neueSeite(b, { kontext = null } = {}) {
  const ctx = kontext || (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false }));
  await ctx.addInitScript(KAMERA);
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

// Öffnet die App, wählt "im Browser testen", überspringt die Einführung und gibt die Kamera frei.
export async function oeffne(page, url) {
  await page.goto(url);
  const trotzdem = page.locator('#trotzdem');
  if (await trotzdem.isVisible().catch(() => false)) await trotzdem.click();
  await warteAuf(page, () => ['sucher', 'einfuehrung'].includes(document.body.dataset.ansicht));
  if (await page.evaluate(() => document.body.dataset.ansicht === 'einfuehrung')) await page.click('#einf-ueberspringen');
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  const frei = page.locator('#freigeben');
  try { await frei.waitFor({ state: 'visible', timeout: 1500 }); await frei.click(); } catch {}
  await warteAuf(page, () => document.querySelector('#video').videoWidth > 0 && !document.querySelector('#ausloeser').disabled);
}

export async function ausloesen(page) {
  const vorher = (await zustand(page)).halte;
  await page.click('#ausloeser');
  await warteAuf(page, (n) => window.nahtlos.zustand().fertig > n, vorher, 30000);
}
