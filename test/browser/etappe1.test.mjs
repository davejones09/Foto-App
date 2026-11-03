// Etappe 1: zwei Aufnahmen ergeben 2229 Pixel, Neuladen stellt alles her, offline, Absturz beim Nähen.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, zustand, warteAuf, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

async function zweiHalte(page) {
  await oeffne(page, s.url);
  await ausloesen(page);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  await ausloesen(page);
  await page.waitForSelector('#v-aufdeckung .aktionen:not([hidden])', { timeout: 20000 });
  await page.click('#auf-weiter');
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
}

test('Zwei Aufnahmen ergeben ein Band von 2229 Pixeln, Neuladen stellt alles wieder her', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await zweiHalte(page);
  await page.click('#zur-strecke');
  await warteAuf(page, () => document.querySelector('#v-strecke .band')?.dataset.breite);
  assert.equal(await page.getAttribute('#v-strecke .band', 'data-breite'), '2229');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ERGEBNISSE}/e1-strecke.png` });
  // Das Band ist tatsächlich gezeichnet (nicht leer)
  const hell = await page.evaluate(() => {
    const c = document.querySelector('#v-strecke .band');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 400) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
    return n;
  });
  assert.ok(hell > 50, `Band gezeichnet: ${hell}`);
  await page.reload();
  await warteAuf(page, () => window.nahtlos?.zustand().ansicht === 'sucher');
  const z = await zustand(page);
  assert.equal(z.halte, 2);
  assert.equal(z.fertig, 2);
  await page.click('#zur-strecke');
  await warteAuf(page, () => document.querySelector('#v-strecke .band')?.dataset.breite === '2229');
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Die App lädt offline', async () => {
  const { ctx, page } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await warteAuf(page, () => !!navigator.serviceWorker.controller || true);
  await page.reload(); // jetzt vom Service Worker kontrolliert
  await warteAuf(page, () => !!navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await page.reload();
  await warteAuf(page, () => window.nahtlos?.zustand().ansicht === 'sucher');
  assert.equal(await page.evaluate(() => typeof window.nahtlos.version), 'string');
  // Auch der Worker und alle Module kommen aus dem Cache: eine Aufnahme gelingt.
  await warteAuf(page, () => document.querySelector('#video').videoWidth > 0 && !document.querySelector('#ausloeser').disabled);
  await ausloesen(page);
  await ctx.setOffline(false);
  await ctx.close();
});

test('Absturz beim Nähen verliert kein Foto', async () => {
  const { ctx, page } = await neueSeite(b);
  await oeffne(page, s.url);
  await ausloesen(page);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  await page.evaluate(() => localStorage.setItem('nahtlos-test-haenger', '1'));
  await page.reload();
  await warteAuf(page, () => window.nahtlos?.zustand().ansicht === 'sucher');
  await warteAuf(page, () => !document.querySelector('#ausloeser').disabled && document.querySelector('#video').videoWidth > 0);
  await page.click('#ausloeser');
  await warteAuf(page, () => window.nahtlos.zustand().halte === 2);
  await page.waitForTimeout(800);
  assert.equal((await zustand(page)).fertig, 1, 'Nähen hängt');
  // "Absturz": Seite neu laden, ohne dass das Nähen fertig wurde.
  await page.evaluate(() => localStorage.removeItem('nahtlos-test-haenger'));
  await page.reload();
  await warteAuf(page, () => window.nahtlos?.zustand().fertig === 2, null, 30000);
  assert.equal((await zustand(page)).halte, 2);
  await ctx.close();
});
