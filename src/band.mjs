// Strecke anzeigen: nur sichtbare Stücke laden, höchstens etwa 6 große Bilder im Speicher (LRU).
import { stuecke, bandBreite, breiteVon, HALT_H, UEBER } from './masse.mjs';
import { ladeBild, freigeben } from './bild.mjs';
import { protokolliere } from './diagnose.mjs';
import { blobPflicht } from './speicher.mjs';

const KLEIN = { bild: 'vorschau', naht: 'nahtVorschau' };

// Farbraum, in dem ein gespeichertes Stück vorliegt. Die Ausgaben rechnen es beim Zeichnen sauber nach sRGB.
const raumFuer = (halt, art) => (art === 'naht' || art === 'nahtVorschau' ? halt.nahtFarbraum || halt.farbraum : halt.farbraum) || 'srgb';

export class Kachellager {
  constructor(max = 6) {
    this.max = max;
    this.gross = new Map(); // Schlüssel -> { bm, p }
    this.klein = new Map();
  }

  #karte(art) { return art === 'bild' || art === 'naht' ? this.gross : this.klein; }

  // Liefert das Bitmap sofort, wenn geladen. Sonst null und lädt im Hintergrund (dann fertig()).
  sofort(halt, art, fertig) {
    const k = this.#karte(art);
    const sch = halt.id + ':' + art;
    const e = k.get(sch);
    if (e) {
      if (k === this.gross) { k.delete(sch); k.set(sch, e); }
      if (e.bm) return e.bm;
      return null;
    }
    this.hole(halt, art).then(() => fertig?.(), () => {});
    return null;
  }

  hole(halt, art) {
    const k = this.#karte(art);
    const sch = halt.id + ':' + art;
    const e = k.get(sch);
    if (e) {
      if (k === this.gross) { k.delete(sch); k.set(sch, e); }
      return e.p;
    }
    const eintrag = { bm: null, p: null };
    // Bilddaten erst jetzt aus der Datenbank: nur das, was gerade gezeichnet wird.
    eintrag.p = (halt[art] ? blobPflicht(halt, art).then((b) => ladeBild(b, raumFuer(halt, art))) : Promise.reject(new Error('fehlt ' + art))).then((bm) => {
      if (k.get(sch) !== eintrag) { freigeben(bm); return null; }
      eintrag.bm = bm;
      return bm;
    });
    eintrag.p.catch((err) => { if (k.get(sch) === eintrag) k.delete(sch); protokolliere('kachel', err); });
    k.set(sch, eintrag);
    if (k === this.gross) this.#aufraeumen();
    return eintrag.p;
  }

  #aufraeumen() {
    while (this.gross.size > this.max) {
      const [sch, e] = this.gross.entries().next().value;
      this.gross.delete(sch);
      freigeben(e.bm);
    }
  }

  leeren() {
    for (const k of [this.gross, this.klein]) {
      for (const e of k.values()) freigeben(e.bm);
      k.clear();
    }
  }
}

// Zeichnet einen Bereich des Bands. ziel: Kontext, Maßstab s in Zielpixeln je Bandpixel,
// x0/y0 = Bandkoordinate an der linken oberen Ecke. Liefert true, wenn alles in voller Auflösung da war.
export function zeichneBand(ctx, halte, lager, { s, x0, y0 = 0, w, h, klein = false, fertig }) {
  const xEnde = x0 + w / s;
  let komplett = true;
  for (const st of stuecke(halte)) {
    if (st.x >= xEnde || st.x + st.sw <= x0) continue;
    const halt = halte[st.halt];
    const links = Math.round((st.x - x0) * s);
    const rechts = Math.round((st.x + st.sw - x0) * s);
    const oben = Math.round(-y0 * s);
    const unten = Math.round((HALT_H - y0) * s);
    let bm = klein ? null : lager.sofort(halt, st.art, fertig);
    const breiteQuelle = st.art === 'naht' ? UEBER : breiteVon(halt);
    if (!bm) {
      if (!klein) komplett = false;
      bm = lager.sofort(halt, KLEIN[st.art], fertig);
    }
    if (!bm) { komplett = false; continue; }
    const f = bm.width / breiteQuelle;
    ctx.drawImage(bm, st.sx * f, 0, st.sw * f, bm.height, links, oben, rechts - links, unten - oben);
  }
  return komplett;
}

export class BandAnsicht {
  constructor(canvas, { beiBewegung } = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.lager = new Kachellager(6);
    this.halte = [];
    this.s = 0.3;
    this.x0 = 0;
    this.y0 = 0;
    this.beiBewegung = beiBewegung;
    this.geplant = false;
    this.finger = new Map();
    this.geste = null;
    this.vx = 0;
    this.traege = 0;
    this.letzterTipp = 0;
    this.#gesten();
  }

  get breite() { return bandBreite(this.halte); }

  setze(halte) {
    const alt = this.halte;
    this.halte = halte.filter((h) => h.bild);
    if (alt.length && alt.some((h, i) => this.halte[i]?.id !== h.id)) this.lager.leeren();
    this.c.dataset.breite = String(this.breite);
    this.messen();
    this.s = this.fitHoehe;
    // Ans Ende der Strecke springen: dort wurde zuletzt angebaut.
    this.x0 = this.breite;
    this.begrenzen();
    this.zeichnen();
  }

  messen() {
    const r = this.c.getBoundingClientRect();
    this.vw = Math.max(1, r.width);
    this.vh = Math.max(1, r.height);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.round(this.vw * this.dpr);
    const h = Math.round(this.vh * this.dpr);
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
  }

  get fitHoehe() { return this.vh / HALT_H; }
  get fitAlles() { return Math.min(this.fitHoehe, this.breite ? this.vw / this.breite : 1); }
  get sMax() { return 1; }

