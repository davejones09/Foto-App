// Ideen im Sucher: Knopf, passender Satz, Ort, keine Wiederholung, Richtungshinweis.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, ERGEBNISSE, neuGeladen } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

test('Idee: passt zum Rest, merkt den Ort, wiederholt sich nicht, Richtung stimmt', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  assert.ok(await page.isHidden('#idee'), 'ohne Rest keine Idee');
  // Halt mit Horizont auf 0,55, oben hell, unten dunkel
  await page.evaluate(() => Object.assign(window.__szene, { linie: 0.55, farbeOben: [215, 225, 235], farbeUnten: [30, 40, 50] }));
  await page.waitForTimeout(300);
  await ausloesen(page);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher' && !document.querySelector('#idee').hidden);
  await page.click('#idee');
  await warteAuf(page, () => document.querySelector('.idee-text').textContent.length > 0);
  const erste = await page.textContent('.idee-text');
  assert.match(erste, /^Linie auf halber Höhe, oben hell, unten dunkel\. /);
  await page.click('.idee-orte button[data-ort="essen"]');
  await warteAuf(page, (alt) => document.querySelector('.idee-text').textContent !== alt, erste);
  assert.equal(await page.getAttribute('.idee-orte button[data-ort="essen"]', 'aria-pressed'), 'true');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${ERGEBNISSE}/id-idee.png` });
  const saetze = [await page.textContent('.idee-text')];
  for (let i = 0; i < 4; i++) {
    await page.click('#idee-andere');
    await warteAuf(page, (alt) => document.querySelector('.idee-text').textContent !== alt, saetze[saetze.length - 1]);
    saetze.push(await page.textContent('.idee-text'));
  }
  assert.equal(new Set(saetze).size, saetze.length, `keine Wiederholung: ${saetze.join(' | ')}`);
  // Der Ort bleibt nach dem Neuladen gemerkt
  await neuGeladen(page);
  await warteAuf(page, () => !document.querySelector('#idee').hidden);
  await page.click('#idee');
  await page.waitForSelector('.idee-orte button[data-ort="essen"][aria-pressed="true"]');
  await page.click('#idee-zu');

  // Kameralinie knapp über der Marke: höher halten. Dem folgen heißt hier: Das Bild rutscht nach unten.
  await page.evaluate(() => Object.assign(window.__szene, { linie: 0.49, farbeOben: [205, 190, 165], farbeUnten: [90, 55, 35] }));
  await warteAuf(page, () => document.querySelector('#v-sucher .ansage').textContent.startsWith('Etwas höher halten'), null, 15000);
  await page.screenshot({ path: `${ERGEBNISSE}/id-richtung.png` });
  await page.evaluate(() => { window.__szene.linie = 0.55; });
  await warteAuf(page, () => document.querySelector('#v-sucher .marke.trifft') && !document.querySelector('#v-sucher .ansage').textContent.startsWith('Etwas'), null, 15000);
  await page.evaluate(() => { window.__szene.linie = 0.61; });
  await warteAuf(page, () => document.querySelector('#v-sucher .ansage').textContent.startsWith('Etwas tiefer halten'), null, 15000);
  assert.deepEqual(fehler, []);
  await ctx.close();
});
