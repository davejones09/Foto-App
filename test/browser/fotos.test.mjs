// Reel aus Fotos: einmal für alle wählen, wie Fotos ins Hochformat kommen, und mehr als 30 Fotos.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, warteAuf, fotoJpeg, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

// Wartet, bis der gespeicherte Entwurf die Bedingung erfüllt (async im Browser, deshalb von hier aus fragen).
async function entwurfWarten(page, fn, timeout = 15000) {
  const ende = Date.now() + timeout;
  for (;;) {
    const e = await page.evaluate(async () => (await import('./src/speicher.mjs')).reelEntwurf());
    if (e && fn(e)) return e;
    if (Date.now() > ende) throw new Error(`Entwurf erfüllt die Bedingung nicht: ${JSON.stringify(e?.medien?.map((m) => m.rahmen))}`);
    await new Promise((ok) => setTimeout(ok, 150));
  }
}

// Mitte und Rand der Vorschau eines Listeneintrags: Beim ganzen Foto ist oben der Hintergrund zu sehen.
const pixel = (page, i, x, y) => page.evaluate(({ i, x, y }) => {
  const c = document.querySelectorAll('.cl-zeile canvas')[i];
  const d = c.getContext('2d').getImageData(Math.round(c.width * x), Math.round(c.height * y), 1, 1).data;
  return [d[0], d[1], d[2]];
}, { i, x, y });

test('Fotos im Reel: automatisch, ganz mit Hintergrund, ausfüllen, eigene bleiben', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  assert.ok(await page.locator('.cl-fotos').isHidden());
  const quer = await fotoJpeg(page, { w: 1800, h: 1200, a: 0.5, b: 0.6, oben: '#4a8fd6', unten: '#c9a46a', seed: 3 });
  const hoch = await fotoJpeg(page, { w: 1200, h: 1600, a: 0.5, b: 0.6, oben: '#4a8fd6', unten: '#c9a46a', seed: 4 });
  await page.setInputFiles('#datei-clips', [
    { name: 'quer.jpg', mimeType: 'image/jpeg', buffer: quer },
    { name: 'hoch.jpg', mimeType: 'image/jpeg', buffer: hoch },
  ]);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 2, null, { timeout: 30000 });
  await page.waitForSelector('.cl-fotos:not([hidden])');
  assert.equal(await page.getAttribute('.cl-fotoart [data-art="auto"]', 'aria-pressed'), 'true');
  // Querformat ganz: oben dunkler Unschärfe-Rand statt Himmel bis zum Rand? Mitte zeigt das Foto.
  const zust = () => page.evaluate(async () => (await (await import('./src/speicher.mjs')).reelEntwurf())?.medien?.map((m) => m.rahmen?.modus + (m.rahmen?.auto ? '+auto' : '')));
  await entwurfWarten(page, (e) => e.medien?.length === 2 && e.medien[0].pw === 1800 && e.medien[1].pw === 1200);
  assert.deepEqual(await zust(), ['ganz+auto', 'fuellen+auto']);
  assert.ok(await page.locator('.cl-fotogrund').isVisible());
  await page.click('.cl-fotogrund [data-grund="weiss"]');
  await page.waitForFunction(() => {
    const c = document.querySelectorAll('.cl-zeile canvas')[0];
    const d = c.getContext('2d').getImageData(Math.round(c.width / 2), 1, 1, 1).data;
    return d[0] > 245 && d[1] > 245 && d[2] > 245;
  }, null, { timeout: 10000 });
  await page.screenshot({ path: `${ERGEBNISSE}/fotos-ganz.png` });
  // Ausfüllen: oben ist jetzt Himmel, kein Weiß
  await page.click('.cl-fotoart [data-art="fuellen"]');
  await entwurfWarten(page, (e) => e.fotoArt === 'fuellen' && e.medien.every((m) => m.rahmen.modus === 'fuellen'));
  const oben = await pixel(page, 0, 0.5, 0.02);
  assert.ok(oben[2] > oben[0] + 40, `Himmel oben: ${oben}`);
  assert.ok(await page.locator('.cl-fotogrund').isHidden());
  // Von Hand angepasst: bleibt beim Umschalten
  await page.locator('.cl-bearbeiten').nth(1).click();
  await page.waitForSelector('.cl-editor:not([hidden])');
  await page.click('.ce-modus [data-modus="ganz"]');
  await page.click('#ce-fertig');
  await page.click('.cl-fotoart [data-art="ganz"]');
  await page.click('.cl-fotoart [data-art="fuellen"]');
  await entwurfWarten(page, (e) => e.fotoArt === 'fuellen' && e.medien[1].rahmen.modus === 'ganz');
  assert.deepEqual(await zust(), ['fuellen+auto', 'ganz']);
  assert.match(await page.locator('.cl-fotos-info').textContent(), /1 selbst angepasst/);
  assert.deepEqual(fehler, []);
});

test('Mehr als 30 Fotos: alle kommen ins Reel, jedes steht kürzer', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  const dateien = [];
  for (let k = 0; k < 45; k++) {
    dateien.push({ name: `f${k}.jpg`, mimeType: 'image/jpeg', buffer: await fotoJpeg(page, { w: 480, h: 320, a: 0.3 + (k % 5) * 0.1, b: 0.6, oben: '#4a8fd6', unten: '#c9a46a', seed: k + 1 }) });
  }
  await page.setInputFiles('#datei-clips', dateien);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 45, null, { timeout: 120000 });
  // 45 × 2,5 s wären 112 s: Jedes Foto steht 2,0 s, alle sind dabei
  await page.waitForFunction(() => /45 Clips und Fotos · 90 s/.test(document.querySelector('.cl-info').textContent), null, { timeout: 10000 });
  assert.match(await page.locator('.cl-info').textContent(), /steht jedes 2,0 s/);
  assert.doesNotMatch(await page.locator('.cl-info').textContent(), /Rest fällt weg/);
  assert.deepEqual(fehler, []);
});
