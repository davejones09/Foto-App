// Reel aus Clips: Zeitplan und Stelle im Clip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clipPlan, clipZeit, deckAusschnitt, GANZ, REEL_MAX, FOTO_STAND } from '../src/clipreel.mjs';
import { vorlagenZustand } from '../src/reelvorlagen.mjs';
import { FPS } from '../src/reelstil.mjs';

const CLIP = (dauer, start = 0) => ({ typ: 'clip', dauer, start });
const FOTO = { typ: 'foto', dauer: 0, start: 0 };

test('Ganze Clips: jeder läuft ab dem Startpunkt bis zum Ende, Fotos 2,5 Sekunden', () => {
  const p = clipPlan([CLIP(4), CLIP(6, 2), FOTO]);
  assert.deepEqual(p.staende, [4, 4, FOTO_STAND]);
  assert.equal(p.dauer, 10.5);
  assert.equal(p.bilder, Math.round(10.5 * FPS));
  assert.equal(p.gekappt, false);
  assert.deepEqual(p.versatz, [0, 0, 0]);
  const z = vorlagenZustand(p, 5);
  assert.deepEqual([z.i, z.j], [1, null]);
});

test('Ganze Clips: Bei 90 Sekunden ist Schluss und die App sagt es', () => {
  const p = clipPlan([CLIP(70), CLIP(70), CLIP(70)]);
  assert.equal(p.dauer, REEL_MAX);
  assert.equal(p.gekappt, true);
  assert.equal(p.staende.length, 2);
  assert.equal(p.staende[1], 20);
});

test('Vorlage: Die zweite Runde zeigt eine spätere Stelle des Clips', () => {
  const m = [CLIP(30), CLIP(30), CLIP(30)];
  const p = clipPlan(m, { stil: 'v-beat', laenge: 60 });
  assert.ok(p.runden > 1);
  assert.equal(p.versatz[0], 0);
  assert.ok(p.versatz[3] > 0, 'zweite Runde');
  assert.ok(Math.abs(p.dauer - 60) < 1 / FPS + 1e-9);
});

test('Stelle im Clip: ab Startpunkt, am Ende wieder von vorn', () => {
  const c = CLIP(5, 1);
  assert.equal(clipZeit(c, 0, 0), 1);
  assert.equal(clipZeit(c, 0, 2), 3);
  assert.equal(clipZeit(c, 3, 2), 2, 'Rest ist 4 Sekunden, also 1 + (5 % 4)');
});

test('Ausschnitt füllt den 9:16-Rahmen, mittig', () => {
  const q = deckAusschnitt(1920, 1080);
  assert.ok(Math.abs(q.h - 1080) < 1e-9 && Math.abs(q.w - (1080 * 9) / 16) < 1e-9);
  assert.ok(Math.abs(q.x - (1920 - q.w) / 2) < 1e-9);
  const h = deckAusschnitt(1080, 1920);
  assert.ok(Math.abs(h.w - 1080) < 1e-9 && Math.abs(h.h - 1920) < 1e-9);
});
