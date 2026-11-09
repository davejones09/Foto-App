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
    window.__ladenWeg = document.querySelector('#laden').hidden;
    return { daten: Array.from(u), proben: mp4TonProben(u), hinweis: document.querySelector('.cl-ergebnis p').textContent };
  });
  assert.ok(r.daten.length > 1000);
  assert.ok(r.proben > 100, 'Tonspur fehlt');
  assert.equal(await page.evaluate(() => window.__ladenWeg), true, 'Ladeanzeige ist weg');
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

test('Ladeanzeige: steht ab dem Öffnen der Auswahl, zählt mit, verschwindet', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  const wahl = page.waitForEvent('filechooser');
  await page.click('#cl-waehlen');
  const auswahl = await wahl;
  assert.equal(await page.locator('#laden').isVisible(), true, 'Anzeige schon beim Öffnen');
  assert.match(await page.locator('.laden-text').textContent(), /Wird geladen/);
  await page.screenshot({ path: `${ERGEBNISSE}/cl-laden.png` });
  // Abbrechen nimmt sie wieder weg
  await page.evaluate(() => document.querySelector('#datei-clips').dispatchEvent(new Event('cancel', { bubbles: true })));
  assert.equal(await page.locator('#laden').isVisible(), false);
  await page.click('#cl-waehlen').catch(() => {});
  await auswahl.setFiles([join(DATEN, 'clip-rot.webm'), join(DATEN, 'clip-blau.webm')]);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 2, null, { timeout: 30000 });
  await page.waitForSelector('#laden', { state: 'hidden' });
  assert.deepEqual(fehler, []);
});

test('Bearbeiten: Fertig und Zurücksetzen liegen unten und bleiben erreichbar', async () => {
  const { page, fehler } = await neueSeite(b);
  await page.setViewportSize({ width: 390, height: 664 });
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  await page.setInputFiles('#datei-clips', [join(DATEN, 'clip-rot.webm')]);
  await page.waitForSelector('.cl-bearbeiten');
  await page.click('.cl-bearbeiten');
  await page.waitForSelector('.cl-editor:not([hidden])');
  const r = await page.evaluate(() => {
    const k = (id) => document.querySelector(id).getBoundingClientRect();
    return { fertig: k('#ce-fertig'), zurueck: k('#ce-zuruecksetzen'), h: innerHeight };
  });
  for (const k of [r.fertig, r.zurueck]) {
    assert.ok(k.top > r.h * 0.75, `Knopf liegt bei ${k.top} von ${r.h}`);
    assert.ok(k.bottom <= r.h, 'Knopf im Bild');
    assert.ok(k.height >= 44);
  }
  await page.screenshot({ path: `${ERGEBNISSE}/cl-editor-klein.png` });
  await page.click('#ce-fertig');
  await page.waitForSelector('.cl-editor', { state: 'hidden' });
  assert.deepEqual(fehler, []);
});

test('Musik: Der Übergang landet auf dem Schlag', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  await page.setInputFiles('#datei-clips', [join(DATEN, 'clip-rot.webm'), join(DATEN, 'clip-blau.webm')]);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 2, null, { timeout: 30000 });
  await page.setInputFiles('#datei-musik', [wav(120, 20)]);
  await page.waitForSelector('.cl-musik-info:not([hidden])', { timeout: 20000 });
  await page.locator('.cl-stil[data-stil="v-slide"]').click();
  await page.click('#cl-bauen');
  await page.waitForSelector('.cl-video', { timeout: 120000 });
  const daten = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.querySelector('.cl-video').src)).arrayBuffer())));
  const datei = join(ERGEBNISSE, 'cl-takt.mp4');
  writeFileSync(datei, Buffer.from(daten));
  const ff = spawnSync('ffmpeg', ['-v', 'error', '-i', datei, '-vf', 'scale=32:57,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1e9 });
  if (!ff.error) {
    assert.equal(ff.status, 0, String(ff.stderr));
    const groesse = 32 * 57;
    const bilder = Math.floor(ff.stdout.length / groesse);
    const unterschied = [];
    for (let i = 1; i < bilder; i++) {
      let d = 0;
      for (let p = 0; p < groesse; p++) d += Math.abs(ff.stdout[i * groesse + p] - ff.stdout[(i - 1) * groesse + p]);
      unterschied.push(d / groesse);
    }
    // Letztes Bild jeder Bewegung: danach steht das neue Bild. Die Kicks liegen bei 0,1 + k × 0,5.
    const enden = [];
    unterschied.forEach((d, i) => { if (d > 3 && !(unterschied[i + 1] > 3)) enden.push((i + 1) / 30); });
    assert.ok(enden.length === 1, `Genau ein Übergang erwartet, gefunden: ${enden}`);
    for (const e of enden) {
      const abstand = Math.abs(((e - 0.1 + 0.25) % 0.5) - 0.25);
      assert.ok(abstand <= 0.07, `Übergang endet ${abstand.toFixed(3)} s neben dem Schlag (${e.toFixed(2)} s)`);
    }
  }
  assert.deepEqual(fehler, []);
});

