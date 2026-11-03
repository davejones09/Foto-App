// Diagnose: Bleibt ein Foto beim Bauen unverändert? (TECHNIK.md, Abschnitt Farbprofil)
// Das gewählte Foto läuft genau wie beim Import durch die App, aber nur im Speicher, ohne Datenbank:
// dekodieren, Rohbild als JPEG, zurücklesen, rahmen, gegen einen Vorgänger nähen, Bild als JPEG, zurücklesen.
// Verglichen wird außerhalb der Überlappung mit dem Foto, wie der Browser es direkt aus der Datei zeigt,
// in dessen eigenem Farbraum. Eine stille Umrechnung oder Farbangleichung fiele hier sofort auf.
import { dekodiere } from './einfuhr.mjs';
import { nahtZwischen } from './naehwerk.mjs';
import { leinwand, ctx2d, pixel, alsBlob, ladeBild, rendere, verkleinere, freigeben, raumVon, HALT_Q } from './bild.mjs';
import { profilAusDatei, p3Moeglich, iccLesen, iccAusJpeg, farbTest } from './farbe.mjs';
import { STANDARD } from './geometrie.mjs';
import { HALT_H, UEBER, ROH_MAX, breiteFuerSeite } from './masse.mjs';

// Mittlere und größte Abweichung je Kanal zwischen zwei gleich großen Pixelfeldern.
export function abweichung(a, b) {
  const summe = [0, 0, 0];
  const max = [0, 0, 0];
  const n = a.w * a.h;
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a.d[p * 4 + c] - b.d[p * 4 + c]);
      summe[c] += d;
      if (d > max[c]) max[c] = d;
    }
  }
  return { mittel: summe.map((s) => s / n), max };
}

function bildElement(datei) {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Bild nicht lesbar')); };
    img.src = url;
  });
}

// In einen anderen Farbraum zeichnen (der Browser rechnet um). Gleicher Farbraum: dieselbe Leinwand.
function imRaum(c, raum, frei) {
  if (raumVon(c) === raum) return c;
  const z = leinwand(c.width, c.height, raum);
  frei.push(z);
  ctx2d(z, true).drawImage(c, 0, 0);
  return z;
}

async function dekodiereLeinwand(blob, raum, frei) {
  const b = await ladeBild(blob, raum);
  frei.push(b);
  if (b instanceof HTMLCanvasElement) return b;
  const c = leinwand(b.width, b.height, raum);
  frei.push(c);
  ctx2d(c, true).drawImage(b, 0, 0);
  return c;
}

const f1 = (v) => v.toFixed(1);
const raumText = (r) => (r === 'display-p3' ? 'Display P3' : 'sRGB');

