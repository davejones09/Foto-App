// Einführung: nur beim ersten Start, vor der Kamera, überspringbar, in den Strecken wieder aufrufbar.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, ERGEBNISSE, hauptmenue, bisHauptmenue } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const seite = (page) => page.evaluate(() => document.querySelector('#v-einfuehrung').dataset.seite);
const abdruck = (page) => page.evaluate(() => {
  const c = document.querySelector('#v-einfuehrung .einf-bild');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let summe = 0;
  let hell = 0;
  for (let i = 0; i < d.length; i += 97 * 4) { summe = (summe * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; if (d[i] + d[i + 1] + d[i + 2] > 150) hell++; }
  return { summe, hell };
});

test('Kommt beim ersten Start vor dem Hauptmenü, animiert, wischbar, überspringbar und dann nie wieder', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await page.goto(s.url);
  await page.click('#trotzdem');
  await page.waitForSelector('#v-einfuehrung:not([hidden])');
  assert.equal(await page.locator('.einf-punkte button').count(), 3);
  assert.equal(await page.textContent('.einf-titel'), 'Fotos, die ineinander übergehen.');
  assert.equal(await page.evaluate(() => window.__gumAufrufe), 0);
  await page.waitForTimeout(1200);
  const a = await abdruck(page);
  await page.waitForTimeout(700);
  const z = await abdruck(page);
  assert.ok(a.hell > 20 && z.hell > 20, 'zeigt ein Bild');
  assert.notEqual(a.summe, z.summe, 'bewegt sich');
  // Wischen nach links: nächster Bildschirm, nach rechts: zurück
  const r = await page.locator('.einf-flaeche').boundingBox();
  const wisch = async (von, bis) => {
    await page.mouse.move(r.x + von, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + bis, r.y + r.height / 2, { steps: 5 });
    await page.mouse.up();
  };
  await wisch(r.width - 40, 40);
  assert.equal(await seite(page), '2');
  assert.equal(await page.textContent('.einf-titel'), 'Die Passung finden.');
  await wisch(40, r.width - 40);
  assert.equal(await seite(page), '1');
  await page.locator('.einf-punkte button').nth(2).click();
  assert.equal(await page.textContent('#einf-weiter'), "Los geht's");
  assert.match(await page.textContent('.einf-absatz'), /Reel/);
  await page.locator('.einf-punkte button').nth(0).click();
  assert.match(await page.textContent('.einf-absatz'), /10 Fotos aus der Mediathek/);
  await page.locator('.einf-punkte button').nth(2).click();
  // Überspringen führt ins Hauptmenü, die Kamera ist noch nicht gefragt
  await page.click('#einf-ueberspringen');
  await hauptmenue(page);
  assert.equal(await page.evaluate(() => window.__gumAufrufe), 0);
  await page.screenshot({ path: `${ERGEBNISSE}/ef-hauptmenue.png` });
  await page.reload();
  await hauptmenue(page);
  assert.ok(await page.isHidden('#v-einfuehrung'));
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Lässt sich in den Einstellungen wieder aufrufen und führt dorthin zurück', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await page.goto(s.url);
  await bisHauptmenue(page);
  await page.click('#start-einstellungen');
  await page.waitForSelector('#v-einstellungen:not([hidden])');
  assert.equal(await page.textContent('#ei-einfuehrung span'), 'Einführung ansehen');
  assert.match(await page.textContent('#version'), /^v\d+\.\d+\.\d+$/);
  await page.screenshot({ path: `${ERGEBNISSE}/ef-einstellungen.png` });
  await page.click('#ei-einfuehrung');
  await page.waitForSelector('#v-einfuehrung:not([hidden])');
  assert.equal(await seite(page), '1');
  await page.click('#einf-weiter');
  await page.click('#einf-weiter');
  await page.click('#einf-weiter');
  await warteAuf(page, () => document.body.dataset.ansicht === 'einstellungen');
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Mit vorhandenen Halten kommt sie nicht ungefragt', async () => {
  const { ctx, page } = await neueSeite(b);
  await oeffne(page, s.url);
  await ausloesen(page);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  // Merker löschen, wie bei einer Installation, die älter ist als die Einführung
  await page.evaluate(async () => {
    localStorage.removeItem('nahtlos-einfuehrung');
    const db = await import('./src/speicher.mjs');
    await db.setzeEinstellung('einfuehrung', null);
  });
  await page.reload();
  await hauptmenue(page);
  await ctx.close();
});

test('Bei reduzierter Bewegung steht das Beispiel still', async () => {
  const { ctx, page } = await neueSeite(b);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(s.url);
  await page.click('#trotzdem');
  await page.waitForSelector('#v-einfuehrung:not([hidden])');
  await page.waitForTimeout(300);
  const a = await abdruck(page);
  await page.waitForTimeout(600);
  const z = await abdruck(page);
  assert.ok(a.hell > 20);
  assert.equal(a.summe, z.summe);
  await ctx.close();
});