test('Sofort-Vorschau: zeigt das erste Bild, spielt in Echtzeit, folgt Änderungen ohne Bauen', async () => {
  // Rot: Rotanteil steigt mit 70 je Sekunde, Blau: Blauanteil mit 100. So zeigt die Farbe die Stelle im Clip.
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  assert.ok(await page.locator('.cl-vorschau').isHidden(), 'ohne Medien keine Vorschau');
  await page.setInputFiles('#datei-clips', [join(DATEN, 'clip-rot.webm'), join(DATEN, 'clip-blau.webm')]);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 2, null, { timeout: 30000 });
  await page.waitForSelector('.cl-vorschau:not([hidden])');
  const pixel = 'const c = document.querySelector("#cl-vorschau"); const d = c.getContext("2d").getImageData(c.width / 2, c.height / 2, 1, 1).data;';
  const warte = (bed, ms = 8000) => page.waitForFunction(`(() => { ${pixel} return ${bed}; })()`, null, { timeout: ms, polling: 50 });
  await warte('d[3] === 255 && d[1] > 10 && d[0] < 40 && d[2] > 10', 15000);
  await page.screenshot({ path: `${ERGEBNISSE}/cl-vorschau.png` });
  const t0 = Date.now();
  await page.click('.cl-vorschau-bild');
  assert.ok(await page.locator('.cl-vorschau-knopf').isHidden(), 'Spielt: Knopf weg');
  await warte('d[0] > 100 && d[2] < 40');
  const rot = (Date.now() - t0) / 1000;
  assert.ok(rot > 1 && rot < 3.2, `Rot 100 nach ${rot} s, erwartet etwa 1,4 s`);
  await warte('d[2] > 90 && d[0] < 40');
  const blau = (Date.now() - t0) / 1000;
  assert.ok(blau > 3 && blau < 6, `Blau 90 nach ${blau} s, erwartet etwa 3,9 s`);
  const stand = await page.evaluate(() => parseFloat(document.querySelector('.cl-zeit-stand').style.width));
  assert.ok(stand > 50, `Zeitleiste bei ${stand} %`);
  // Anhalten und an den Anfang springen
  await page.click('.cl-vorschau-bild');
  assert.ok(await page.locator('.cl-vorschau-knopf').isVisible());
  await page.locator('.cl-zeitleiste').scrollIntoViewIfNeeded();
  const leiste = await page.locator('.cl-zeitleiste').boundingBox();
  await page.mouse.click(leiste.x + leiste.width * 0.2, leiste.y + leiste.height / 2);
  await warte('d[0] > 50 && d[2] < 40');
  // Reihenfolge ändern: An derselben Stelle steht sofort der blaue Clip, ohne Bauen.
  await page.locator('.cl-zeile').first().locator('button', { hasText: '↓' }).click();
  await warte('d[2] > 60 && d[0] < 40');
  assert.equal(await page.locator('.cl-video').count(), 0, 'Nichts gebaut');
  await page.click('#cl-zurueck');
  await warteAuf(page, () => document.body.dataset.ansicht !== 'clips');
  const laufend = await page.evaluate(() => [...document.querySelectorAll('body > video')].filter((x) => !x.paused).length);
  assert.equal(laufend, 0);
  assert.deepEqual(fehler, []);
});

