// Etappe 4: Fahrplan, Blindfahrt mit Finale, Tageswechsel, ganze Strecke.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

async function halte(page, n, { blind = false } = {}) {
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => Object.assign(window.__szene, { linie: 0.5 + (i % 2) * 0.04, farbeOben: [120 + i * 30, 170, 210 - i * 20], farbeUnten: [30 + i * 25, 70, 100] }), i);
    await page.waitForTimeout(250);
    await ausloesen(page);
    if (i > 0) {
      await page.waitForSelector('#v-aufdeckung .aktionen:not([hidden])', { timeout: 20000 });
      if (i === 1 && blind) await page.screenshot({ path: `${ERGEBNISSE}/e4-blind-aufdeckung.png` });
      await page.click('#auf-weiter');
    }
    await warteAuf(page, () => document.body.dataset.ansicht === 'sucher' && !document.querySelector('#ausloeser').disabled);
  }
}

test('Fahrplan: Kennzahlen, Halt benennen, Tageswechsel, ganze Strecke', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await halte(page, 4);
  // Ersten Halt auf den Vortag legen: Tageswechsel
  await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const l = await db.halte(localStorage.getItem('nahtlos-aktiv'));
    await db.aendereHalt(l[0].id, { zeit: l[0].zeit - 86400000 });
  });
  await page.click('#zur-strecke');
  await page.waitForSelector('#v-strecke .hl-tag');
  assert.equal(await page.locator('#v-strecke .hl-halt').count(), 4);
  // Herauszoomen auf die ganze Strecke
  const r = await page.locator('#v-strecke .band').boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  await warteAuf(page, () => document.querySelector('#v-strecke .band').dataset.sicht === '0.000-1.000');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ERGEBNISSE}/e4-ganze-strecke.png` });
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -400);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ERGEBNISSE}/e4-100-prozent.png` });
  await page.click('#zum-fahrplan');
  await page.waitForSelector('#v-fahrplan:not([hidden]) .fp-zeile:not(.kopfz)');
  assert.equal(await page.locator('.fp-zeile:not(.kopfz)').count(), 4);
  assert.equal(await page.locator('.fp-tagz').count(), 2);
  const kz = await page.textContent('.fp-kennzahlen');
  assert.match(kz, /^4 Halte · Durchschnitt \d+ · Pünktlichkeit \d+ %$/);
  await page.locator('.fp-name').nth(1).click();
  await page.fill('.d-eingabe', 'Hafenmauer');
  await page.click('#dialog button.haupt');
  await page.waitForSelector('.fp-name:text("Hafenmauer")');
  assert.equal(await page.locator('.fp-name').nth(0).textContent(), 'Halt 1');
  await page.screenshot({ path: `${ERGEBNISSE}/e4-fahrplan.png` });
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Blindfahrt: Strecke bleibt verdeckt, Ziel erreichen zeigt das Finale', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await page.click('#zur-strecke');
  await page.click('#zu-strecken');
  await page.click('#sl-neu');
  await page.fill('.d-eingabe', 'Zu zweit');
  await page.check('.d-option input');
  await page.click('#dialog button.haupt');
  await warteAuf(page, () => window.nahtlos.zustand().strecke === 'Zu zweit' && window.nahtlos.zustand().blind === true);
  await warteAuf(page, () => !document.querySelector('#ausloeser').disabled);
  await halte(page, 3, { blind: true });
  await page.click('#zur-strecke');
  await page.waitForSelector('#v-strecke .band-blind:not([hidden])');
  assert.ok(await page.isDisabled('#zur-ausfahrt'));
  assert.ok(!(await page.isVisible('#v-strecke .band')));
  await page.screenshot({ path: `${ERGEBNISSE}/e4-blind-strecke.png` });
  await page.click('#ziel');
  assert.equal(await page.textContent('.d-text'), 'Ziel erreichen? Danach seht ihr alles.');
  await page.click('#dialog button.haupt');
  await page.waitForSelector('#v-finale:not([hidden])');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${ERGEBNISSE}/e4-finale.png` });
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke', null, 40000);
  assert.ok(await page.isVisible('#v-strecke .band'));
  assert.ok(!(await page.isDisabled('#zur-ausfahrt')));
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('50 Halte: Strecke, Karussell-Aufteilung und Gesamtbild-Verkleinerung', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await halte(page, 2);
  // Die zwei echten Halte zu 50 vervielfältigen
  await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const id = localStorage.getItem('nahtlos-aktiv');
    const [a, h1] = await db.halte(id);
    for (let i = 2; i < 50; i++) await db.neuerHalt({ ...h1, id: db.neueId(), index: i, zeit: h1.zeit + i * 600000 });
  });
  await page.reload();
  await warteAuf(page, () => window.nahtlos?.zustand().halte === 50);
  await page.click('#zur-strecke');
  await warteAuf(page, () => document.querySelector('#v-strecke .band').dataset.breite === String(50 * 933 + 363));
  // Durchwischen: flüssig heißt hier, dass ein Zeichenvorgang klein bleibt
  const r = await page.locator('#v-strecke .band').boundingBox();
  const t0 = Date.now();
  for (let k = 0; k < 4; k++) {
    await page.mouse.move(r.x + 50, r.y + 100);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width - 50, r.y + 100, { steps: 10 });
    await page.mouse.up();
  }
  console.log(`Wischen: ${Date.now() - t0} ms`);
  await page.click('#zur-ausfahrt');
  await page.waitForSelector('#v-ausfahrt:not([hidden]) .af-punkt');
  assert.equal(await page.locator('.af-punkt').nth(0).locator('.af-titel').textContent(), 'Karussell · 37 Bilder für Instagram');
  assert.match(await page.locator('.af-punkt').nth(0).textContent(), /Wird auf 2 Teile aufgeteilt\./);
  assert.match(await page.locator('.af-punkt').nth(2).textContent(), /Für das iPhone zu groß, deshalb auf \d+ × \d+ verkleinert\./);
  // Reel über 50 Halte in 15 s wäre zu schnell: Vorschlag eines kürzeren Abschnitts
  const reel = page.locator('.af-punkt').nth(1);
  await reel.locator('.af-laengen button', { hasText: '15 s' }).click();
  await reel.locator('.af-vorschlag').waitFor();
  assert.match(await reel.locator('.af-vorschlag').textContent(), /^Bei 15 s wird es zu schnell\. Vorschlag: Halt 1 bis \d+\./);
  await reel.locator('.af-vorschlag-ok').click();
  assert.ok(await reel.locator('.af-vorschlag').isHidden());
  const bis = Number(await reel.locator('select').nth(1).inputValue());
  assert.ok(bis > 0 && bis < 49, `bis ${bis}`);
  await page.screenshot({ path: `${ERGEBNISSE}/e4-reel-vorschlag.png` });
  await page.screenshot({ path: `${ERGEBNISSE}/e4-ausfahrt-50.png` });
  assert.deepEqual(fehler, []);
  await ctx.close();
});
