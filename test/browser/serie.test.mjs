// Serie aus der Mediathek im Browser: Reihenfolge mit festem Start, Aufnahmezeit, Vorschau bearbeiten,
// Bauen, Abbruch ohne Verlust, höchstens 10 Fotos, Blindfahrt, Migration alter Strecken.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const HOEHEN = [0.55, 0.4, 0.62, 0.47, 0.34];
const FARBEN = [
  ['#c9b48e', '#5a3522'], ['#b4c8a0', '#3c5a28'], ['#f0c896', '#46465a'], ['#a0aac8', '#28322d'],
];

// Testfoto im Browser zeichnen: Linie links flach auf a, rechts flach auf b.
async function fotoJpeg(page, { w = 1600, h = 1200, a, b, oben, unten, seed = 1 }) {
  const b64 = await page.evaluate(async ({ w, h, a, b, oben, unten, seed }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const k = c.getContext('2d');
    k.fillStyle = oben;
    k.fillRect(0, 0, w, h);
    k.beginPath();
    k.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const u = x / w;
      const t = u < 0.3 ? 0 : u > 0.7 ? 1 : (u - 0.3) / 0.4;
      k.lineTo(x, (a + (b - a) * t * t * (3 - 2 * t)) * h);
    }
    k.lineTo(w, h);
    k.closePath();
    k.fillStyle = unten;
    k.fill();
    let r = seed;
    const z = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 120; i++) { k.fillStyle = `rgba(255,255,255,${0.04 + z() * 0.05})`; k.fillRect(z() * w, z() * h, 30 + z() * 60, 6); }
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    const u = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768));
    return btoa(s);
  }, { w, h, a, b, oben, unten, seed });
  return Buffer.from(b64, 'base64');
}

// EXIF mit DateTimeOriginal direkt hinter SOI einsetzen.
function mitExif(jpeg, datum) {
  const text = [...Buffer.from(datum), 0];
  const u16 = (v) => [v & 255, v >> 8];
  const u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24];
  const tiff = [0x49, 0x49, ...u16(42), ...u32(8),
    ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0),
    ...u16(1), ...u16(0x9003), ...u16(2), ...u32(text.length), ...u32(44), ...u32(0), ...text];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const l = app1.length + 2;
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1, l >> 8, l & 255, ...app1]), jpeg.subarray(2)]);
}

async function kette(page, n = 4) {
  const fotos = [];
  for (let k = 0; k < n; k++) fotos.push(await fotoJpeg(page, { a: HOEHEN[k], b: HOEHEN[k + 1], oben: FARBEN[k][0], unten: FARBEN[k][1], seed: k + 3 }));
  return fotos;
}

const reihe = (page) => page.$$eval('#v-serie .se-zeile', (l) => l.map((z) => z.dataset.name));
const wartend = (page) => page.evaluate(async () => (await import('./src/speicher.mjs')).zaehleSerienFotos());
const bereit = (page) => warteAuf(page, () => !document.querySelector('#se-bauen').disabled && document.querySelectorAll('#v-serie .se-zeile').length > 0, null, 60000);

async function start(page) {
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await ausloesen(page); // ein Halt mit Horizont auf 0,55 aus der Kamera: der feste Start
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher' && !document.querySelector('#ausloeser').disabled);
}

