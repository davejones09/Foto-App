// Originalton und Musik: richtige Stelle, Überblendung, Anteile, Ducking, Tempo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clipPlan, GANZ } from '../src/clipreel.mjs';
import { mischen, originalSpur, wavAus } from '../src/tonmix.mjs';

const RATE = 8000;
const ton = (sek, f, klick = null) => {
  const k = new Float32Array(Math.round(sek * RATE));
  for (let i = 0; i < k.length; i++) k[i] = 0.3 * Math.sin((2 * Math.PI * f * i) / RATE);
  if (klick != null) for (let i = 0; i < 40; i++) k[Math.round(klick * RATE) + i] = 1;
  return { kanaele: [k, k], rate: RATE };
};
const pegel = (k, a, b) => {
  let s = 0;
  for (let i = Math.round(a * RATE); i < Math.round(b * RATE); i++) s += k[i] * k[i];
  return Math.sqrt(s / Math.max(1, Math.round((b - a) * RATE)));
};
// Frequenz grob über Nulldurchgänge
const frequenz = (k, a, b) => {
  let z = 0;
  for (let i = Math.round(a * RATE) + 1; i < Math.round(b * RATE); i++) if (k[i - 1] < 0 && k[i] >= 0) z++;
  return z / (b - a);
};

test('Originalton folgt dem Plan: erst Clip 1, dann Clip 2, an der richtigen Stelle', () => {
  const medien = [{ typ: 'clip', dauer: 3, start: 0.5 }, { typ: 'clip', dauer: 2, start: 0 }];
  const plan = clipPlan(medien, { stil: GANZ });
  const toene = [ton(3, 440, 1.5), ton(2, 660)];
  const [L] = originalSpur(plan, medien, toene, plan.dauer, RATE);
  assert.ok(Math.abs(frequenz(L, 0.1, 2) - 440) < 15);
  assert.ok(Math.abs(frequenz(L, 2.8, 4.2) - 660) < 15);
  // Klick bei 1,5 s im Clip, Clip startet bei 0,5 s: im Reel bei 1,0 s
  const klick = L.findIndex((x) => x > 0.9) / RATE;
  assert.ok(Math.abs(klick - 1) < 0.01, `Klick bei ${klick}`);
});

test('Fotos und Clips ohne Ton schweigen, ohne Fehler', () => {
  const medien = [{ typ: 'foto' }, { typ: 'clip', dauer: 2, start: 0 }];
  const plan = clipPlan(medien, { stil: GANZ });
  assert.equal(mischen({ plan, medien, toene: [null, null], rate: RATE }), null);
  const m = mischen({ plan, medien, toene: [null, ton(2, 440)], rate: RATE });
  assert.ok(pegel(m[0], 0.2, plan.beginn[1] - 0.1) < 0.01, 'Foto still');
  assert.ok(pegel(m[0], plan.beginn[1] + 0.2, plan.beginn[1] + 1) > 0.1, 'Clip hörbar');
});

test('Anteil: 0 nur Musik, 1 nur Originalton, Ducking nimmt die Musik zurück', () => {
  const medien = [{ typ: 'clip', dauer: 4, start: 0 }];
  const plan = clipPlan(medien, { stil: GANZ });
  const leise = { kanaele: [new Float32Array(4 * RATE), new Float32Array(4 * RATE)], rate: RATE };
  // Originalton: erst 2 s Stille, dann laut
  const o = ton(4, 440);
  o.kanaele[0].fill(0, 0, 2 * RATE);
  const musik = { ...ton(10, 200), start: 0 };
  const nurMusik = mischen({ plan, medien, toene: [o], musik, anteil: 0, rate: RATE });
  assert.ok(Math.abs(frequenz(nurMusik[0], 2.2, 3) - 200) < 10);
  const nurO = mischen({ plan, medien, toene: [o], musik, anteil: 1, rate: RATE });
  assert.ok(pegel(nurO[0], 0.2, 1.8) < 0.01, 'Ohne Musik still, solange der Clip still ist');
  const beide = mischen({ plan, medien, toene: [o], musik, anteil: 0.5, rate: RATE });
  const mitM = mischen({ plan, medien, toene: [leise], musik, anteil: 0.5, rate: RATE });
  // Musik allein in den ersten 2 s gleich laut, danach durch das Ducking leiser als ohne Originalton
  assert.ok(Math.abs(pegel(beide[0], 0.5, 1.8) - pegel(mitM[0], 0.5, 1.8)) < 0.01);
  const reineMusikSpaeter = pegel(mitM[0], 2.5, 3);
  const nurOSpaeter = pegel(nurO[0], 2.5, 3);
  assert.ok(pegel(beide[0], 2.5, 3) < Math.hypot(reineMusikSpaeter, nurOSpaeter) * 0.95, 'Ducking');
  // Nie übersteuert
  assert.ok(beide[0].every((x) => Math.abs(x) <= 1));
});

test('Freeze: Der Ton schweigt, solange das Bild steht', () => {
  const medien = [{ typ: 'clip', dauer: 3, start: 0 }, { typ: 'clip', dauer: 3, start: 0 }];
  const plan = clipPlan(medien, { stil: GANZ, tempo: 'freeze' });
  const [L] = originalSpur(plan, medien, [ton(3, 440), ton(3, 660)], plan.dauer, RATE);
  const b = plan.beginn[1];
  assert.ok(pegel(L, b + 0.02, b + 0.15) < 0.02, 'Stille im Freeze');
  assert.ok(pegel(L, b + 1.2, b + 2) > 0.1);
});

test('WAV für die Vorschau hat den richtigen Kopf', async () => {
  const w = wavAus([new Float32Array(100), new Float32Array(100)], 24000);
  const b = new Uint8Array(await w.arrayBuffer());
  assert.equal(new TextDecoder().decode(b.subarray(0, 4)), 'RIFF');
  assert.equal(b.length, 44 + 400);
});