test('Entwurf: Clips, Musik und Stil überstehen das Schließen der App, „Neu beginnen“ räumt auf', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  const zuClips = async () => {
    await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
    await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  };
  await zuClips();
  assert.ok(await page.locator('#cl-neu').isHidden());
  await page.setInputFiles('#datei-clips', [join(DATEN, 'clip-rot.webm'), join(DATEN, 'clip-blau.webm')]);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 2, null, { timeout: 30000 });
  await page.setInputFiles('#datei-musik', [wav(120, 20)]);
  await page.waitForSelector('.cl-musik-info:not([hidden])', { timeout: 20000 });
  await page.locator('.cl-stil[data-stil="v-slide"]').click();
  await page.locator('.cl-zeile').first().locator('button', { hasText: '↓' }).click();
  await page.waitForTimeout(800);
  // App schließen und neu öffnen
  await oeffne(page, s.url);
  await zuClips();
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 2, null, { timeout: 30000 });
  await page.waitForSelector('.cl-musik-info:not([hidden])', { timeout: 20000 });
  assert.equal(await page.locator('.cl-stil[aria-pressed="true"]').getAttribute('data-stil'), 'v-slide');
  assert.match(await page.locator('#meldung p').textContent(), /Entwurf ist wieder da/);
  // Reihenfolge blieb: zuerst Blau (2 s), dann Rot (3 s)
  const infos = await page.locator('.cl-zeile small').allTextContents();
  assert.match(infos[0], /2,0 s/);
  assert.match(infos[1], /3,0 s/);
  await page.screenshot({ path: `${ERGEBNISSE}/cl-entwurf.png` });
  // Neu beginnen
  await page.click('#cl-neu');
  await page.locator('#dialog button', { hasText: 'Neu beginnen' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 0);
  await page.waitForTimeout(500);
  const rest = await page.evaluate(async () => {
    const d = await (await import('./src/speicher.mjs')).oeffne();
    const keys = await new Promise((ok) => { const r = d.transaction('dateien').objectStore('dateien').getAllKeys(); r.onsuccess = () => ok(r.result); });
    return keys.filter((k) => k.startsWith('entwurf/')).length;
  });
  assert.equal(rest, 0, 'Keine Entwurfsdaten mehr');
  await oeffne(page, s.url);
  await zuClips();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.cl-zeile').count(), 0);
  assert.deepEqual(fehler, []);
});

test('Speicherformat 6: Daten aus Format 5 bleiben unberührt', async () => {
  const { page, fehler } = await neueSeite(b);
  await page.goto(`${s.url}manifest.webmanifest`);
  await page.evaluate(() => new Promise((ok, nein) => {
    const r = indexedDB.open('nahtlos', 5);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('strecken', { keyPath: 'id' });
      const h = d.createObjectStore('halte', { keyPath: 'id' });
      h.createIndex('strecke', 'streckeId');
      d.createObjectStore('einstellungen', { keyPath: 'schluessel' });
      const se = d.createObjectStore('serie', { keyPath: 'id' });
      se.createIndex('strecke', 'streckeId');
      const da = d.createObjectStore('dateien', { keyPath: 'schluessel' });
      da.createIndex('laenge', 'laenge');
      d.createObjectStore('collagen', { keyPath: 'id' });
    };
    r.onsuccess = () => {
      const d = r.result;
      const t = d.transaction(['collagen', 'dateien', 'strecken'], 'readwrite');
      t.objectStore('collagen').put({ id: 'c1', name: 'Alt', erstellt: 1, fotos: [], felder: [] });
      t.objectStore('strecken').put({ id: 's1', name: 'Alte Strecke', erstellt: 1 });
      t.objectStore('dateien').put({ schluessel: 'x/roh', typ: 'image/jpeg', laenge: 3, daten: new Uint8Array([1, 2, 3]).buffer });
      t.oncomplete = () => { d.close(); ok(); };
      t.onerror = () => nein(t.error);
    };
    r.onerror = () => nein(r.error);
  }));
  await oeffne(page, s.url);
  const r = await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const d = await db.oeffne();
    return {
      version: d.version, stores: [...d.objectStoreNames].sort(),
      collage: (await db.collage('c1'))?.name, strecke: (await db.strecke('s1'))?.name, datei: (await db.datei('x/roh'))?.laenge,
      entwurf: await db.reelEntwurf(),
    };
  });
  assert.equal(r.version, 6);
  assert.ok(r.stores.includes('reelentwurf'));
  assert.equal(r.collage, 'Alt');
  assert.equal(r.strecke, 'Alte Strecke');
  assert.equal(r.datei, 3);
  assert.equal(r.entwurf, undefined);
  assert.deepEqual(fehler, []);
});

