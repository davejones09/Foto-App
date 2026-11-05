// Reel aus Clips: Zeitplan und Stelle im Clip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clipPlan, clipZeit, clipStellen, clipBewegung, gleichesBild, sprungZiel, HINTER_GRENZE, deckAusschnitt, GANZ, REEL_MAX, FOTO_STAND } from '../src/clipreel.mjs';
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
