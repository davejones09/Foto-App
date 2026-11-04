// Fotos bleiben unverändert: P3-Fotos bleiben P3, außerhalb der Überlappung höchstens JPEG-Rauschen,
// Ausgaben in sRGB, Diagnose-Vergleich, alte Strecken nur nach Rückfrage neu genäht.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server, browser, neueSeite, oeffne, ausloesen, warteAuf, fotoJpeg, hauptmenue, oeffneDiagnose } from './hilfe.mjs';

let s;
let b;
before(async () => { s = await server(); b = await browser(); });
after(async () => { await b?.close(); await s?.schliessen(); });

// Testfoto in Display P3 mit Farben außerhalb von sRGB. Chromium schreibt das Profil ins JPEG.
async function fotoP3(page, { w = 1600, h = 1200, a, b: bis, oben, unten, seed = 1 }) {
  const b64 = await page.evaluate(async ({ w, h, a, bis, oben, unten, seed }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const k = c.getContext('2d', { colorSpace: 'display-p3' });
    k.fillStyle = oben;
    k.fillRect(0, 0, w, h);
    k.beginPath();
    k.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const u = x / w;
      const t = u < 0.3 ? 0 : u > 0.7 ? 1 : (u - 0.3) / 0.4;
      k.lineTo(x, (a + (bis - a) * t * t * (3 - 2 * t)) * h);
    }
    k.lineTo(w, h);
    k.closePath();
    k.fillStyle = unten;
    k.fill();
    let r = seed;
    const z = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 80; i++) { k.fillStyle = `rgba(255,255,255,${0.04 + z() * 0.05})`; k.fillRect(z() * w, h * 0.5 + z() * h * 0.5, 30 + z() * 60, 6); }
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.95));
    const u = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768));
    return btoa(s);
  }, { w, h, a, bis, oben, unten, seed });
  return Buffer.from(b64, 'base64');
}

const b64 = (buf) => buf.toString('base64');

