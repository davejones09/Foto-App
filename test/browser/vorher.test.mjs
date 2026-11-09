// Vorher und nachher: Paare aus gemischter Auswahl, Reel und Carousel.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { server, browser, neueSeite, oeffne, warteAuf, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

test('Vorher und nachher: Paare gefunden, Reel mit Wischlinie, Carousel geteilt', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await ctx.addInitScript(() => {
    window.__geteilt = [];
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => { window.__geteilt.push(files); };
  });
  await oeffne(page, s.url);
  // Zwei Szenen, je flach (vorher) und kräftig bearbeitet (nachher)
  const bilder = await page.evaluate(async () => {
    const mache = async (h, cx, kontrast, warm) => {
      const c = new OffscreenCanvas(400, 500);
      const k = c.getContext('2d');
      const v = (x) => Math.round(128 + (x - 128) * kontrast);
      k.fillStyle = `rgb(${v(170) + warm},${v(170)},${v(170) - warm})`;
      k.fillRect(0, 0, 400, 500 * h);
      k.fillStyle = `rgb(${v(70) + warm},${v(70)},${v(70) - warm})`;
      k.fillRect(0, 500 * h, 400, 500);
      k.fillStyle = `rgb(${v(230)},${v(230)},${v(230)})`;
      k.beginPath(); k.arc(400 * cx, 150, 50, 0, 7); k.fill();
      return Array.from(new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.95 })).arrayBuffer()));
    };
    return [await mache(0.4, 0.7, 0.6, 0), await mache(0.7, 0.2, 1.4, 30), await mache(0.4, 0.7, 1.5, 40), await mache(0.7, 0.2, 0.5, 0)];
  });
  const dateien = bilder.map((d, i) => { const p = join(ERGEBNISSE, `vn-${i}.jpg`); writeFileSync(p, Buffer.from(d)); return p; });
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('vorher', { art: 'reel' }); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'vorher');
  await page.setInputFiles('#datei-vorher', dateien);
  await page.waitForSelector('.vn-paar');
  assert.equal(await page.locator('.vn-paar').count(), 2);
  assert.match(await page.locator('.vn-info').textContent(), /2 Paare/);
  await page.screenshot({ path: `${ERGEBNISSE}/vn-paare.png` });
  await page.click('#vn-bauen');
  await page.waitForSelector('#vn-teilen', { timeout: 120000 });
  await page.click('#vn-teilen');
  await warteAuf(page, () => window.__geteilt.length > 0);
  const reel = await page.evaluate(async () => {
    const f = window.__geteilt[0][0];
    const v = document.createElement('video');
    v.muted = true;
    v.src = URL.createObjectURL(f);
    await new Promise((ok) => (v.onloadedmetadata = ok));
    return { name: f.name, dauer: v.duration, w: v.videoWidth, h: v.videoHeight };
  });
  assert.equal(reel.name, 'vorher-nachher.mp4');
  assert.equal(reel.w, 1080);
  assert.ok(Math.abs(reel.dauer - 7.6) < 0.2, `Dauer ${reel.dauer}`);
  // Carousel
  await page.locator('.vn-art [data-art="carousel"]').click();
  await page.click('#vn-bauen');
  await page.waitForFunction(() => document.querySelector('#vn-teilen') && !document.querySelector('.vn-fort:not([hidden])'), null, { timeout: 60000 });
  await page.click('#vn-teilen');
  await warteAuf(page, () => window.__geteilt.length > 1);
  const bild = await page.evaluate(async () => {
    const f = window.__geteilt[1];
    const b2 = await createImageBitmap(f[0]);
    const c = new OffscreenCanvas(b2.width, b2.height);
    const k = c.getContext('2d');
    k.drawImage(b2, 0, 0);
    // Unten im Bild: links das flache, rechts das kräftige Foto
    const l = k.getImageData(200, 1300, 1, 1).data;
    const r = k.getImageData(880, 1300, 1, 1).data;
    return { n: f.length, w: b2.width, h: b2.height, links: [...l], rechts: [...r] };
  });
  assert.equal(bild.n, 2);
  assert.equal(bild.w, 1080);
  assert.equal(bild.h, 1350);
  assert.notDeepEqual(bild.links.slice(0, 3), bild.rechts.slice(0, 3), 'zwei verschiedene Fassungen');
  assert.deepEqual(fehler, []);
});
