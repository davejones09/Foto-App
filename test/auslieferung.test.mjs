// Auslieferung: Version, Service-Worker-Liste, relative Pfade, keine Netzabfragen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION } from '../src/version.mjs';

const W = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = (p) => readFileSync(join(W, p), 'utf8');

function alle(dir) {
  return readdirSync(join(W, dir)).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(W, p)).isDirectory() ? alle(p) : [p];
  });
}

test('Service Worker trägt dieselbe Version im Cache-Namen', () => {
  const sw = lies('sw.js');
  const m = sw.match(/const APP_VERSION = '([^']+)'/);
  assert.ok(m);
  assert.equal(m[1], APP_VERSION);
  assert.match(sw, /const CACHE = 'nahtlos-' \+ APP_VERSION/);
});

test('Service Worker kennt jede Datei der App', () => {
  const sw = lies('sw.js');
  const liste = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
  const noetig = [...alle('src'), ...alle('vendor'), 'index.html', 'style.css', 'manifest.webmanifest'];
  for (const f of noetig) assert.ok(liste.includes(f.replaceAll('\\', '/')), `fehlt im Service Worker: ${f}`);
  for (const f of liste) if (f) assert.ok(statSync(join(W, f)).isFile(), `existiert nicht: ${f}`);
});

test('Alle Pfade sind relativ, keine externen Adressen zur Laufzeit', () => {
  const html = lies('index.html');
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(!m[1].startsWith('/') && !/^https?:/.test(m[1]), `nicht relativ: ${m[1]}`);
  }
  const manifest = JSON.parse(lies('manifest.webmanifest'));
  for (const i of manifest.icons) assert.ok(!i.src.startsWith('/'));
  assert.ok(!manifest.start_url.startsWith('/'));
  for (const f of [...alle('src'), 'sw.js', 'index.html', 'style.css']) {
    const t = lies(f);
    assert.ok(!/fetch\(\s*['"`]https?:/.test(t), `Netzabfrage in ${f}`);
    assert.ok(!/@import|fonts\.googleapis|https?:\/\/[^\s'"`]*\.(js|css|woff2?)/.test(t), `externe Quelle in ${f}`);
  }
});

test('Icons und Startbilder sind vorhanden', () => {
  const html = lies('index.html');
  for (const m of html.matchAll(/href="(icons\/[^"]+)"/g)) assert.ok(statSync(join(W, m[1])).isFile(), m[1]);
});

test('Startvideo ist eingebunden und kann den Start nicht blockieren', () => {
  const html = lies('index.html');
  for (const a of ['autoplay', 'muted', 'playsinline']) assert.ok(html.includes(a), a);
  assert.ok(statSync(join(W, 'medien/start.mp4')).size < 1024 * 1024, 'Startvideo zu groß');
  const css = lies('style.css');
  assert.match(css, /animation: startvideo-weg/);
  const sw = lies('sw.js');
  assert.match(sw, /medien\/start\.mp4/);
  assert.match(sw, /status: 206/);
});
