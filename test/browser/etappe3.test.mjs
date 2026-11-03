// Etappe 3: Karussell ohne Stufe, Sicherung verlustfrei, Fahrt als abspielbares MP4, Abbruch.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
let ctx;
let page;
before(async () => {
  s = await server();
  b = await browser();
  ({ ctx, page } = await neueSeite(b));
  // Teilen abfangen: die Dateien landen in window.__geteilt.
  await ctx.addInitScript(() => {
    window.__geteilt = [];
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => { window.__geteilt.push(files); };
  });
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  const szenen = [
    { linie: 0.55, farbeOben: [135, 175, 215], farbeUnten: [30, 75, 110] },
    { linie: 0.55, farbeOben: [205, 190, 165], farbeUnten: [90, 55, 35] },
    { linie: 0.5, farbeOben: [180, 200, 160], farbeUnten: [60, 90, 40] },
  ];
  for (const [i, sz] of szenen.entries()) {
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
  await page.waitForSelector('#v-ausfahrt:not([hidden]) .af-punkt');
});
after(async () => { await ctx?.close(); await b?.close(); await s?.schliessen(); });

const punkt = (i) => page.locator('.af-punkt').nth(i);
async function bauenUndTeilen(i, timeout = 60000) {
  const vorher = await page.evaluate(() => window.__geteilt.length);
  await punkt(i).locator('.af-titel').click();
  await punkt(i).locator('.af-reihe button.haupt').first().waitFor({ timeout });
  await punkt(i).locator('.af-reihe button.haupt').first().click();
  await warteAuf(page, (n) => window.__geteilt.length > n, vorher);
}

test('Karussell: Anzahl stimmt, Bilder ergeben aneinandergelegt das Band ohne Stufe', async () => {
  await page.screenshot({ path: `${ERGEBNISSE}/e3-ausfahrt.png` });
  assert.match(await punkt(0).locator('.af-titel').textContent(), /^Karussell · 3 Bilder für Instagram$/);
  await bauenUndTeilen(0);
  await bauenUndTeilen(2);
  const r = await page.evaluate(async () => {
    const [karussell, [gesamt]] = window.__geteilt.slice(-2);
    const lade = async (f) => { const bm = await createImageBitmap(f); const c = new OffscreenCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0); return { w: bm.width, h: bm.height, d: c.getContext('2d').getImageData(0, 0, bm.width, bm.height).data }; };
    const bilder = await Promise.all(karussell.map(lade));
    const spalte = (b, x) => { const a = []; for (let y = 0; y < b.h; y++) for (let c = 0; c < 3; c++) a.push(b.d[(y * b.w + x) * 4 + c]); return a; };
    const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
    const stufen = [];
    const innen = [];
    for (let k = 0; k + 1 < bilder.length; k++) {
      stufen.push(diff(spalte(bilder[k], bilder[k].w - 1), spalte(bilder[k + 1], 0)));
      innen.push(diff(spalte(bilder[k], bilder[k].w - 2), spalte(bilder[k], bilder[k].w - 1)));
    }
    // Gegenprobe zum Gesamtbild: jedes Karussellbild ist der passende Ausschnitt des Bands.
    const g = await createImageBitmap(gesamt);
    const abw = [];
    for (let k = 0; k < bilder.length - 1; k++) {
      const c = new OffscreenCanvas(1080, 1350);
      const x = c.getContext('2d');
      x.drawImage(g, k * 1296 * (g.height / 1620), 0, 1296 * (g.height / 1620), g.height, 0, 0, 1080, 1350);
      const d = x.getImageData(0, 0, 1080, 1350).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4 * 7) sum += Math.abs(d[i] - bilder[k].d[i]) + Math.abs(d[i + 1] - bilder[k].d[i + 1]) + Math.abs(d[i + 2] - bilder[k].d[i + 2]);
      abw.push(sum / (d.length / (4 * 7)) / 3);
    }
    return { anzahl: bilder.length, masse: bilder.map((b) => `${b.w}x${b.h}`), stufen, innen, abw, gesamt: `${g.width}x${g.height}` };
  });
  console.log(JSON.stringify(r));
  // Zum Ansehen ablegen
  const { writeFileSync } = await import('node:fs');
  const dateien = await page.evaluate(async () => {
    const [karussell, [gesamt]] = window.__geteilt.slice(-2);
    const b64 = async (f) => { const u = new Uint8Array(await f.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); };
    return Promise.all([...karussell, gesamt].map(b64));
  });
  dateien.forEach((d, i) => writeFileSync(`${ERGEBNISSE}/e3-${i === dateien.length - 1 ? 'gesamt' : 'karussell-' + (i + 1)}.jpg`, Buffer.from(d, 'base64')));
  assert.equal(r.anzahl, 3);
  for (const m of r.masse) assert.equal(m, '1080x1350');
  assert.equal(r.gesamt, '3162x1620');
  for (let i = 0; i < r.stufen.length; i++) assert.ok(r.stufen[i] < r.innen[i] + 6, `Stufe ${r.stufen[i]} gegen ${r.innen[i]}`);
  for (const a of r.abw) assert.ok(a < 4, `Abweichung zum Band ${a}`);
});

