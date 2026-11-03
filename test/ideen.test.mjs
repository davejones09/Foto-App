// Ideen für den nächsten Halt: Merkmale, Auswahl, keine Wiederholung, Kontrast, Richtung.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDEEN, ORTE, restMerkmale, beschreibung, waehleIdee, monotonie, tageszeit, farbKlasse, richtung } from '../src/ideen.mjs';

// Rest als Bild: Linie bei y (links) bis y2 (rechts), oben und unten je eine Farbe.
function rest({ w = 91, h = 405, y, y2 = y, oben, unten }) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let py = 0; py < h; py++) for (let x = 0; x < w; x++) {
    const linie = (y + (y2 - y) * (x / (w - 1))) * h;
    const f = py < linie ? oben : unten;
    const i = (py * w + x) * 4;
    d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255;
  }
  return { w, h, d };
}

const HELL = [225, 230, 235];
const DUNKEL = [40, 35, 30];
const merk = (bild, extra = {}) => ({ ...restMerkmale(bild), zeit: 'tag', ort: null, monoton: null, ...extra });

test('Mindestens 60 Ideen, eindeutig, im Ton der App und sauber getaggt', () => {
  assert.ok(IDEEN.length >= 60, `${IDEEN.length} Ideen`);
  assert.equal(new Set(IDEEN.map((i) => i.id)).size, IDEEN.length);
  const farben = ['hell', 'dunkel', 'blau', 'gruen', 'warm', 'grau'];
  for (const i of IDEEN) {
    assert.match(i.text, /[.]$/, i.id);
    assert.ok(!/[!]/.test(i.text), `kein Ausrufezeichen: ${i.id}`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(i.text), `kein Emoji: ${i.id}`);
    if (i.h) assert.ok(['oben', 'mitte', 'unten'].includes(i.h), i.id);
    if (i.n) assert.ok(['steigt', 'faellt'].includes(i.n), i.id);
    for (const t of [i.ob, i.un, i.gegen]) if (t) assert.ok(farben.includes(t), i.id);
    for (const o of i.ort || []) assert.ok(ORTE.includes(o), i.id);
  }
  for (const o of ORTE) assert.ok(IDEEN.filter((i) => i.ort?.includes(o)).length >= 5, `genug Ideen für ${o}`);
});

test('Merkmale: Linie auf halber Höhe, oben hell, unten dunkel', () => {
  const m = merk(rest({ y: 0.5, oben: HELL, unten: DUNKEL }));
  assert.equal(m.hoehe, 'mitte');
  assert.equal(m.staerke, 'stark');
  assert.equal(m.neigung, 'flach');
  assert.equal(beschreibung(m), 'Linie auf halber Höhe, oben hell, unten dunkel.');
  const r = waehleIdee({ ...m, ort: 'essen' }, { zufall: () => 0 });
  assert.equal(r.satz, 'Linie auf halber Höhe, oben hell, unten dunkel. Versuch\'s mit einer Tischkante vor einer hellen Wand.');
});

test('Merkmale: Höhe und Neigung', () => {
  assert.equal(merk(rest({ y: 0.25, oben: HELL, unten: DUNKEL })).hoehe, 'oben');
  assert.equal(merk(rest({ y: 0.8, oben: HELL, unten: DUNKEL })).hoehe, 'unten');
  const steigt = merk(rest({ y: 0.6, y2: 0.4, oben: HELL, unten: DUNKEL }));
  assert.equal(steigt.neigung, 'steigt', `Winkel ${steigt.winkel}`);
  assert.equal(merk(rest({ y: 0.4, y2: 0.6, oben: HELL, unten: DUNKEL })).neigung, 'faellt');
  const flaeche = merk(rest({ y: 0.5, oben: [120, 160, 210], unten: [121, 160, 210] }));
  assert.equal(flaeche.staerke, 'keine');
  assert.equal(beschreibung(flaeche), 'Kaum Linien im Rest, nur Fläche.');
  assert.ok(waehleIdee(flaeche).idee.st === 'keine' || waehleIdee(flaeche).idee.allg);
});

test('Auswahl passt zu Ort, Höhe, Neigung und Tageszeit', () => {
  const basis = merk(rest({ y: 0.5, oben: HELL, unten: DUNKEL }));
  for (const ort of ORTE) {
    for (const zeit of ['morgen', 'tag', 'abend', 'nacht']) {
      const benutzt = new Set();
      for (let k = 0; k < 8; k++) {
        const r = waehleIdee({ ...basis, ort, zeit }, { benutzt });
        const i = r.idee;
        if (i.ort) assert.ok(i.ort.includes(ort), `${i.id} passt nicht zu ${ort}`);
        if (i.zeit) assert.ok(i.zeit.includes(zeit), `${i.id} passt nicht zu ${zeit}`);
        if (i.h) assert.equal(i.h, 'mitte', i.id);
        assert.ok(!i.n, `keine Schräge bei flacher Linie: ${i.id}`);
        benutzt.add(i.id);
      }
    }
  }
  const steigt = merk(rest({ y: 0.6, y2: 0.4, oben: HELL, unten: DUNKEL }), { ort: 'natur' });
  assert.equal(waehleIdee(steigt, { zufall: () => 0 }).idee.n, 'steigt');
});

