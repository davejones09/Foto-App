// Wechsel mit Vordergrund: Spitze finden, Lage über der neuen Szene, Stelle im Clip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clipPlan, spitzeFinden, vordergrundLage, vordergrundZeit, GANZ } from '../src/clipreel.mjs';
import { VORLAGEN_IDS } from '../src/reelvorlagen.mjs';

const proben = (werte, schritt = 0.2) => werte.map((a, i) => ({ t: i * schritt, a }));

test('Spitze: das Bild, in dem das Fahrzeug am meisten bedeckt, und wie lange es danach bleibt', () => {
  const r = spitzeFinden(proben([0, 0.1, 0.4, 0.7, 0.5, 0.2, 0.02, 0, 0]));
  assert.equal(r.t.toFixed(1), '0.6');
  assert.equal(r.anteil, 0.7);
  // weg bei 1,2 s: 0,6 s nach der Spitze, plus Polster
  assert.ok(Math.abs(r.aus - 0.7) < 1e-9, String(r.aus));
});

test('Spitze: zu kleine Fahrzeuge zählen nicht, die Dauer bleibt in Grenzen', () => {
  assert.equal(spitzeFinden(proben([0, 0.05, 0.1, 0.05])), null);
  assert.equal(spitzeFinden([]), null);
  const lang = spitzeFinden(proben([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]));
  assert.ok(lang.aus <= 1.5 && lang.aus >= 0.4);
  const knapp = spitzeFinden(proben([0, 0.5, 0.8]), { zeitEnde: 0.5 });
  assert.equal(knapp.aus, 0.4);
});

const fahrzeugClip = { typ: 'clip', dauer: 6, start: 0, ende: 3, eigen: true, wechsel: { art: 'fahrzeug', t: 3, aus: 0.8 } };
const zweiter = { typ: 'clip', dauer: 5, start: 0 };

test('Ganze Clips: geschnitten wird genau an der Spitze, das Fahrzeug läuft danach weiter', () => {
  const medien = [fahrzeugClip, zweiter];
  const p = clipPlan(medien, { stil: GANZ });
  assert.equal(p.beginn[1], 3);
  assert.equal(vordergrundLage(p, medien, 2.9), null);
  const l = vordergrundLage(p, medien, 3.2);
  assert.equal(l.k, 0);
  assert.equal(l.a, 0);
  assert.ok(Math.abs(l.seit - 0.2) < 1e-9);
  assert.equal(l.alpha, 1);
  // Clipzeit: weiter hinter der Spitze, kein Sprung an den Anfang
  assert.ok(Math.abs(vordergrundZeit(p, medien, l) - 3.2) < 0.01, String(vordergrundZeit(p, medien, l)));
  // blendet am Ende aus und ist dann weg
  const spaet = vordergrundLage(p, medien, 3.7);
  assert.ok(spaet.alpha > 0 && spaet.alpha < 1);
  assert.equal(vordergrundLage(p, medien, 3.85), null);
});

test('Vorlagen: Die Mitte des Übergangs liegt am Ende des Fahrzeug-Clips', () => {
  for (const id of VORLAGEN_IDS.slice(0, 12)) {
    const medien = [{ typ: 'foto', dauer: 0, start: 0 }, fahrzeugClip, zweiter];
    const p = clipPlan(medien, { stil: id });
    // Clipzeit am Schnitt (Mitte des Übergangs 1) = eingestelltes Ende
    const mitte = p.beginn[1] + p.staende[1] + p.uebergaenge[1] / 2;
    const l = vordergrundLage(p, medien, mitte + 0.01);
    assert.ok(l, id);
    assert.equal(l.k, 1, id);
    const z = vordergrundZeit(p, medien, l);
    assert.ok(Math.abs(z - 3.01) < 0.02, `${id}: ${z}`);
  }
});

test('Stehende Figur: eingefroren am Schnitt, wächst leicht und endet vor dem nächsten Übergang', () => {
  const a = { typ: 'clip', dauer: 4, start: 0, wechsel: { art: 'stehen', aus: 1.1 } };
  const medien = [a, zweiter, { typ: 'clip', dauer: 3, start: 0 }];
  const p = clipPlan(medien, { stil: GANZ });
  const l1 = vordergrundLage(p, medien, 4.1);
  const l2 = vordergrundLage(p, medien, 4.6);
  assert.equal(vordergrundZeit(p, medien, l1), vordergrundZeit(p, medien, l2));
  assert.ok(l2.s > l1.s && l2.s <= 1.04);
  assert.equal(vordergrundLage(p, medien, 5.2), null);
  // Ein kurzes Folgemedium kürzt die Dauer
  const kurz = [a, { typ: 'clip', dauer: 0.5, start: 0 }, zweiter];
  const pk = clipPlan(kurz, { stil: GANZ });
  assert.ok(vordergrundLage(pk, kurz, 4.3));
  assert.equal(vordergrundLage(pk, kurz, 4.5), null);
});

test('Ohne Wechsel und beim ersten Medium gibt es keinen Vordergrund', () => {
  const medien = [zweiter, zweiter];
  const p = clipPlan(medien, { stil: GANZ });
  for (const t of [0, 1, 5.1, 7]) assert.equal(vordergrundLage(p, medien, t), null);
});