test('Sicherung lässt sich verlustfrei einspielen', async () => {
  await bauenUndTeilen(3);
  const zip = await page.evaluate(async () => {
    const [f] = window.__geteilt[window.__geteilt.length - 1];
    const u = new Uint8Array(await f.arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768));
    return { name: f.name, b64: btoa(s) };
  });
  assert.match(zip.name, /\.zip$/);
  const alteId = await page.evaluate(() => localStorage.getItem('nahtlos-aktiv'));
  await page.setInputFiles('#datei-sicherung', { name: zip.name, mimeType: 'application/zip', buffer: Buffer.from(zip.b64, 'base64') });
  await warteAuf(page, (alt) => document.body.dataset.ansicht === 'strecke' && localStorage.getItem('nahtlos-aktiv') !== alt, alteId, 30000);
  const neueId = await page.evaluate(() => localStorage.getItem('nahtlos-aktiv'));
  const vergleich = await page.evaluate(async ([a, b]) => {
    const db = await import('./src/speicher.mjs');
    const ha = await db.halte(a);
    const hb = await db.halte(b);
    const gleich = async (x, y) => {
      if (!x || !y) return x === y;
      const [p, q] = [new Uint8Array(await x.arrayBuffer()), new Uint8Array(await y.arrayBuffer())];
      return p.length === q.length && p.every((v, i) => v === q[i]);
    };
    const fehler = [];
    if (ha.length !== hb.length) fehler.push('Anzahl');
    for (let i = 0; i < ha.length; i++) {
      for (const k of ['index', 'zeit', 'wert', 'quelle', 'rohB', 'rohH']) if (ha[i][k] !== hb[i][k]) fehler.push(`${i}.${k}`);
      if (JSON.stringify(ha[i].transform) !== JSON.stringify(hb[i].transform)) fehler.push(`${i}.transform`);
      for (const k of ['roh', 'bild', 'naht', 'vorschau', 'nahtVorschau']) if (!(await gleich(ha[i][k], hb[i][k]))) fehler.push(`${i}.${k}`);
      if (hb[i].streckeId !== b || ha[i].id === hb[i].id) fehler.push(`${i}.id`);
    }
    const sa = await db.strecke(a);
    const sb = await db.strecke(b);
    if (sa.name !== sb.name) fehler.push('name');
    return { fehler, n: ha.length };
  }, [alteId, neueId]);
  assert.equal(vergleich.n, 3);
  assert.deepEqual(vergleich.fehler, []);
  assert.equal(await page.getAttribute('#v-strecke .band', 'data-breite'), String(3 * 933 + 363));
  await page.click('#zur-ausfahrt');
  await page.waitForSelector('#v-ausfahrt:not([hidden]) .af-punkt');
});

test('Fahrt erzeugt ein abspielbares MP4', async () => {
  await punkt(1).locator('.af-tempi button').nth(2).click();
  const titel = await punkt(1).locator('.af-titel').textContent();
  assert.match(titel, /^Fahrt · Video · Sprinter · \d+ s$/);
  const erwartet = Number(titel.match(/(\d+) s$/)[1]);
  await bauenUndTeilen(1, 120000);
  await page.screenshot({ path: `${ERGEBNISSE}/e3-ausfahrt-fertig.png` });
  const r = await page.evaluate(async () => {
    const [f] = window.__geteilt[window.__geteilt.length - 1];
    const kopf = new Uint8Array(await f.slice(0, 12).arrayBuffer());
    const v = document.createElement('video');
    v.muted = true;
    v.src = URL.createObjectURL(f);
    await new Promise((ok, fehler) => { v.onloadedmetadata = ok; v.onerror = () => fehler(new Error('nicht abspielbar')); });
    v.currentTime = v.duration / 2;
    await new Promise((ok) => (v.onseeked = ok));
    await v.play();
    await new Promise((ok) => setTimeout(ok, 300));
    return { typ: f.type, name: f.name, groesse: f.size, ftyp: String.fromCharCode(...kopf.subarray(4, 8)), dauer: v.duration, b: v.videoWidth, h: v.videoHeight, zeit: v.currentTime };
  });
  console.log(JSON.stringify(r));
  assert.equal(r.typ, 'video/mp4');
  assert.equal(r.ftyp, 'ftyp');
  assert.equal(r.b, 1080);
  assert.equal(r.h, 1920);
  assert.ok(Math.abs(r.dauer - erwartet) <= 1, `Dauer ${r.dauer}, angezeigt ${erwartet}`);
  assert.ok(r.zeit > r.dauer / 2, 'spielt ab');
});

test('Geht die App in den Hintergrund, bricht die Ausgabe mit Hinweis ab', async () => {
  await punkt(1).locator('.af-tempi button').nth(0).click();
  await punkt(1).locator('.af-titel').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await punkt(1).locator('.af-status', { hasText: 'Abgebrochen, weil die App in den Hintergrund ging.' }).waitFor({ timeout: 20000 });
  await page.evaluate(() => { delete document.hidden; });
  assert.equal(await punkt(1).locator('.af-reihe button').textContent(), 'Nochmal');
});
