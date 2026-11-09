// Speicherformat 3: keine Blobs in IndexedDB, Bilddaten als ArrayBuffer in "dateien".
// Die Hülle aus hilfe.mjs lässt jeden Test scheitern, der doch einen Blob schreiben will.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, fotoJpeg, ERGEBNISSE, hauptmenue, oeffneDiagnose, zumProjekt, bisHauptmenue, kameraBereit } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const HOEHEN = [0.55, 0.4, 0.62, 0.47];
const FARBEN = [['#c9b48e', '#5a3522'], ['#b4c8a0', '#3c5a28'], ['#f0c896', '#46465a']];

// Rohe Datensätze ohne die App-Hülle lesen: Liegt irgendwo ein Blob?
const rohDurchsicht = (page) => page.evaluate(async () => {
  const d = await (await import('./src/speicher.mjs')).oeffne();
  const alle = async (store) => new Promise((ok) => { const r = d.transaction(store).objectStore(store).getAll(); r.onsuccess = () => ok(r.result); });
  const findeBlob = (v, t = 0) => v instanceof Blob || (v && typeof v === 'object' && t < 6 && !(v instanceof ArrayBuffer) && Object.values(v).some((x) => findeBlob(x, t + 1)));
  const halte = await alle('halte');
  const serie = await alle('serie');
  const keys = await new Promise((ok) => { const r = d.transaction('dateien').objectStore('dateien').getAllKeys(); r.onsuccess = () => ok(r.result); });
  return { blobs: [...halte, ...serie].filter((x) => findeBlob(x)).length, halte: halte.length, dateien: keys.length };
});

