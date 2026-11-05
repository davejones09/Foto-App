// Browser-Fassung am Computer: kein Installationshinweis, Layout, Tastenkürzel, Hereinziehen, Download.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, warteAuf, kameraBereit, bisHauptmenue, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

async function computer() {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const { page, fehler } = await neueSeite(b, { kontext: ctx });
  return { ctx, page, fehler };
}

test('Am Computer: direkt in die App, Karten nebeneinander, passende Texte', async () => {
  const { ctx, page, fehler } = await computer();
  await page.goto(s.url);
  await warteAuf(page, () => ['start', 'einfuehrung'].includes(document.body.dataset.ansicht), null, 20000);
  assert.ok(await page.locator('#v-install').isHidden(), 'kein Hinweis zum Home-Bildschirm');
  await bisHauptmenue(page);
  const karten = await page.locator('.neu-karte').evaluateAll((l) => l.map((k) => k.getBoundingClientRect().top));
  assert.ok(Math.abs(karten[0] - karten[2]) < 2, 'nebeneinander');
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('desktop')));
  assert.equal(await page.evaluate(async () => (await import('./src/texte.mjs')).T.teilen), 'Herunterladen');
  assert.doesNotMatch(await page.evaluate(async () => JSON.stringify((await import('./src/texte.mjs')).T.kameraText)), /iPhone/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${ERGEBNISSE}/de-start.png` });
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Das Handy sieht weiter den Hinweis', async () => {
  const { ctx, page } = await neueSeite(b);
  await page.goto(s.url);
  await page.waitForSelector('#v-install:not([hidden])');
  await ctx.close();
});

test('Leertaste löst aus, Escape geht zurück, Dateien lassen sich hereinziehen, mehrere Dateien als ZIP', async () => {
  const { ctx, page, fehler } = await computer();
  await page.goto(s.url);
  await bisHauptmenue(page);
  await page.click('.neu-karte[data-art="carousel"]');
  await page.getByRole('button', { name: 'Kamera' }).click();
  await kameraBereit(page);
  await page.keyboard.press(' ');
  await warteAuf(page, () => window.nahtlos.zustand().halte === 1, null, 20000);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher' && !document.querySelector('#ausloeser').disabled, null, 20000);
  await page.keyboard.press('Escape');
  await warteAuf(page, () => document.body.dataset.ansicht !== 'sucher');

  // Hereinziehen im Hauptmenü führt zu Reel aus Clips
  await page.evaluate(async () => (await import('./src/zustand.mjs')).zeige('start'));
  await warteAuf(page, () => document.body.dataset.ansicht === 'start');
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    c.getContext('2d').fillRect(0, 0, 400, 300);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'a.jpg', { type: 'image/jpeg' }));
    for (const typ of ['dragenter', 'dragover', 'drop']) window.dispatchEvent(new DragEvent(typ, { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 1, null, { timeout: 15000 });
  assert.ok(await page.locator('#ablage').isHidden());

  // Teilen lädt herunter, mehrere Dateien gebündelt
  const [zip] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(async () => {
      const aus = await import('./src/ausgabe.mjs');
      await aus.teilen([new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')], 'x');
    }),
  ]);
  assert.equal(zip.suggestedFilename(), 'export.zip');
  const [einzeln] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(async () => (await import('./src/ausgabe.mjs')).teilen([new File(['v'], 'reel.mp4')], 'x')),
  ]);
  assert.equal(einzeln.suggestedFilename(), 'reel.mp4');
  assert.deepEqual(fehler, []);
  await ctx.close();
});
