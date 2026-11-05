// Reel aus Clips: Auswahl, Reihenfolge, jedes Bild zeigt die richtige Stelle im Clip, MP4.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { server, browser, neueSeite, oeffne, warteAuf, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const DATEN = new URL('../daten/', import.meta.url).pathname;

test('Clips wählen, ordnen, richtige Stelle im Clip, bauen', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  assert.ok(await page.isDisabled('#cl-bauen'));
  await page.setInputFiles('#datei-clips', [join(DATEN, 'clip-rot.webm'), join(DATEN, 'clip-blau.webm')]);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 2, null, { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('#cl-bauen').disabled);
  assert.match(await page.locator('.cl-info').textContent(), /^2 Clips und Fotos · 5 s/);
  assert.equal(await page.locator('.cl-zeile input[type="range"]').count(), 2);
  assert.ok(await page.locator('.cl-laengen').isHidden(), 'Ganze Clips ohne Längenwahl');
  await page.screenshot({ path: `${ERGEBNISSE}/cl-liste.png` });

  // Stelle im Clip: Rot steigt mit 70 je Sekunde, Blau mit 100
  const r = await page.evaluate(async () => {
    const { clipPlan, clipMaler } = await import('./src/clipreel.mjs');
    const dateien = await Promise.all(['clip-rot.webm', 'clip-blau.webm'].map(async (n) => {
      const a = await fetch(`test/daten/${n}`);
      return new File([await a.blob()], n, { type: 'video/webm' });
    }));
    const medien = [
      { typ: 'clip', datei: dateien[0], url: URL.createObjectURL(dateien[0]), dauer: 3, start: 0 },
      { typ: 'clip', datei: dateien[1], url: URL.createObjectURL(dateien[1]), dauer: 2, start: 0 },
    ];
    const p = clipPlan(medien);
    const c = document.createElement('canvas');
    c.width = 90;
    c.height = 160;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const m = clipMaler(medien, p, { W: 90, H: 160 });
    const proben = {};
    for (const t of [0.5, 2, 3.5, 4.5]) {
      await m.male(ctx, t);
      const d = ctx.getImageData(45, 80, 1, 1).data;
      proben[t] = [d[0], d[2]];
    }
    m.ende();
    return proben;
  });
  assert.ok(Math.abs(r['0.5'][0] - 35) < 25, `Rot bei 0,5 s: ${r['0.5']}`);
  assert.ok(Math.abs(r['2'][0] - 140) < 25, `Rot bei 2 s: ${r['2']}`);
  assert.ok(Math.abs(r['3.5'][1] - 50) < 25, `Blau bei 3,5 s: ${r['3.5']}`);
  assert.ok(Math.abs(r['4.5'][1] - 150) < 25, `Blau bei 4,5 s: ${r['4.5']}`);

  // Vorlage, Reihenfolge, Startpunkt
  await page.locator('.cl-stil[data-stil="v-slide"]').click();
  assert.ok(await page.locator('.cl-laengen').isVisible());
  await page.locator('.cl-zeile').nth(1).locator('button[aria-label="Nach oben"]').click();
  await page.evaluate(() => {
    const r = document.querySelector('.cl-zeile input[type="range"]');
    r.value = '0.5';
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.match(await page.locator('.cl-zeile small').first().textContent(), /Start bei 0,5 s/);

  // Bauen und ansehen
  await page.click('#cl-bauen');
  await page.waitForFunction(() => document.querySelector('.cl-video') || (document.querySelector('.cl-fort') && !document.querySelector('.cl-fort').hidden && /nicht|schief/.test(document.querySelector('.cl-fort').textContent)), null, { timeout: 120000 });
  const gebaut = await page.locator('.cl-video').count();
  const text = await page.locator('.cl-fort').textContent();
  assert.ok(gebaut === 1 || /kann Reels aus Clips nicht/.test(text), text);
  await page.screenshot({ path: `${ERGEBNISSE}/cl-fertig.png` });
  assert.deepEqual(fehler, []);
});

test('Hauptmenü: Reel bietet „Aus Clips“ an', async () => {
  const { page } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('start'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'start');
  await page.click('.neu-karte[data-art="reel"]');
  await page.getByRole('button', { name: 'Aus Clips' }).click();
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
});

test('Nach dem Übergang läuft der Clip weiter und springt nicht zurück', async () => {
  const { page } = await neueSeite(b);
  await oeffne(page, s.url);
  const r = await page.evaluate(async () => {
    const { clipPlan, clipMaler } = await import('./src/clipreel.mjs');
    const lade = async (n) => new File([await (await fetch(`test/daten/${n}`)).blob()], n, { type: 'video/webm' });
    const blau = await lade('clip-blau.webm');
    const rot = await lade('clip-rot.webm');
    const medien = [
      { typ: 'clip', datei: blau, url: URL.createObjectURL(blau), dauer: 2, start: 0 },
      { typ: 'clip', datei: rot, url: URL.createObjectURL(rot), dauer: 3, start: 0 },
    ];
    const p = clipPlan(medien, { stil: 'v-spot', laenge: null });
    const c = document.createElement('canvas');
    c.width = 90;
    c.height = 160;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const m = clipMaler(medien, p, { W: 90, H: 160 });
    const rotWerte = [];
    // Vom Beginn des Übergangs bis 0,5 Sekunden danach: Der Kreis öffnet sich in der Mitte.
    const von = p.staende[0] + p.uebergaenge[0] * 0.3;
    const bis = p.beginn[1] + 0.5;
    for (let t = von; t < bis; t += 1 / 30) {
      await m.male(ctx, t);
      rotWerte.push(ctx.getImageData(45, 80, 1, 1).data[0]);
    }
    m.ende();
    return rotWerte;
  });
  assert.ok(r.length > 10);
  for (let i = 1; i < r.length; i++) assert.ok(r[i] >= r[i - 1] - 6, `Rücksprung bei Bild ${i}: ${r.join(' ')}`);
});
