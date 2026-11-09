// Sofort-Vorschau: spielt den Plan direkt in der App ab, klein und in Echtzeit, ohne Video zu bauen.
// Mit Musik gibt der Ton den Takt vor, damit die Schnitte hörbar auf dem Schlag liegen.

export function vorschauSpieler(canvas, { maler, dauer, ton = null, tonStart = 0, beiZeit = null }) {
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  let m = maler();
  let d = dauer;
  let t = 0;
  let spielt = false;
  let raf = 0;
  let malt = false;
  let t0 = 0;
  let neuMalen = false;
  let audio = null;

  function tonAn() {
    if (!ton) return;
    if (!audio) {
      audio = new Audio(ton);
      audio.preload = 'auto';
    }
    audio.currentTime = tonStart + t;
    audio.play().catch(() => {});
  }
  function tonAus() { audio?.pause(); }

  async function bild() {
    if (malt) { neuMalen = true; return; }
    malt = true;
    try {
      await m.male(ctx, Math.min(t, Math.max(0, d - 1 / 30)), { steht: !spielt });
    } catch {
      // Ein Bild, das nicht geht, darf die Vorschau nicht anhalten.
    } finally {
      malt = false;
    }
    beiZeit?.(t, d);
    if (neuMalen && !spielt) { neuMalen = false; bild(); }
  }

  function schritt() {
    if (!spielt) return;
    if (audio && !audio.paused && audio.readyState >= 2) t = audio.currentTime - tonStart;
    else t = (performance.now() - t0) / 1000;
    if (t >= d) {
      t = 0;
      t0 = performance.now();
      if (audio) audio.currentTime = tonStart;
    }
    if (!malt) bild();
    raf = requestAnimationFrame(schritt);
  }

  return {
    spielen() {
      if (spielt) return;
      if (t >= d - 0.05) t = 0;
      spielt = true;
      t0 = performance.now() - t * 1000;
      tonAn();
      raf = requestAnimationFrame(schritt);
    },
    anhalten() {
      spielt = false;
      cancelAnimationFrame(raf);
      tonAus();
      m.pause?.();
    },
    get spielt() { return spielt; },
    get zeit() { return t; },
    springe(z) {
      t = Math.max(0, Math.min(z, d));
      t0 = performance.now() - t * 1000;
      if (spielt && audio) audio.currentTime = tonStart + t;
      if (!spielt) bild();
    },
    // Neuer Plan: Die Vorschau läuft an derselben Stelle weiter.
    neu({ maler: neuerMaler, dauer: neueDauer, ton: neuerTon = ton, tonStart: neuerStart = tonStart }) {
      m.ende();
      m = neuerMaler();
      d = neueDauer;
      if (neuerTon !== ton) { tonAus(); audio = null; ton = neuerTon; }
      tonStart = neuerStart;
      t = Math.min(t, d);
      if (spielt) { t0 = performance.now() - t * 1000; tonAus(); tonAn(); } else bild();
    },
    zeigen() { bild(); },
    ende() {
      this.anhalten();
      m.ende();
      audio = null;
    },
  };
}
