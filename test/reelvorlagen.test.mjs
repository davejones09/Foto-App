// Reel-Vorlagen: Zeitplan, Takt, Runden, Vorschlag, Masken und volle Rahmen im Übergang.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VORLAGEN, VORLAGEN_IDS, vorlagenPlan, vorlagenZustand, uebergangLage, bewegung, kreisMaske, streifenMaske, kachelMaske, TAKT } from '../src/reelvorlagen.mjs';
import { FPS, RAHMEN } from '../src/reelstil.mjs';
import { REEL_LAENGEN } from '../src/kennzahlen.mjs';
import { T } from '../src/texte.mjs';

test('Mindestens zehn Vorlagen, jede hat einen Namen', () => {
  assert.ok(VORLAGEN.length >= 10);
  assert.equal(new Set(VORLAGEN_IDS).size, VORLAGEN_IDS.length);
  for (const id of VORLAGEN_IDS) assert.ok(T[`vorlage_${id.slice(2)}`], id);
});

test('Auto: jedes Foto genau einmal, endet auf dem letzten, mindestens 5 Sekunden', () => {
  for (const vorlage of VORLAGEN_IDS) for (const n of [1, 2, 3, 6, 10]) {
    const p = vorlagenPlan(n, { vorlage });
    assert.ok(p.dauer >= 5 - 1e-9, `${vorlage} ${n}: ${p.dauer}`);
    assert.equal(p.runden, 1);
    const gesehen = new Set();
    for (let k = 0; k < p.bilder; k++) gesehen.add(vorlagenZustand(p, k / FPS).i);
    assert.equal(gesehen.size, n);
    const z = vorlagenZustand(p, (p.bilder - 1) / FPS);
    assert.deepEqual([z.i, z.j], [n - 1, null], 'endet auf dem letzten Foto');
  }
});

test('Auto liegt im Takt: Die Schnitte fallen ohne Übergangszeit auf ganze Schläge', () => {
  const p = vorlagenPlan(8, { vorlage: 'v-beat' });
  p.beginn.forEach((b) => assert.ok(Math.abs(b / TAKT - Math.round(b / TAKT)) < 1e-9, String(b)));
});

test('Feste Länge wird genau getroffen, wenige Fotos laufen mehrere Runden', () => {
  for (const vorlage of VORLAGEN_IDS) for (const laenge of REEL_LAENGEN) for (const n of [3, 6, 10]) {
    const p = vorlagenPlan(n, { vorlage, laenge });
    assert.ok(Math.abs(p.dauer - laenge) < 1 / FPS + 1e-9, `${vorlage} ${laenge} ${n}: ${p.dauer}`);
    assert.equal(p.bilder, Math.round(p.dauer * FPS));
    assert.ok(p.staende.every((s) => s > 0));
    const z = vorlagenZustand(p, (p.bilder - 1) / FPS);
    assert.deepEqual([z.i, z.j], [n - 1, null]);
  }
  assert.ok(vorlagenPlan(3, { vorlage: 'v-beat', laenge: 90 }).runden > 1);
});

test('Zu viele Fotos für die Länge: Der Vorschlag passt', () => {
  const p = vorlagenPlan(80, { vorlage: 'v-mosaik', laenge: 15 });
  assert.ok(p.zuKurz);
  assert.ok(!vorlagenPlan(p.maxFotos, { vorlage: 'v-mosaik', laenge: 15 }).zuKurz);
  assert.ok(vorlagenPlan(p.maxFotos + 1, { vorlage: 'v-mosaik', laenge: 15 }).zuKurz);
});

test('Übergänge liegen in Folge: am Ende steht nur noch das neue Foto voll im Rahmen', () => {
  for (const art of ['schieb', 'hoch']) {
    const a = uebergangLage(art, 1);
    assert.ok(Math.abs(a.b.dx ?? 0) < 1e-9 && Math.abs(a.b.dy ?? 0) < 1e-9, art);
    const m = uebergangLage(art, 0.5);
    const breite = art === 'schieb' ? RAHMEN.w : RAHMEN.h;
    const d = art === 'schieb' ? m.b.dx - m.a.dx : m.b.dy - m.a.dy;
    assert.ok(Math.abs(d - breite) < 1e-9, 'lückenlos');
  }
  for (const art of ['wirbel', 'rush']) {
    const e = uebergangLage(art, 1);
    assert.ok(Math.abs((e.b.rot ?? 0)) < 1e-9 && Math.abs(e.b.faktor - 1) < 1e-9 && Math.abs(e.b.alpha - 1) < 1e-9, art);
  }
  assert.equal(uebergangLage('blitz', 0.5).blitz, 1);
  assert.equal(uebergangLage('blitz', 0).blitz, 0);
  assert.equal(uebergangLage('blitz', 1).blitz, 0);
});

test('Wirbel: Der gedrehte Rahmen bleibt immer ganz gefüllt', () => {
  const v = RAHMEN.h / RAHMEN.w;
  for (let p = 0; p <= 1; p += 0.02) {
    const u = uebergangLage('wirbel', p);
    const noetig = (rot) => Math.cos(Math.abs(rot)) + v * Math.sin(Math.abs(rot));
    assert.ok(u.a.faktor >= noetig(u.a.rot) - 1e-9, `a bei ${p}`);
    assert.ok(u.b.faktor >= noetig(u.b.rot) - 1e-9, `b bei ${p}`);
  }
});

test('Bewegung bleibt immer mindestens rahmenfüllend, Wackeln hat Spielraum', () => {
  for (const art of ['puls', 'stoss', 'drift', 'wackel']) for (let t = 0; t < 3; t += 0.05) {
    assert.ok(bewegung(art, t, 0.5, Math.min(1, t / 3)).s >= 1, art);
  }
  assert.ok(bewegung('wackel', 3, 0.5, 1).s >= 1.08);
});

test('Masken: am Ende ist die ganze Fläche bedeckt, ohne Lücken', () => {
  const W = 270;
  const H = 480;
  const k = kreisMaske(1, W, H);
  assert.ok(k.r >= Math.hypot(W / 2, H / 2));
  assert.equal(kreisMaske(0, W, H).r, 0);
  for (const fn of [streifenMaske, kachelMaske]) {
    const flaeche = fn(1, W, H).reduce((s, r) => s + r.w * r.h, 0);
    assert.equal(flaeche, W * H, fn.name);
    const halb = fn(0.5, W, H).reduce((s, r) => s + r.w * r.h, 0);
    assert.ok(halb > 0 && halb < W * H, `${fn.name} halb`);
  }
});
