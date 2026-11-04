// Reel-Stile im Browser: Live-Vorschau, Auswahl, jedes Bild formatfüllend, MP4 mit richtiger Dauer und
// Bildanzahl, Vorschlag mit weniger Fotos, Stile ausgeblendet, wenn nur der Ausweichweg da ist.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, zumProjekt, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const SZENEN = [
  { linie: 0.55, farbeOben: [135, 175, 215], farbeUnten: [30, 75, 110] },
  { linie: 0.55, farbeOben: [205, 190, 165], farbeUnten: [90, 55, 35] },
  { linie: 0.5, farbeOben: [180, 200, 160], farbeUnten: [60, 90, 40] },
];

async function dreiFotos(page) {
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
  await page.waitForSelector('#v-ausfahrt:not([hidden]) .af-stil');
}

const reelKarte = (page) => page.locator('.af-punkt', { has: page.locator('.af-stile') });

test('Stile: Live-Vorschau, Auswahl, jedes Bild füllt den Rahmen, MP4 mit 450 Bildern', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await ctx.addInitScript(() => {
    window.__geteilt = [];
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => { window.__geteilt.push(files); };
  });
  await dreiFotos(page);
  const karte = reelKarte(page);
  assert.deepEqual(await karte.locator('.af-stil:not([hidden])').evaluateAll((l) => l.map((x) => x.dataset.stil)), ['band', 'sanft', 'schwung', 'zoom', 'naht']);
  assert.deepEqual(await karte.locator('.af-stil span').allTextContents(), ['Band', 'Sanft', 'Schwung', 'Zoom', 'Naht']);
  await warteAuf(page, () => [...document.querySelectorAll('.af-stil canvas')].every((c) => c.dataset.laeuft === '1'), null, 20000);
  // Die Vorschau bewegt sich
  const abdruck = () => page.evaluate(() => [...document.querySelectorAll('.af-stil canvas')].map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 64) s += d[i]; return s; }));
  const a = await abdruck();
  await page.waitForTimeout(900);
  const z = await abdruck();
  assert.ok(a.some((v, i) => v !== z[i]), 'Vorschau animiert');
  await page.screenshot({ path: `${ERGEBNISSE}/rs-stile.png` });

  // Stil wählen: Standzeit ergibt sich aus der Länge
  await karte.locator('.af-laengen button', { hasText: '15 s' }).click();
  await karte.locator('.af-stil[data-stil="naht"]').click();
  assert.equal(await karte.locator('.af-stil[data-stil="naht"]').getAttribute('aria-pressed'), 'true');
  assert.match(await karte.locator('.af-tempo').textContent(), /^3 Fotos · 4,4 s je Foto$/);
  assert.ok(await karte.locator('.af-vorschlag').isHidden());

  // Jeder Stil: Anfang, mitten im Übergang und Ende füllen den 9:16-Rahmen ganz
  const r = await page.evaluate(async () => {
    const aus = await import('./src/ausgabe.mjs');
    const db = await import('./src/speicher.mjs');
    const halte = (await db.halte(localStorage.getItem('nahtlos-aktiv'))).filter((h) => h.bild);
    const ergebnis = {};
    for (const stil of ['sanft', 'schwung', 'zoom', 'naht']) {
      const plan = aus.reelStilPlan(halte, { laenge: 15, stil });
      const m = await aus.stilMaler(halte, plan);
      const c = new OffscreenCanvas(1080, 1920);
      const k = c.getContext('2d', { willReadFrequently: true });
      const zeiten = [0, plan.stand + plan.uebergang / 2, plan.dauer - 1 / 30];
      ergebnis[stil] = [];
      for (const t of zeiten) {
        await m.male(k, t);
        // Dunkelster Rand: In den Ecken und an den Kanten darf nichts schwarz bleiben
        let min = 255;
        for (const [x, y] of [[2, 2], [1077, 2], [2, 1917], [1077, 1917], [540, 2], [540, 1917], [2, 960], [1077, 960]]) {
          const d = k.getImageData(x, y, 1, 1).data;
          min = Math.min(min, (d[0] + d[1] + d[2]) / 3);
        }
        ergebnis[stil].push(Math.round(min));
      }
      m.ende();
    }
    return ergebnis;
  });
  console.log(JSON.stringify(r));
  for (const [stil, werte] of Object.entries(r)) for (const w of werte) assert.ok(w > 20, `${stil}: Rahmen ganz gefüllt (${werte})`);

  // Bauen: MP4, 15 s, genau 450 Bilder, endet auf dem letzten Foto
  await karte.locator('.af-titel').click();
  await karte.locator('.af-reihe button', { hasText: 'In Fotos speichern' }).waitFor({ timeout: 240000 });
  await karte.locator('.af-reihe button', { hasText: 'In Fotos speichern' }).click();
  await warteAuf(page, () => window.__geteilt.length > 0);
  const v = await page.evaluate(async () => {
    const [video, titel] = window.__geteilt.at(-1);
    const u = new Uint8Array(await video.arrayBuffer());
    // Bildanzahl aus dem stsz-Kasten
    let n = -1;
    for (let i = 4; i + 16 < u.length; i++) {
      if (u[i] === 0x73 && u[i + 1] === 0x74 && u[i + 2] === 0x73 && u[i + 3] === 0x7a) { n = (u[i + 12] << 24 | u[i + 13] << 16 | u[i + 14] << 8 | u[i + 15]) >>> 0; break; }
    }
    const el = document.createElement('video');
    el.muted = true;
    el.src = URL.createObjectURL(video);
    await new Promise((ok, f) => { el.onloadedmetadata = ok; el.onerror = () => f(new Error('nicht abspielbar')); });
    const c = document.createElement('canvas');
    c.width = 108; c.height = 192;
    const k = c.getContext('2d', { willReadFrequently: true });
    const bei = async (t) => { el.currentTime = t; await new Promise((ok) => (el.onseeked = ok)); k.drawImage(el, 0, 0, 108, 192); const d = k.getImageData(54, 40, 1, 1).data; return [d[0], d[1], d[2]]; };
    return { name: video.name, titel: titel.name, dauer: el.duration, b: el.videoWidth, h: el.videoHeight, bilder: n, anfang: await bei(0.2), ende: await bei(14.9) };
  });
  console.log(JSON.stringify(v));
  assert.equal(v.name, 'reel.mp4');
  assert.equal(v.titel, 'reel-cover.jpg');
  assert.equal(`${v.b}x${v.h}`, '1080x1920');
  assert.ok(Math.abs(v.dauer - 15) < 0.2, `Dauer ${v.dauer}`);
  assert.equal(v.bilder, 450, 'genau 15 s × 30 Bilder');
  // Anfang: Himmel des ersten Fotos (blau), Ende: Himmel des letzten (grünlich)
  assert.ok(v.anfang[2] > v.anfang[0] + 30, `Anfang zeigt das erste Foto: ${v.anfang}`);
  assert.ok(v.ende[1] > v.ende[2] + 10, `Ende zeigt das letzte Foto: ${v.ende}`);
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Zu kurz für alle Fotos: Vorschlag mit weniger Fotos', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await ausloesen(page);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher' && !document.querySelector('#ausloeser').disabled);
  await ausloesen(page);
  await page.waitForSelector('#v-aufdeckung .aktionen:not([hidden])', { timeout: 20000 });
  await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const id = localStorage.getItem('nahtlos-aktiv');
    const [, h1] = await db.halte(id);
    for (let i = 2; i < 20; i++) await db.neuerHalt({ ...h1, id: db.neueId(), index: i, zeit: h1.zeit + i * 600000 });
  });
  await page.reload();
  await zumProjekt(page);
  await page.click('#zur-ausfahrt');
  const karte = reelKarte(page);
  await karte.locator('.af-stil[data-stil="sanft"]').click();
  await karte.locator('.af-laengen button', { hasText: '15 s' }).click();
  await karte.locator('.af-vorschlag').waitFor();
  assert.match(await karte.locator('.af-vorschlag').textContent(), /^Bei 15 s bleibt zu wenig Zeit je Foto\. Vorschlag: Foto 1 bis 6\./);
  await karte.locator('.af-vorschlag-ok').click();
  assert.ok(await karte.locator('.af-vorschlag').isHidden());
  assert.match(await karte.locator('.af-tempo').textContent(), /^6 Fotos · \d,\d s je Foto$/);
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Nur der Ausweichweg (ohne WebCodecs): Schwung und Naht sind ausgeblendet', async () => {
  const { ctx, page } = await neueSeite(b);
  await ctx.addInitScript(() => { delete window.VideoEncoder; delete window.VideoFrame; });
  await dreiFotos(page);
  const karte = reelKarte(page);
  await page.waitForTimeout(500);
  const sichtbar = await karte.locator('.af-stil:not([hidden])').evaluateAll((l) => l.map((x) => x.dataset.stil));
  const weg = await page.evaluate(async () => (await (await import('./src/ausgabe.mjs')).reelWeg())?.art || null);
  console.log(weg, sichtbar);
  if (weg === 'recorder') assert.deepEqual(sichtbar, ['band', 'sanft', 'zoom']);
  else assert.deepEqual(sichtbar, [], 'ohne MP4-Weg gar kein Stil');
  await ctx.close();
});
