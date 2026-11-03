import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packe, entpacke, pruefe, crc32 } from '../src/zip.mjs';

test('crc32 stimmt mit bekanntem Wert', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('ZIP: packen und entpacken verlustfrei, auch mit Umlauten', async () => {
  const gross = new Uint8Array(300000).map((_, i) => (i * 31) & 255);
  const z = await packe([
    { name: 'manifest.json', inhalt: '{"ä":1}' },
    { name: 'halte/0/bild.jpg', inhalt: new Blob([gross]) },
    { name: 'leer.bin', inhalt: new Uint8Array(0) },
  ]);
  const e = await entpacke(z);
  assert.equal(await e.get('manifest.json').blob.text(), '{"ä":1}');
  const b = new Uint8Array(await e.get('halte/0/bild.jpg').blob.arrayBuffer());
  assert.deepEqual(b, gross);
  for (const v of e.values()) assert.ok(await pruefe(v));
  // Gegenprobe mit einem fremden Werkzeug, falls vorhanden.
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  const f = join(dir, 't.zip');
  writeFileSync(f, new Uint8Array(await z.arrayBuffer()));
  try {
    const aus = execFileSync('python3', ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip()); print(len(z.namelist()))', f]).toString();
    assert.match(aus, /None\n3/);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
});
