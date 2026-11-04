// Collage im Browser: Fotos aus Mediathek und Kamera, Felder wählen, verschieben, zoomen, tauschen,
// Vorlage, Format und Stil, Ausgabe 2160 breit ohne Farbänderung, Neuladen, Sicherung und Migration.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, bisHauptmenue, hauptmenue, warteAuf, fotoJpeg, ERGEBNISSE } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

const FARBEN = [['#c9b48e', '#5a3522'], ['#9ab8d8', '#24425e'], ['#b4c8a0', '#3c5a28'], ['#e0a0a0', '#603040']];

async function seite() {
  const r = await neueSeite(b);
  await r.ctx.addInitScript(() => {
    window.__geteilt = [];
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => { window.__geteilt.push(files); };
  });
  return r;
}

async function fotos(page, n) {
  const l = [];
  for (let k = 0; k < n; k++) l.push({ name: `c${k}.jpg`, mimeType: 'image/jpeg', buffer: await fotoJpeg(page, { a: 0.4 + k * 0.05, b: 0.5, oben: FARBEN[k % 4][0], unten: FARBEN[k % 4][1], seed: k + 11 }) });
  return l;
}

const bereit = (page) => warteAuf(page, () => document.body.dataset.ansicht === 'collage' && document.querySelector('.co-bild').dataset.bereit === '1', null, 60000);
const stand = (page) => page.evaluate(async () => {
  const db = await import('./src/speicher.mjs');
  const l = await db.collagen();
  return l.map((c) => ({ id: c.id, name: c.name, format: c.format, vorlage: c.vorlage, stil: c.stil, felder: c.felder, n: c.fotos.length, vorschau: !!c.vorschau }));
});

// Mitte eines Felds in Bildschirmpunkten
async function feldMitte(page, i) {
  return page.evaluate(async (k) => {
    const werk = await import('./src/collagewerk.mjs');
    const { aktuelleCollage } = await import('./src/ansichten/collage.mjs');
    const cv = document.querySelector('.co-bild');
    const g = werk.geometrie(aktuelleCollage(), cv.width);
    const r = g.r[k];
    const box = cv.getBoundingClientRect();
    return { x: box.left + ((r.x + r.w / 2) / cv.width) * box.width, y: box.top + ((r.y + r.h / 2) / cv.height) * box.height };
  }, i);
}

// Vergleicht die Ausgabe Feld für Feld mit dem Original (Rohbild, gleicher Ausschnitt). Im Stil „Nahtlos“
// nur das Innere, ohne die Streifen an den Nähten: Außerhalb des Übergangs darf sich keine Farbe ändern.
async function vergleich(page, idx) {
  return page.evaluate(async (i) => {
    const db = await import('./src/speicher.mjs');
    const werk = await import('./src/collagewerk.mjs');
    const [datei] = window.__geteilt.at(i);
    const c = werk.vervollstaendige((await db.collagen())[0]);
    const bm = await createImageBitmap(datei);
    const W = bm.width;
    const aus = new OffscreenCanvas(W, bm.height);
    aus.getContext('2d').drawImage(bm, 0, 0);
    const g = werk.geometrie(c, W);
    const abw = [];
    for (let k = 0; k < c.felder.length; k++) {
      const a = werk.feldAusschnitt(c, g, k);
      const roh = await createImageBitmap(await db.blobPflicht(a.foto, 'roh'));
      const e = g.e[k];
      const r = g.r[k];
      const ref = new OffscreenCanvas(Math.round(e.w), Math.round(e.h));
      const rk = ref.getContext('2d');
      rk.imageSmoothingQuality = 'high';
      rk.drawImage(roh, a.sx, a.sy, a.sw, a.sh, 0, 0, ref.width, ref.height);
      // Inneres: an jeder Naht die halbe Breite weg, dazu 4 Pixel Luft
      let x0 = r.x; let y0 = r.y; let x1 = r.x + r.w; let y1 = r.y + r.h;
      for (const n of g.n) {
        const h = n.breite / 2 + 4;
        if (n.art === 'v' && n.a.includes(k) && Math.abs(r.x + r.w - n.pos) <= 1) x1 = Math.min(x1, n.pos - h);
        if (n.art === 'v' && n.b.includes(k) && Math.abs(r.x - n.pos) <= 1) x0 = Math.max(x0, n.pos + h);
        if (n.art === 'h' && n.a.includes(k) && Math.abs(r.y + r.h - n.pos) <= 1) y1 = Math.min(y1, n.pos - h);
        if (n.art === 'h' && n.b.includes(k) && Math.abs(r.y - n.pos) <= 1) y0 = Math.max(y0, n.pos + h);
      }
      x0 += 4; y0 += 4; x1 -= 4; y1 -= 4;
      const w = Math.round(x1 - x0);
      const h = Math.round(y1 - y0);
      const p = aus.getContext('2d').getImageData(Math.round(x0), Math.round(y0), w, h).data;
      const q = rk.getImageData(Math.round(x0 - e.x), Math.round(y0 - e.y), w, h).data;
      let sum = 0;
      for (let j = 0; j < p.length; j += 4 * 5) sum += Math.abs(p[j] - q[j]) + Math.abs(p[j + 1] - q[j + 1]) + Math.abs(p[j + 2] - q[j + 2]);
      abw.push(sum / (p.length / 20) / 3);
      roh.close();
    }
    const t = new TextDecoder('latin1').decode(new Uint8Array(await datei.arrayBuffer()));
    const m = await import('./src/metadaten.mjs');
    return { name: datei.name, w: bm.width, h: bm.height, abw, app: /nahtlos|claude|chrome/i.test(t), abschnitte: m.jpegAbschnitte(new Uint8Array(await datei.arrayBuffer())).map((x) => x.kennung || x.marker.toString(16)), naehte: g.n.length };
  }, idx);
}

