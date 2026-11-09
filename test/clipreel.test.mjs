// Reel aus Clips: Zeitplan und Stelle im Clip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clipPlan, clipZeit, clipStellen, clipBewegung, gleichesBild, sprungZiel, HINTER_GRENZE, deckAusschnitt, rahmenAusschnitt, eigeneLaenge, musikPlan, GANZ, REEL_MAX, FOTO_STAND } from '../src/clipreel.mjs';
import { vorlagenZustand, VORLAGEN_IDS } from '../src/reelvorlagen.mjs';
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

test('Clips laufen über jeden Übergang hinweg gleichmäßig weiter, in allen Vorlagen und Runden', () => {
  const m = [CLIP(600), CLIP(600), CLIP(600)];
  for (const stil of VORLAGEN_IDS) for (const laenge of [null, 15, 60]) {
    const p = clipPlan(m, { stil, laenge });
    const zuletzt = new Map(); // Abschnitt des Plans -> [Bild, Stelle im Clip]
    for (let k = 0; k < p.bilder; k++) {
      const z = vorlagenZustand(p, k / FPS);
      const st = clipStellen(p, m, z);
      const pruefe = (schritt, zeit) => {
        const v = zuletzt.get(schritt);
        if (v) {
          const erwartet = v[1] + (k - v[0]) / FPS;
          assert.ok(Math.abs(zeit - erwartet) < 0.002, `${stil} ${laenge}: Abschnitt ${schritt}, Bild ${k}: ${zeit} statt ${erwartet}`);
        }
        zuletzt.set(schritt, [k, zeit]);
      };
      pruefe(z.schritt, st.zeitI);
      if (z.j != null) pruefe(z.schritt + 1, st.zeitJ);
    }
  }
});

test('Spätere Runden zeigen neue Stellen: nichts wiederholt sich', () => {
  const m = [CLIP(600), CLIP(600), CLIP(600)];
  const p = clipPlan(m, { stil: 'v-slide', laenge: 60 });
  assert.ok(p.runden > 1);
  const n = m.length;
  for (let k = n; k < p.staende.length; k++) {
    const vorherEnde = p.versatz[k - n] + p.vorlauf[k - n] + p.staende[k - n] + (p.uebergaenge[k - n] || 0);
    assert.ok(Math.abs(p.versatz[k] - vorherEnde) < 1e-9, `Abschnitt ${k}`);
  }
});

test('Clip-Bewegung ändert sich sanft und ohne Sprung über den Übergang', () => {
  for (const art of ['stoss', 'puls']) {
    let vorher = null;
    for (let k = 0; k < 90; k++) {
      const { s } = clipBewegung(art, k / FPS, 0.5, k / 90);
      assert.ok(s >= 1);
      if (vorher != null) assert.ok(Math.abs(s - vorher) < 0.005, `${art} Bild ${k}: ${vorher} zu ${s}`);
      vorher = s;
    }
  }
  assert.equal(clipBewegung('keine', 1, 0.5, 0).s, 1);
});

test('Liegt die Zeit noch im selben Bild, wird nicht gesucht', () => {
  const b = 1 / 24;
  assert.equal(gleichesBild(1, b, 1), true);
  assert.equal(gleichesBild(1, b, 1 + 1 / 30), true);
  assert.equal(gleichesBild(1, b, 1 + b), false);
  assert.equal(gleichesBild(1, b, 0.9), false);
  assert.equal(gleichesBild(null, b, 1), false, 'noch kein Bild');
  assert.equal(gleichesBild(1, 0, 1), false, 'Abstand noch unbekannt');
});

test('Sprungziel liegt nie auf einer Bildgrenze, für 24, 25, 30 und 60 fps', () => {
  for (const fps of [24, 25, 30, 60]) {
    const abstand = 1 / fps;
    for (let k = 0; k < 900; k++) {
      const z = sprungZiel(k / FPS, 1000);
      const inBild = (z / abstand) % 1;
      if (fps === FPS || fps === 60) assert.ok(inBild > 0.05 && inBild < 0.95, `${fps} fps, Bild ${k}: ${inBild}`);
    }
    assert.ok(HINTER_GRENZE < abstand / 2);
  }
  assert.equal(sprungZiel(100, 5), 5 - 0.04, 'bleibt im Clip');
  assert.equal(sprungZiel(0, 5), HINTER_GRENZE);
});

