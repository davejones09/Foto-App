// Tipps für Reels: aus dem Hauptmenü erreichbar, aufklappbar, zurück.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, warteAuf, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

test('Tipps öffnen, aufklappen, zurück ins Hauptmenü', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('start'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'start');
  await page.click('#start-tipps');
  await warteAuf(page, () => document.body.dataset.ansicht === 'reeltipps');
  assert.ok((await page.locator('.rt-klappe').count()) >= 6);
  await page.click('.rt-klappe[data-id="bahn"] summary');
  assert.ok(await page.locator('.rt-klappe[data-id="bahn"] .rt-clips').first().isVisible());
  assert.match(await page.locator('.rt-klappe[data-id="bahn"]').textContent(), /Zugfahrt durch die Landschaft/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${ERGEBNISSE}/rt-tipps.png` });
  const breit = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert.ok(breit, 'kein seitliches Scrollen');
  await page.click('#rt-zurueck');
  await warteAuf(page, () => document.body.dataset.ansicht === 'start');
  assert.deepEqual(fehler, []);
});