test('Serie: beste Reihenfolge ab dem letzten Halt, Aufnahmezeit, Ziehen, Entfernen, Ausschnitt, Bauen', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await start(page);
  const fotos = await kette(page, 4);
  const zeiten = ['2026:06:14 12:00:00', '2026:06:14 10:00:00', '2026:06:14 13:00:00', '2026:06:14 09:00:00'];
  const eingabe = [2, 0, 3, 1].map((k) => ({ name: `foto${k}.jpg`, mimeType: 'image/jpeg', buffer: mitExif(fotos[k], zeiten[k]) }));
  await page.setInputFiles('#datei-bild', eingabe);
  await page.waitForSelector('#v-serie:not([hidden])');
  await bereit(page);
  assert.equal(await wartend(page), 4, 'alle Rohbilder gesichert');
  assert.deepEqual(await reihe(page), ['foto0.jpg', 'foto1.jpg', 'foto2.jpg', 'foto3.jpg']);
  assert.equal(await page.textContent('#v-serie .se-status'), 'Schließt an Halt 1 an.');
  const werte = await page.$$eval('#v-serie .se-wert', (l) => l.map((x) => Number(x.textContent)));
  console.log(`Werte: ${werte}`);
  assert.ok(werte[0] >= 40, `Anschluss an den Kamera-Halt ${werte}`);
  for (const w of werte.slice(1)) assert.ok(w >= 70, `Anschlüsse in der Serie ${werte}`);
  assert.equal(await page.getAttribute('[data-modus="beste"]', 'aria-pressed'), 'true');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${ERGEBNISSE}/se-vorschau.png` });

  // Nach Aufnahmezeit: EXIF-Zeiten bestimmen die Reihenfolge
  await page.click('[data-modus="zeit"]');
  await warteAuf(page, () => document.querySelector('[data-modus="zeit"]').getAttribute('aria-pressed') === 'true' && !document.querySelector('#se-bauen').disabled);
  assert.deepEqual(await reihe(page), ['foto3.jpg', 'foto1.jpg', 'foto0.jpg', 'foto2.jpg']);
  assert.match(await page.textContent('#v-serie .se-info small'), /^14\.06\.2026 09:00$/);
  await page.click('[data-modus="beste"]');
  await warteAuf(page, (n) => document.querySelectorAll('#v-serie .se-zeile')[0].dataset.name === n, 'foto0.jpg');

  // Ziehen: das letzte Foto nach oben
  const griffe = page.locator('#v-serie .se-griff');
  const vonBox = await griffe.nth(3).boundingBox();
  const zuBox = await griffe.nth(0).boundingBox();
  await page.mouse.move(vonBox.x + 20, vonBox.y + vonBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(zuBox.x + 20, zuBox.y + 5, { steps: 8 });
  await page.mouse.up();
  await warteAuf(page, () => document.querySelectorAll('#v-serie .se-zeile')[0].dataset.name === 'foto3.jpg');
  assert.deepEqual(await reihe(page), ['foto3.jpg', 'foto0.jpg', 'foto1.jpg', 'foto2.jpg']);
  assert.equal(await page.getAttribute('[data-modus="beste"]', 'aria-pressed'), 'false');

  // Entfernen
  await page.locator('#v-serie .se-zeile[data-name="foto3.jpg"] .se-weg').click();
  await warteAuf(page, () => document.querySelectorAll('#v-serie .se-zeile').length === 3);
  assert.equal(await wartend(page), 3);

  // Ausschnitt per Antippen ändern
  await page.locator('#v-serie .se-zeile[data-name="foto1.jpg"] .se-bild').click();
  await page.waitForSelector('#se-wahl:not([hidden]) .se-alt');
  assert.ok(await page.locator('.se-alt').count() >= 3);
  await page.screenshot({ path: `${ERGEBNISSE}/se-ausschnitt.png` });
  await page.locator('.se-alt').nth(2).click();
  await bereit(page);

  // Bauen
  await page.click('#se-bauen');
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke', null, 120000);
  const z = await page.evaluate(() => window.nahtlos.zustand());
  assert.equal(z.halte, 4);
  assert.equal(z.fertig, 4);
  assert.equal(await wartend(page), 0);
  assert.equal(await page.getAttribute('#v-strecke .band', 'data-breite'), String(4 * 933 + 363));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ERGEBNISSE}/se-strecke.png` });
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Abbruch beim Bauen: nichts geht verloren, die Serie läuft mit derselben Reihenfolge weiter', async () => {
  const { ctx, page } = await neueSeite(b);
  await start(page);
  const fotos = await kette(page, 3);
  await page.setInputFiles('#datei-bild', [1, 2, 0].map((k) => ({ name: `foto${k}.jpg`, mimeType: 'image/jpeg', buffer: fotos[k] })));
  await page.waitForSelector('#v-serie:not([hidden])');
  await bereit(page);
  const plan = await reihe(page);
  // Das Nähen hängt: wie ein Absturz mitten im Bau
  await page.evaluate(async () => (await import('./src/rechner.mjs')).auftrag('test-haenger', { an: true }));
  await page.click('#se-bauen');
  await warteAuf(page, () => window.nahtlos.zustand().halte === 2);
  await page.waitForTimeout(300);
  assert.equal(await wartend(page), 2);
  await page.reload();
  await warteAuf(page, () => window.nahtlos?.zustand().ansicht === 'sucher' && window.nahtlos.zustand().fertig === 2, null, 30000);
  await page.waitForSelector('#meldung:not([hidden])');
  assert.equal(await page.textContent('#meldung p'), 'Eine Serie aus der Mediathek wartet noch.');
  await page.click('#meldung button');
  await page.waitForSelector('#v-serie:not([hidden])');
  await bereit(page);
  assert.deepEqual(await reihe(page), plan.slice(1), 'gleiche Reihenfolge wie vor dem Abbruch');
  await page.click('#se-bauen');
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke', null, 120000);
  assert.equal((await page.evaluate(() => window.nahtlos.zustand())).fertig, 4);
  assert.equal(await wartend(page), 0);
  await ctx.close();
});

