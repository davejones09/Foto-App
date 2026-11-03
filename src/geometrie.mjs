// Transformation eines Rohbilds in den 4:5-Rahmen. Reine Rechnung.
// transform = { dx, dy, zoom, drehung }: dx/dy in Pixeln des 1296er-Rahmens, drehung in Grad.
// Gezeichnet wird: translate(B/2 + dx, H/2 + dy) · rotate(drehung) · scale(s) · translate(-rw/2, -rh/2)
// mit s = Füllmaß · zoom.
import { HALT_B, HALT_H } from './masse.mjs';

export const ZOOM_MAX = 2;
export const DREHUNG_MAX = 8;
export const STANDARD = Object.freeze({ dx: 0, dy: 0, zoom: 1, drehung: 0 });

export const fuellmass = (rw, rh, B = HALT_B, H = HALT_H) => Math.max(B / rw, H / rh);

// Liegt der Rahmen ganz im Rohbild?
export function deckt(t, rw, rh, B = HALT_B, H = HALT_H) {
  const s = fuellmass(rw, rh, B, H) * t.zoom;
  const w = (-t.drehung * Math.PI) / 180;
  const c = Math.cos(w);
  const sn = Math.sin(w);
  for (const [ex, ey] of [[-B / 2, -H / 2], [B / 2, -H / 2], [-B / 2, H / 2], [B / 2, H / 2]]) {
    const px = ex - t.dx;
    const py = ey - t.dy;
    const rx = (c * px - sn * py) / s + rw / 2;
    const ry = (sn * px + c * py) / s + rh / 2;
    if (rx < -0.01 || ry < -0.01 || rx > rw + 0.01 || ry > rh + 0.01) return false;
  }
  return true;
}

// Bringt eine Transformation in den erlaubten Bereich: Zoom 1 bis 2, Drehung ±8°, kein leerer Rand.
export function begrenze(t, rw, rh, B = HALT_B, H = HALT_H) {
  const aus = {
    dx: Number.isFinite(t.dx) ? t.dx : 0,
    dy: Number.isFinite(t.dy) ? t.dy : 0,
    zoom: Math.min(ZOOM_MAX, Math.max(1, Number.isFinite(t.zoom) ? t.zoom : 1)),
    drehung: Math.min(DREHUNG_MAX, Math.max(-DREHUNG_MAX, Number.isFinite(t.drehung) ? t.drehung : 0)),
  };
  // Erst den Zoom so weit anheben, dass der Rahmen mittig gedreht passt.
  let z = aus.zoom;
  for (let i = 0; i < 60 && !deckt({ ...aus, dx: 0, dy: 0, zoom: z }, rw, rh, B, H); i++) z *= 1.01;
  aus.zoom = z;
  if (deckt(aus, rw, rh, B, H)) return aus;
  // Dann die Verschiebung so weit wie nötig zurücknehmen (Halbierungssuche).
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (deckt({ ...aus, dx: aus.dx * m, dy: aus.dy * m }, rw, rh, B, H)) lo = m;
    else hi = m;
  }
  // Achsen getrennt nachbessern, damit man am Rand entlang schieben kann.
  const basis = { ...aus, dx: aus.dx * lo, dy: aus.dy * lo };
  for (const achse of ['dx', 'dy']) {
    let a = 0;
    let b = 1;
    const ziel = aus[achse];
    const start = basis[achse];
    for (let i = 0; i < 24; i++) {
      const m = (a + b) / 2;
      if (deckt({ ...basis, [achse]: start + (ziel - start) * m }, rw, rh, B, H)) a = m;
      else b = m;
    }
    basis[achse] = start + (ziel - start) * a;
  }
  return basis;
}

// Zeichnet die Quelle mit Transformation in einen Kontext der Größe B×H (beliebig skaliert).
export function zeichneTransformiert(ctx, quelle, rw, rh, t, B, H) {
  const f = B / HALT_B;
  const s = fuellmass(rw, rh, B, H) * t.zoom;
  ctx.save();
  ctx.translate(B / 2 + t.dx * f, H / 2 + t.dy * f);
  ctx.rotate((t.drehung * Math.PI) / 180);
  ctx.scale(s, s);
  ctx.drawImage(quelle, -rw / 2, -rh / 2, rw, rh);
  ctx.restore();
}
