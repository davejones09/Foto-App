import test from 'node:test';
import assert from 'node:assert/strict';
import { kennzahlen, karussellAnzahl, beitraege, fahrtPlan, gesamtGroesse, TEMPI, FAHRT_B } from '../src/kennzahlen.mjs';
import { bandBreite } from '../src/masse.mjs';

test('Kennzahlen: Durchschnitt zählt nur Passungen ab dem zweiten Foto', () => {
  const h = [{ index: 0, wert: null }, { index: 1, wert: 90 }, { index: 2, wert: 50 }, { index: 3, wert: 70 }, { index: 4, wert: 10 }];
  assert.deepEqual(kennzahlen(h), { n: 5, anschluesse: 4, schnitt: 55 });
  assert.deepEqual(kennzahlen([{ index: 0, wert: null }]), { n: 1, anschluesse: 0, schnitt: null });
});

test('Carousel: Anzahl und Aufteilung in Beiträge', () => {
  assert.equal(karussellAnzahl(1), 1);
  assert.equal(karussellAnzahl(2), 1, 'zwei Kamerafotos: 2 Slides bräuchten 16 % Zoom, also eine Slide');
  assert.equal(karussellAnzahl(3), 2);
  assert.ok(karussellAnzahl(27) <= 20, 'etwa 27 Fotos passen in einen Beitrag');
  assert.ok(karussellAnzahl(28) <= 21);
  assert.deepEqual(beitraege(7), [[0, 7]]);
  assert.deepEqual(beitraege(25), [[0, 13], [13, 25]]);
  for (const n of [1, 20, 21, 40, 41, 77]) {
    const b = beitraege(n);
    assert.equal(b[0][0], 0);
    assert.equal(b[b.length - 1][1], n);
    for (const [a, e] of b) assert.ok(e - a <= 20 && e > a);
  }
});

test('Fahrt: Bewegung ist stetig, endet am Bandende und hat die angezeigte Länge', () => {
  for (const n of [1, 2, 5, 50]) {
    for (const v of TEMPI) {
      const p = fahrtPlan(n, v);
      assert.ok(Math.abs(p.weg - Math.max(0, bandBreite(n) * (1920 / 1620) - FAHRT_B)) < 1e-6);
      assert.equal(p.x(0), 0);
      assert.ok(Math.abs(p.x(p.dauer) - p.weg) < 1e-6);
      let alt = 0;
      for (let t = 0; t <= p.dauer; t += 1 / 30) {
        const x = p.x(t);
        assert.ok(x >= alt - 1e-9, 'nie rückwärts');
        assert.ok(x - alt <= v / 30 + 1e-6, `nie schneller als das Tempo: ${x - alt}`);
        alt = x;
      }
    }
  }
  assert.ok(fahrtPlan(10, 220).dauer > fahrtPlan(10, 900).dauer);
});

test('Gesamtbild: verkleinert nur, wenn es nötig ist', () => {
  const klein = gesamtGroesse(3, 16_777_216);
  assert.equal(klein.verkleinert, false);
  assert.equal(klein.b, bandBreite(3));
  const gross = gesamtGroesse(50, 16_777_216);
  assert.ok(gross.verkleinert);
  assert.ok(gross.b * gross.h <= 16_777_216);
  assert.ok(Math.abs(gross.b / gross.h / (bandBreite(50) / 1620) - 1) < 0.005);
});

import { reelPlan, abschnittBereich, REEL_LAENGEN, REEL_MAX_TEMPO, FAHRT_FPS as FPS } from '../src/kennzahlen.mjs';

test('Reel: Länge bestimmt das Tempo, Dauer und Bildzahl stimmen', () => {
  for (const laenge of REEL_LAENGEN) {
    const p = reelPlan(10, { laenge });
    assert.equal(p.dauer, laenge);
    assert.equal(p.bilder, laenge * FPS);
    assert.ok(Math.abs(p.xBand(p.bewegung) - (p.x1 - p.sicht)) < 1e-6, 'endet am Abschnittsende, auf dem letzten Bild');
    assert.equal(p.bewegung, laenge, 'kein Abspann');
  }
  assert.ok(reelPlan(10, { laenge: 15 }).tempo > reelPlan(10, { laenge: 90 }).tempo, 'kürzer heißt schneller');
});

test('Reel: ab dem ersten Bild in Bewegung, nur das Ende läuft weich aus', () => {
  const p = reelPlan(8, { laenge: 30 });
  const v = (t) => (p.xBand(t + 1 / FPS) - p.xBand(t)) * p.f * FPS; // Pixel je Sekunde im Video
  assert.equal(p.xBand(0), p.x0);
  assert.ok(Math.abs(v(0) - p.tempo) < 1, `Start mit vollem Tempo: ${v(0)} / ${p.tempo}`);
  assert.ok(Math.abs(v(p.bewegung / 2) - p.tempo) < 1, 'gleichmäßig in der Mitte');
  assert.ok(v(p.bewegung - 1 / FPS) < p.tempo * 0.05, 'bremst bis fast null');
  let alt = p.xBand(0);
  for (let t = 1 / FPS; t <= p.dauer; t += 1 / FPS) {
    const x = p.xBand(t);
    assert.ok(x >= alt - 1e-9);
    assert.ok((x - alt) * p.f <= p.tempo / FPS + 1e-6, 'nie schneller als das Tempo');
    alt = x;
  }
});

