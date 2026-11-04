// Startvideo: darf den Start nie blockieren.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, warteAuf } from './hilfe.mjs';

let s, b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const weg = (page) => page.waitForFunction(() => !document.getElementById('startvideo'), null, { timeout: 12000 });

test('Das Video verschwindet von selbst, die App läuft weiter', async () => {
  const { page } = await neueSeite(b);
  await page.goto(s.url + '?startvideo=1');
  await weg(page);
  await warteAuf(page, () => ['start', 'einfuehrung'].includes(document.body.dataset.ansicht), null, 30000);
});

test('Antippen überspringt das Video', async () => {
  const { page } = await neueSeite(b);
  await page.goto(s.url + '?startvideo=1');
  await page.evaluate(() => document.getElementById('startvideo')?.dispatchEvent(new PointerEvent('pointerdown')));
  await page.waitForFunction(() => !document.getElementById('startvideo'), null, { timeout: 2000 });
});

test('Ohne Parameter stört es Tests nicht, und der Service Worker beantwortet Range mit 206', async () => {
  const { page } = await neueSeite(b);
  await page.goto(s.url);
  assert.equal(await page.evaluate(() => !!document.getElementById('startvideo')), false);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  const r = await page.evaluate(async () => {
    const a = await fetch('medien/start.mp4', { headers: { Range: 'bytes=10-19' } });
    const v = await fetch('medien/start.mp4');
    return { status: a.status, laenge: (await a.arrayBuffer()).byteLength, bereich: a.headers.get('Content-Range'), voll: v.status };
  });
  assert.equal(r.status, 206);
  assert.equal(r.laenge, 10);
  assert.match(r.bereich, /^bytes 10-19\/\d+$/);
  assert.equal(r.voll, 200);
});
