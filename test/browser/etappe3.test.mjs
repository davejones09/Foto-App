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
      for (const k of ['roh', 'bild', 'naht', 'vorschau', 'nahtVorschau']) {
        if (!!ha[i][k] !== !!hb[i][k]) { fehler.push(`${i}.${k} fehlt`); continue; }
        if (!(await gleich(await db.blob(ha[i], k), await db.blob(hb[i], k)))) fehler.push(`${i}.${k}`);
      }
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

test('Reel: 15 s, Abschnitt von Halt 2 bis 3, MP4, Titelbild, ab dem ersten Bild in Bewegung', async () => {
  const karte = punkt(1);
  assert.match(await karte.locator('.af-titel').textContent(), /^Reel · Video für Instagram · \d+ s$/);
  await karte.locator('.af-laengen button', { hasText: '15 s' }).click();
  assert.equal(await karte.locator('.af-titel').textContent(), 'Reel · Video für Instagram · 15 s');
  await karte.locator('select').nth(0).selectOption('1');
  assert.equal(await karte.locator('select').nth(1).inputValue(), '2');
  assert.match(await karte.locator('.af-tempo').textContent(), /^2 Halte · Tempo \d+ Pixel pro Sekunde$/);
  assert.ok(await karte.locator('.af-vorschlag').isHidden());
  await karte.locator('.af-titel').click();
  await karte.locator('.af-reihe button', { hasText: 'In Fotos speichern' }).waitFor({ timeout: 180000 });
  assert.match(await karte.locator('.af-status').textContent(), /Reel/);
  await page.screenshot({ path: `${ERGEBNISSE}/e3-reel-fertig.png` });
  const vorher = await page.evaluate(() => window.__geteilt.length);
  await karte.locator('.af-reihe button', { hasText: 'In Fotos speichern' }).click();
  await warteAuf(page, (n) => window.__geteilt.length > n, vorher);
  const r = await page.evaluate(async () => {
    const [video, titel] = window.__geteilt[window.__geteilt.length - 1];
    const kopf = new Uint8Array(await video.slice(0, 12).arrayBuffer());
    const v = document.createElement('video');
    v.muted = true;
    v.src = URL.createObjectURL(video);
    await new Promise((ok, fehler) => { v.onloadedmetadata = ok; v.onerror = () => fehler(new Error('nicht abspielbar')); });
    // Erstes und zweites Bild vergleichen: Das Reel bewegt sich sofort.
    const c = document.createElement('canvas');
    c.width = 270; c.height = 480;
    const k = c.getContext('2d', { willReadFrequently: true });
    const bildBei = async (t) => {
      v.currentTime = t;
      await new Promise((ok) => (v.onseeked = ok));
      k.drawImage(v, 0, 0, 270, 480);
      return k.getImageData(0, 0, 270, 480).data;
    };
    const unterschied = (a, b) => { let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]); return d / (a.length / 4); };
    const anfang = unterschied(await bildBei(0), await bildBei(0.2));
    const ende = unterschied(await bildBei(14.4), await bildBei(14.6));
    k.drawImage(v, 0, 0, 270, 480);
    const endBild = c.toDataURL('image/png');
    const tb = await createImageBitmap(titel);
    const tc = new OffscreenCanvas(tb.width, tb.height);
    const tk = tc.getContext('2d');
    tk.drawImage(tb, 0, 0);
    const zeile = (y) => { const d = tk.getImageData(0, y, tb.width, 1).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4) / 3; };
    return {
      typ: video.type, name: video.name, ftyp: String.fromCharCode(...kopf.subarray(4, 8)), dauer: v.duration, b: v.videoWidth, h: v.videoHeight,
      anfang, ende, endBild, titelBild: tc.convertToBlob ? await new Promise(async (ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(titel); }) : null,
      titel: `${tb.width}x${tb.height}`, titelName: titel.name,
      oben: zeile(100), mitte: zeile(960), unten: zeile(1800),
    };
  });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${ERGEBNISSE}/e3-reel-endstation.png`, Buffer.from(r.endBild.split(',')[1], 'base64'));
  writeFileSync(`${ERGEBNISSE}/e3-reel-titelbild.jpg`, Buffer.from(r.titelBild.split(',')[1], 'base64'));
  delete r.endBild; delete r.titelBild;
  console.log(JSON.stringify(r));
  assert.equal(r.typ, 'video/mp4');
  assert.equal(r.ftyp, 'ftyp');
  assert.match(r.name, /-reel-15s\.mp4$/);
  assert.equal(r.b, 1080);
  assert.equal(r.h, 1920);
  assert.ok(Math.abs(r.dauer - 15) < 0.2, `Dauer ${r.dauer}`);
  assert.ok(r.anfang > 3 * r.ende + 0.5, `in Bewegung ab dem ersten Bild: ${r.anfang}, am Ende ruhig: ${r.ende}`);
  assert.equal(r.titel, '1080x1920');
  assert.ok(r.mitte > 40, 'Titelbild trägt das Band in der Mitte');
  assert.ok(r.oben < 20 && r.unten < 20, 'außerhalb der mittleren 1080×1350 nur Grund');
});

test('Geht die App in den Hintergrund, bricht die Ausgabe mit Hinweis ab', async () => {
  await punkt(1).locator('.af-laengen button', { hasText: '90 s' }).click();
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
