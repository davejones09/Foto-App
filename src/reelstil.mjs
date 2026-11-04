// Reel-Stile: Planung und Bewegung je Bild. Reine Rechnung, in Node getestet; gezeichnet wird in ausgabe.mjs.
// Band: das fortlaufende Band wie bisher. Sanft, Schwung, Zoom und Naht zeigen jedes Foto formatfüllend
// in 9:16, der Ausschnitt folgt der Motivkarte. Farben ändern sich nur im Übergang selbst, keine Filter.

export const FPS = 30;
export const RAHMEN = { w: 1080, h: 1920 };
export const STILE = ['band', 'sanft', 'schwung', 'zoom', 'naht'];
// Übergangsdauer und kleinste sinnvolle Standzeit je Foto, in Sekunden
export const ZEITEN = {
  sanft: { uebergang: 1.0, standMin: 1.6 },
  schwung: { uebergang: 0.45, standMin: 1.2 },
  zoom: { uebergang: 0.7, standMin: 1.2 },
  naht: { uebergang: 0.9, standMin: 1.3 },
};
// Was im Ausweichweg (MediaRecorder, in Echtzeit) nicht sauber geht, wird ausgeblendet:
// Schwung braucht viele überlagerte Bilder je Bild, Naht viele Masken. Beides ruckelt in Echtzeit.
export const ECHTZEIT_STILE = ['band', 'sanft', 'zoom'];
export const stileFuer = (weg) => (!weg ? [] : weg.art === 'webcodecs' ? STILE.slice() : ECHTZEIT_STILE.slice());

const klemme = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const weich = (t) => { const u = klemme(t); return u * u * (3 - 2 * u); };
export const schwungKurve = (t) => { const u = klemme(t); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; };

// Plan eines Stil-Reels mit n Fotos und der gewählten Länge. Standzeit und Übergänge ergeben sich daraus.
// Ist die Länge zu kurz, schlägt der Plan die größte Fotoanzahl vor, die noch passt.
export function stilPlan(n, { laenge = 30, stil = 'sanft' } = {}) {
  const z = ZEITEN[stil];
  if (!z) throw new Error(`Unbekannter Stil ${stil}`);
  const tr = n > 1 ? z.uebergang : 0;
  const stand = n > 0 ? (laenge - (n - 1) * tr) / n : laenge;
  const zuKurz = stand < z.standMin - 1e-9;
  const maxFotos = Math.max(1, Math.floor((laenge + z.uebergang) / (z.standMin + z.uebergang) + 1e-9));
  // Foto i ist zu sehen von beginn[i] bis ende[i]; der Übergang zu i + 1 liegt am Ende seiner Zeit.
  const beginn = [];
  const ende = [];
  for (let i = 0; i < n; i++) {
    beginn.push(i * (stand + tr));
    ende.push(i * (stand + tr) + stand + (i < n - 1 ? tr : 0));
  }
  return { stil, n, laenge, dauer: laenge, bilder: Math.round(laenge * FPS), stand, uebergang: tr, zuKurz, maxFotos, beginn, ende };
}

// Was zur Zeit t zu sehen ist: Foto i, im Übergang auch Foto j mit Fortschritt p (0 bis 1).
// lauf: wie weit Foto i in seiner ganzen Zeit ist (für langsames Zoomen und Schwenken).
export function zustand(plan, t) {
  const { n, stand, uebergang: tr } = plan;
  if (n === 0) return null;
  const zeit = klemme(t, 0, plan.dauer);
  let i = Math.min(n - 1, Math.floor(zeit / (stand + tr)));
  const im = zeit - i * (stand + tr);
  let j = null;
  let p = null;
  if (i < n - 1 && im > stand) { j = i + 1; p = klemme((im - stand) / tr); }
  if (i === n - 1) j = null;
  const lauf = (k) => klemme((zeit - plan.beginn[k] + (k > 0 ? tr : 0)) / (plan.ende[k] - plan.beginn[k] + (k > 0 ? tr : 0)));
  return { i, j, p, lauf: lauf(i), laufJ: j != null ? lauf(j) : 0 };
}