test('Farbtest: P3-Leinwand, toBlob schreibt das Profil, das eigene P3-Profil wirkt wie erwartet', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await page.goto(s.url);
  const r = await page.evaluate(async () => {
    const farbe = await import('./src/farbe.mjs');
    const t = await farbe.farbTest();
    // Rohe Werte 255,0,0 in einer sRGB-Leinwand, dann das erzeugte P3-Profil davor: muss als P3-Rot gelten.
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const k = c.getContext('2d');
    k.fillStyle = 'rgb(255 0 0)';
    k.fillRect(0, 0, 16, 16);
    const roh = new Uint8Array(await (await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 1))).arrayBuffer());
    const lies = async (bytes) => {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
      const img = new Image();
      img.src = url;
      await img.decode();
      const d = document.createElement('canvas');
      d.width = 16; d.height = 16;
      const dk = d.getContext('2d', { colorSpace: 'display-p3' });
      dk.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      return [...dk.getImageData(8, 8, 1, 1).data.slice(0, 3)];
    };
    return { t, ohne: await lies(roh), mit: await lies(farbe.setzeProfil(roh, farbe.displayP3Profil())) };
  });
  console.log(`Farbtest: ${JSON.stringify(r.t)}; sRGB-Rot in P3 ${r.ohne}, mit P3-Profil ${r.mit}`);
  assert.equal(r.t.p3, true);
  assert.equal(r.t.speichern, 'nativ');
  assert.ok(r.mit[0] >= 250 && r.mit[1] <= 6 && r.mit[2] <= 6, `mit eigenem Profil P3-Rot: ${r.mit}`);
  assert.ok(r.ohne[1] > 30, `ohne Profil gilt es als sRGB-Rot: ${r.ohne}`);
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('P3-Serie: Fotos bleiben P3 und außerhalb der Überlappung unverändert, Ausgaben in sRGB', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await ausloesen(page); // sRGB-Kamerahalt vorneweg
  await warteAuf(page, () => document.body.dataset.ansicht === 'sucher' && !document.querySelector('#ausloeser').disabled);
  const GRUEN = 'color(display-p3 0.15 0.85 0.25)';
  const fotos = [
    await fotoP3(page, { a: 0.55, b: 0.45, oben: GRUEN, unten: 'color(display-p3 0.85 0.2 0.12)', seed: 3 }),
    await fotoP3(page, { a: 0.45, b: 0.6, oben: 'color(display-p3 0.2 0.3 0.95)', unten: 'color(display-p3 0.9 0.75 0.1)', seed: 4 }),
  ];
  await page.setInputFiles('#datei-bild', fotos.map((buffer, k) => ({ name: `p3-${k}.jpg`, mimeType: 'image/jpeg', buffer })));
  await page.waitForSelector('#v-serie:not([hidden])');
  await warteAuf(page, () => !document.querySelector('#se-bauen').disabled && document.querySelectorAll('#v-serie .se-zeile').length === 2, null, 60000);
  await page.click('#se-bauen');
  await warteAuf(page, () => document.body.dataset.ansicht === 'strecke', null, 120000);

  const r = await page.evaluate(async (quellen) => {
    const db = await import('./src/speicher.mjs');
    const bild = await import('./src/bild.mjs');
    const farbe = await import('./src/farbe.mjs');
    const ausgabe = await import('./src/ausgabe.mjs');
    const halte = await db.halte(localStorage.getItem('nahtlos-aktiv'));
    const bytes = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
    const dekodiere = async (blob, raum) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      await img.decode();
      URL.revokeObjectURL(url);
      const c = bild.leinwand(img.naturalWidth, img.naturalHeight, raum);
      bild.ctx2d(c).drawImage(img, 0, 0);
      return c;
    };
    const ab = (p, q) => {
      const m = [0, 0, 0]; const mx = [0, 0, 0];
      for (let i = 0; i < p.d.length; i += 4) for (let c = 0; c < 3; c++) { const d = Math.abs(p.d[i + c] - q.d[i + c]); m[c] += d; mx[c] = Math.max(mx[c], d); }
      return { mittel: m.map((v) => v / (p.d.length / 4)), max: mx };
    };
    const aus = { halte: halte.map((h) => ({ farbraum: h.farbraum, nahtFarbraum: h.nahtFarbraum, verfahren: h.verfahren, profil: h.profil, breite: h.breite })), vergleich: [], profile: [] };
    for (const h of halte.slice(1)) {
      const gespeichert = await db.blob(h, 'bild');
      aus.profile.push(farbe.iccLesen(farbe.iccAusJpeg(new Uint8Array(await gespeichert.arrayBuffer())))?.art || 'keins');
      const nach = await dekodiere(gespeichert, 'display-p3');
      const x0 = 363;
      const bw = h.breite - 2 * 363;
      const p = bild.pixel(nach, x0, 0, bw, 1620);
      // Bezug: die Quelldatei, direkt dekodiert, gleich gerahmt. Welche Quelle zu welchem Halt gehört, sagt die kleinere Abweichung.
      let best = null;
      for (const q of quellen) {
        const src = await dekodiere(new Blob([bytes(q)], { type: 'image/jpeg' }), 'display-p3');
        const vor = bild.rendere(src, src.width, src.height, h.transform, h.breite, 1620, h.breite, 'display-p3');
        const e = ab(bild.pixel(vor, x0, 0, bw, 1620), p);
        if (!best || Math.max(...e.mittel) < Math.max(...best.mittel)) best = e;
      }
      aus.vergleich.push(best);
    }
    // Karussell: sRGB, ohne P3-Profil; das P3-Grün kommt als sauber umgerechnetes sRGB-Grün an.
    const strecke = (await db.strecken()).find((x) => x.id === localStorage.getItem('nahtlos-aktiv'));
    const plan = await ausgabe.karussellPlanen(halte);
    const slides = await ausgabe.karussell(strecke, halte, { plan });
    aus.slideProfile = [];
    for (const sl of slides) aus.slideProfile.push(farbe.iccLesen(farbe.iccAusJpeg(new Uint8Array(await sl.arrayBuffer())))?.art || 'keins');
    const probe = document.createElement('canvas');
    probe.width = 1; probe.height = 1;
    const pk = probe.getContext('2d', { colorSpace: 'srgb' });
    pk.fillStyle = 'color(display-p3 0.15 0.85 0.25)';
    pk.fillRect(0, 0, 1, 1);
    aus.gruenSoll = [...pk.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    // Grüner Halt finden: oben grün. Seine Mitte im Band, dann die passende Folie.
    const lagen = [0];
    for (let i = 1; i < halte.length; i++) lagen.push(lagen[i - 1] + halte[i - 1].breite - 363);
    aus.gruen = null;
    for (let i = 1; i < halte.length; i++) {
      const bx = lagen[i] + halte[i].breite / 2;
      const k = Math.floor((bx - plan.versatz) / 1296);
      if (k < 0 || k >= slides.length) continue;
      const c = await dekodiere(slides[k], 'srgb');
      const sx = Math.round((bx - plan.versatz - k * 1296) * (1080 / 1296));
      const px = bild.pixel(c, sx - 20, 100, 40, 200);
      const m = [0, 0, 0];
      for (let j = 0; j < px.d.length; j += 4) for (let q = 0; q < 3; q++) m[q] += px.d[j + q] / (px.d.length / 4);
      if (m[1] > m[0] + 60 && m[1] > m[2] + 60) aus.gruen = m.map((v) => Math.round(v));
    }
    return aus;
  }, fotos.map(b64));
  console.log(JSON.stringify(r));
  assert.deepEqual(r.halte.map((h) => h.farbraum), ['srgb', 'display-p3', 'display-p3']);
  assert.deepEqual(r.halte.map((h) => h.verfahren), [2, 2, 2]);
  assert.deepEqual(r.halte.slice(1).map((h) => h.nahtFarbraum), ['display-p3', 'display-p3']);
  assert.deepEqual(r.halte.slice(1).map((h) => h.profil?.art), ['display-p3', 'display-p3']);
  assert.deepEqual(r.profile, ['display-p3', 'display-p3'], 'gespeicherte Bilder tragen das P3-Profil');
  for (const v of r.vergleich) {
    assert.ok(Math.max(...v.mittel) <= 3, `außerhalb der Überlappung im Mittel höchstens 3 Stufen: ${v.mittel}`);
  }
  assert.ok(r.slideProfile.every((p) => p !== 'display-p3'), `Karussell ohne P3: ${r.slideProfile}`);
  assert.ok(r.gruen, 'grüner Halt im Karussell gefunden');
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(r.gruen[c] - r.gruenSoll[c]) <= 6, `sRGB-Grün ${r.gruen} statt ${r.gruenSoll}`);
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Diagnose: Foto vergleichen zeigt mittlere und größte Abweichung je Kanal', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  const p3 = await fotoP3(page, { a: 0.5, b: 0.5, oben: 'color(display-p3 0.15 0.85 0.25)', unten: 'color(display-p3 0.85 0.2 0.12)', seed: 9 });
  const srgb = await fotoJpeg(page, { a: 0.5, b: 0.4, oben: '#c9b48e', unten: '#5a3522', seed: 5 });
  await oeffneDiagnose(page);
  await warteAuf(page, () => /Farbe: P3-Leinwand/.test(document.querySelector('.dg-text').textContent));
  for (const [name, buffer, raum] of [['p3.jpg', p3, 'Display P3'], ['srgb.jpg', srgb, 'sRGB']]) {
    const vorher = (await page.textContent('.dg-text')).split('Fotovergleich:').length;
    await page.setInputFiles('#dg-datei', { name, mimeType: 'image/jpeg', buffer });
    await warteAuf(page, (n) => document.querySelector('.dg-text').textContent.split('Fotovergleich:').length > n && /Ergebnis:/.test(document.querySelector('.dg-text').textContent), vorher, 60000);
    const text = await page.textContent('.dg-text');
    const teil = text.slice(text.lastIndexOf(`Fotovergleich: ${name}`));
    console.log(teil.split('\n').slice(0, 10).join('\n'));
    assert.match(teil, new RegExp(`gerechnet in ${raum}`));
    assert.match(teil, /Ergebnis: in Ordnung/);
    assert.match(teil, /Beim Nähen verändert \(vor dem JPEG\): größte Abweichung 0/);
    const m = teil.match(/mittlere Abweichung R ([\d.]+) G ([\d.]+) B ([\d.]+)/);
    assert.ok(m && [1, 2, 3].every((i) => Number(m[i]) <= 3), `mittlere Abweichung ${m}`);
    assert.match(teil, /größte Abweichung {3}R \d+ G \d+ B \d+/);
  }
  const text = await page.textContent('.dg-text');
  assert.match(text, /Farbe: P3-Leinwand ja, P3 speichern: nativ/);
  assert.match(text, /Profil der Datei: Display P3[^\n]*\(display-p3\)/);
  assert.match(text, /Profil im gespeicherten Bild: Display P3/);
  assert.deepEqual(fehler, []);
  await ctx.close();
});

