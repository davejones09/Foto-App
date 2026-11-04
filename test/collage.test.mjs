// Collage: Vorlagen, Felder, Ausschnitte ohne leere Bereiche, Motivvorschlag, Nähte und Drehen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VORLAGEN, vorlagenFuer, feldRechtecke, zerlege, baum, ausschnitt, bewege, vorschlag, motivRaster,
  feldBei, drehe, zurueckDrehen, masse, belege, FOTOS_MIN, FOTOS_MAX, ZOOM_MAX,
} from '../src/collage.mjs';

test('Mindestens 12 Vorlagen, für jede Anzahl von 2 bis 9, jede füllt die Fläche lückenlos', () => {
  assert.ok(VORLAGEN.length >= 12, `${VORLAGEN.length} Vorlagen`);
  assert.equal(new Set(VORLAGEN.map((v) => v.id)).size, VORLAGEN.length, 'eindeutige Namen');
  for (let n = FOTOS_MIN; n <= FOTOS_MAX; n++) assert.ok(vorlagenFuer(n).length >= 2, `zu ${n} Fotos`);
  const arten = VORLAGEN.map((v) => v.id);
  assert.ok(arten.some((a) => /raster|spalten|zeilen/.test(a)) && arten.some((a) => /gross/.test(a)) && arten.some((a) => /versetzt|mosaik/.test(a)));
  for (const v of VORLAGEN) {
    assert.equal(v.felder.length, v.n, v.id);
    // auf einem feinen Raster: jeder Punkt liegt in genau einem Feld
    for (let y = 0.0125; y < 1; y += 0.025) for (let x = 0.0125; x < 1; x += 0.025) {
      const treffer = v.felder.filter(([fx, fy, fw, fh]) => x > fx && x < fx + fw && y > fy && y < fy + fh).length;
      assert.equal(treffer, 1, `${v.id} bei ${x.toFixed(3)}, ${y.toFixed(3)}`);
    }
  }
});

test('Formate 4:5, 1:1 und 9:16 bei 2160 Pixeln Breite', () => {
  assert.deepEqual(masse('4:5'), { w: 2160, h: 2700 });
  assert.deepEqual(masse('1:1'), { w: 2160, h: 2160 });
  assert.deepEqual(masse('9:16'), { w: 2160, h: 3840 });
});

test('Mit Rahmen: gleicher Abstand zwischen den Feldern und am Rand, alles in der Fläche', () => {
  const v = VORLAGEN.find((x) => x.id === 'z4-raster');
  const r = feldRechtecke(v, 2160, 2700, { abstand: 0.02 });
  const a = Math.round(0.02 * 2160);
  assert.equal(r[0].x, a);
  assert.equal(r[0].y, a);
  assert.equal(r[1].x - (r[0].x + r[0].w), a);
  assert.equal(r[2].y - (r[0].y + r[0].h), a);
  assert.equal(2160 - (r[1].x + r[1].w), a);
  const ohne = feldRechtecke(v, 2160, 2700);
  assert.deepEqual(ohne[3], { x: 1080, y: 1350, w: 1080, h: 1350 });
  assert.equal(feldBei(ohne, 1500, 100), 1);
  assert.equal(feldBei(r, a / 2, a / 2), -1, 'im Rahmen liegt kein Feld');
});

test('Ausschnitt: immer hineingezoomt, nie leere Bereiche, egal wohin geschoben', () => {
  for (const [pw, ph] of [[4000, 3000], [3000, 4000], [1000, 1000]]) {
    for (const [fw, fh] of [[1080, 1350], [2160, 900], [700, 2000]]) {
      for (const t of [{ x: -5, y: 9, zoom: 0.2 }, { x: 0.5, y: 0.5, zoom: 1 }, { x: 0.99, y: 0.01, zoom: 3 }, { x: 0.3, y: 0.7, zoom: 99 }]) {
        const a = ausschnitt(pw, ph, fw, fh, t);
        assert.ok(a.sx >= -1e-6 && a.sy >= -1e-6 && a.sx + a.sw <= pw + 1e-6 && a.sy + a.sh <= ph + 1e-6, `im Foto ${pw}x${ph} ${fw}x${fh} ${JSON.stringify(t)}`);
        assert.ok(Math.abs(a.sw / a.sh - fw / fh) < 1e-6, 'Seitenverhältnis des Felds');
        assert.ok(a.t.zoom >= 1 && a.t.zoom <= ZOOM_MAX);
      }
    }
  }
  // Verschieben bleibt im Foto, Zoomen nicht unter 1
  let t = { x: 0.5, y: 0.5, zoom: 1 };
  t = bewege(4000, 3000, 1080, 1350, t, { dx: 100000 });
  assert.ok(Math.abs(ausschnitt(4000, 3000, 1080, 1350, t).sx) < 1e-6, 'ganz nach rechts geschoben zeigt den linken Rand');
  t = bewege(4000, 3000, 1080, 1350, t, { faktor: 0.1 });
  assert.equal(t.zoom, 1);
});