// 9:16-Ausschnitt eines Fotos aus dem Band (b breit, 1620 hoch): links oben x0, Breite w.
// Das Motivprofil (Spalten) entscheidet, wo; ohne Motiv die Mitte.
export function reelAusschnitt(b, profil = null, h = 1620) {
  const w = Math.min(b, (h * RAHMEN.w) / RAHMEN.h);
  const spiel = b - w;
  if (spiel <= 0 || !profil || !profil.length) return { x0: spiel / 2, w, h };
  const L = profil.length;
  const fenster = Math.max(1, Math.round((w / b) * L));
  const sum = new Float64Array(L + 1);
  for (let k = 0; k < L; k++) sum[k + 1] = sum[k] + profil[k];
  let best = { wert: -1, k: Math.round((L - fenster) / 2) };
  for (let k = 0; k + fenster <= L; k++) {
    const wert = sum[k + fenster] - sum[k] - 1e-6 * Math.abs(k - (L - fenster) / 2);
    if (wert > best.wert) best = { wert, k };
  }
  return { x0: klemme((best.k / L) * b, 0, spiel), w, h };
}

// Wie ein Foto im Rahmen liegt: Maßstab über dem Füllen (1 = füllt) und Verschiebung der Mitte in Pixeln.
// Sanft: langsam von 1,0 auf 1,06. Zoom: im Übergang hinein (bis 2,2), das nächste kommt aus der Tiefe.
export function lage(stil, z) {
  const aus = { aktuell: { s: 1, dx: 0, alpha: 1 }, naechstes: null };
  if (stil === 'sanft') {
    aus.aktuell.s = 1 + 0.06 * z.lauf;
    if (z.j != null) aus.naechstes = { s: 1 + 0.06 * z.laufJ, dx: 0, alpha: weich(z.p) };
  } else if (stil === 'zoom') {
    if (z.j != null) {
      const q = weich(z.p);
      aus.aktuell = { s: 1 + 1.2 * q * q, dx: 0, alpha: 1 };
      aus.naechstes = { s: 0.55 + 0.45 * q, dx: 0, alpha: weich(z.p * 1.6) };
    }
  } else if (stil === 'schwung') {
    if (z.j != null) {
      const x = -schwungKurve(z.p) * RAHMEN.w;
      aus.aktuell.dx = x;
      aus.naechstes = { s: 1, dx: x + RAHMEN.w, alpha: 1 };
    }
  } else if (stil === 'naht') {
    if (z.j != null) aus.naechstes = { s: 1, dx: 0, alpha: 1, kante: weich(z.p) };
  }
  return aus;
}

// Schwung: Bewegungsunschärfe aus mehreren überlagerten Bildern, kurz vor der Zeit t.
export const SCHWUNG_TEILBILDER = 8;
export function teilzeiten(t, n = SCHWUNG_TEILBILDER, dauer = 0.6 / FPS) {
  return Array.from({ length: n }, (_, k) => t - (dauer * k) / Math.max(1, n - 1));
}

// Naht: Die Grenze folgt dem echten Nahtverlauf (pfad, 1620 Zeilen, x in der Überlappung), mittig bei 0,
// skaliert auf den Rahmen. Liefert die x-Lage der Grenze je Rahmenzeile für den Fortschritt kante (0 bis 1).
export function nahtGrenze(pfad, kante, { w = RAHMEN.w, h = RAHMEN.h, schritt = 8 } = {}) {
  const f = h / 1620;
  const p = pfad && pfad.length ? pfad : null;
  const mitte = p ? p.reduce((s, v) => s + v, 0) / p.length : 0;
  const amplitude = p ? Math.max(...p.map((v) => Math.abs(v - mitte))) * f : 0;
  const x0 = w + amplitude + 24 - kante * (w + 2 * amplitude + 48);
  const aus = [];
  for (let y = 0; y <= h; y += schritt) {
    const v = p ? p[Math.min(p.length - 1, Math.round(y / f))] - mitte : 0;
    aus.push({ x: x0 + v * f, y });
  }
  return aus;
}
