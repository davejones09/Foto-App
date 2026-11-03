// Etappe 2: Erstlauf in Screenshots, Import eines 25-MP-Bilds, Feinjustieren, Strecken, Fehlerzustände.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, zustand, warteAuf, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const bild = (page, name) => page.screenshot({ path: `${ERGEBNISSE}/e2-${name}.png` });

test('Erstlauf: jeder Schritt als Screenshot', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await page.goto(s.url);
  await page.waitForSelector('#v-install:not([hidden])');
  await bild(page, '01-installation');
  await page.click('#trotzdem');
  // Einführung: drei Bildschirme, erst danach die Kamera
  await page.waitForSelector('#v-einfuehrung:not([hidden])');
  for (let i = 1; i <= 3; i++) {
    await warteAuf(page, (n) => document.querySelector('#v-einfuehrung').dataset.seite === String(n), i);
    await page.waitForTimeout(i === 2 ? 3300 : 3000);
    await bild(page, `01-einfuehrung-${i}`);
    await page.click('#einf-weiter');
  }
  await page.waitForSelector('.freigabe:not([hidden])');
  assert.equal(await page.evaluate(() => window.__gumAufrufe), 0, 'Kamera erst nach der Einführung');
  await bild(page, '02-freigabe');
  await page.click('#freigeben');
  await warteAuf(page, () => !document.querySelector('#ausloeser').disabled);
  await page.waitForTimeout(600);
  assert.equal(await page.textContent('#v-sucher .ansage'), 'Mach ein Foto. Egal wovon.');
  await bild(page, '03-leer');
  await ausloesen(page);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  await page.waitForTimeout(700);
  assert.equal(await page.textContent('#v-sucher .ansage'), 'Das ist das Ende deines letzten Fotos.');
  await bild(page, '04-rest');
  await warteAuf(page, () => document.querySelector('#v-sucher .ansage').textContent.startsWith('Such etwas'));
  await page.waitForTimeout(500);
  await bild(page, '05-such');
  await warteAuf(page, () => document.querySelector('#v-sucher .ansage').textContent.startsWith('Hier kommen Linien'));
  await page.waitForTimeout(500);
  await bild(page, '06-marken');
  // Ein anderes Motiv mit der Linie auf gleicher Höhe: so sieht ein gefundener Anschluss aus.
  await page.evaluate(() => Object.assign(window.__szene, { farbeOben: [205, 190, 165], farbeUnten: [90, 55, 35] }));
  await warteAuf(page, () => document.querySelector('#v-sucher .ansage').textContent.startsWith('Grün heißt'));
  await page.waitForTimeout(600);
  await bild(page, '07-signal');
  const wert = Number(await page.textContent('#v-sucher .wert'));
  assert.ok(wert >= 70, `gefundener Anschluss: ${wert}`);
  const t0 = Date.now();
  await page.click('#ausloeser');
  await page.waitForTimeout(1500);
  await bild(page, '08-aufdeckung-mitte');
  await page.waitForSelector('#v-aufdeckung .stempel:not([hidden])', { timeout: 20000 });
  const dauer = Date.now() - t0;
  // Ohne die Nähzeit bleibt die reine Animation. Das Test-Chromium kodiert JPEGs nach
  // Screenshots mal schneller, mal langsamer, deshalb zählt nur die Animation.
  const anim1 = dauer - (await zustand(page)).naehenMs;
  assert.ok(anim1 > 2200, `erste Aufdeckung langsam: ${anim1} ms Animation`);
  await page.waitForTimeout(900);
  await bild(page, '09-kein-schnitt');
  await page.waitForSelector('#v-aufdeckung .aktionen:not([hidden])', { timeout: 10000 });
  assert.equal(await page.textContent('#auf-weiter'), 'Weiterfahren');
  await bild(page, '10-deine-strecke');
  await page.click('#auf-weiter');
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  await page.waitForTimeout(500);
  await bild(page, '11-danach');
  // Nach dem Erstlauf: normale, schnelle Aufdeckung mit allen Knöpfen
  const t1 = Date.now();
  await page.click('#ausloeser');
  await page.waitForSelector('#v-aufdeckung .stempel:not([hidden])', { timeout: 20000 });
  const dauer2 = Date.now() - t1;
  const anim2 = dauer2 - (await zustand(page)).naehenMs;
  await page.waitForSelector('#v-aufdeckung .aktionen:not([hidden])', { timeout: 20000 });
  console.log(`Aufdeckung ohne Nähen: erste ${Math.round(anim1)} ms, normale ${Math.round(anim2)} ms`);
  assert.ok(anim2 < 2600, `normale Aufdeckung: ${anim2} ms Animation`);
  assert.ok(anim2 < anim1, 'die erste Aufdeckung ist langsamer');
  assert.equal(await page.textContent('#auf-weiter'), 'Weiter');
  assert.ok(await page.isVisible('#auf-fein'));
  await bild(page, '12-aufdeckung-normal');
  assert.deepEqual(fehler, []);
  await ctx.close();
});

