// Fehler beim Bauen einer Serie: einmalig, zweimalig, dauerhaft, hängender Worker, 13 Fotos.
// Immer gilt: Kein Foto geht verloren, keines bleibt halbfertig, ohne Neustart.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, fotoJpeg, ERGEBNISSE, oeffneDiagnose } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const FEHLERTEXT = 'Das Zusammensetzen hat nicht geklappt. Tippe nochmal auf Zusammensetzen.';
const HOEHEN = [0.55, 0.4, 0.62, 0.47, 0.34];
const FARBEN = [['#c9b48e', '#5a3522'], ['#b4c8a0', '#3c5a28'], ['#f0c896', '#46465a'], ['#a0aac8', '#28322d']];

// createImageBitmap gezielt scheitern lassen: window.__bmFehler = Anzahl der nächsten Fehlschläge.
const BITMAP_FEHLER = `
  window.__bmFehler = 0;
  const original = window.createImageBitmap.bind(window);
  window.createImageBitmap = (...a) => {
    if (window.__bmFehler > 0) {
      window.__bmFehler--;
      return Promise.reject(new DOMException('Testfehler: Bild nicht lesbar', 'InvalidStateError'));
    }
    return original(...a);
  };
`;

async function seite() {
  const r = await neueSeite(b);
  await r.ctx.addInitScript(BITMAP_FEHLER);
  return r;
}

const stand = (page) => page.evaluate(async () => {
  const db = await import('./src/speicher.mjs');
  const halte = await db.halte(localStorage.getItem('nahtlos-aktiv'));
  return { halte: halte.length, fertig: halte.filter((h) => h.bild).length, wartend: await db.zaehleSerienFotos() };
});

async function mitSerie(page, n = 3, groesse = {}) {
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await ausloesen(page);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher' && !document.querySelector('#ausloeser').disabled);
  const dateien = [];
  for (let k = 0; k < n; k++) {
    const j = k % 4;
    dateien.push({ name: `foto${k}.jpg`, mimeType: 'image/jpeg', buffer: await fotoJpeg(page, { a: HOEHEN[j], b: HOEHEN[j + 1], oben: FARBEN[j][0], unten: FARBEN[j][1], seed: k + 3, ...groesse }) });
  }
  await page.setInputFiles('#datei-bild', dateien);
  await page.waitForSelector('#v-serie:not([hidden])');
  await bereit(page);
}

const bereit = (page) => warteAuf(page, () => !document.querySelector('#se-bauen').disabled, null, 60000);
const fertigOderFehler = (page) => warteAuf(page, (t) => document.body.dataset.ansicht === 'strecke'
  || (!document.querySelector('#se-bauen').disabled && document.querySelector('#v-serie .se-status').textContent === t), FEHLERTEXT, 120000);

test('Einmaliger Fehler beim Dekodieren: automatisch wiederholt, Bauen läuft ohne Neustart durch', async () => {
  const { ctx, page, fehler } = await seite();
  await mitSerie(page, 3);
  await page.evaluate(() => { window.__bmFehler = 1; });
  await page.click('#se-bauen');
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke', null, 120000);
  assert.deepEqual(await stand(page), { halte: 4, fertig: 4, wartend: 0 });
  const log = await page.evaluate(() => localStorage.getItem('nahtlos-fehler'));
  assert.match(log, /Versuch 1 von 2.*Testfehler: Bild nicht lesbar/, 'echter Fehlertext in der Diagnose');
  assert.deepEqual(fehler.filter((f) => !/Testfehler/.test(f)), []);
  await ctx.close();
});

test('Zweimaliger Fehler: Meldung, nur ein Foto angefasst, nochmal Bauen repariert und baut den Rest', async () => {
  const { ctx, page } = await seite();
  await mitSerie(page, 3);
  await page.evaluate(() => { window.__bmFehler = 2; });
  await page.click('#se-bauen');
  await fertigOderFehler(page);
  assert.equal(await page.textContent('#v-serie .se-status'), FEHLERTEXT);
  assert.equal(await page.textContent('#meldung p'), FEHLERTEXT);
  assert.deepEqual(await stand(page), { halte: 2, fertig: 1, wartend: 2 }, 'ein Halt halbfertig, zwei Fotos warten unberührt');
  await page.screenshot({ path: `${ERGEBNISSE}/sf-fehler.png` });
  // Nochmal auf Bauen: erst der halbfertige Halt, dann der Rest, ohne Neustart
  await page.click('#se-bauen');
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke', null, 120000);
  assert.deepEqual(await stand(page), { halte: 4, fertig: 4, wartend: 0 });
  await ctx.close();
});

