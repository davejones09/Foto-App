// Tipps für Reels: vollständig, und die Clips ergeben die genannte Länge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ANLAESSE, GRUNDLAGEN } from '../src/reeltipps.mjs';

test('Die gewünschten Anlässe sind da, jeder mit mindestens zwei Vorschlägen und Tipps', () => {
  const ids = ANLAESSE.map((a) => a.id);
  for (const id of ['reise', 'restaurant', 'hotel', 'flug', 'bahn']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(GRUNDLAGEN.length >= 5);
  for (const a of ANLAESSE) {
    assert.ok(a.ideen.length >= 2, a.id);
    assert.ok(a.tipps.length >= 3, a.id);
    assert.ok(a.stil, a.id);
  }
});

test('Die Clips jedes Vorschlags ergeben seine Länge und bleiben unter 90 Sekunden', () => {
  for (const a of ANLAESSE) for (const i of a.ideen) {
    const summe = i.clips.reduce((s, [, sek]) => s + sek, 0);
    assert.ok(summe >= i.laenge[0] && summe <= i.laenge[1], `${a.id} ${i.titel}: ${summe} s`);
    assert.ok(i.laenge[1] <= 90);
    assert.ok(i.clips.length >= 3);
  }
});

test('Die Stilnamen gibt es in der App wirklich', async () => {
  const { T } = await import('../src/texte.mjs');
  const namen = Object.entries(T).filter(([k]) => k.startsWith('stil_') || k.startsWith('vorlage_')).map(([, v]) => v);
  for (const a of ANLAESSE) for (const teil of a.stil.split(' oder ')) assert.ok(namen.includes(teil), `${a.id}: ${teil}`);
});
