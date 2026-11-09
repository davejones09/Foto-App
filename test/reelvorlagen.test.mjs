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

test('Gruppen: jede Vorlage gehört zu einer Stimmung, jede Stimmung hat mindestens drei', async () => {
  const { VORLAGEN, GRUPPEN, gueltig } = await import('../src/reelvorlagen.mjs');
  assert.ok(VORLAGEN.length >= 30);
  for (const v of VORLAGEN) {
    assert.ok(GRUPPEN.includes(v.gruppe), `${v.id}: Gruppe ${v.gruppe}`);
    assert.ok(gueltig(v), `${v.id} gültig`);
  }
  for (const g of GRUPPEN) assert.ok(VORLAGEN.filter((v) => v.gruppe === g).length >= 3, `${g} zu klein`);
  assert.equal(new Set(VORLAGEN.map((v) => v.id)).size, VORLAGEN.length);
});

test('Übergänge: am Anfang nur das alte Bild, am Ende nur das neue, voll deckend', async () => {
  const { UEBERGANG_IDS, uebergangLage } = await import('../src/reelvorlagen.mjs');
  for (const art of UEBERGANG_IDS) {
    const e = uebergangLage(art, 1);
    if (art !== 'schnitt') {
      assert.ok(e.b, `${art}: neues Bild am Ende`);
      assert.ok((e.b.alpha ?? 1) > 0.99, `${art}: am Ende deckend`);
      assert.ok(Math.abs(e.b.dx ?? 0) < 1 && Math.abs(e.b.dy ?? 0) < 1, `${art}: am Ende an seinem Platz`);
      assert.ok(Math.abs((e.b.faktor ?? 1) - 1) < 1e-6, `${art}: am Ende ohne Zoom`);
      assert.ok(!e.blitz, `${art}: am Ende kein Blitz`);
    }
    const a = uebergangLage(art, 0);
    if (art !== 'schnitt') assert.ok(a.a, `${art}: altes Bild am Anfang`);
    assert.ok(!a.blitz, `${art}: am Anfang kein Blitz`);
  }
});

test('Masken decken am Ende das ganze Bild', async () => {
  const { maskePfad, jalousieMaske } = await import('../src/reelvorlagen.mjs');
  const W = 108;
  const H = 192;
  // Kleiner Rasterer für die Pfade: Punkt-in-Polygon und Rechtecke
  const pruefe = (maske, p) => {
    const formen = [];
    let poly = null;
    const ctx = {
      arc: (x, y, r) => formen.push({ kreis: { x, y, r } }),
      rect: (x, y, w, h) => formen.push({ rect: { x, y, w, h } }),
      moveTo: (x, y) => { poly = [[x, y]]; },
      lineTo: (x, y) => poly.push([x, y]),
      closePath: () => formen.push({ poly }),
    };
    maskePfad(ctx, maske, p, W, H);
    const drin = (px, py) => formen.some((f) => {
      if (f.kreis) return Math.hypot(px - f.kreis.x, py - f.kreis.y) <= f.kreis.r;
      if (f.rect) return px >= f.rect.x && px < f.rect.x + f.rect.w && py >= f.rect.y && py < f.rect.y + f.rect.h;
      let c = false;
      const q = f.poly;
      for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
        if ((q[i][1] > py) !== (q[j][1] > py) && px < ((q[j][0] - q[i][0]) * (py - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
      }
      return c;
    });
    let n = 0;
    for (let y = 0.5; y < H; y += 3) for (let x = 0.5; x < W; x += 3) if (drin(x, y)) n++;
    return n / (Math.ceil(H / 3) * Math.ceil(W / 3));
  };
  for (const m of ['kreis', 'streifen', 'kacheln', 'diagonal', 'jalousie', 'tuer']) {
    assert.ok(pruefe(m, 1) > 0.999, `${m}: am Ende voll`);
    assert.ok(pruefe(m, 0) < 0.02, `${m}: am Anfang leer`);
    const mitte = pruefe(m, 0.5);
    assert.ok(mitte > 0.05 && mitte < 0.95, `${m}: in der Mitte halb (${mitte})`);
  }
  assert.equal(jalousieMaske(1, W, H).reduce((s, r) => s + r.h, 0), H);
});

test('Varianten: ohne Variante das Original, sonst anders, gleich bei gleicher Zahl, in der Stimmung', async () => {
  const { VORLAGEN, vorlageAus, gueltig } = await import('../src/reelvorlagen.mjs');
  for (const v of VORLAGEN) {
    assert.equal(vorlageAus(v.id, 0), v);
    let anders = 0;
    for (let k = 1; k <= 6; k++) {
      const a = vorlageAus(v.id, k);
      assert.ok(gueltig(a), `${v.id}/${k}`);
      assert.deepEqual(a, vorlageAus(v.id, k));
      assert.equal(a.gruppe, v.gruppe);
      if (JSON.stringify([a.arten, a.schlaege, a.bewegung]) !== JSON.stringify([v.arten, v.schlaege, v.bewegung])) anders++;
    }
    assert.ok(anders >= 3, `${v.id}: nur ${anders} von 6 Varianten anders`);
  }
});

test('Eigene Vorlagen: werden gefunden, ungültige abgelehnt', async () => {
  const { eigeneSetzen, istVorlage, vorlageAus, vorlagenPlan } = await import('../src/reelvorlagen.mjs');
  eigeneSetzen([{ id: 'e-test', name: 'Test', schlaege: [2, 1], arten: ['blende', 'schnitt'], bewegung: 'drift' }, { id: 'e-kaputt', schlaege: [], arten: ['x'], bewegung: 'y' }]);
  assert.ok(istVorlage('e-test'));
  assert.ok(!istVorlage('e-kaputt'));
  assert.equal(vorlageAus('e-test').arten[0], 'blende');
  const p = vorlagenPlan(4, { vorlage: 'e-test' });
  assert.equal(p.arten[0], 'blende');
  eigeneSetzen([]);
  assert.ok(!istVorlage('e-test'));
});