test('Erweitert: Originalton im Reel, Ton-Regler, Tempo, Schnitte auf der Wellenform ziehen', async () => {
  const { page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  // Einfach zeigt keine Profi-Regler
  assert.equal(await page.getAttribute('#v-clips', 'data-modus'), 'einfach');
  await page.setInputFiles('#datei-clips', [join(DATEN, 'clip-ton.webm'), join(DATEN, 'clip-rot.webm')]);
  await page.waitForFunction(() => document.querySelectorAll('.cl-zeile').length === 2, null, { timeout: 30000 });
  assert.ok(await page.locator('.cl-tempo').isHidden());
  assert.ok(await page.locator('#cl-ton').isHidden());
  // Ohne Musik: Originalton landet im Reel
  await page.click('#cl-bauen');
  await page.waitForSelector('.cl-video', { timeout: 120000 });
  assert.match(await page.locator('.cl-ergebnis p').textContent(), /Originalton/);
  const holen = async (name) => {
    const daten = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.querySelector('.cl-video').src)).arrayBuffer())));
    const datei = join(ERGEBNISSE, name);
    writeFileSync(datei, Buffer.from(daten));
    const ff = spawnSync('ffmpeg', ['-v', 'error', '-i', datei, '-map', '0:a', '-f', 'f32le', '-ac', '1', '-ar', '8000', '-'], { maxBuffer: 1e9 });
    if (ff.error) return null;
    assert.equal(ff.status, 0, String(ff.stderr));
    return new Float32Array(ff.stdout.buffer, ff.stdout.byteOffset, ff.stdout.length >> 2);
  };
  const pegel = (k, a, b) => { let s2 = 0; for (let i = a * 8000; i < b * 8000; i++) s2 += k[i] * k[i]; return Math.sqrt(s2 / ((b - a) * 8000)); };
  const t1 = await holen('cl-originalton.mp4');
  if (t1) {
    assert.ok(pegel(t1, 0.3, 2.5) > 0.1, 'Ton aus Clip 1 hörbar');
    assert.ok(pegel(t1, 3.5, 5.5) < 0.02, 'Clip 2 hat keinen Ton');
    let z = 0;
    for (let i = 8001; i < 16000; i++) if (t1[i - 1] < 0 && t1[i] >= 0) z++;
    assert.ok(Math.abs(z - 440) < 10, `Frequenz ${z}`);
  }
  // Erweitert
  await page.locator('.cl-modus button[data-modus="erweitert"]').click();
  assert.ok(await page.locator('.cl-tempo').isVisible());
  assert.ok(await page.locator('#cl-ton').isVisible());
  assert.ok(await page.locator('#cl-ton').isDisabled(), 'Ohne Musik kein Mischverhältnis');
  await page.locator('.cl-tempo button[data-tempo="rampe"]').click();
  assert.equal(await page.locator('.cl-tempo button[aria-pressed="true"]').getAttribute('data-tempo'), 'rampe');
  // Musik dazu: Wellenform mit Schnitt
  await page.setInputFiles('#datei-musik', [wav(120, 20)]);
  await page.waitForSelector('.cl-welle:not([hidden])', { timeout: 20000 });
  assert.ok(await page.locator('#cl-ton').isEnabled());
  await page.screenshot({ path: `${ERGEBNISSE}/cl-erweitert.png`, fullPage: true });
  // Den ersten Schnitt nach rechts ziehen: Er rastet auf einem Schlag ein und wird gelb.
  await page.locator('#cl-welle').scrollIntoViewIfNeeded();
  const box = await page.locator('#cl-welle').boundingBox();
  const marke = await page.evaluate(async () => {
    // Lage des ersten Schnitts über den gleichen Plan wie die App
    const c = document.querySelector('#cl-welle');
    const k = c.getContext('2d').getImageData(0, 4, c.width, 1).data;
    for (let x = 6; x < c.width; x++) if (k[x * 4] > 240 && k[x * 4 + 1] > 240 && k[x * 4 + 2] > 240) return x / c.width;
    return null;
  });
  assert.ok(marke != null, 'Schnitt auf der Welle zu sehen');
  await page.mouse.move(box.x + box.width * marke + 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * (marke - 0.1), box.y + 8, { steps: 5 });
  await page.mouse.up();
  await page.waitForSelector('#cl-welle-auto:not([hidden])');
  const gelb = await page.evaluate(() => {
    const c = document.querySelector('#cl-welle');
    const k = c.getContext('2d').getImageData(0, 4, c.width, 1).data;
    for (let x = 0; x < c.width; x++) if (k[x * 4] > 240 && k[x * 4 + 1] > 190 && k[x * 4 + 1] < 230 && k[x * 4 + 2] < 40) return x / c.width;
    return null;
  });
  assert.ok(gelb != null && gelb < marke - 0.03, `Gezogener Schnitt bei ${gelb}, vorher ${marke}`);
  // Zurücksetzen
  await page.click('#cl-welle-auto');
  await page.waitForSelector('#cl-welle-auto', { state: 'hidden' });
  // Modus bleibt gemerkt
  await oeffne(page, s.url);
  await page.evaluate(async () => { (await import('./src/zustand.mjs')).zeige('clips'); });
  await warteAuf(page, () => document.body.dataset.ansicht === 'clips');
  await page.waitForFunction(() => document.querySelector('#v-clips').dataset.modus === 'erweitert');
  assert.deepEqual(fehler, []);
});