  begrenzen() {
    this.s = Math.min(this.sMax, Math.max(this.fitAlles, this.s));
    const sichtB = this.vw / this.s;
    const sichtH = this.vh / this.s;
    if (this.breite <= sichtB) this.x0 = -(sichtB - this.breite) / 2;
    else this.x0 = Math.min(this.breite - sichtB, Math.max(0, this.x0));
    if (HALT_H <= sichtH) this.y0 = -(sichtH - HALT_H) / 2;
    else this.y0 = Math.min(HALT_H - sichtH, Math.max(0, this.y0));
  }

  zeichnen() {
    if (this.geplant) return;
    this.geplant = true;
    requestAnimationFrame(() => {
      this.geplant = false;
      this.#jetztZeichnen();
    });
  }

  #jetztZeichnen() {
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e0f10';
    ctx.fillRect(0, 0, this.c.width, this.c.height);
    if (!this.halte.length) return;
    ctx.imageSmoothingQuality = 'high';
    const s = this.s * dpr;
    const klein = s * HALT_H <= 360;
    zeichneBand(ctx, this.halte, this.lager, {
      s, x0: this.x0, y0: this.y0, w: this.c.width, h: this.c.height, klein,
      fertig: () => this.zeichnen(),
    });
    this.beiBewegung?.(this);
  }

  // Sichtbarer Bereich als Anteil des Bands
  sicht() {
    const b = this.breite || 1;
    return { von: Math.max(0, this.x0 / b), bis: Math.min(1, (this.x0 + this.vw / this.s) / b) };
  }

  springeZu(anteil) {
    this.x0 = anteil * this.breite - this.vw / this.s / 2;
    this.begrenzen();
    this.zeichnen();
  }

  zoomUm(faktor, cx, cy) {
    const bx = this.x0 + cx / this.s;
    const by = this.y0 + cy / this.s;
    this.s *= faktor;
    this.begrenzen();
    this.x0 = bx - cx / this.s;
    this.y0 = by - cy / this.s;
    this.begrenzen();
    this.zeichnen();
  }

  ganz() { this.s = this.fitAlles; this.begrenzen(); this.zeichnen(); }

  #gesten() {
    const c = this.c;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
    const start = () => {
      const p = [...this.finger.values()];
      if (p.length === 1) this.geste = { art: 1, ...p[0], x0: this.x0, y0: this.y0 };
      else if (p.length >= 2) {
        const [a, b] = p;
        this.geste = { art: 2, d: Math.hypot(b.x - a.x, b.y - a.y) || 1, s: this.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, bx: this.x0 + (a.x + b.x) / 2 / this.s, by: this.y0 + (a.y + b.y) / 2 / this.s };
      } else this.geste = null;
    };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.traege++;
      const p = pos(e);
      this.finger.set(e.pointerId, p);
      this.vx = 0;
      this.letzt = p;
      start();
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.finger.has(e.pointerId) || !this.geste) return;
      const p = pos(e);
      this.finger.set(e.pointerId, p);
      if (this.geste.art === 1) {
        const dt = Math.max(1, p.t - this.letzt.t);
        this.vx = 0.8 * ((this.letzt.x - p.x) / dt) + 0.2 * this.vx;
        this.letzt = p;
        this.x0 = this.geste.x0 - (p.x - this.geste.x) / this.s;
        this.y0 = this.geste.y0 - (p.y - this.geste.y) / this.s;
      } else {
        const [a, b] = [...this.finger.values()];
        if (!b) return;
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        this.s = this.geste.s * (d / this.geste.d);
        this.begrenzen();
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        this.x0 = this.geste.bx - mx / this.s;
        this.y0 = this.geste.by - my / this.s;
      }
      this.begrenzen();
      this.zeichnen();
    });
    const ende = (e) => {
      if (!this.finger.has(e.pointerId)) return;
      const war = this.geste;
      this.finger.delete(e.pointerId);
      start();
      if (war?.art === 1 && !this.finger.size) {
        const p = pos(e);
        const bewegt = Math.hypot(p.x - war.x, p.y - war.y);
        if (bewegt < 8 && p.t - war.t < 300) {
          if (p.t - this.letzterTipp < 320) {
            this.letzterTipp = 0;
            // Doppeltipp: zwischen Streckenhöhe und 100 % wechseln
            const ziel = this.s < this.fitHoehe * 1.5 ? this.sMax : this.fitHoehe;
            this.zoomUm(ziel / this.s, p.x, p.y);
          } else this.letzterTipp = p.t;
        } else this.#traegheit();
      }
    };
    c.addEventListener('pointerup', ende);
    c.addEventListener('pointercancel', ende);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5) this.zoomUm(Math.exp(-e.deltaY * 0.003), p.x, p.y);
      else { this.x0 += e.deltaX / this.s; this.begrenzen(); this.zeichnen(); }
    }, { passive: false });
    addEventListener('resize', () => { if (this.c.offsetParent) { this.messen(); this.begrenzen(); this.zeichnen(); } });
  }

  #traegheit() {
    const meine = ++this.traege;
    let v = this.vx; // CSS-Pixel je ms
    let t = performance.now();
    const schritt = (jetzt) => {
      if (meine !== this.traege || Math.abs(v) < 0.02) return;
      const dt = Math.min(40, jetzt - t);
      t = jetzt;
      this.x0 += (v * dt) / this.s;
      v *= Math.pow(0.995, dt);
      const vorher = this.x0;
      this.begrenzen();
      if (this.x0 !== vorher) v = 0;
      this.#jetztZeichnen();
      requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  }

  freigeben() { this.lager.leeren(); }
}