test('Eigene Längen: Clip von Start bis Ende, Foto wie eingestellt, Clip läuft dann am Ende von vorn', () => {
  assert.equal(eigeneLaenge({ typ: 'clip', dauer: 10, start: 2, ende: 5 }), 3);
  assert.equal(eigeneLaenge({ typ: 'foto', laenge: 4 }), 4);
  assert.equal(eigeneLaenge(FOTO), FOTO_STAND);
  const p = clipPlan([{ typ: 'clip', dauer: 10, start: 2, ende: 5 }, { typ: 'foto', laenge: 4, dauer: 0, start: 0 }]);
  assert.deepEqual(p.staende, [3, 4]);
  assert.equal(clipZeit({ dauer: 10, start: 2, ende: 5 }, 0, 4), 3, 'Bereich ist 3 s, 4 % 3 = 1');
});

test('Eigene Längen gelten auch in Vorlagen, die anderen behalten den Takt', () => {
  const p = clipPlan([{ typ: 'foto', laenge: 4, eigen: true, dauer: 0, start: 0 }, FOTO, CLIP(10)], { stil: 'v-beat' });
  assert.equal(p.staende[0], 4);
  assert.equal(p.staende[1], 1);
  assert.equal(p.eigeneLaengen, true);
});

test('Rahmen: Zoom und Lage bleiben immer im Bild', () => {
  const m = rahmenAusschnitt(1920, 1080, null);
  assert.ok(Math.abs(m.x - (1920 - m.w) / 2) < 1e-9);
  const l = rahmenAusschnitt(1920, 1080, { x: 0, y: 0, zoom: 2 });
  assert.deepEqual([l.x, l.y], [0, 0]);
  const r = rahmenAusschnitt(1920, 1080, { x: 1, y: 1, zoom: 2 });
  assert.ok(Math.abs(r.x + r.w - 1920) < 1e-9 && Math.abs(r.y + r.h - 1080) < 1e-9);
  assert.ok(Math.abs(r.w - m.w / 2) < 1e-9);
});

const RASTER = Array.from({ length: 300 }, (_, k) => (k + 1) * 0.5);
for (const stil of [GANZ, ...VORLAGEN_IDS]) {
  test(`Musik, ${stil}: Jeder Schnitt liegt auf einem Schlag`, () => {
    const m = [CLIP(8), FOTO, CLIP(6), CLIP(9)];
    const p = clipPlan(m, { stil, raster: RASTER, musikRest: 120 });
    assert.ok(p.schnitte.length >= 1);
    // Der Übergang endet auf dem Schlag
    p.schnitte.forEach((s, k) => {
      const ende = s + p.uebergaenge[k] / 2;
      assert.ok(RASTER.some((r) => Math.abs(r - ende) < 1e-6), `Übergang endet bei ${ende}`);
      assert.ok(p.uebergaenge[k] <= 0.24);
    });
    for (const k of p.staende) assert.ok(k > 0);
    // Mitte des Übergangs ist der Schnitt, auch nach dem Runden auf Bilder
    p.schnitte.forEach((s, k) => {
      const mitte = p.beginn[k] + p.staende[k] + (p.uebergaenge[k] || 0) / 2;
      assert.ok(Math.abs(mitte - s) < 1e-6, `${mitte} statt ${s}`);
    });
    const z = vorlagenZustand(p, (p.bilder - 1) / FPS);
    assert.equal(z.j, null, 'endet ohne offenen Übergang');
    assert.ok(p.dauer <= REEL_MAX);
  });
}

test('Musik: Der stärkere Akzent schlägt den näheren', () => {
  const raster = [{ t: 2, s: 0.15 }, { t: 2.5, s: 0.15 }, { t: 3, s: 0.15 }, { t: 3.3, s: 1 }, { t: 3.5, s: 0.15 }, { t: 4, s: 0.15 }, { t: 8, s: 0.15 }];
  const p = clipPlan([CLIP(3.5), CLIP(5)], { stil: GANZ, raster, takt: 0.5, musikRest: 20 });
  assert.equal(p.schnitte[0], 3.3);
});

test('Musik: Der ganze Clip steht auch beim Akzent nicht über sein Ende', () => {
  const raster = [{ t: 2.5, s: 0.15 }, { t: 3.2, s: 0.15 }, { t: 3.4, s: 1 }];
  const p = clipPlan([CLIP(3.3), CLIP(5)], { stil: GANZ, raster, takt: 0.5, musikRest: 20 });
  assert.equal(p.schnitte[0], 3.2);
});

test('Musik mit fester Länge: Fotos laufen in Runden bis zum Ende, Schluss genau bei der Länge', () => {
  const p = clipPlan([CLIP(30), CLIP(30)], { stil: 'v-beat', raster: RASTER, laenge: 30, musikRest: 120 });
  assert.equal(p.dauer, 30);
  assert.ok(p.runden > 1);
});