async function grossesJpeg(page, w, h) {
  const b64 = await page.evaluate(async ([w, h]) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const k = c.getContext('2d');
    const g = k.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8ab'); g.addColorStop(0.55, '#cde'); g.addColorStop(0.551, '#353'); g.addColorStop(1, '#121');
    k.fillStyle = g; k.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { k.fillStyle = `hsl(${i * 37 % 360},40%,${30 + i % 40}%)`; k.fillRect((i * 997) % w, h * 0.6 + (i * 613) % (h * 0.38), 80, 30); }
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    c.width = 0; c.height = 0;
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768));
    return btoa(s);
  }, [w, h]);
  return Buffer.from(b64, 'base64');
}

test('Import eines 25-MP-Bilds stürzt nicht ab, Feinjustieren und Übernehmen', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await ausloesen(page);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  const jpeg = await grossesJpeg(page, 6144, 4096);
  await page.setInputFiles('#datei-bild', { name: 'gross.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  await page.waitForSelector('#v-fein:not([hidden])');
  await warteAuf(page, () => document.querySelector('#fein-rahmen .kamerastatus').hidden, null, 30000);
  await warteAuf(page, () => document.querySelector('#v-fein .wert').textContent !== '');
  await bild(page, '13-fein-start');
  const z = await zustand(page);
  assert.equal(z.letzter.quelle, 'import');
  assert.ok(Math.max(z.letzter.rohB, z.letzter.rohH) <= 4000, `Rohbild ${z.letzter.rohB}x${z.letzter.rohH}`);
  // Schieben mit der Maus und zoomen mit dem Rad
  const r = await page.locator('#fein-rahmen').boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 60, r.y + r.height / 2 - 40, { steps: 6 });
  await page.mouse.up();
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(500);
  await bild(page, '14-fein-verschoben');
  await page.click('#fein-ok');
  await page.waitForSelector('#v-aufdeckung .aktionen:not([hidden])', { timeout: 30000 });
  const z2 = await zustand(page);
  assert.equal(z2.fertig, 2);
  assert.ok(z2.letzter.transform.zoom > 1, 'Zoom übernommen');
  assert.ok(z2.letzter.transform.dx !== 0, 'Verschiebung übernommen');
  await bild(page, '15-import-aufdeckung');
  // Nochmal feinjustieren und abbrechen: nichts ändert sich
  await page.click('#auf-fein');
  await page.waitForSelector('#v-fein:not([hidden])');
  await warteAuf(page, () => document.querySelector('#fein-rahmen .kamerastatus').hidden, null, 30000);
  await page.click('#fein-abbrechen');
  await page.waitForSelector('#v-aufdeckung .aktionen:not([hidden])', { timeout: 10000 });
  assert.deepEqual((await zustand(page)).letzter.transform, z2.letzter.transform);
  // Streichen mit Rückfrage
  await page.click('#auf-streichen');
  await page.click('#dialog button.haupt');
  await warteAuf(page, () => window.nahtlos.zustand().halte === 1 && document.body.dataset.ansicht === 'sucher');
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Import als erster Halt und kaputte Datei', async () => {
  const { ctx, page } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.setInputFiles('#datei-bild', { name: 'kaputt.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('kein bild') });
  await page.waitForSelector('#meldung:not([hidden])');
  assert.equal(await page.textContent('#meldung p'), 'Dieses Foto lässt sich nicht öffnen. Versuch ein anderes.');
  await bild(page, '16-import-fehler');
  const jpeg = await grossesJpeg(page, 1200, 900);
  await page.setInputFiles('#datei-bild', { name: 'quer.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  await page.waitForSelector('#v-fein:not([hidden])');
  await warteAuf(page, () => document.querySelector('#fein-rahmen .kamerastatus').hidden, null, 30000);
  await page.click('#fein-ok');
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher' && window.nahtlos.zustand().fertig === 1, null, 30000);
  await ctx.close();
});

test('Mehrere Strecken: neue Strecke mit Namen, wechseln, löschen', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await ausloesen(page);
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher');
  await page.click('#zur-strecke');
  await page.click('#zu-strecken');
  await page.waitForSelector('#v-strecken:not([hidden]) .sl-eintrag');
  await page.click('#sl-neu');
  assert.match(await page.inputValue('.d-eingabe'), /^Strecke \S+ \d{4}$/);
  await bild(page, '17-neue-strecke');
  await page.fill('.d-eingabe', 'Testfahrt');
  await page.click('#dialog button.haupt');
  await warteAuf(page, () => window.nahtlos.zustand().strecke === 'Testfahrt' && document.body.dataset.ansicht === 'sucher');
  assert.equal((await zustand(page)).halte, 0);
  await page.click('#zur-strecke');
  await page.waitForSelector('#v-strecke .band-leer:not([hidden])');
  await bild(page, '18-strecke-leer');
  await page.click('#zu-strecken');
  await warteAuf(page, () => document.querySelectorAll('.sl-eintrag').length === 2);
  await page.waitForTimeout(300);
  await bild(page, '19-strecken');
  // Alte Strecke löschen
  await page.locator('.sl-eintrag:not(.aktiv) .sl-loeschen').click();
  assert.match(await page.textContent('.d-text'), /wirklich löschen\? 1 Halte sind dann weg\./);
  await page.click('#dialog button.haupt');
  await warteAuf(page, () => document.querySelectorAll('.sl-eintrag').length === 1);
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Kamera verweigert: Text und Ausweg über die Mediathek', async () => {
  const { ctx, page } = await neueSeite(b);
  await ctx.addInitScript(() => { window.__kameraVerweigert = true; });
  await page.goto(s.url);
  await page.click('#trotzdem');
  await page.click('#einf-ueberspringen');
  await page.click('#freigeben');
  await page.waitForSelector('.freigabe:not([hidden]) #frei-mediathek');
  assert.match(await page.textContent('.frei-text'), /Ohne Kamera bleibt der Zug stehen/);
  await bild(page, '20-verweigert');
  await ctx.close();
});

test('Querformat zeigt den Hinweis', async () => {
  const { ctx, page } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(200);
  assert.ok(await page.isVisible('#quer'));
  await bild(page, '21-quer');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(!(await page.isVisible('#quer')));
  // Diagnose: fünfmal auf die Version
  for (let i = 0; i < 5; i++) await page.click('#version');
  await page.waitForSelector('#diagnose:not([hidden])');
  assert.match(await page.textContent('.dg-text'), /Nahtlos \d+\.\d+\.\d+/);
  await bild(page, '22-diagnose');
  await ctx.close();
});
