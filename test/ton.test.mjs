// Musik im Reel: eigener AAC-Weg bis in die fertige, bereinigte Datei.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { aacKodieren } from '../src/aac.mjs';
import { mp4Sauber, mp4TonProben } from '../src/metadaten.mjs';
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.mjs';

const RATE = 48000;

// 4 Sekunden Stille, ab genau 2 Sekunden ein Ton: So lässt sich der Versatz messen.
function testton() {
  const n = 4 * RATE;
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 2 * RATE; i < n; i++) {
    l[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / RATE);
    r[i] = 0.5 * Math.sin((2 * Math.PI * 660 * i) / RATE);
  }
  return [l, r];
}

function mp4Aus(aac) {
  const muxer = new Muxer({ target: new ArrayBufferTarget(), audio: { codec: 'aac', numberOfChannels: 2, sampleRate: RATE }, fastStart: 'in-memory' });
  const dauer = (aac.rahmen / RATE) * 1e6;
  aac.pakete.forEach((p, i) => muxer.addAudioChunkRaw(p, 'key', i * dauer, dauer, i ? undefined : { decoderConfig: { codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: RATE, description: aac.beschreibung } }));
  muxer.finalize();
  return mp4Sauber(new Uint8Array(muxer.target.buffer));
}

test('AAC: Beschreibung passt zu LC, 48 kHz, Stereo, Pakete decken die Länge', async () => {
  const k = testton();
  const aac = await aacKodieren(k, RATE);
  assert.equal(aac.rahmen, 1024);
  assert.deepEqual([...aac.beschreibung.subarray(0, 2)], [0x11, 0x90]);
  assert.ok(Math.abs(aac.pakete.length - k[0].length / 1024) <= 2, `${aac.pakete.length} Pakete`);
  assert.ok(aac.pakete[0][0] >> 4 !== 0xf || aac.pakete[0].length < 7, 'kein ADTS-Kopf');
});

test('AAC: Der Encoder lässt sich mehrfach nacheinander nutzen', async () => {
  for (let i = 0; i < 3; i++) assert.ok((await aacKodieren(testton(), RATE)).pakete.length > 100);
});

test('mp4TonProben: zählt die Tonspur auch nach dem Bereinigen', async () => {
  const aac = await aacKodieren(testton(), RATE);
  assert.equal(mp4TonProben(mp4Aus(aac)), aac.pakete.length);
  assert.equal(mp4TonProben(new Uint8Array(64)), 0);
});

test('Fremdes Programm liest AAC, Ton beginnt zur richtigen Zeit', { skip: spawnSync('ffmpeg', ['-version']).error ? 'kein ffmpeg' : false }, async () => {
  const datei = join(mkdtempSync(join(tmpdir(), 'ton-')), 'ton.mp4');
  writeFileSync(datei, mp4Aus(await aacKodieren(testton(), RATE)));
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,sample_rate,channels', '-of', 'csv=p=0', datei]);
  assert.match(String(probe.stdout), /aac,LC,48000,2/);
  const ff = spawnSync('ffmpeg', ['-v', 'error', '-i', datei, '-f', 'f32le', '-ac', '1', '-'], { maxBuffer: 1e9 });
  assert.equal(ff.status, 0, String(ff.stderr));
  const t = new Float32Array(ff.stdout.buffer, ff.stdout.byteOffset, ff.stdout.length >> 2);
  assert.ok(Math.abs(t.length / RATE - 4) < 0.05, `Länge ${t.length / RATE}`);
  const ersteLaut = t.findIndex((x) => Math.abs(x) > 0.1) / RATE;
  assert.ok(Math.abs(ersteLaut - 2) < 0.005, `Ton beginnt bei ${ersteLaut} s`);
});
