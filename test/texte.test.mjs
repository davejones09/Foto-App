// Sichtbar darf kein Bahnbegriff bleiben: Texte, Ideen, Bewertung, Seite, Manifest und alle
// Zeichenketten im Code. Interne Bezeichner (klein geschrieben, etwa 'strecke') sind erlaubt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { T } from '../src/texte.mjs';
import { IDEEN, KONTRAST_WORT } from '../src/ideen.mjs';
import { bewertung } from '../src/kern.mjs';

// Groß geschrieben (Substantive) und die Verben, die nach Bahn klingen.
export const BAHN = /\b(Strecken?\w*|Halte?s?|Halten|Haltestelle\w*|Anschl(uss|üss)\w*|F(a|ä)den\w*|Marken?|Fahrpl(a|ä)n\w*|Ausfahrt\w*|Blindfahrt\w*|Fahrt(en)?|Pünktlich\w*|pünktlich\w*|Endstation\w*|Stempel\w*|Signal\w*|Zug|Züge|Zuges|Bahn\w*|\w*bahn|Gleis\w*|Abfahrt\w*|[Ee]insteigen|[Ww]eiterfahren|Bummelzug|Sprinter|Regionalexpress|Planmäßig|Ziel erreich\w*)\b/u;

function strings(x, pfad = 'T') {
  if (typeof x === 'string') return [[pfad, x]];
  if (Array.isArray(x)) return x.flatMap((v, i) => strings(v, `${pfad}[${i}]`));
  if (x && typeof x === 'object') return Object.entries(x).flatMap(([k, v]) => strings(v, `${pfad}.${k}`));
  return [];
}

// Zeichenketten aus JavaScript-Quelltext, ohne Kommentare. Vorlagen mit ${…} werden in ihre Textteile zerlegt.
export function literale(q) {
  const aus = [];
  let i = 0;
  let letztes = '';
  const code = (ende) => {
    let tiefe = 0;
    while (i < q.length) {
      const c = q[i];
      const n = q[i + 1];
      if (ende && c === '}' && tiefe === 0) { i++; return; }
      if (c === '{') tiefe++;
      if (c === '}') tiefe--;
      if (c === '/' && n === '/') { while (i < q.length && q[i] !== '\n') i++; continue; }
      if (c === '/' && n === '*') { i = q.indexOf('*/', i + 2) + 2; if (i < 2) i = q.length; continue; }
      if (c === '"' || c === "'") {
        let s = '';
        i++;
        while (i < q.length && q[i] !== c) { if (q[i] === '\\') { s += q[i + 1]; i += 2; } else s += q[i++]; }
        i++;
        aus.push(s);
        letztes = 'x';
        continue;
      }
      if (c === '`') {
        i++;
        let s = '';
        while (i < q.length && q[i] !== '`') {
          if (q[i] === '\\') { s += q[i + 1]; i += 2; continue; }
          if (q[i] === '$' && q[i + 1] === '{') { aus.push(s); s = ''; i += 2; code(true); continue; }
          s += q[i++];
        }
        i++;
        aus.push(s);
        letztes = 'x';
        continue;
      }
      if (c === '/' && (!letztes || /[(,=:[!&|?{};+\-*%<>~^]$/.test(letztes))) {
        // regulärer Ausdruck
        i++;
        let klasse = false;
        while (i < q.length) {
          if (q[i] === '\\') { i += 2; continue; }
          if (q[i] === '[') klasse = true;
          else if (q[i] === ']') klasse = false;
          else if (q[i] === '/' && !klasse) break;
          i++;
        }
        i++;
        while (/[a-z]/.test(q[i] || '')) i++;
        letztes = 'x';
        continue;
      }
      if (!/\s/.test(c)) letztes = c;
      i++;
    }
  };
  code(false);
  return aus;
}

function dateien(d) {
  const l = [];
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) l.push(...dateien(p));
    else if (p.endsWith('.mjs')) l.push(p);
  }
  return l;
}

const wurzel = new URL('..', import.meta.url).pathname;

test('Zerleger findet Zeichenketten, aber keine Kommentare', () => {
  const l = literale("// Halt\nconst a = 'Foto'; /* Strecke */ const b = `x ${a ? 'y' : 'z'} w`; const r = /a'b/g; const c = \"q\";");
  assert.deepEqual(l, ['Foto', 'x ', 'y', 'z', ' w', 'q']);
  assert.ok(BAHN.test('Halt 3'), 'Halt');
  assert.ok(BAHN.test('Die Straßenbahn kommt'), 'Straßenbahn');
  assert.ok(BAHN.test('Anschlusswert'), 'Komposita');
  assert.ok(!BAHN.test('Etwas höher halten'), 'das Verb halten ist erlaubt');
  assert.ok(!BAHN.test('Auffahrt und Zugriff'), 'Auffahrt, Zugriff');
});

test('Texte, Ideen und Bewertung ohne Bahnbegriffe', () => {
  const funde = [];
  for (const [p, s] of strings(T)) if (BAHN.test(s)) funde.push(`${p}: ${s}`);
  for (const idee of IDEEN) if (BAHN.test(idee.text)) funde.push(`Idee ${idee.id}: ${idee.text}`);
  for (const [k, v] of Object.entries(KONTRAST_WORT)) if (BAHN.test(v)) funde.push(`Kontrast ${k}: ${v}`);
  for (let w = 0; w <= 100; w++) if (BAHN.test(bewertung(w))) funde.push(`bewertung(${w}): ${bewertung(w)}`);
  assert.deepEqual(funde, []);
  assert.equal(bewertung(95), 'Perfekt');
  assert.equal(bewertung(90), 'Perfekt');
  assert.equal(bewertung(75), 'Passt gut');
  assert.equal(bewertung(70), 'Passt gut');
  assert.equal(bewertung(50), 'Passt teilweise');
  assert.equal(bewertung(40), 'Passt teilweise');
  assert.equal(bewertung(39), 'Passt nicht');
});

test('Seite, Manifest und alle Zeichenketten im Code ohne Bahnbegriffe', () => {
  const funde = [];
  const html = readFileSync(join(wurzel, 'index.html'), 'utf8');
  const sichtbar = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const m of sichtbar.matchAll(/>([^<]+)</g)) if (BAHN.test(m[1])) funde.push(`index.html: ${m[1].trim()}`);
  for (const m of sichtbar.matchAll(/(?:aria-label|alt|title|placeholder|content)="([^"]*)"/g)) if (BAHN.test(m[1])) funde.push(`index.html: ${m[1]}`);
  const manifest = JSON.parse(readFileSync(join(wurzel, 'manifest.webmanifest'), 'utf8'));
  for (const [p, s] of strings(manifest, 'manifest')) if (BAHN.test(s)) funde.push(`${p}: ${s}`);
  for (const p of dateien(join(wurzel, 'src'))) {
    // Die Tipps handeln auch vom Bahnfahren: Dort ist das Thema, nicht die Sprache der App.
    if (p.endsWith('src/reeltipps.mjs')) continue;
    for (const s of literale(readFileSync(p, 'utf8'))) if (BAHN.test(s)) funde.push(`${p.slice(wurzel.length)}: ${s}`);
  }
  assert.deepEqual(funde, []);
});
