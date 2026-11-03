import test from 'node:test';
import assert from 'node:assert/strict';
import { bandBreite, stuecke, stueckeIm, HALT_B, UEBER } from '../src/masse.mjs';
import { begrenze, deckt, STANDARD } from '../src/geometrie.mjs';

test('Bandbreite: zwei Halte ergeben 2229 Pixel', () => {
  assert.equal(bandBreite(2), 2229);
  assert.equal(bandBreite(1), 1296);
  assert.equal(bandBreite(0), 0);
});

test('Stücke liegen lückenlos und ohne Überlappung hintereinander', () => {
  for (const n of [1, 2, 3, 7, 50]) {
    const s = stuecke(n);
    let x = 0;
    for (const st of s) {
      assert.equal(st.x, x, `n=${n} ${JSON.stringify(st)}`);
      x += st.sw;
      if (st.art === 'naht') assert.equal(st.sw, UEBER);
      assert.ok(st.sx >= 0 && st.sx + st.sw <= HALT_B);
    }
    assert.equal(x, bandBreite(n));
  }
});

test('stueckeIm findet nur berührte Stücke', () => {
  const s = stueckeIm(5, 1000, 1100);
  assert.ok(s.length >= 1);
  for (const st of s) assert.ok(st.x < 1100 && st.x + st.sw > 1000);
});

test('Standard-Transformation deckt jedes Seitenverhältnis', () => {
  for (const [w, h] of [[3840, 2160], [2160, 3840], [1000, 1000], [6000, 4000], [1296, 1620]]) {
    assert.ok(deckt(STANDARD, w, h), `${w}x${h}`);
  }
});

test('begrenze hält Rand, Zoom und Drehung ein', () => {
  const t = begrenze({ dx: 5000, dy: -5000, zoom: 3, drehung: 20 }, 2160, 3840);
  assert.ok(t.zoom <= 2.2 && t.zoom >= 1);
  assert.equal(t.drehung, 8);
  assert.ok(deckt(t, 2160, 3840));
  const g = begrenze({ dx: 0, dy: 0, zoom: 1, drehung: 8 }, 1296, 1620);
  assert.ok(g.zoom > 1, 'Drehung braucht mehr Zoom');
  assert.ok(deckt(g, 1296, 1620));
  const frei = begrenze({ dx: 100, dy: 0, zoom: 1, drehung: 0 }, 3840, 2160);
  assert.ok(frei.dx > 99, 'Querformat lässt seitlich Platz');
});
