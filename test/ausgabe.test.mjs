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
