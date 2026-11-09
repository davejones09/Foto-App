// Instagram-Vorschau: Wo die App von Instagram etwas verdeckt und was im Profilraster zu sehen ist.
// Nur zur Ansicht in der App, nie in einer Ausgabe. Werte nach dem Aufbau der Instagram-App, gerundet.

export const REEL_ZONEN = [
  { x: 0, y: 0, w: 1, h: 0.09 }, // Kopfzeile
  { x: 0.84, y: 0.42, w: 0.16, h: 0.46 }, // Knöpfe rechts
  { x: 0, y: 0.8, w: 1, h: 0.2 }, // Name, Text und Ton unten
];
export const RASTER = 3 / 4; // Profilraster: Hochformat 3:4

// Ausschnitt im Profilraster: mittig, 3:4.
export function rasterAusschnitt(W, H) {
  if (W / H > RASTER) { const w = H * RASTER; return { x: (W - w) / 2, y: 0, w, h: H }; }
  const h = W / RASTER;
  return { x: 0, y: (H - h) / 2, w: W, h };
}

export function instaZeichnen(ctx, W, H, art = 'reel') {
  ctx.save();
  if (art === 'reel') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    for (const z of REEL_ZONEN) ctx.fillRect(z.x * W, z.y * H, z.w * W, z.h * H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const r = Math.max(3, W * 0.025);
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(W * 0.92, H * (0.5 + k * 0.09), r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillRect(W * 0.05, H * 0.85, W * 0.35, Math.max(2, H * 0.012));
    ctx.fillRect(W * 0.05, H * 0.88, W * 0.55, Math.max(2, H * 0.01));
  }
  const a = rasterAusschnitt(W, H);
  ctx.strokeStyle = '#FFD400';
  ctx.lineWidth = Math.max(1.5, W / 220);
  ctx.setLineDash([ctx.lineWidth * 4, ctx.lineWidth * 3]);
  ctx.strokeRect(a.x + ctx.lineWidth / 2, a.y + ctx.lineWidth / 2, a.w - ctx.lineWidth, a.h - ctx.lineWidth);
  ctx.restore();
}