test('Serie bauen, neu laden: alle Bilder lesbar, Strecke, Karussell, Gesamtbild, Sicherung und Einspielen', async () => {
  const { ctx, page } = await neueSeite(b);
  await ctx.addInitScript(() => {
    window.__geteilt = [];
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => { window.__geteilt.push(files); };
  });
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await ausloesen(page);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher' && !document.querySelector('#ausloeser').disabled);
  const dateien = [];
  for (let k = 0; k < 3; k++) dateien.push({ name: `f${k}.jpg`, mimeType: 'image/jpeg', buffer: await fotoJpeg(page, { a: HOEHEN[k], b: HOEHEN[k + 1], oben: FARBEN[k][0], unten: FARBEN[k][1], seed: k + 2 }) });
  await page.setInputFiles('#datei-bild', dateien);
  await page.waitForSelector('#v-serie:not([hidden])');
  await warteAuf(page, () => !document.querySelector('#se-bauen').disabled, null, 60000);
  await page.click('#se-bauen');
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke', null, 120000);

  // Neu laden: Alles muss aus der Datenbank kommen
  await page.reload();
  await hauptmenue(page);
  const roh = await rohDurchsicht(page);
  assert.equal(roh.blobs, 0, 'kein Blob in halte oder serie');
  assert.equal(roh.halte, 4);
  const lese = await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const id = localStorage.getItem('nahtlos-aktiv');
    const t = await db.lesetest(id);
    // Jedes Bild auch wirklich dekodieren
    let dekodiert = 0;
    for (const h of await db.halte(id)) {
      for (const f of db.BILDFELDER) {
        if (!h[f]) continue;
        const bm = await createImageBitmap(await db.blobPflicht(h, f));
        if (bm.width > 0) dekodiert++;
        bm.close();
      }
    }
    return { t, dekodiert, statistik: await db.dateienStatistik() };
  });
  assert.equal(lese.t.length, 4);
  for (const x of lese.t) assert.deepEqual(x.fehlt, [], `Halt ${x.index + 1} vollständig`);
  assert.equal(lese.dekodiert, lese.statistik.anzahl, 'jede Datei ist ein lesbares Bild');
  assert.ok(lese.statistik.bytes > 100000);

  // Diagnose zeigt Dateien, beschädigte Halte und den Lesetest
  await oeffneDiagnose(page);
  await warteAuf(page, () => /Lesetest:/.test(document.querySelector('.dg-text').textContent));
  const bericht = await page.textContent('.dg-text');
  assert.match(bericht, /Dateien: \d+ Einträge, [\d.]+ MB/);
  assert.match(bericht, /Beschädigte Fotos: 0/);
  assert.match(bericht, /Lesetest: 4 von 4 Fotos vollständig lesbar/);
  await page.click('#dg-schliessen');

  // Das Projekt zeichnet aus der Datenbank
  await zumProjekt(page);
  const BAND = 1296 + 3 * 2160 - 3 * 363; // Kamerahalt plus drei ganze 4:3-Fotos
  await warteAuf(page, (b) => document.querySelector('#v-strecke .band').dataset.breite === String(b), BAND);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${ERGEBNISSE}/f3-strecke.png` });

  // Ausgaben
  await page.click('#zur-ausfahrt');
  await page.waitForSelector('#v-ausfahrt:not([hidden]) .af-punkt');
  const bauen = async (i) => {
    const vorher = await page.evaluate(() => window.__geteilt.length);
    const p = page.locator('.af-punkt').nth(i);
    await p.locator('.af-titel').click();
    await p.locator('.af-reihe button.haupt').first().waitFor({ timeout: 120000 });
    await p.locator('.af-reihe button.haupt').first().click();
    await warteAuf(page, (n) => window.__geteilt.length > n, vorher);
  };
  await bauen(0);
  await bauen(2);
  await bauen(4);
  const aus = await page.evaluate(async () => {
    const [karussell, [gesamt], [zip]] = window.__geteilt.slice(-3);
    const masse = async (f) => { const bm = await createImageBitmap(f); const m = `${bm.width}x${bm.height}`; bm.close(); return m; };
    return { karussell: await Promise.all(karussell.map(masse)), gesamt: await masse(gesamt), zipName: zip.name, zipGroesse: zip.size, zip: await (async () => { const u = new Uint8Array(await zip.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); })() };
  });
  assert.equal(aus.karussell.length, 5, `genau aufgehende Slides: ${aus.karussell.length}`); // 6687 Pixel: 6 Slides bräuchten 16 % Zoom
  for (const m of aus.karussell) assert.equal(m, '1080x1350');
  assert.match(aus.gesamt, /^\d+x\d+$/);
  const [gb, gh] = aus.gesamt.split('x').map(Number);
  assert.ok(Math.abs(gb / gh - BAND / 1620) < 0.01, `Gesamtbild ${aus.gesamt}`);
  assert.ok(aus.zipGroesse > 100000, 'Sicherung enthält die Bilder');

  // Einspielen und wieder alles lesen
  await page.setInputFiles('#datei-sicherung', { name: aus.zipName, mimeType: 'application/zip', buffer: Buffer.from(aus.zip, 'base64') });
  await warteAuf(page, (b) => document.body.dataset.ansicht === 'strecke' && document.querySelector('#v-strecke .band').dataset.breite === String(b), BAND, 60000);
  const neu = await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const t = await db.lesetest(localStorage.getItem('nahtlos-aktiv'));
    return { n: t.length, voll: t.every((x) => !x.fehlt.length), strecken: (await db.strecken()).length };
  });
  assert.deepEqual(neu, { n: 4, voll: true, strecken: 2 });
  assert.equal((await rohDurchsicht(page)).blobs, 0);
  await ctx.close();
});

test('Prüfung nach dem Schreiben: Ist das Rohbild nicht lesbar, gilt das Foto nicht als gesichert', async () => {
  const { ctx, page } = await neueSeite(b);
  // Das Zurücklesen des nächsten Rohbilds liefert zu wenige Bytes
  await ctx.addInitScript(() => {
    window.__pruefFehler = 0;
    const desc = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'result');
    Object.defineProperty(IDBRequest.prototype, 'result', {
      configurable: true,
      get() {
        const r = desc.get.call(this);
        if (window.__pruefFehler > 0 && r && typeof r.schluessel === 'string' && r.schluessel.endsWith('/roh') && r.daten) {
          window.__pruefFehler--;
          return { ...r, daten: new ArrayBuffer(3) };
        }
        return r;
      },
    });
  });
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await page.evaluate(() => { window.__pruefFehler = 1; });
  await page.click('#ausloeser');
  await warteAuf(page, () => !document.querySelector('#meldung').hidden && document.querySelector('#meldung p').textContent === 'Das Foto ließ sich nicht sichern. Bitte nochmal.');
  const st = await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    return { halte: (await db.halte(localStorage.getItem('nahtlos-aktiv'))).length, dateien: (await db.dateienStatistik()).anzahl };
  });
  assert.deepEqual(st, { halte: 0, dateien: 0 }, 'kein halber Halt, keine verwaisten Daten');
  // Der nächste Versuch klappt
  await warteAuf(page, () => !document.querySelector('#ausloeser').disabled);
  await ausloesen(page);
  assert.equal((await page.evaluate(() => window.nahtlos.zustand())).fertig, 1);
  await ctx.close();
});

test('Migration aus Format 2: Blobs ziehen um, unlesbare markieren den Halt, Rettbares wird nachgerechnet', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  // Künstlich unlesbare Blobs: Typ image/x-kaputt scheitert beim Lesen wie auf dem iPhone
  await ctx.addInitScript(() => {
    const ab = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      if (this.type === 'image/x-kaputt') return Promise.reject(new DOMException('An error occured reading the Blob argument', 'NotReadableError'));
      return ab.call(this);
    };
  });
  await page.goto(`${s.url}manifest.webmanifest`);
  await page.evaluate(async () => {
    const jpeg = async (w, h, farbe, typ = 'image/jpeg') => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const k = c.getContext('2d');
      k.fillStyle = farbe; k.fillRect(0, 0, w, h * 0.55);
      k.fillStyle = '#223'; k.fillRect(0, h * 0.55, w, h * 0.45);
      const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
      return typ === 'image/jpeg' ? b : new Blob([b], { type: typ });
    };
    const db = await new Promise((ok, err) => {
      const r = indexedDB.open('nahtlos', 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('strecken', { keyPath: 'id' });
        d.createObjectStore('halte', { keyPath: 'id' }).createIndex('strecke', 'streckeId');
        d.createObjectStore('einstellungen', { keyPath: 'schluessel' });
        d.createObjectStore('serie', { keyPath: 'id' }).createIndex('strecke', 'streckeId');
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => err(r.error);
    });
    const roh = [await jpeg(2000, 1500, '#9bc'), await jpeg(2000, 1500, '#cb9')];
    const bild = [await jpeg(1296, 1620, '#9bc'), await jpeg(1296, 1620, '#cb9')];
    const naht = await jpeg(363, 1620, '#abc');
    const vorschau = await jpeg(192, 240, '#9bc');
    const kaputt = await jpeg(64, 64, '#f00', 'image/x-kaputt');
    const t = db.transaction(['strecken', 'halte', 'einstellungen', 'serie'], 'readwrite');
    const put = (store, wert) => IDBObjectStore.prototype.__putOriginal.call(t.objectStore(store), wert);
    const basis = { streckeId: 'alt', quelle: 'kamera', rohB: 2000, rohH: 1500, transform: { dx: 0, dy: 0, zoom: 1, drehung: 0 }, pfad: null, wert: 80, teile: null, name: '' };
    put('strecken', { id: 'alt', name: 'Alte Strecke', erstellt: 1, blind: false, ziel: false, formatVersion: 2, gesichertBei: 0 });
    // 0: alles lesbar
    put('halte', { ...basis, id: 'h0', index: 0, zeit: 1000, roh: roh[0], bild: bild[0], naht: null, vorschau, nahtVorschau: null, wert: null });
    // 1: Rohbild und Vorschau unlesbar, Bild und Naht da: bleibt nutzbar, Vorschau wird aus dem Bild nachgerechnet
    put('halte', { ...basis, id: 'h1', index: 1, zeit: 2000, roh: kaputt, bild: bild[1], naht, vorschau: kaputt, nahtVorschau: vorschau });
    // 2: Bild und Naht unlesbar, Rohbild da: wird komplett neu genäht
    put('halte', { ...basis, id: 'h2', index: 2, zeit: 3000, roh: roh[1], bild: kaputt, naht: kaputt, vorschau, nahtVorschau: vorschau });
    // 3: Rohbild und Bild unlesbar: nicht zu retten, nur zu löschen
    put('halte', { ...basis, id: 'h3', index: 3, zeit: 4000, roh: kaputt, bild: kaputt, naht: kaputt, vorschau: kaputt, nahtVorschau: kaputt });
    put('serie', { id: 's0', streckeId: 'alt', serieId: 'x', reihe: 0, roh: roh[0], rohB: 2000, rohH: 1500, zeit: 1, aufnahme: null, name: 'warte.jpg', plan: null });
    put('einstellungen', { schluessel: 'einfuehrung', wert: true });
    put('einstellungen', { schluessel: 'erstlauf', wert: true });
    await new Promise((ok) => (t.oncomplete = ok));
    db.close();
  });
  await page.goto(s.url);
  await bisHauptmenue(page);
  // Hinweis auf beschädigte Halte
  await warteAuf(page, () => !document.querySelector('#meldung').hidden && /Fotos sind beschädigt/.test(document.querySelector('#meldung p').textContent), null, 60000);
  assert.equal(await page.textContent('#meldung p'), '2 Fotos sind beschädigt. Unter „Fotos“ kannst du sie löschen, der Rest bleibt.');
  assert.equal((await rohDurchsicht(page)).blobs, 0, 'alle Blobs umgezogen');
  const nach = await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const h = await db.halte('alt');
    const t = await db.lesetest('alt');
    const serie = await db.serienFotos('alt');
    return {
      n: h.length,
      felder: h.map((x) => ['roh', 'bild', 'naht', 'vorschau'].map((f) => (x[f] ? 1 : 0)).join('')),
      beschaedigt: h.map((x) => (x.beschaedigt ? x.beschaedigt.felder.join('+') : '')),
      fehlt: t.map((x) => x.fehlt.length),
      serieLesbar: !!(await db.blob(serie[0], 'roh')),
    };
  });
  assert.equal(nach.n, 4);
  assert.deepEqual(nach.felder, ['1101', '0111', '1111', '0000'], 'Vorschau von Halt 2 und Bild von Halt 3 nachgerechnet');
  assert.deepEqual(nach.beschaedigt, ['', 'roh+vorschau', '', 'roh+bild+naht+vorschau+nahtVorschau']);
  assert.deepEqual(nach.fehlt, [0, 0, 0, 0], 'alles, was da ist, ist lesbar');
  assert.ok(nach.serieLesbar, 'wartendes Serienfoto umgezogen');
  // Fahrplan zeigt beide beschädigten Halte zum Löschen
  await page.click('#meldung button.haupt');
  await page.waitForSelector('#v-fahrplan:not([hidden]) .fp-zeile.kaputt');
  assert.equal(await page.locator('.fp-zeile.kaputt').count(), 2);
  await page.screenshot({ path: `${ERGEBNISSE}/f3-beschaedigt.png` });
  // Den unrettbaren letzten und den mittleren löschen
  for (const index of ['3', '1']) {
    await page.locator(`.fp-zeile.kaputt[data-index="${index}"] .fp-loeschen`).click();
    await page.click('#dialog button.haupt');
    await warteAuf(page, (i) => !document.querySelector(`.fp-zeile.kaputt[data-index="${i}"]`) || document.querySelectorAll('.fp-zeile:not(.kopfz)').length < 4, index, 30000);
  }
  await warteAuf(page, () => document.querySelectorAll('.fp-zeile:not(.kopfz)').length === 2 && !document.querySelector('.fp-zeile.kaputt'), null, 30000);
  const rest = await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const h = await db.halte('alt');
    const t = await db.lesetest('alt');
    return { indizes: h.map((x) => x.index), ids: h.map((x) => x.id), naht: !!h[1]?.naht, voll: t.every((x) => !x.fehlt.length), dateien: (await db.dateienStatistik()).anzahl };
  });
  assert.deepEqual(rest.indizes, [0, 1]);
  assert.deepEqual(rest.ids, ['h0', 'h2']);
  assert.ok(rest.naht, 'Halt 2 an Halt 1 neu genäht');
  assert.ok(rest.voll);
  // Strecke ist nutzbar: Band und eine neue Aufnahme
  await page.click('#fp-zurueck');
  await warteAuf(page, () => document.querySelector('#v-strecke .band').dataset.breite === String(2 * 933 + 363));
  await page.click('#zum-sucher');
  await kameraBereit(page);
  await ausloesen(page);
  await page.waitForSelector('#v-aufdeckung .aktionen:not([hidden])', { timeout: 30000 });
  assert.equal((await page.evaluate(() => window.nahtlos.zustand())).fertig, 3);
  assert.deepEqual(fehler.filter((f) => !/Blob argument|x-kaputt|NotReadable/.test(f)), []);
  await ctx.close();
});