test('Andere Idee: keine Wiederholung, bis alle passenden durch sind', () => {
  const m = merk(rest({ y: 0.5, oben: HELL, unten: DUNKEL }), { ort: 'stadt' });
  const benutzt = new Set();
  const gesehen = [];
  let erste = null;
  for (let k = 0; k < 200; k++) {
    const r = waehleIdee(m, { benutzt, zufall: () => 0.42 });
    if (!erste) erste = r.passend.length;
    if (r.neueRunde) { benutzt.clear(); break; }
    assert.ok(!benutzt.has(r.idee.id), `Wiederholung: ${r.idee.id}`);
    benutzt.add(r.idee.id);
    gesehen.push(r.idee.id);
  }
  assert.equal(gesehen.length, erste, 'jede passende Idee kam genau einmal');
  assert.ok(gesehen.length >= 8, `${gesehen.length} passende Ideen`);
});

test('Kontrast: drei gleichfarbige Halte führen zu einer Idee dagegen', () => {
  const m = merk(rest({ y: 0.5, oben: HELL, unten: DUNKEL }));
  const blau = [[60, 110, 190], [70, 130, 200], [50, 90, 160]];
  assert.equal(monotonie(blau), 'blau');
  assert.equal(monotonie([[60, 110, 190], [200, 120, 60], [50, 90, 160]]), null);
  assert.equal(monotonie(blau.slice(0, 2)), null);
  const r = waehleIdee({ ...m, monoton: monotonie(blau) });
  assert.equal(r.idee.gegen, 'blau');
  assert.match(r.satz, /^Die letzten drei Halte waren alle blau\. /);
  // Ist die Kontrast-Idee schon benutzt, geht es normal weiter
  const r2 = waehleIdee({ ...m, monoton: 'blau' }, { benutzt: new Set(['gegen-blau']) });
  assert.ok(!r2.idee.gegen);
});

test('Tageszeit und Farbklassen', () => {
  assert.equal(tageszeit(7), 'morgen');
  assert.equal(tageszeit(13), 'tag');
  assert.equal(tageszeit(19), 'abend');
  assert.equal(tageszeit(23), 'nacht');
  assert.equal(tageszeit(3), 'nacht');
  assert.equal(farbKlasse([60, 110, 190]).ton, 'blau');
  assert.equal(farbKlasse([60, 140, 60]).ton, 'gruen');
  assert.equal(farbKlasse([190, 110, 60]).ton, 'warm');
  assert.equal(farbKlasse([120, 122, 125]).ton, 'grau');
  assert.equal(farbKlasse(HELL).lum, 'hell');
  assert.equal(farbKlasse(DUNKEL).lum, 'dunkel');
});

// Einfaches Kameramodell (Lochkamera): Punkt in Höhe Y und Entfernung Z, Kamera in Höhe C, nach oben
// gekippt um den Winkel k. Bildhöhe y in Anteilen der Bildhöhe, 0 = oben.
function bildY(Y, Z, C, k = 0, brennweite = 1.2) {
  const winkel = Math.atan2(Y - C, Z) - k;
  return 0.5 - (brennweite * Math.tan(winkel)) / 2;
}

test('Richtung: Hinweis stimmt mit dem Kameramodell überein', () => {
  const marke = { y: 0.55 };
  for (const [Y, Z] of [[1.6, 4], [0.9, 2], [2.4, 8]]) {
    for (const C of [1.2, 1.4, 1.7]) {
      const y = bildY(Y, Z, C);
      const r = richtung([{ y }], [marke]);
      if (!r) continue;
      // Dem Hinweis folgen: höher halten (C größer) oder nach oben kippen (k größer), sonst umgekehrt
      const s = r.richtung === 'hoeher' ? 1 : -1;
      const nachVerschieben = bildY(Y, Z, C + s * 0.05);
      const nachKippen = bildY(Y, Z, C, s * 0.02);
      assert.ok(Math.abs(nachVerschieben - marke.y) < Math.abs(y - marke.y), `verschieben: ${y} -> ${nachVerschieben}`);
      assert.ok(Math.abs(nachKippen - marke.y) < Math.abs(y - marke.y), `kippen: ${y} -> ${nachKippen}`);
    }
  }
  assert.equal(richtung([{ y: 0.5 }], [marke]).richtung, 'hoeher', 'Linie über der Marke: höher halten');
  assert.equal(richtung([{ y: 0.61 }], [marke]).richtung, 'tiefer', 'Linie unter der Marke: tiefer halten');
  assert.equal(richtung([{ y: 0.545 }], [marke]), null, 'trifft schon');
  assert.equal(richtung([{ y: 0.3 }], [marke]), null, 'zu weit weg, keine Linie in der Nähe');
  assert.equal(richtung([{ y: 0.5 }, { y: 0.552 }], [marke]), null, 'eine Linie trifft bereits');
});