async function exportieren(page, was) {
  const vorher = await page.evaluate(() => window.__geteilt.length);
  await page.click('#co-export');
  await page.waitForSelector('#dialog:not([hidden])');
  await page.click(`#dialog button:has-text("${was}")`);
  await page.waitForSelector('#meldung:not([hidden]) button:has-text("Teilen")', { timeout: 90000 });
  await page.click('#meldung button:has-text("Teilen")');
  await warteAuf(page, (n) => window.__geteilt.length > n, vorher);
}

test('Collage: vier Fotos aus der Mediathek, wählen, verschieben, zoomen, tauschen, Vorlage, Format, Export ohne Farbänderung', async () => {
  const { ctx, page, fehler } = await seite();
  await page.goto(s.url);
  await bisHauptmenue(page);
  const dateien = await fotos(page, 4);
  await page.click('#v-start .neu-karte[data-art="collage"]');
  await page.waitForSelector('#dialog:not([hidden])');
  assert.equal(await page.textContent('#dialog .d-text'), 'Neue Collage');
  assert.match(await page.inputValue('.d-eingabe'), /^Collage \S+ \d{4}$/);
  const wahl = page.waitForEvent('filechooser');
  await page.click('#dialog button:has-text("Mediathek")');
  await (await wahl).setFiles(dateien);
  await bereit(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ERGEBNISSE}/co-start.png` });
  let st = (await stand(page))[0];
  assert.equal(st.n, 4);
  assert.equal(st.vorlage, 'z4-raster');
  assert.equal(st.format, '4:5');
  assert.equal(await page.locator('.co-vorlage').count(), 8, 'Vorlagen passend zur Fotoanzahl');
  assert.match(await page.textContent('.co-hinweis'), /^Antippen wählt ein Feld/);

  // Antippen wählt, Ziehen verschiebt, Mausrad zoomt
  let m = await feldMitte(page, 0);
  await page.mouse.click(m.x, m.y);
  await warteAuf(page, () => document.querySelector('.co-bild').dataset.auswahl === '0');
  await page.mouse.move(m.x, m.y);
  await page.mouse.down();
  await page.mouse.move(m.x - 60, m.y - 20, { steps: 6 });
  await page.mouse.up();
  await page.mouse.move(m.x, m.y);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(900);
  st = (await stand(page))[0];
  assert.ok(st.felder[0].t && st.felder[0].t.zoom > 1.2, `gezoomt: ${JSON.stringify(st.felder[0].t)}`);
  // Ziehen von Feld 1 auf Feld 2 tauscht die Fotos
  const vorher = st.felder.map((x) => x.foto);
  const a = await feldMitte(page, 1);
  const z = await feldMitte(page, 2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(z.x, z.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  st = (await stand(page))[0];
  assert.deepEqual(st.felder.map((x) => x.foto), [vorher[0], vorher[2], vorher[1], vorher[3]], 'Fotos getauscht');
  await page.screenshot({ path: `${ERGEBNISSE}/co-bearbeitet.png` });

  // Mit Rahmen: Ausgabe 2160 × 2700, jedes Feld ist das Original
  await exportieren(page, 'Collage als Bild');
  let r = await vergleich(page, -1);
  console.log(JSON.stringify(r));
  assert.equal(r.name, 'collage.jpg');
  assert.equal(`${r.w}x${r.h}`, '2160x2700');
  for (const x of r.abw) assert.ok(x <= 3, `Feld weicht im Mittel ${x} vom Original ab`);
  assert.equal(r.app, false);
  assert.ok(r.abschnitte.every((x) => ['JFIF', 'ICC_PROFILE', 'db', 'c0', 'c2', 'c4', 'dd'].includes(x)), r.abschnitte.join());

  // Andere Vorlage, Format 1:1, Stil „Nahtlos“: außerhalb der Nähte unverändert
  await page.click('.co-vorlage[data-vorlage="z4-gross-oben"]');
  await page.click('.co-formate button[data-format="1:1"]');
  await page.click('.co-stile button[data-stil="nahtlos"]');
  await bereit(page);
  await page.waitForTimeout(700);
  st = (await stand(page))[0];
  assert.deepEqual([st.vorlage, st.format, st.stil], ['z4-gross-oben', '1:1', 'nahtlos']);
  assert.ok(await page.isHidden('.co-rahmen'), 'Abstand und Farbe nur mit Rahmen');
  await page.screenshot({ path: `${ERGEBNISSE}/co-nahtlos.png` });
  await exportieren(page, 'Collage als Bild');
  r = await vergleich(page, -1);
  console.log(JSON.stringify(r));
  assert.equal(`${r.w}x${r.h}`, '2160x2160');
  assert.equal(r.naehte, 3, 'vier Felder: drei Schnitte');
  for (const x of r.abw) assert.ok(x <= 3, `außerhalb der Nähte im Mittel ${x} vom Original`);
  const { writeFileSync } = await import('node:fs');
  const jpg = await page.evaluate(async () => { const u = new Uint8Array(await window.__geteilt.at(-1)[0].arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); });
  writeFileSync(`${ERGEBNISSE}/co-nahtlos.jpg`, Buffer.from(jpg, 'base64'));

  // Neu laden: alles noch da, im Hauptmenü mit Titelbild
  await page.click('#co-zurueck');
  await hauptmenue(page);
  await page.reload();
  await bisHauptmenue(page);
  assert.match(await page.textContent('#v-start .zuletzt-info'), /^Collage · 4 Fotos$/);
  assert.ok(await page.locator('#v-start .zuletzt-eintrag img').count() >= 1, 'Titelbild im Menü');
  await page.locator('#v-start .zuletzt-eintrag').first().click();
  await bereit(page);
  const nach = (await stand(page))[0];
  assert.deepEqual([nach.vorlage, nach.format, nach.stil, nach.felder], [st.vorlage, st.format, st.stil, st.felder]);

  // Sicherung und Einspielen: zweite Collage mit denselben Einstellungen
  await exportieren(page, 'Sicherung');
  const zip = await page.evaluate(async () => {
    const [f] = window.__geteilt.at(-1);
    const u = new Uint8Array(await f.arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768));
    return { name: f.name, b64: btoa(s) };
  });
  assert.match(zip.name, /\.zip$/);
  await page.setInputFiles('#datei-sicherung', { name: zip.name, mimeType: 'application/zip', buffer: Buffer.from(zip.b64, 'base64') });
  let zwei = [];
  for (let i = 0; i < 300 && zwei.length < 2; i++) { await page.waitForTimeout(200); zwei = await stand(page); }
  await bereit(page);
  assert.equal(zwei.length, 2);
  assert.notEqual(zwei[0].id, zwei[1].id);
  for (const k of ['format', 'vorlage', 'stil', 'n']) assert.equal(zwei[0][k], zwei[1][k], k);
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Collage aus der Kamera: ein Foto reicht nicht, zwei schon, dann Foto entfernen', async () => {
  const { ctx, page, fehler } = await seite();
  await page.goto(s.url);
  await bisHauptmenue(page);
  const [eins, zwei, drei] = await fotos(page, 3);
  await page.click('#v-start .neu-karte[data-art="collage"]');
  const wahl = page.waitForEvent('filechooser');
  await page.click('#dialog button:has-text("Kamera")');
  const chooser = await wahl;
  assert.equal(await chooser.element().getAttribute('capture'), 'environment', 'öffnet die Kamera');
  await chooser.setFiles([eins]);
  await bereit(page);
  assert.equal(await page.textContent('.co-hinweis'), 'Füge mindestens ein weiteres Foto hinzu.');
  assert.ok(await page.isDisabled('#co-export'));
  const mehr = page.waitForEvent('filechooser');
  await page.click('#co-mediathek');
  await (await mehr).setFiles([zwei, drei]);
  await warteAuf(page, () => !document.querySelector('#co-export').disabled && document.querySelector('.co-bild').dataset.bereit === '1', null, 60000);
  assert.equal((await stand(page))[0].n, 3);
  assert.equal(await page.locator('.co-vorlage').count(), 8);
  const m = await feldMitte(page, 0);
  await page.mouse.click(m.x, m.y);
  await warteAuf(page, () => !document.querySelector('#co-entfernen').disabled);
  await page.click('#co-entfernen');
  await warteAuf(page, () => document.querySelectorAll('.co-vorlage').length === 6 && document.querySelector('.co-bild').dataset.bereit === '1', null, 30000);
  let st = (await stand(page))[0];
  for (let i = 0; i < 50 && st.felder.length !== 2; i++) { await page.waitForTimeout(100); st = (await stand(page))[0]; }
  assert.equal(st.n, 2);
  assert.equal(st.felder.length, 2);
  const dateien = await page.evaluate(async () => (await (await import('./src/speicher.mjs')).dateienStatistik()).anzahl);
  assert.equal(dateien, 2 * 2 + 1, 'Rohbild und Vorschau je Foto, dazu das Titelbild: entferntes Foto ist weg');
  assert.deepEqual(fehler, []);
  await ctx.close();
});