test('Reel: Abschnitt von bis Halt und Vorschlag bei zu hohem Tempo', () => {
  assert.deepEqual(abschnittBereich(3, 0, 0), { x0: 0, x1: 1296 });
  assert.deepEqual(abschnittBereich(5, 2, 4), { x0: 2 * 933, x1: 4 * 933 + 1296 });
  // Gemischte Breiten: Serienhalte behalten ihr Seitenverhältnis
  const br = [1296, 2160, 1134, 3240];
  assert.deepEqual(abschnittBereich(br, 1, 2), { x0: 933, x1: 933 + (2160 - 363) + 1134 });
  const gemischt = reelPlan(br, { laenge: 30 });
  assert.ok(Math.abs(gemischt.xBand(gemischt.bewegung) + gemischt.sicht - (1296 + 2160 + 1134 + 3240 - 3 * 363)) < 1e-6, 'endet am Bandende');
  const p = reelPlan(20, { von: 3, bis: 7, laenge: 30 });
  assert.equal(p.x0, 3 * 933);
  assert.ok(Math.abs(p.xBand(p.bewegung) + p.sicht - (7 * 933 + 1296)) < 1e-6);
  const schnell = reelPlan(50, { laenge: 15 });
  assert.ok(schnell.zuSchnell && schnell.tempo > REEL_MAX_TEMPO);
  const v = schnell.vorschlag;
  assert.equal(v.von, 0);
  assert.ok(!reelPlan(50, { von: v.von, bis: v.bis, laenge: 15 }).zuSchnell, 'Vorschlag ist langsam genug');
  assert.ok(reelPlan(50, { von: v.von, bis: v.bis + 1, laenge: 15 }).zuSchnell, 'Vorschlag ist der längste mögliche');
  assert.equal(reelPlan(50, { laenge: 90 }).zuSchnell, false);
  assert.equal(reelPlan(5, { laenge: 15 }).vorschlag, null);
});

import { karussellPlan, karussellGrund, bandProfil, slideAusschnitt, KARUSSELL_VERSATZ_MAX, KARUSSELL_ZOOM_MAX } from '../src/kennzahlen.mjs';
import { motivKarte, spaltenProfil, skaliere } from '../src/serie.mjs';

// Jede Slide liegt vollständig im Band: keine leere Fläche, keine Abschluss-Slide.
function pruefeVoll(plan, B, text = '') {
  assert.ok(plan.versatz >= -1e-6, `${text} Versatz ${plan.versatz}`);
  const letzte = slideAusschnitt(plan, plan.anzahl - 1);
  assert.ok(letzte.x0 + letzte.w <= B + 1e-6, `${text} letzte Slide endet bei ${letzte.x0 + letzte.w} von ${B}`);
  assert.ok(plan.y0 >= -1e-6 && plan.y0 + plan.hoehe <= 1620 + 1e-6, `${text} Höhe`);
  assert.ok(Math.abs(plan.sicht * 1620 / 1296 - plan.hoehe) < 1e-6, `${text} Seitenverhältnis 4:5`);
}

test('Carousel geht genau in ganze Slides auf: erst bis 8 % Zoom, sonst Beschnitt an den Enden', () => {
  // Zoom reicht: 3700 Pixel werden mit 5,1 % Zoom genau drei Slides, nichts fällt seitlich weg
  const z = karussellPlan([3700]);
  assert.equal(z.anzahl, 3);
  assert.ok(Math.abs(z.zoom - 3888 / 3700) < 1e-9);
  assert.equal(z.versatz, 0);
  assert.ok(Math.abs(z.anzahl * z.sicht - 3700) < 1e-6, 'Band geht genau auf');
  assert.ok(Math.abs(z.y0 - (1620 - 1620 / z.zoom) / 2) < 1e-9, 'oben und unten gleich viel');
  // Zoom reicht nicht: drei Slides mit 212 Pixeln Beschnitt, je zur Hälfte am Anfang und Ende
  const r = karussellPlan([4100]);
  assert.equal(r.anzahl, 3);
  assert.equal(r.zoom, 1);
  assert.equal(r.versatz, 106);
  // Kürzer als eine Slide: eine Slide, so groß wie nötig
  const k = karussellPlan([1134]);
  assert.equal(k.anzahl, 1);
  assert.ok(Math.abs(k.zoom - 1296 / 1134) < 1e-9);
  // Viele Breiten: immer voll, Zoom höchstens 8 %, und die Wahl kostet am wenigsten Bild
  let s = 7;
  const zufall = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 300; i++) {
    const breiten = Array.from({ length: 1 + Math.floor(zufall() * 12) }, () => Math.round(1134 + zufall() * (3240 - 1134)));
    const B = bandBreite(breiten);
    const plan = karussellPlan(breiten);
    pruefeVoll(plan, B, `Breiten ${breiten}`);
    if (B >= 1296 / KARUSSELL_ZOOM_MAX) assert.ok(plan.zoom <= KARUSSELL_ZOOM_MAX + 1e-9, `Zoom ${plan.zoom}`);
    const g = karussellGrund(B);
    for (let n = 1; n <= Math.ceil(B / 1296); n++) {
      const zn = Math.max(1, (n * 1296) / B);
      if (zn <= KARUSSELL_ZOOM_MAX) assert.ok((n * 1296) / (B * zn * zn) <= g.sichtbar + 1e-9, `n=${n} wäre besser als ${g.n}`);
    }
  }
});

