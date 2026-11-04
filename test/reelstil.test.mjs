// Reel-Stile: Dauer, Bildanzahl, Standzeit und Übergänge, Vorschlag mit weniger Fotos, Stilauswahl, Ausschnitt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STILE, ZEITEN, stilPlan, zustand, stileFuer, reelAusschnitt, lage, nahtGrenze, teilzeiten, FPS, RAHMEN } from '../src/reelstil.mjs';
import { REEL_LAENGEN } from '../src/kennzahlen.mjs';

test('Dauer und Bildanzahl stimmen für jeden Stil und jede Länge, jedes Foto kommt vor, das Ende ist das letzte Foto', () => {
  for (const stil of Object.keys(ZEITEN)) {
    for (const laenge of REEL_LAENGEN) {
      for (const n of [2, 3, 6, 10]) {
        const p = stilPlan(n, { laenge, stil });
        assert.equal(p.dauer, laenge);
        assert.equal(p.bilder, laenge * FPS);
        assert.ok(Math.abs(n * p.stand + (n - 1) * p.uebergang - laenge) < 1e-9, 'Stand und Übergänge füllen die Länge');
        const gesehen = new Set();
        let uebergaenge = 0;
        let vorher = null;
        for (let k = 0; k < p.bilder; k++) {
          const z = zustand(p, k / FPS);
          gesehen.add(z.i);
          if (z.j != null) gesehen.add(z.j);
          if (z.j != null && vorher?.j == null) uebergaenge++;
          vorher = z;
        }
        assert.equal(gesehen.size, n, `${stil} ${laenge} s ${n}: alle Fotos`);
        assert.equal(uebergaenge, n - 1, `${stil}: ${n - 1} Übergänge`);
        const erstes = zustand(p, 0);
        const letztes = zustand(p, (p.bilder - 1) / FPS);
        assert.deepEqual([erstes.i, erstes.j], [0, null]);
        assert.deepEqual([letztes.i, letztes.j], [n - 1, null], 'endet auf dem letzten Foto');
      }
    }
  }
});

test('Zu kurz: Der Plan schlägt die größte Fotoanzahl vor, die noch passt', () => {
  for (const stil of Object.keys(ZEITEN)) {
    for (const laenge of REEL_LAENGEN) {
      const p = stilPlan(80, { laenge, stil });
      assert.ok(p.zuKurz, `${stil} ${laenge} s mit 80 Fotos ist zu kurz`);
      const m = p.maxFotos;
      assert.ok(!stilPlan(m, { laenge, stil }).zuKurz, `${stil} ${laenge}: ${m} Fotos passen`);
      assert.ok(stilPlan(m + 1, { laenge, stil }).zuKurz, `${stil} ${laenge}: ${m + 1} Fotos nicht mehr`);
      assert.ok(stilPlan(m, { laenge, stil }).stand >= ZEITEN[stil].standMin - 1e-9);
    }
  }
  assert.equal(stilPlan(3, { laenge: 15, stil: 'sanft' }).zuKurz, false);
});

test('Stilauswahl: mit WebCodecs alle fünf, im Ausweichweg nur, was in Echtzeit sauber geht', () => {
  assert.deepEqual(STILE, ['band', 'sanft', 'schwung', 'zoom', 'naht']);
  assert.deepEqual(stileFuer({ art: 'webcodecs' }), STILE);
  const echtzeit = stileFuer({ art: 'recorder', typ: 'video/mp4' });
  assert.ok(echtzeit.includes('band') && echtzeit.includes('sanft'));
  assert.ok(!echtzeit.includes('schwung') && !echtzeit.includes('naht'));
  assert.deepEqual(stileFuer(null), []);
});

test('Ausschnitt 9:16 folgt der Motivkarte und bleibt im Foto', () => {
  const b = 2160;
  const profil = new Float32Array(200);
  for (let k = 160; k < 190; k++) profil[k] = 1; // Motiv rechts
  const a = reelAusschnitt(b, profil);
  assert.ok(Math.abs(a.w - (1620 * 9) / 16) < 1e-9);
  assert.ok(a.x0 >= 0 && a.x0 + a.w <= b);
  assert.ok(a.x0 + a.w >= (190 / 200) * b - 1, `Motiv im Ausschnitt: ${a.x0}..${a.x0 + a.w}`);
  assert.equal(reelAusschnitt(b).x0, (b - a.w) / 2, 'ohne Motiv die Mitte');
});

test('Bewegungen: Sanft zoomt leicht, Schwung schiebt genau einen Rahmen, Zoom kommt aus der Tiefe, Naht läuft durch', () => {
  const p = stilPlan(3, { laenge: 15, stil: 'sanft' });
  const s0 = lage('sanft', zustand(p, 0)).aktuell.s;
  const s1 = lage('sanft', zustand(p, p.stand)).aktuell.s;
  assert.ok(s0 >= 1 && s1 > s0 && s1 <= 1.06 + 1e-9);
  const q = stilPlan(3, { laenge: 15, stil: 'schwung' });
  const mitte = lage('schwung', zustand(q, q.stand + q.uebergang / 2));
  assert.ok(Math.abs(mitte.naechstes.dx - mitte.aktuell.dx - RAHMEN.w) < 1e-9, 'beide Fotos liegen lückenlos nebeneinander');
  const z = stilPlan(3, { laenge: 15, stil: 'zoom' });
  const anfang = lage('zoom', zustand(z, z.stand + 0.01));
  const fast = lage('zoom', zustand(z, z.stand + z.uebergang - 0.001));
  assert.ok(anfang.naechstes.s < 0.6 && fast.naechstes.s > 0.99 && fast.naechstes.alpha > 0.99);
  const pfad = Array.from({ length: 1620 }, (_, y) => 180 + 40 * Math.sin(y / 200));
  const start = nahtGrenze(pfad, 0);
  const ende = nahtGrenze(pfad, 1);
  assert.ok(start.every((pt) => pt.x > RAHMEN.w), 'am Anfang ganz rechts außerhalb');
  assert.ok(ende.every((pt) => pt.x < 0), 'am Ende ganz links außerhalb');
  const form = start.map((pt) => pt.x);
  assert.ok(Math.max(...form) - Math.min(...form) > 50, 'die Grenze hat die Form der echten Naht');
  assert.equal(teilzeiten(1, 8).length, 8);
});
