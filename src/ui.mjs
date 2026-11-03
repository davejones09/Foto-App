// Kleine Oberflächen-Helfer: Dialoge, Meldungen, Texte einsetzen.
import { T } from './texte.mjs';

export const $ = (sel, wurzel = document) => wurzel.querySelector(sel);
export const $$ = (sel, wurzel = document) => Array.from(wurzel.querySelectorAll(sel));

export function texteEinsetzen(wurzel = document) {
  for (const e of $$('[data-t]', wurzel)) {
    const t = T[e.dataset.t];
    if (typeof t === 'string') e.textContent = t;
  }
  const ol = $('#v-install .schritte');
  ol.replaceChildren(...T.installSchritte.map((s) => Object.assign(document.createElement('li'), { textContent: s })));
}

export function el(tag, attr = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (k === 'text') e.textContent = v;
    else if (k === 'klasse') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kinder) if (k != null) e.append(k);
  return e;
}

// Dialog mit Knöpfen. knoepfe: [{ text, wert, haupt }]. Liefert den Wert des gedrückten Knopfs.
export function frage(text, knoepfe, { eingabe = null, option = null } = {}) {
  const d = $('#dialog');
  $('.d-text', d).textContent = text;
  const inp = $('.d-eingabe', d);
  inp.hidden = eingabe == null;
  if (eingabe != null) inp.value = eingabe;
  const opt = $('.d-option', d);
  opt.hidden = !option;
  if (option) { $('span', opt).textContent = option; $('input', opt).checked = false; }
  const reihe = $('.d-knoepfe', d);
  return new Promise((ok) => {
    reihe.replaceChildren(...knoepfe.map((k) => el('button', {
      klasse: k.haupt ? 'haupt' : 'neben2',
      text: k.text,
      onclick: () => {
        d.hidden = true;
        ok({ wert: k.wert, text: inp.value.trim(), option: option ? $('input', opt).checked : false });
      },
    })));
    d.hidden = false;
    if (eingabe != null) setTimeout(() => { inp.focus(); inp.select(); }, 50);
  });
}

let meldungTimer = null;
// Meldung unten. knoepfe optional: [{ text, aktion }]. dauer 0 = bleibt.
export function melde(text, knoepfe = [], dauer = knoepfe.length ? 0 : 4000) {
  const m = $('#meldung');
  $('p', m).textContent = text;
  $('.m-knoepfe', m).replaceChildren(...knoepfe.map((k) => el('button', {
    klasse: k.haupt === false ? 'neben2' : 'haupt',
    text: k.text,
    onclick: () => { m.hidden = true; k.aktion?.(); },
  })));
  m.hidden = false;
  clearTimeout(meldungTimer);
  if (dauer) meldungTimer = setTimeout(() => (m.hidden = true), dauer);
}

export function meldungWeg() { $('#meldung').hidden = true; }

export const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));

const zwei = (n) => String(n).padStart(2, '0');

export function datumKurz(ms) {
  const d = new Date(ms);
  return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear();
}

export function uhrzeit(ms) {
  const d = new Date(ms);
  return zwei(d.getHours()) + ':' + zwei(d.getMinutes());
}

export const tagSchluessel = (ms) => {
  const d = new Date(ms);
  return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
};

// Objekt-URLs mit Aufräumen
export class Urls {
  constructor() { this.l = []; }
  von(blob) {
    if (!blob) return '';
    const u = URL.createObjectURL(blob);
    this.l.push(u);
    return u;
  }
  leeren() {
    for (const u of this.l) URL.revokeObjectURL(u);
    this.l = [];
  }
}
