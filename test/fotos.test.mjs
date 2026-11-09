// Fotos im Reel: einmal für alle festlegen, viele Fotos passen in 90 s.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clipPlan, fotoRahmen, fotoStandFuer, GANZ, MEDIEN_MAX, REEL_MAX, FOTO_STAND, FOTO_STAND_MIN } from '../src/clipreel.mjs';

const foto = (pw, ph, extra = {}) => ({ typ: 'foto', dauer: 0, start: 0, pw, ph, ...extra });

test('Automatisch: Hochformat füllt nach dem Motiv, Quer und Quadrat bleiben ganz', () => {
  const hoch = fotoRahmen(foto(3000, 4000, { motiv: { x: 0.3, y: 0.6 } }));
  assert.deepEqual(hoch, { x: 0.3, y: 0.6, zoom: 1, modus: 'fuellen', auto: true });
  assert.equal(fotoRahmen(foto(6000, 4000)).modus, 'ganz');
  assert.equal(fotoRahmen(foto(4000, 4000)).modus, 'ganz');
  assert.equal(fotoRahmen(foto(6000, 4000), 'auto', 'weiss').grund, 'weiss');
  // Ohne Maße (noch nicht gelesen) erst einmal füllen
  assert.equal(fotoRahmen(foto()).modus, 'fuellen');
});

test('Ganz zeigen und Ausfüllen gelten für jedes Format', () => {
  assert.equal(fotoRahmen(foto(3000, 4000), 'ganz').modus, 'ganz');
  assert.equal(fotoRahmen(foto(6000, 4000), 'fuellen').modus, 'fuellen');
  assert.equal(fotoRahmen(foto(6000, 4000), 'ganz', 'schwarz').grund, 'schwarz');
});

test('Bis zu 100 Medien, viele Fotos rücken zusammen statt wegzufallen', () => {
  assert.ok(MEDIEN_MAX >= 100);
  const zehn = Array.from({ length: 10 }, () => foto(6000, 4000));
  assert.equal(fotoStandFuer(zehn), FOTO_STAND);
  const viele = Array.from({ length: 80 }, () => foto(6000, 4000));
  const p = clipPlan(viele, { stil: GANZ });
  assert.equal(p.staende.length, 80, 'alle Fotos sind dabei');
  assert.ok(p.dauer <= REEL_MAX + 1e-9);
  assert.ok(p.fotoStand < FOTO_STAND && p.fotoStand >= FOTO_STAND_MIN);
  assert.equal(p.gekappt, false);
  // Selbst eingestellte Längen und Clips bleiben, nur die übrigen Fotos rücken zusammen
  const gemischt = [{ typ: 'clip', dauer: 20, start: 0 }, foto(1, 1, { laenge: 4, eigen: true }), ...viele.slice(0, 60)];
  const q = clipPlan(gemischt, { stil: GANZ });
  assert.equal(q.staende[0], 20);
  assert.equal(q.staende[1], 4);
  assert.ok(q.dauer <= REEL_MAX + 1e-9);
  // Mehr als in 90 s passt (auch bei 0,8 s): dann wird wie bisher gekappt
  const zuViele = Array.from({ length: 100 }, () => foto(6000, 4000));
  const r = clipPlan([{ typ: 'clip', dauer: 30, start: 0 }, ...zuViele], { stil: GANZ });
  assert.equal(r.fotoStand, FOTO_STAND_MIN);
  assert.equal(r.gekappt, true);
});