test('Vorschlag aus der Motivkarte: das Motiv liegt im Feld', () => {
  // Motiv ganz rechts in einem Querformat, Feld hochkant: der Ausschnitt rückt nach rechts
  const w = 64;
  const h = 48;
  const sal = new Float32Array(w * h);
  for (let y = 10; y < 30; y++) for (let x = 52; x < 62; x++) sal[y * w + x] = 1;
  const raster = motivRaster({ w, h, sal });
  const t = vorschlag(4000, 3000, 1080, 1350, raster);
  const a = ausschnitt(4000, 3000, 1080, 1350, t);
  assert.ok(a.sx + a.sw > 4000 * (60 / 64), `Motiv im Feld: ${a.sx}..${a.sx + a.sw}`);
  assert.deepEqual(vorschlag(4000, 3000, 1080, 1350, null), { x: 0.5, y: 0.5, zoom: 1 });
});

test('Nahtlos: jede Vorlage lässt sich durchgehend schneiden, Bereiche bleiben in der Fläche', () => {
  for (const v of VORLAGEN) {
    for (const [W, H] of [[2160, 2700], [2160, 2160], [2160, 3840], [540, 675]]) {
      const r = feldRechtecke(v, W, H);
      const z = zerlege(r, W, H);
      assert.equal(z.schnitte.length, v.n - 1, `${v.id}: n − 1 Schnitte`);
      for (const s of z.schnitte) assert.ok(s.breite >= 16 && s.breite <= 362 && s.breite % 2 === 0, `${v.id} Breite ${s.breite}`);
      z.bereiche.forEach((e, i) => {
        assert.ok(e.x >= 0 && e.y >= 0 && e.x + e.w <= W + 1e-9 && e.y + e.h <= H + 1e-9, `${v.id} Bereich ${i}`);
        assert.ok(e.x <= r[i].x && e.y <= r[i].y && e.x + e.w >= r[i].x + r[i].w && e.y + e.h >= r[i].y + r[i].h, `${v.id}: Bereich umfasst das Feld ${i}`);
      });
    }
  }
  // Raster aus vier Feldern: ein durchgehender Schnitt, dann je einer in jeder Hälfte
  const r = feldRechtecke(VORLAGEN.find((x) => x.id === 'z4-raster'), 2160, 2700);
  const b = baum(r);
  assert.ok(b.art === 'v' || b.art === 'h');
  const z = zerlege(r, 2160, 2700);
  const lang = z.schnitte[0];
  assert.equal(lang.bis - lang.von, lang.art === 'v' ? 2700 : 2160, 'der erste Schnitt geht durch die ganze Fläche');
});

test('Drehen und zurückdrehen ergibt wieder dasselbe Bild', () => {
  const b = { w: 5, h: 3, d: new Uint8ClampedArray(60).map((_, i) => i * 3) };
  const g = drehe(b);
  assert.equal(g.w, 3);
  assert.equal(g.h, 5);
  assert.deepEqual(zurueckDrehen(g).d, b.d);
});

test('Belegen einer neuen Vorlage behält die Zuordnung', () => {
  const fotos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const v = vorlagenFuer(3)[1];
  const f = belege(fotos, v, [{ foto: 'c' }, { foto: 'a' }]);
  assert.deepEqual(f.map((x) => x.foto), ['c', 'a', 'b']);
});