test('Dauerhafter Fehler: kein weiteres Foto wird angefasst, nach dem Ende des Fehlers läuft alles durch', async () => {
  const { ctx, page } = await seite();
  await mitSerie(page, 3);
  await page.evaluate(() => { window.__bmFehler = Infinity; });
  await page.click('#se-bauen');
  await fertigOderFehler(page);
  assert.deepEqual(await stand(page), { halte: 2, fertig: 1, wartend: 2 });
  for (let i = 0; i < 2; i++) {
    await page.click('#se-bauen');
    await page.waitForTimeout(300);
    await fertigOderFehler(page);
    assert.deepEqual(await stand(page), { halte: 2, fertig: 1, wartend: 2 }, `Druck ${i + 2}: nichts weiter angefasst`);
  }
  const serienLog = await page.evaluate(() => localStorage.getItem('nahtlos-serie-log'));
  assert.match(serienLog, /Nachholen gescheitert, kein weiteres Foto angefasst: Testfehler/);
  // Zurück zum Sucher: Die wartende Serie meldet sich, der Diagnosebericht nennt den echten Fehler.
  await page.click('#se-zurueck');
  await warteAuf(page, () => document.querySelector('#meldung p').textContent === 'Eine Auswahl aus der Mediathek wartet noch.' && !document.querySelector('#meldung').hidden);
  await page.click('#meldung button.neben2'); // Später
  await oeffneDiagnose(page);
  await warteAuf(page, () => /Lesetest/.test(document.querySelector('.dg-text').textContent));
  const bericht = await page.textContent('.dg-text');
  assert.match(bericht, /Testfehler: Bild nicht lesbar/);
  assert.match(bericht, /Serie \(\d+\):/);
  await page.click('#dg-schliessen');
  // Fehler vorbei: weiterbauen. Die Erinnerung kommt beim nächsten Wechsel aus der Serie oder beim Start.
  await page.evaluate(() => { window.__bmFehler = 0; });
  await page.reload();
  await warteAuf(page, () => window.nahtlos?.zustand().ansicht === 'start' && !document.querySelector('#meldung').hidden, null, 30000);
  assert.equal(await page.textContent('#meldung p'), 'Eine Auswahl aus der Mediathek wartet noch.');
  await page.click('#meldung button.haupt');
  await page.waitForSelector('#v-serie:not([hidden])');
  await bereit(page);
  await page.click('#se-bauen');
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke', null, 120000);
  assert.deepEqual(await stand(page), { halte: 4, fertig: 4, wartend: 0 });
  await ctx.close();
});

test('Hängender Worker: Zeitgrenze, Neustart, Serienplan wird neu aufgebaut, Nähen klappt im zweiten Versuch', async () => {
  const { ctx, page } = await seite();
  await mitSerie(page, 3);
  await page.evaluate(() => localStorage.setItem('nahtlos-test-zeitgrenze', '3000'));
  // Der Plan hängt: nach 3 s Neustart, Plan neu aufgebaut, Ergebnis kommt trotzdem
  await page.evaluate(async () => (await import('./src/rechner.mjs')).auftrag('test-haenger', { an: true, typen: ['serie-plane'] }));
  await page.click('[data-modus="zeit"]');
  await warteAuf(page, () => document.querySelector('[data-modus="zeit"]').getAttribute('aria-pressed') === 'true' && !document.querySelector('#se-bauen').disabled, null, 30000);
  assert.equal(await page.locator('#v-serie .se-zeile').count(), 3, 'alle Fotos im neu aufgebauten Plan');
  assert.match(await page.evaluate(() => localStorage.getItem('nahtlos-fehler')), /Worker antwortet nicht: serie-plane nach 3000 ms/);
  // Das Nähen hängt: erster Versuch läuft in die Zeitgrenze, der zweite im frischen Worker klappt
  await page.evaluate(async () => (await import('./src/rechner.mjs')).auftrag('test-haenger', { an: true, typen: ['anschliessen'] }));
  await page.click('#se-bauen');
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke', null, 120000);
  assert.deepEqual(await stand(page), { halte: 4, fertig: 4, wartend: 0 });
  await page.evaluate(() => localStorage.removeItem('nahtlos-test-zeitgrenze'));
  await ctx.close();
});

test('13 Fotos: zwei Auswahlen, Pausen zwischen den Fotos, Dauer je Foto in der Diagnose', async () => {
  const { ctx, page } = await seite();
  await mitSerie(page, 7, { w: 800, h: 600 });
  await page.click('#se-zurueck');
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke');
  const weitere = [];
  for (let k = 7; k < 13; k++) {
    const j = k % 4;
    weitere.push({ name: `foto${k}.jpg`, mimeType: 'image/jpeg', buffer: await fotoJpeg(page, { w: 800, h: 600, a: HOEHEN[j], b: HOEHEN[j + 1], oben: FARBEN[j][0], unten: FARBEN[j][1], seed: k + 3 }) });
  }
  await page.setInputFiles('#datei-bild', weitere);
  await page.waitForSelector('#v-serie:not([hidden])');
  await warteAuf(page, () => document.querySelectorAll('#v-serie .se-zeile').length === 13 && !document.querySelector('#se-bauen').disabled, null, 90000);
  await page.click('#se-bauen');
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke', null, 300000);
  assert.deepEqual(await stand(page), { halte: 14, fertig: 14, wartend: 0 });
  const log = JSON.parse(await page.evaluate(() => localStorage.getItem('nahtlos-serie-log')));
  const fotos = log.filter((e) => /^Foto \d+\/13: \d+ ms$/.test(e.text));
  assert.equal(fotos.length, 13, 'Dauer je Foto protokolliert');
  const zeiten = fotos.map((e) => new Date(e.zeit).getTime());
  for (let i = 1; i < zeiten.length; i++) assert.ok(zeiten[i] - zeiten[i - 1] >= 450, 'Pause zwischen den Fotos');
  assert.equal(log.filter((e) => /^Einlesen \d+\/\d+: \d+x\d+, \d+ ms$/.test(e.text)).length, 13);
  await ctx.close();
});
