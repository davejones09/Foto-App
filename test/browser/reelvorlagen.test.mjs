// Reel-Vorlagen im Browser: Auswahl, Auto, jedes Bild füllt den Rahmen, MP4 wird gebaut.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const SZENEN = [
  { linie: 0.55, farbeOben: [135, 175, 215], farbeUnten: [30, 75, 110] },
  { linie: 0.55, farbeOben: [205, 190, 165], farbeUnten: [90, 55, 35] },
  { linie: 0.5, farbeOben: [180, 200, 160], farbeUnten: [60, 90, 40] },
];

test('Vorlagen: Auswahl, Auto, voller Rahmen in jedem Übergang, MP4', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  for (const [i, sz] of SZENEN.entries()) {
    await page.evaluate((x) => Object.assign(window.__szene, x), sz);
    await page.waitForTimeout(300);
    await ausloesen(page);
    if (i > 0) {
      await page.waitForSelector('#v-aufdeckung .aktionen:not([hidden])', { timeout: 20000 });
      await page.click('#auf-weiter');
    }
    await warteAuf(page, () => document.body.dataset.ansicht === 'sucher' && !document.querySelector('#ausloeser').disabled);
  }
  await page.click('#zur-strecke');
  await page.click('#zur-ausfahrt');
  await page.waitForSelector('#v-ausfahrt:not([hidden]) .af-vorlage');
  assert.equal(await page.locator('.af-vorlage').count(), 11);
  assert.deepEqual((await page.locator('.af-vorlage span').allTextContents()).slice(0, 3), ['Beat', 'Blitz', 'Slide']);
  // Sichtbare Vorschauen laufen
  await warteAuf(page, () => document.querySelector('.af-vorlage canvas').dataset.laeuft === '1', null, 20000);
  await page.locator('.af-vorlage[data-stil="v-blitz"]').click();
  assert.equal(await page.locator('.af-vorlage[data-stil="v-blitz"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.af-stil[aria-pressed="true"]').count(), 0);
  assert.equal(await page.locator('.af-auto').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('.af-tempo').first().textContent(), /^3 Fotos · \d+ s$/);
  await page.screenshot({ path: `${ERGEBNISSE}/rv-vorlagen.png` });
  // Feste Länge schaltet Auto aus, ein Stil blendet Auto aus
  await page.locator('.af-laengen button', { hasText: '15 s' }).click();
  assert.equal(await page.locator('.af-auto').getAttribute('aria-pressed'), 'false');
  await page.locator('.af-stil[data-stil="sanft"]').click();
  assert.ok(await page.locator('.af-auto').isHidden());
  await page.locator('.af-vorlage[data-stil="v-mix"]').click();

  const r = await page.evaluate(async () => {
    const aus = await import('./src/ausgabe.mjs');
    const db = await import('./src/speicher.mjs');
    const { VORLAGEN_IDS } = await import('./src/reelvorlagen.mjs');
    const halte = (await db.halte(localStorage.getItem('nahtlos-aktiv'))).filter((h) => h.bild);
    const W = 270;
    const H = 480;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const schwarz = {};
    for (const id of VORLAGEN_IDS) {
      const p = aus.reelStilPlan(halte, { laenge: null, stil: id });
      const m = await aus.stilMaler(halte, p, { W, H });
      let leer = 0;
      for (let k = 0; k < p.bilder; k += 4) {
        await m.male(ctx, k / 30);
        for (const [x, y] of [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2], [W >> 1, H >> 1]]) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          if (d[0] + d[1] + d[2] < 6) leer++;
        }
      }
      m.ende();
      schwarz[id] = leer;
    }
    const weg = await aus.reelWeg();
    const plan = aus.reelStilPlan(halte, { laenge: null, stil: 'v-beat' });
    let mp4 = null;
    if (weg) {
      const blob = await aus.reel({ name: 'x' }, halte, plan);
      mp4 = { typ: blob.type, groesse: blob.size };
    }
    const titel = await aus.titelbild(halte, plan);
    return { schwarz, mp4, titel: titel.size };
  });
  for (const [id, leer] of Object.entries(r.schwarz)) assert.equal(leer, 0, `${id}: schwarze Stellen`);
  if (r.mp4) { assert.match(r.mp4.typ, /mp4/); assert.ok(r.mp4.groesse > 1000); }
  assert.ok(r.titel > 1000);
  assert.deepEqual(fehler, []);
});
