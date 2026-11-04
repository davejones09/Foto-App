// Browser-Fassung: Erkennung des Computers und Texte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { istComputerGeraet, DESKTOP_TEXTE, ZIEL_JE_ANSICHT } from '../src/desktop.mjs';
import { T } from '../src/texte.mjs';

const fall = (ua, mausFein, breite, beruehrpunkte = 0) => istComputerGeraet({ ua, mausFein, breite, beruehrpunkte });

test('Computer und Mobilgeräte werden unterschieden', () => {
  const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605';
  assert.equal(fall(WIN, true, 1440), true);
  assert.equal(fall(MAC, true, 1440), true);
  assert.equal(fall('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7) Safari', false, 393), false);
  assert.equal(fall('Mozilla/5.0 (iPad; CPU OS 18_0) Safari', true, 1024), false);
  assert.equal(fall(MAC, true, 1180, 5), false, 'iPad meldet sich als Mac');
  assert.equal(fall('Mozilla/5.0 (Linux; Android 14) Chrome', false, 900), false);
  assert.equal(fall(WIN, false, 1440), false, 'Touch-Bildschirm ohne Maus');
  assert.equal(fall(WIN, true, 500), false, 'sehr schmales Fenster');
});

test('Desktop-Texte ersetzen nur vorhandene Texte, Dateien landen je Ansicht richtig', () => {
  for (const k of Object.keys(DESKTOP_TEXTE)) assert.equal(typeof T[k], 'string', k);
  for (const z of Object.values(ZIEL_JE_ANSICHT)) assert.match(z, /^#datei-/);
});
