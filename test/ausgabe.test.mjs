import test from 'node:test';
import assert from 'node:assert/strict';
import { kennzahlen, karussellAnzahl, beitraege, fahrtPlan, gesamtGroesse, TEMPI, FAHRT_B } from '../src/kennzahlen.mjs';
import { bandBreite } from '../src/masse.mjs';

test('Kennzahlen: Durchschnitt und Pünktlichkeit zählen nur Anschlüsse', () => {
  const h = [{ index: 0, wert: null }, { index: 1, wert: 90 }, { index: 2, wert: 50 }, { index: 3, wert: 70 }, { index: 4, wert: 10 }];
  assert.deepEqual(kennzahlen(h), { n: 5, anschluesse: 4, schnitt: 55, p: 50 });
  assert.deepEqual(kennzahlen([{ index: 0, wert: null }]), { n: 1, anschluesse: 0, schnitt: null, p: null });
});

test('Karussell: Anzahl und Aufteilung in Beiträge', () => {
  assert.equal(karussellAnzahl(2), 2);
  assert.equal(karussellAnzahl(1), 1);
  assert.equal(karussellAnzahl(27), Math.ceil((27 * 933 + 363) / 1296));
  assert.ok(karussellAnzahl(27) <= 20, 'etwa 27 Halte passen in einen Beitrag');
  assert.ok(karussellAnzahl(28) <= 21);
  assert.deepEqual(beitraege(7), [[0, 7]]);
  assert.deepEqual(beitraege(25), [[0, 13], [13, 25]]);
  for (const n of [1, 20, 21, 40, 41, 77]) {
    const b = beitraege(n);
    assert.equal(b[0][0], 0);
    assert.equal(b[b.length - 1][1], n);
    for (const [a, e] of b) assert.ok(e - a <= 20 && e > a);
  }
});

test('Fahrt: Bewegung ist stetig, endet am Bandende und hat die angezeigte Länge', () => {
  for (const n of [1, 2, 5, 50]) {
    for (const v of TEMPI) {
      const p = fahrtPlan(n, v);
      assert.ok(Math.abs(p.weg - Math.max(0, bandBreite(n) * (1920 / 1620) - FAHRT_B)) < 1e-6);
      assert.equal(p.x(0), 0);
      assert.ok(Math.abs(p.x(p.dauer) - p.weg) < 1e-6);
      let alt = 0;
      for (let t = 0; t <= p.dauer; t += 1 / 30) {
        const x = p.x(t);
        assert.ok(x >= alt - 1e-9, 'nie rückwärts');
        assert.ok(x - alt <= v / 30 + 1e-6, `nie schneller als das Tempo: ${x - alt}`);
        alt = x;
      }
    }
  }
  assert.ok(fahrtPlan(10, 220).dauer > fahrtPlan(10, 900).dauer);
});

test('Gesamtbild: verkleinert nur, wenn es nötig ist', () => {
  const klein = gesamtGroesse(3, 16_777_216);
  assert.equal(klein.verkleinert, false);
  assert.equal(klein.b, bandBreite(3));
  const gross = gesamtGroesse(50, 16_777_216);
  assert.ok(gross.verkleinert);
  assert.ok(gross.b * gross.h <= 16_777_216);
  assert.ok(Math.abs(gross.b / gross.h / (bandBreite(50) / 1620) - 1) < 0.005);
});

import { reelPlan, abschnittBereich, endstationLayout, REEL_LAENGEN, REEL_MAX_TEMPO, REEL_RAND, FAHRT_FPS as FPS } from '../src/kennzahlen.mjs';

test('Reel: Länge bestimmt das Tempo, Dauer und Bildzahl stimmen', () => {
  for (const laenge of REEL_LAENGEN) {
    for (const endstation of [true, false]) {
      const p = reelPlan(10, { laenge, endstation });
      assert.equal(p.dauer, laenge);
      assert.equal(p.bilder, laenge * FPS);
      assert.ok(Math.abs(p.xBand(p.bewegung) - (p.x1 - p.sicht)) < 1e-6, 'endet am Abschnittsende');
      assert.equal(p.bewegung, laenge - (endstation ? 3 : 0));
    }
  }
  assert.ok(reelPlan(10, { laenge: 15 }).tempo > reelPlan(10, { laenge: 90 }).tempo, 'kürzer heißt schneller');
});

test('Reel: ab dem ersten Bild in Bewegung, nur das Ende läuft weich aus', () => {
  const p = reelPlan(8, { laenge: 30 });
  const v = (t) => (p.xBand(t + 1 / FPS) - p.xBand(t)) * p.f * FPS; // Pixel je Sekunde im Video
  assert.equal(p.xBand(0), p.x0);
  assert.ok(Math.abs(v(0) - p.tempo) < 1, `Start mit vollem Tempo: ${v(0)} / ${p.tempo}`);
  assert.ok(Math.abs(v(p.bewegung / 2) - p.tempo) < 1, 'gleichmäßig in der Mitte');
  assert.ok(v(p.bewegung - 1 / FPS) < p.tempo * 0.05, 'bremst bis fast null');
  let alt = p.xBand(0);
  for (let t = 1 / FPS; t <= p.dauer; t += 1 / FPS) {
    const x = p.xBand(t);
    assert.ok(x >= alt - 1e-9);
    assert.ok((x - alt) * p.f <= p.tempo / FPS + 1e-6, 'nie schneller als das Tempo');
    alt = x;
  }
});

test('Reel: Abschnitt von bis Halt und Vorschlag bei zu hohem Tempo', () => {
  assert.deepEqual(abschnittBereich(0, 0), { x0: 0, x1: 1296 });
  assert.deepEqual(abschnittBereich(2, 4), { x0: 2 * 933, x1: 4 * 933 + 1296 });
  const p = reelPlan(20, { von: 3, bis: 7, laenge: 30 });
  assert.equal(p.x0, 3 * 933);
  assert.ok(Math.abs(p.xBand(p.bewegung) + p.sicht - (7 * 933 + 1296)) < 1e-6);
  const schnell = reelPlan(50, { laenge: 15 });
  assert.ok(schnell.zuSchnell && schnell.tempo > REEL_MAX_TEMPO);
  const v = schnell.vorschlag;
  assert.equal(v.von, 0);
  assert.ok(!reelPlan(50, { von: v.von, bis: v.bis, laenge: 15 }).zuSchnell, 'Vorschlag ist langsam genug');
  assert.ok(reelPlan(50, { von: v.von, bis: v.bis + 1, laenge: 15 }).zuSchnell, 'Vorschlag ist der längste mögliche');
  assert.equal(reelPlan(50, { laenge: 90 }).zuSchnell, false);
  assert.equal(reelPlan(5, { laenge: 15 }).vorschlag, null);
});

test('Reel: Endstation hält oben und unten 250, rechts 60 Pixel Abstand', () => {
  const l = endstationLayout();
  for (const z of l.zeilen) {
    assert.ok(z.oben >= REEL_RAND.oben, `${z.art} oben ${z.oben}`);
    assert.ok(z.unten <= 1920 - REEL_RAND.unten, `${z.art} unten ${z.unten}`);
  }
  assert.ok(l.x >= REEL_RAND.links);
  assert.ok(l.x + l.maxBreite <= 1080 - REEL_RAND.rechts);
});
