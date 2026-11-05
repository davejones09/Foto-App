// Reel aus Clips: Auswahl, Reihenfolge, jedes Bild zeigt die richtige Stelle im Clip, MP4.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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
  assert.equal(await page.locator('.cl-bearbeiten').count(), 2);
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
  await page.locator('.cl-bearbeiten').first().click();
  await page.waitForSelector('.cl-editor:not([hidden])');
  await page.evaluate(() => {
    const r = document.querySelector('#ce-start');
    r.value = '0.5';
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#ce-fertig');
  await page.waitForSelector('.cl-editor', { state: 'hidden' });
  assert.match(await page.locator('.cl-zeile small').first().textContent(), /ab 0,5 s/);

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

test('Bei gleicher Bildrate kommt jedes Clip-Bild genau einmal vor, auch mit Startpunkt', async () => {
  const { page } = await neueSeite(b);
  await oeffne(page, s.url);
  const r = await page.evaluate(async () => {
    const { clipMaler, clipPlan } = await import('./src/clipreel.mjs');
    const d = new File([await (await fetch('test/daten/clip-rot.webm')).blob()], 'r.webm', { type: 'video/webm' });
    const c = document.createElement('canvas');
    c.width = 90;
    c.height = 160;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const aus = {};
    for (const start of [0, 0.5, 0.517]) {
      const medien = [{ typ: 'clip', datei: d, url: URL.createObjectURL(d), dauer: 3, start }];
      const p = clipPlan(medien);
      const m = clipMaler(medien, p, { W: 90, H: 160 });
      const werte = [];
      for (let k = 0; k < 45; k++) {
        await m.male(ctx, k / 30);
        werte.push(ctx.getImageData(45, 80, 1, 1).data[0]);
      }
      m.ende();
      aus[start] = werte;
    }
    return aus;
  });
  for (const [start, w] of Object.entries(r)) {
    // Rot steigt um 70 je Sekunde, also etwa 2,3 je Bild: keine Pause, kein Doppelsprung.
    for (let i = 1; i < w.length; i++) {
      const d = w[i] - w[i - 1];
      assert.ok(d >= 0 && d <= 6, `Start ${start}, Bild ${i}: ${w.join(' ')}`);
    }
    const gleich = w.slice(1).filter((x, i) => x === w[i]).length;
    assert.ok(gleich <= 4, `Start ${start}: ${gleich} gleiche Bilder: ${w.join(' ')}`);
  }
});

async function fotoDatei(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 900;
    const k = c.getContext('2d');
    k.fillStyle = 'rgb(200,30,30)';
    k.fillRect(0, 0, 800, 900);
    k.fillStyle = 'rgb(30,200,30)';
    k.fillRect(800, 0, 800, 900);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.95));
    const u = new Uint8Array(await blob.arrayBuffer());
    let t = '';
    for (let i = 0; i < u.length; i += 32768) t += String.fromCharCode(...u.subarray(i, i + 32768));
    return btoa(t);
  });
  return { name: 'quer.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}

test('Foto: Ausschnitt verschieben, zoomen, ganz zeigen, Länge einstellen', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  await page.setInputFiles('#datei-clips', [await fotoDatei(page)]);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 1, null, { timeout: 20000 });
  await page.click('.cl-bearbeiten');
  await page.waitForSelector('.cl-editor:not([hidden])');
  const farbe = () => page.evaluate(() => {
    const c = document.querySelector('#ce-bild');
    const d = c.getContext('2d').getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
    return [d[0], d[1]];
  });
  const box = await page.locator('#ce-bild').boundingBox();
  // Ganz nach rechts ziehen zeigt die linke, rote Bildhälfte
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 3, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  let c = await farbe();
  assert.ok(c[0] > 150 && c[1] < 80, `rot erwartet: ${c}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - box.width * 3, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  c = await farbe();
  assert.ok(c[1] > 150 && c[0] < 80, `grün erwartet: ${c}`);
  // Ganz zeigen: Links und rechts der Bildmitte sind beide Hälften zu sehen, oben und unten nur Hintergrund
  await page.click('.ce-modus [data-modus="ganz"]');
  const ganz = await page.evaluate(() => {
    const cv = document.querySelector('#ce-bild');
    const k = cv.getContext('2d');
    const y = cv.height >> 1;
    const l = k.getImageData(10, y, 1, 1).data;
    const r = k.getImageData(cv.width - 10, y, 1, 1).data;
    return { l: [l[0], l[1]], r: [r[0], r[1]] };
  });
  assert.ok(ganz.l[0] > 150 && ganz.r[1] > 150, JSON.stringify(ganz));
  await page.screenshot({ path: `${ERGEBNISSE}/cl-editor.png` });
  await page.evaluate(() => {
    const r = document.querySelector('#ce-laenge');
    r.value = '4';
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.locator('#ce-fertig').textContent(), 'Fertig');
  await page.click('#ce-fertig');
  assert.match(await page.locator('.cl-zeile small').first().textContent(), /Foto · 4,0 s · ganz gezeigt/);
  assert.match(await page.locator('.cl-info').textContent(), /4 s/);
  assert.deepEqual(fehler, []);
});

function wav(bpm, sek) {
  const rate = 22050;
  const n = rate * sek;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  const a = new Float32Array(n);
  for (let t = 0.1; t < sek - 0.2; t += 60 / bpm) {
    const st = Math.round(t * rate);
    for (let i = 0; i < 0.15 * rate && st + i < n; i++) a[st + i] += 0.8 * Math.sin(2 * Math.PI * 70 * (i / rate)) * Math.exp((-i / rate) * 20);
  }
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, a[i])) * 32000), 44 + i * 2);
  return { name: 'musik.wav', mimeType: 'audio/wav', buffer: b };
}

test('Musik: Takt erkannt, Schnitte darauf, Video enthält Ton', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  await page.setInputFiles('#datei-clips', [join(DATEN, 'clip-rot.webm'), join(DATEN, 'clip-blau.webm')]);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 2, null, { timeout: 30000 });
  await page.setInputFiles('#datei-musik', [wav(120, 20)]);
  await page.waitForSelector('.cl-musik-info:not([hidden])', { timeout: 20000 });
  assert.match(await page.locator('.cl-musik-takt').textContent(), /1(19|20|21) BPM/);
  assert.equal(await page.locator('.cl-alle button[aria-pressed="true"]').textContent(), 'Alle 2');
  await page.locator('.cl-stil[data-stil="v-slide"]').click();
  await page.click('#cl-bauen');
  await page.waitForSelector('.cl-video', { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const u = new Uint8Array(await (await fetch(document.querySelector('.cl-video').src)).arrayBuffer());
    const { mp4TonProben } = await import('./src/metadaten.mjs');
    return { daten: Array.from(u), proben: mp4TonProben(u), hinweis: document.querySelector('.cl-ergebnis p').textContent };
  });
  assert.ok(r.daten.length > 1000);
  assert.ok(r.proben > 100, 'Tonspur fehlt');
  // Die fertige Datei mit einem fremden Programm prüfen: AAC, und der Ton ist wirklich hörbar.
  const datei = join(ERGEBNISSE, 'cl-musik.mp4');
  writeFileSync(datei, Buffer.from(r.daten));
  const ff = spawnSync('ffmpeg', ['-v', 'error', '-i', datei, '-map', '0:a', '-f', 'f32le', '-ac', '1', '-'], { maxBuffer: 1e9 });
  if (!ff.error) {
    assert.equal(ff.status, 0, String(ff.stderr));
    const t = new Float32Array(ff.stdout.buffer, ff.stdout.byteOffset, ff.stdout.length >> 2);
    assert.ok(t.subarray(0, 96000).some((x) => Math.abs(x) > 0.05), 'Tonspur ist stumm');
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', datei]);
    assert.equal(String(probe.stdout).trim(), 'aac');
  }
  assert.match(r.hinweis, /enthält die Musik/);
  await page.screenshot({ path: `${ERGEBNISSE}/cl-musik.png` });
  assert.deepEqual(fehler, []);
});
