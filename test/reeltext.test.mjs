// Text und Signatur: Umbruch, Ein- und Ausblenden, Lage in sicheren Bereichen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { umbrechen, sichtbarkeit, textUeber, signaturZeichnen, ueberlagern, TEXT_LAGEN } from '../src/reeltext.mjs';

const messCtx = (proZeichen = 10) => {
  const aufrufe = [];
  return {
    aufrufe,
    measureText: (t) => ({ width: t.length * proZeichen }),
    save() {}, restore() {}, fillText: (t, x, y) => aufrufe.push({ art: 'text', t, x, y }), drawImage: (b, x, y, w, h) => aufrufe.push({ art: 'bild', x, y, w, h }),
    set font(_) {}, set fillStyle(_) {}, set globalAlpha(_) {}, set textAlign(_) {}, set textBaseline(_) {}, set shadowColor(_) {}, set shadowBlur(_) {}, set shadowOffsetY(_) {},
  };
};

test('Umbruch: passt in die Breite, höchstens drei Zeilen', () => {
  const z = umbrechen(messCtx(), 'eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf', 100);
  assert.ok(z.length <= 3);
  for (const x of z.slice(0, -1)) assert.ok(x.length * 10 <= 100);
  assert.match(z[2], /…$/);
  assert.deepEqual(umbrechen(messCtx(), 'kurz', 100), ['kurz']);
});

test('Sichtbarkeit: weich herein und hinaus, außerhalb null', () => {
  assert.equal(sichtbarkeit(0, 1, 3), 0);
  assert.equal(sichtbarkeit(2, 1, 3), 1);
  assert.ok(sichtbarkeit(1.1, 1, 3) > 0 && sichtbarkeit(1.1, 1, 3) < 1);
  assert.equal(sichtbarkeit(4, 1, 3), 0);
});

test('Ohne Text kein Überzug, Titel liegt in der gewählten Höhe', () => {
  assert.equal(textUeber({ titel: { text: ' ' }, zeilen: [] }, 1080, 1920), null);
  const ctx = messCtx(20);
  textUeber({ titel: { text: 'Hallo', stil: 'klar', lage: 'oben' } }, 1080, 1920)(ctx, 1.5);
  const t = ctx.aufrufe.find((a) => a.art === 'text');
  assert.equal(t.t, 'Hallo');
  assert.ok(Math.abs(t.y - 1920 * TEXT_LAGEN.oben) < 5);
  const leer = messCtx(20);
  textUeber({ titel: { text: 'Hallo' } }, 1080, 1920)(leer, 5);
  assert.equal(leer.aufrufe.length, 0, 'Titel nach drei Sekunden weg');
});

test('Signatur: Ecke mit Abstand zur Bedienung von Instagram, „Am Ende“ nur zum Schluss', () => {
  const ctx = messCtx();
  signaturZeichnen(ctx, 1080, 1920, { an: true, art: 'text', text: 'AB', lage: 'ur', groesse: 'klein' }, 1, 10);
  const t = ctx.aufrufe[0];
  assert.ok(t.x > 900 && t.y < 1920 * 0.85, `unten rechts, über der Leiste: ${t.x}/${t.y}`);
  const ende = messCtx();
  signaturZeichnen(ende, 1080, 1920, { an: true, art: 'text', text: 'AB', lage: 'ende' }, 2, 10);
  assert.equal(ende.aufrufe.length, 0);
  signaturZeichnen(ende, 1080, 1920, { an: true, art: 'text', text: 'AB', lage: 'ende' }, 9.8, 10);
  assert.equal(ende.aufrufe.length, 1);
  const aus = messCtx();
  signaturZeichnen(aus, 1080, 1920, { an: false, art: 'text', text: 'AB', lage: 'ur' }, 1, 10);
  assert.equal(aus.aufrufe.length, 0);
});

test('Überlagern ohne Text und Signatur gibt den Maler unverändert zurück', () => {
  const male = async () => {};
  assert.equal(ueberlagern(male, { W: 10, H: 10 }), male);
});