test('Höchstens 10 Fotos, in der Blindfahrt nur ein einzelnes', async () => {
  const { ctx, page } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  const klein = await fotoJpeg(page, { w: 640, h: 480, a: 0.5, b: 0.5, oben: '#9ab', unten: '#345' });
  await page.setInputFiles('#datei-bild', Array.from({ length: 12 }, (_, i) => ({ name: `f${i}.jpg`, mimeType: 'image/jpeg', buffer: klein })));
  await page.waitForSelector('#v-serie:not([hidden])');
  await page.waitForSelector('#meldung:not([hidden])');
  assert.equal(await page.textContent('#meldung p'), 'Höchstens 10 Fotos. Die ersten 10 sind dabei.');
  await bereit(page);
  assert.equal(await page.locator('#v-serie .se-zeile').count(), 10);
  assert.equal(await wartend(page), 10);
  // Verwerfen löscht nur die wartenden Fotos
  await page.click('#se-verwerfen');
  await page.click('#dialog button.haupt');
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  assert.equal(await wartend(page), 0);

  // Blindfahrt: Auswahl erlaubt nur ein Foto, mehrere führen zum Einzelimport
  await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    await db.aendereStrecke(localStorage.getItem('nahtlos-aktiv'), { blind: true });
  });
  await page.reload();
  await warteAuf(page, () => window.nahtlos?.zustand().blind === true && document.body.dataset.ansicht === 'sucher');
  await page.evaluate(() => { HTMLInputElement.prototype.click = function () {}; });
  await page.click('#mediathek');
  assert.equal(await page.evaluate(() => document.querySelector('#datei-bild').multiple), false);
  // Auch wenn das System doch mehrere liefert, bleibt es beim ersten Foto.
  await page.evaluate(() => { document.querySelector('#datei-bild').multiple = true; });
  await page.setInputFiles('#datei-bild', [0, 1].map((i) => ({ name: `b${i}.jpg`, mimeType: 'image/jpeg', buffer: klein })));
  await page.waitForSelector('#v-fein:not([hidden])');
  assert.equal(await wartend(page), 0);
  await ctx.close();
});

test('Migration: Strecken aus Format 1 bleiben erhalten', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  // Alte Datenbank in Format 1 anlegen, bevor die App sie öffnet.
  await page.goto(`${s.url}manifest.webmanifest`);
  await page.evaluate(async () => {
    const db = await new Promise((ok, err) => {
      const r = indexedDB.open('nahtlos', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('strecken', { keyPath: 'id' });
        d.createObjectStore('halte', { keyPath: 'id' }).createIndex('strecke', 'streckeId');
        d.createObjectStore('einstellungen', { keyPath: 'schluessel' });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => err(r.error);
    });
    const c = document.createElement('canvas');
    c.width = 1296; c.height = 1620;
    const k = c.getContext('2d');
    k.fillStyle = '#8ab'; k.fillRect(0, 0, 1296, 900);
    k.fillStyle = '#234'; k.fillRect(0, 900, 1296, 720);
    const bild = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    const t = db.transaction(['strecken', 'halte', 'einstellungen'], 'readwrite');
    t.objectStore('strecken').put({ id: 'alt-1', name: 'Alte Strecke', erstellt: 1, blind: false, ziel: false, formatVersion: 1, gesichertBei: 0 });
    t.objectStore('halte').put({ id: 'h-1', streckeId: 'alt-1', index: 0, zeit: Date.now(), quelle: 'kamera', roh: bild, rohB: 1296, rohH: 1620, transform: { dx: 0, dy: 0, zoom: 1, drehung: 0 }, bild, naht: null, vorschau: bild, nahtVorschau: null, pfad: null, wert: null, teile: null, name: 'Erster' });
    t.objectStore('einstellungen').put({ schluessel: 'einfuehrung', wert: true });
    await new Promise((ok) => (t.oncomplete = ok));
    db.close();
  });
  await oeffne(page, s.url);
  const r = await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const l = await db.strecken();
    const h = await db.halte('alt-1');
    const d = await db.oeffne();
    return { version: d.version, stores: [...d.objectStoreNames], namen: l.map((x) => x.name), halte: h.length, name: h[0]?.name, wartend: await db.zaehleSerienFotos() };
  });
  assert.equal(r.version, 2);
  assert.ok(r.stores.includes('serie'));
  assert.deepEqual(r.namen, ['Alte Strecke']);
  assert.equal(r.halte, 1);
  assert.equal(r.name, 'Erster');
  assert.equal(r.wartend, 0);
  assert.equal((await page.evaluate(() => window.nahtlos.zustand())).strecke, 'Alte Strecke');
  assert.deepEqual(fehler, []);
  await ctx.close();
});