test('Alte Strecke: kein Neurechnen beim Start, Neu nähen nur nach Rückfrage', async () => {
  const { ctx, page, fehler } = await neueSeite(b);
  await oeffne(page, s.url);
  await page.evaluate(() => localStorage.setItem('nahtlos-erstlauf', 'fertig'));
  await ausloesen(page);
  // zweiter Halt mit etwas versetzter Linie
  await page.evaluate(() => { window.__szene.linie = 0.5; });
  await ausloesen(page);
  // So sah ein Halt vor Verfahren 2 aus: kein Feld verfahren.
  const vorher = await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const halte = await db.halte(localStorage.getItem('nahtlos-aktiv'));
    await db.aendereHalt(halte[1].id, { verfahren: null });
    return { laenge: halte[1].bild.laenge, schluessel: halte[1].bild.schluessel };
  });
  await page.reload();
  await hauptmenue(page);
  const nachStart = await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    const h = (await db.halte(localStorage.getItem('nahtlos-aktiv')))[1];
    return { laenge: h.bild.laenge, schluessel: h.bild.schluessel, verfahren: h.verfahren };
  });
  assert.deepEqual(nachStart, { ...vorher, verfahren: null }, 'der Start rechnet nichts neu');

  await page.evaluate(async () => (await import('./src/zustand.mjs')).zeige('strecke'));
  await page.waitForSelector('#meldung:not([hidden])');
  assert.match(await page.textContent('#meldung p'), /noch mit Farbangleichung zusammengesetzt/);
  await page.click('#meldung button:has-text("Später")');
  await page.waitForTimeout(300);
  assert.equal((await page.evaluate(async () => (await (await import('./src/speicher.mjs')).halte(localStorage.getItem('nahtlos-aktiv')))[1].verfahren)), null, 'Später ändert nichts');

  // Nach dem nächsten Start: Neu nähen, Rückfrage bestätigen
  await page.reload();
  await hauptmenue(page);
  await page.evaluate(async () => (await import('./src/zustand.mjs')).zeige('strecke'));
  await page.waitForSelector('#meldung:not([hidden]) button:has-text("Neu zusammensetzen")');
  await page.click('#meldung button:has-text("Neu zusammensetzen")');
  await page.waitForSelector('#dialog:not([hidden])');
  assert.match(await page.textContent('#dialog .d-text'), /1 Übergänge neu rechnen\?/);
  await page.click('#dialog button:has-text("Neu zusammensetzen")');
  await warteAuf(page, () => /neu zusammengesetzt/.test(document.querySelector('#meldung p').textContent), null, 60000);
  const danach = await page.evaluate(async () => {
    const db = await import('./src/speicher.mjs');
    return (await db.halte(localStorage.getItem('nahtlos-aktiv'))).map((h) => h.verfahren);
  });
  assert.deepEqual(danach, [2, 2]);
  assert.deepEqual(fehler, []);
  await ctx.close();
});
