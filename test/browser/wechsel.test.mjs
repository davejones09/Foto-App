// Erkennung, Wechsel mit Vordergrund im Clip-Editor und nahtlos weiterfilmen.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { server, browser, neueSeite, oeffne, warteAuf, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const DATEN = new URL('../daten/', import.meta.url).pathname;

async function zuClips(page) {
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
}

test('Erkennung läuft auf dem Gerät und schneidet nur aus, wo etwas ist', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  const r = await page.evaluate(async () => {
    const e = await import('./src/erkennung.mjs');
    const c = new OffscreenCanvas(288, 512);
    const k = c.getContext('2d');
    const g = k.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#9bc4ef');
    g.addColorStop(1, '#d9c7a3');
    k.fillStyle = g;
    k.fillRect(0, 0, 288, 512);
    const m = await e.segmentiere(c);
    return { w: m.w, h: m.h, fz: e.anteil(m, e.FAHRZEUGE), maske: await e.vordergrundMaske(c, 'fahrzeug') };
  });
  assert.equal(r.w, 288);
  assert.equal(r.h, 512);
  assert.ok(r.fz < 0.05, `Fahrzeug im leeren Himmel: ${r.fz}`);
  assert.equal(r.maske, null);
  assert.deepEqual(fehler.filter((x) => !/WebGL|GL Driver|TensorFlow Lite|XNNPACK|^[IW]\d{4}/.test(x)), []);
});

test('Wechsel im Editor: Vordergrund bleibt, ohne Fahrzeug bleibt die Wahl, Entwurf merkt es sich', async () => {
  const { page, fehler } = await neueSeite(b);
  await zuClips(page);
  await page.setInputFiles('#datei-clips', [join(DATEN, 'clip-rot.webm'), join(DATEN, 'clip-blau.webm')]);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 2, null, { timeout: 30000 });
  await page.locator('.cl-bearbeiten').first().click();
  await page.waitForSelector('.cl-editor:not([hidden])');
  assert.equal(await page.getAttribute('.ce-wechsel [data-wechsel=""]', 'aria-pressed'), 'true');
  await page.click('.ce-wechsel [data-wechsel="stehen"]');
  await page.waitForFunction(() => document.querySelector('.ce-wechsel [data-wechsel="stehen"]').getAttribute('aria-pressed') === 'true'
    && !document.querySelector('.ce-wechsel button').disabled, null, { timeout: 60000 });
  assert.match(await page.locator('.ce-wechsel-info').textContent(), /bleiben kurz stehen/);
  await page.click('.ce-wechsel [data-wechsel="fahrzeug"]');
  await page.waitForFunction(() => /kein Fahrzeug/.test(document.querySelector('#meldung p')?.textContent || ''), null, { timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector('.ce-wechsel button').disabled);
  assert.equal(await page.getAttribute('.ce-wechsel [data-wechsel="stehen"]', 'aria-pressed'), 'true');
  await page.screenshot({ path: `${ERGEBNISSE}/wechsel-editor.png` });
  await page.click('#ce-fertig');
  // Der Entwurf enthält den Wechsel
  let gemerkt = null;
  for (let i = 0; i < 60 && gemerkt !== 'stehen'; i++) {
    gemerkt = await page.evaluate(async () => (await (await import('./src/speicher.mjs')).reelEntwurf())?.medien?.[0]?.wechsel?.art ?? null);
    if (gemerkt !== 'stehen') await page.waitForTimeout(150);
  }
  assert.equal(gemerkt, 'stehen');
  // Vorschau mit Vordergrund malt ohne Fehler über den Schnitt
  const ok = await page.evaluate(async () => {
    const { clipPlan, clipMaler } = await import('./src/clipreel.mjs');
    const e = await import('./src/erkennung.mjs');
    const d = await (await fetch('test/daten/clip-rot.webm')).blob();
    const medien = [
      { typ: 'clip', url: URL.createObjectURL(d), dauer: 3, start: 0, wechsel: { art: 'stehen', aus: 1.1 } },
      { typ: 'clip', url: URL.createObjectURL(d), dauer: 3, start: 0 },
    ];
    const p = clipPlan(medien);
    const c = document.createElement('canvas');
    c.width = 90;
    c.height = 160;
    const m = clipMaler(medien, p, { W: 90, H: 160, maske: e.vordergrundMaske });
    for (const t of [2.9, 3.1, 3.5, 4.2]) await m.male(c.getContext('2d'), t);
    m.ende();
    return true;
  });
  assert.ok(ok);
  assert.deepEqual(fehler.filter((x) => !/WebGL|GL Driver|TensorFlow Lite|XNNPACK|^[IW]\d{4}/.test(x)), []);
});

test('Nahtlos weiterfilmen: aufnehmen, Clip landet im Reel, letztes Bild liegt im Sucher', async () => {
  const { page, fehler } = await neueSeite(b);
  await zuClips(page);
  await page.click('#cl-weiterfilmen');
  await page.waitForSelector('.ak');
  assert.match(await page.locator('.ak-hinweis').textContent(), /ersten Clip/);
  await page.click('.ak-ausloeser');
  await page.waitForSelector('.ak.ak-laeuft');
  await page.waitForTimeout(1500);
  await page.click('.ak-ausloeser');
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 1, null, { timeout: 30000 });
  await page.waitForFunction(() => /halb durchsichtig/.test(document.querySelector('.ak-hinweis').textContent));
  await page.waitForFunction(() => /^\d+$/.test(document.querySelector('.ak-wert').textContent), null, { timeout: 10000 });
  await page.screenshot({ path: `${ERGEBNISSE}/weiterfilmen.png` });
  await page.click('.ak-zu');
  await page.waitForFunction(() => !document.querySelector('.ak'));
  assert.match(await page.locator('.cl-zeile small').first().textContent(), /^Clip/);
  assert.deepEqual(fehler, []);
});
