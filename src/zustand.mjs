// Gemeinsamer Zustand und Wechsel der Ansichten. Keine Navigation, kein Hash (WebKit-Kamera-Bugs).
import * as db from './speicher.mjs';
import { protokolliere } from './diagnose.mjs';

export const Z = {
  strecke: null,
  halte: [],
  ansicht: null,
};

const ansichten = {};
export function registriere(name, a) { ansichten[name] = a; }

let wechsel = Promise.resolve();
export function zeige(name, daten = {}) {
  wechsel = wechsel.then(async () => {
    const alt = Z.ansicht;
    if (alt && ansichten[alt]?.verlassen) {
      try { await ansichten[alt].verlassen(name); } catch (e) { protokolliere('ansicht', e); }
    }
    for (const s of document.querySelectorAll('.ansicht')) s.hidden = s.id !== 'v-' + name;
    Z.ansicht = name;
    document.body.dataset.ansicht = name;
    if (ansichten[name]?.betreten) await ansichten[name].betreten(daten, alt);
  }).catch((e) => protokolliere('ansicht', e));
  return wechsel;
}

const AKTIV = 'nahtlos-aktiv';

export async function ladeStrecke(id) {
  const s = id ? await db.strecke(id) : null;
  if (!s) return false;
  Z.strecke = s;
  Z.halte = await db.halte(s.id);
  try { localStorage.setItem(AKTIV, s.id); } catch {}
  await db.setzeEinstellung('aktiv', s.id).catch(() => {});
  return true;
}

export async function ladeAktive() {
  let id = null;
  try { id = localStorage.getItem(AKTIV); } catch {}
  if (!id) id = await db.einstellung('aktiv').catch(() => null);
  if (id && (await ladeStrecke(id))) return;
  const l = await db.strecken();
  if (l.length) await ladeStrecke(l[0].id);
}

// Kein Projekt mehr aktiv (etwa nach dem Löschen).
export async function keinProjekt() {
  Z.strecke = null;
  Z.halte = [];
  try { localStorage.removeItem(AKTIV); } catch {}
  await db.setzeEinstellung('aktiv', null).catch(() => {});
}

export async function neuLaden() {
  if (!Z.strecke) return;
  Z.strecke = await db.strecke(Z.strecke.id);
  Z.halte = await db.halte(Z.strecke.id);
}

export const letzterHalt = () => Z.halte[Z.halte.length - 1] || null;

// Erstlauf gilt als erledigt, sobald irgendwo zwei Halte liegen oder er einmal durch ist.
export async function erstlaufFertig() {
  try { if (localStorage.getItem('nahtlos-erstlauf') === 'fertig') return true; } catch {}
  if (await db.einstellung('erstlauf').catch(() => null)) return true;
  if (Z.halte.length >= 2) return true;
  for (const s of await db.strecken()) if ((await db.halte(s.id)).length >= 2) return true;
  return false;
}

export async function erstlaufAbschliessen() {
  try { localStorage.setItem('nahtlos-erstlauf', 'fertig'); } catch {}
  await db.setzeEinstellung('erstlauf', true).catch(() => {});
}