test('Carousel: Motiv auf einer Slide-Grenze rückt durch den Versatz in eine Slide', () => {
  const br = [1296, 2160, 1296];
  const B = bandBreite(br);
  const grund = karussellPlan(br);
  // Profil mit Motiv genau auf der ersten Grenze des Grundplans
  const mitte = grund.grenzen[0];
  const p = new Float32Array(Math.ceil(B / 4));
  for (let x = Math.round(mitte) - 70; x < mitte + 70; x++) p[Math.floor(x / 4)] = 1;
  const plan = karussellPlan(br, p);
  assert.equal(plan.anzahl, grund.anzahl, 'Bildanzahl bleibt');
  pruefeVoll(plan, B);
  assert.ok(plan.zoom <= KARUSSELL_ZOOM_MAX);
  for (const g of plan.grenzen) assert.ok(g < mitte - 70 - 30 || g > mitte + 70 + 30, `Grenze ${g} trifft das Motiv`);
  assert.equal(plan.treffer.length, 0);
  assert.ok(plan.verlust - grund.verlust <= KARUSSELL_VERSATZ_MAX * 1296 / B + 0.02, 'kostet wenig zusätzliches Bild');
  // Ohne Motiv: mittig beschnitten wie der Grundplan
  assert.equal(karussellPlan(br, new Float32Array(p.length)).versatz, grund.versatz);
  assert.equal(karussellPlan(br, null).versatz, (B - grund.anzahl * 1296) / 2);
  // Zu breites Motiv: Grenze lässt sich nicht vermeiden, wird gemeldet
  const breit = new Float32Array(p.length).fill(1);
  const r = karussellPlan(br, breit);
  assert.ok(r.treffer.length >= 1);
  assert.equal(r.anzahl, grund.anzahl);
  pruefeVoll(r, B);
});

test('Carousel: echtes Motiv aus der Motivkarte zweier Fotos, nach dem Versatz in einer Slide', () => {
  // Zwei Halte, 1296 und 2160 breit. Ein scharfes Motiv sitzt im zweiten Halt so, dass es im Band auf 1296 liegt.
  const br = [1296, 2160];
  const halt = (w, motivBandX, start) => {
    const W = Math.round(640 * w / Math.max(w, 1620));
    const H = Math.round(640 * 1620 / Math.max(w, 1620));
    const d = new Uint8ClampedArray(W * H * 4);
    const mx = ((motivBandX - start) / w) * W;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let f = [140, 170, 200];
      if (Math.abs(x - mx) < W * 0.03 && Math.abs(y - H * 0.45) < H * 0.08) f = ((x >> 1) + (y >> 1)) % 2 ? [240, 230, 210] : [20, 20, 30];
      const i = (y * W + x) * 4;
      d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255;
    }
    return { w: W, h: H, d };
  };
  const profile = [spaltenProfil(motivKarte(halt(1296, -9999, 0))), spaltenProfil(motivKarte(halt(2160, 1296, 933)))];
  const p = bandProfil(br, profile);
  const plan = karussellPlan(br, p);
  // Wo liegt das Motiv im Band?
  let von = Infinity;
  let bis = -Infinity;
  let max = 0;
  for (const v of p) max = Math.max(max, v);
  p.forEach((v, k) => { if (v > 0.2 * max) { von = Math.min(von, k * 4); bis = Math.max(bis, k * 4 + 4); } });
  assert.ok(von < 1296 && bis > 1296, `Motiv liegt auf der Grenze: ${von}..${bis}`);
  for (const g of plan.grenzen) assert.ok(g <= von || g >= bis, `Grenze ${g} im Motiv ${von}..${bis}`);
  const slide = Math.floor((von - plan.versatz) / plan.sicht);
  assert.equal(Math.floor((bis - 1 - plan.versatz) / plan.sicht), slide, 'ganzes Motiv auf einer Slide');
  pruefeVoll(plan, bandBreite(br));
});