export async function fotoVergleich(datei) {
  const frei = [];
  const merke = (x) => { if (x) frei.push(x); return x; };
  try {
    const profil = await profilAusDatei(datei);
    // Bezug: das Foto direkt aus der Datei, im eigenen Farbraum, gleich verkleinert wie beim Import.
    const bezugRaum = profil.art === 'display-p3' || profil.art === 'weit' ? (p3Moeglich() ? 'display-p3' : 'srgb') : 'srgb';
    const img = await bildElement(datei);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const f = Math.min(1, ROH_MAX / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * f));
    const th = Math.max(1, Math.round(h * f));
    const bezugGross = merke(f < 1 ? verkleinere(img, w, h, tw, th, 0, 0, w, h, bezugRaum) : leinwand(tw, th, bezugRaum));
    if (f >= 1) ctx2d(bezugGross).drawImage(img, 0, 0);
    img.src = '';
    const breite = breiteFuerSeite(tw / th);
    const vorher = merke(rendere(bezugGross, tw, th, STANDARD, breite, HALT_H, breite, bezugRaum));
    freigeben(bezugGross);

    // Weg durch die App, wie beim Import und Fertigstellen.
    const c = merke(await dekodiere(datei));
    const raum = raumVon(c);
    const roh = await alsBlob(c, 'image/jpeg', HALT_Q);
    freigeben(c);
    const rohC = await dekodiereLeinwand(roh, raum, frei);
    const neuC = merke(rendere(rohC, rohC.width, rohC.height, STANDARD, breite, HALT_H, breite, raum));
    const vorPixel = pixel(neuC);
    // Vorgänger: dasselbe Foto. Die Naht läuft durch den Worker wie beim echten Bauen.
    const n = await nahtZwischen(vorher, neuC, frei);
    const unveraendert = abweichung(vorPixel, pixel(neuC));
    const bildBlob = await alsBlob(neuC, 'image/jpeg', HALT_Q);
    const nachher = imRaum(await dekodiereLeinwand(bildBlob, raum, frei), bezugRaum, frei);

    // Außerhalb der Überlappung: zwischen den beiden Nähten.
    const x0 = UEBER;
    const bw = Math.max(1, breite - 2 * UEBER);
    const aussen = abweichung(pixel(vorher, x0, 0, bw, HALT_H), pixel(nachher, x0, 0, bw, HALT_H));
    const nurJpeg = abweichung(pixel(imRaum(neuC, bezugRaum, frei), x0, 0, bw, HALT_H), pixel(nachher, x0, 0, bw, HALT_H));

    // Nahtränder: links muss die Naht das Ende des Vorgängers sein, rechts der Anfang des neuen Bildes.
    const nahtC = imRaum(await dekodiereLeinwand(n.dateien.naht, raumVon(n.nahtC), frei), bezugRaum, frei);
    const randL = abweichung(pixel(nahtC, 0, 0, 1, HALT_H), pixel(vorher, breite - UEBER, 0, 1, HALT_H));
    const randR = abweichung(pixel(nahtC, UEBER - 1, 0, 1, HALT_H), pixel(nachher, UEBER - 1, 0, 1, HALT_H));

    const bildProfil = iccLesen(iccAusJpeg(new Uint8Array(await bildBlob.arrayBuffer())));
    const t = await farbTest();
    const mittelMax = Math.max(...aussen.mittel);
    return {
      name: datei.name || 'Foto', profil, raum, bezugRaum, breite, aussen, nurJpeg, unveraendert, randL, randR,
      bildProfil, farbTest: t, gut: mittelMax <= 3 && Math.max(...unveraendert.max) === 0,
      text: [
        `Fotovergleich: ${datei.name || 'Foto'} (${w}x${h}, Halt ${breite}x${HALT_H})`,
        `  Profil der Datei: ${profil.name || 'keins'} (${profil.art}), gerechnet in ${raumText(raum)}, Bezug in ${raumText(bezugRaum)}`,
        `  Profil im gespeicherten Bild: ${bildProfil ? `${bildProfil.name} (${bildProfil.art})` : 'keins (gilt als sRGB)'}`,
        `  Außerhalb der Überlappung (x ${x0} bis ${x0 + bw}), vorher gegen nachher:`,
        `    mittlere Abweichung R ${f1(aussen.mittel[0])} G ${f1(aussen.mittel[1])} B ${f1(aussen.mittel[2])}`,
        `    größte Abweichung   R ${aussen.max[0]} G ${aussen.max[1]} B ${aussen.max[2]}`,
        `    davon nur das letzte JPEG: mittel ${nurJpeg.mittel.map(f1).join(' ')}, größte ${nurJpeg.max.join(' ')}`,
        `  Beim Nähen verändert (vor dem JPEG): größte Abweichung ${Math.max(...unveraendert.max)}`,
        `  Nahtrand mittlere Abweichung: links ${f1(Math.max(...randL.mittel))}, rechts ${f1(Math.max(...randR.mittel))}`,
        `  Ergebnis: ${mittelMax <= 3 && Math.max(...unveraendert.max) === 0 ? 'in Ordnung' : 'AUFFÄLLIG'} (Grenze: im Mittel höchstens 3 Stufen)`,
      ].join('\n'),
    };
  } finally {
    for (const x of frei) freigeben(x);
  }
}

// Kurzbericht zur Farbtechnik dieses Geräts für die Diagnose.
export async function farbBericht() {
  const t = await farbTest();
  const w = t.werte;
  return `Farbe: P3-Leinwand ${t.p3 ? 'ja' : 'nein'}, P3 speichern: ${t.speichern}` +
    (t.p3 ? `, toBlob schreibt Profil: ${t.profil ? t.profil : 'keins'}` : '') +
    (w ? `, Probe innen ${w.innen} außen ${w.aussen} (soll ${w.soll.join(',')}, ist ${w.ist.join(',')})` : '') +
    (t.fehler ? `, Fehler: ${t.fehler}` : '');
}
