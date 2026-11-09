// Reel-Vorlagen im Browser: Auswahl, Auto, jedes Bild füllt den Rahmen, MP4 wird gebaut.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, ERGEBNISSE } from './hilfe.mjs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

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

// 120 BPM: Kick alle 0,5 s ab 0,1 s
function wav(sek) {
  const rate = 22050;
  const n = rate * sek;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const ph = ((i / rate) - 0.1) % 0.5;
    const v = ph >= 0 && ph < 0.12 ? Math.sin(2 * Math.PI * 60 * ph) * Math.exp(-ph * 30) * 0.8 : 0.02 * Math.sin(i);
    b.writeInt16LE(Math.round(v * 32000), 44 + i * 2);
  }
  const datei = join(ERGEBNISSE, 'rv-musik.wav');
  writeFileSync(datei, b);
  return datei;
}

test('Foto-Reel mit Musik: Vorlage schneidet auf die Schläge, Ton im MP4', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await ctx.addInitScript(() => {
    window.__geteilt = [];
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => { window.__geteilt.push(files); };
  });
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
  await page.locator('.af-vorlage[data-stil="v-slide"]').click();
  const karte = page.locator('.af-punkt').filter({ has: page.locator('.af-vorlage') });
  await karte.locator('.af-musik input[type=file]').setInputFiles(wav(30));
  await karte.locator('.af-musik-info:not([hidden])').waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${ERGEBNISSE}/rv-musik.png` });
  await karte.locator('.af-titel').click();
  await karte.locator('.af-reihe button', { hasText: 'In Fotos speichern' }).waitFor({ timeout: 180000 });
  assert.match(await karte.locator('.af-status').textContent(), /Musik/);
  await karte.locator('.af-reihe button', { hasText: 'In Fotos speichern' }).click();
  await warteAuf(page, () => window.__geteilt.length > 0);
  const daten = await page.evaluate(async () => Array.from(new Uint8Array(await window.__geteilt[0][0].arrayBuffer())));
  const datei = join(ERGEBNISSE, 'rv-musik.mp4');
  writeFileSync(datei, Buffer.from(daten));
  const ff = spawnSync('ffmpeg', ['-v', 'error', '-i', datei, '-vf', 'scale=27:48,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1e9 });
  if (!ff.error) {
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', datei]);
    assert.equal(String(probe.stdout).trim(), 'aac');
    const g = 27 * 48;
    const n = Math.floor(ff.stdout.length / g);
    const u = [];
    for (let i = 1; i < n; i++) {
      let d = 0;
      for (let p = 0; p < g; p++) d += Math.abs(ff.stdout[i * g + p] - ff.stdout[(i - 1) * g + p]);
      u.push(d / g);
    }
    // Letztes Bild, in dem sich noch etwas bewegt: Danach steht das neue Foto, genau zum Schlag (0,1 + k × 0,5).
    const enden = [];
    u.forEach((d, i) => { if (d > 1 && !(u[i + 1] > 1)) enden.push((i + 1) / 30); });
    assert.ok(enden.length >= 1, 'Übergänge gefunden');
    for (const e of enden) {
      const schlag = 0.1 + Math.round((e - 0.1) / 0.5) * 0.5;
      assert.ok(e >= schlag - 0.1 && e <= schlag + 0.04, `Übergang endet bei ${e.toFixed(2)} s, Schlag bei ${schlag.toFixed(2)} s`);
    }
  }
  assert.deepEqual(fehler, []);
});