test('Musik kürzer als das Reel: Das Reel endet mit der Musik und sagt es', () => {
  const m = [CLIP(20), CLIP(20), CLIP(20), CLIP(20)];
  const p = clipPlan(m, { stil: GANZ, raster: RASTER.filter((r) => r <= 25), musikRest: 25 });
  assert.ok(p.dauer <= 25);
  assert.equal(p.gekappt, true);
});

test('Ganzer Clip steht nicht über sein Ende hinaus', () => {
  const p = clipPlan([CLIP(2.3), CLIP(5)], { stil: GANZ, raster: RASTER, musikRest: 60 });
  assert.equal(p.schnitte[0], 2);
});

test('Musik: Ein Clip springt nie zurück, auch wenn die Vorlage länger stehen will', () => {
  const m = [CLIP(8), CLIP(1.2), CLIP(2.1), CLIP(8)];
  for (const stil of VORLAGEN_IDS) {
    const p = clipPlan(m, { stil, raster: RASTER, musikRest: 120 });
    p.staende.forEach((s, k) => {
      const gezeigt = p.vorlauf[k] + s + (p.uebergaenge[k] || 0);
      assert.ok(gezeigt <= eigeneLaenge(m[k]) + 1e-6, `${stil} Abschnitt ${k}: ${gezeigt}`);
    });
    const z = vorlagenZustand(p, (p.bilder - 1) / FPS);
    assert.equal(z.j, null);
  }
  const g = clipPlan([CLIP(2), CLIP(2)], { stil: 'v-slide', raster: Array.from({ length: 40 }, (_, k) => 0.1 + k), musikRest: 40 });
  assert.ok(g.staende[0] <= 2, `${g.staende[0]}`);
});

test('Tempoformen verbrauchen genau so viel Clip wie normales Tempo und laufen nie rückwärts', async () => {
  const { tempoForm } = await import('../src/clipreel.mjs');
  for (const art of ['normal', 'rampe', 'freeze']) {
    for (const U of [0.4, 1, 1.5, 3, 7]) {
      for (const [anfang, schluss] of [[true, true], [false, true], [true, false]]) {
        let alt = -1;
        for (let i = 0; i <= 400; i++) {
          const u = (U * i) / 400;
          const { t, rate } = tempoForm(art, u, U, { anfang, schluss });
          assert.ok(t >= alt - 1e-9, `${art} U=${U} läuft rückwärts bei ${u}`);
          assert.ok(rate >= 0 && rate < 4, `${art} Tempo ${rate}`);
          if (alt >= 0) assert.ok(t - alt <= (U / 400) * 3.5 + 1e-9, `${art} springt bei ${u}`);
          alt = t;
        }
        // Nie mehr Clip als normal, sonst liefe er über sein Ende. Mit beiden Enden genau gleich viel.
        const ende = tempoForm(art, U, U, { anfang, schluss }).t;
        assert.ok(ende <= U + 1e-9, `${art} U=${U} ${anfang}/${schluss}: ${ende}`);
        if (anfang && schluss) assert.ok(Math.abs(ende - U) < 1e-9, `${art} U=${U}: ${ende}`);
      }
    }
  }
  const r = tempoForm('rampe', 0.05, 3);
  assert.ok(r.rate < 0.5, 'Rampe beginnt langsam');
  assert.ok(tempoForm('rampe', 2.98, 3).rate > 1.5, 'Rampe endet schnell');
  assert.equal(tempoForm('freeze', 0.1, 3).rate, 0, 'Freeze steht am Anfang');
});

test('Gesetzte Schnitte gelten, bleiben aber im erlaubten Bereich', () => {
  const raster = Array.from({ length: 40 }, (_, i) => 0.5 * (i + 1));
  const m = [{ typ: 'foto' }, { typ: 'foto' }, { typ: 'foto' }];
  const auto = clipPlan(m, { stil: GANZ, raster, takt: 0.5, musikRest: 20 });
  const fest = [3.5];
  const p = clipPlan(m, { stil: GANZ, raster, takt: 0.5, musikRest: 20, fest });
  assert.notEqual(auto.schnitte[0] + auto.uebergaenge[0] / 2, 3.5);
  assert.ok(Math.abs(p.schnitte[0] + p.uebergaenge[0] / 2 - 3.5) < 1e-9);
  // Ein Clip kann nicht über sein Ende gezogen werden
  const c = clipPlan([{ typ: 'clip', dauer: 2, start: 0 }, { typ: 'foto' }], { stil: GANZ, raster, takt: 0.5, musikRest: 20, fest: [5] });
  assert.ok(c.schnitte[0] + c.uebergaenge[0] / 2 <= 2 + 1e-9);
  // Zu früh geht auch nicht
  const f = clipPlan(m, { stil: GANZ, raster, takt: 0.5, musikRest: 20, fest: [0.01] });
  assert.ok(f.schnitte[0] > 0);
});
