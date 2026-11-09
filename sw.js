// Service Worker: alles für den Offline-Betrieb vorhalten. Der Name enthält APP_VERSION.
const APP_VERSION = '0.21.0';
const CACHE = 'nahtlos-' + APP_VERSION;

const DATEIEN = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './src/app.mjs',
  './src/startvideo.mjs',
  './src/desktop.mjs',
  './src/band.mjs',
  './src/bild.mjs',
  './src/diagnose.mjs',
  './src/einfuhr.mjs',
  './src/exif.mjs',
  './src/farbe.mjs',
  './src/geometrie.mjs',
  './src/ideen.mjs',
  './src/ideenquelle.mjs',
  './src/kennzahlen.mjs',
  './src/reelstil.mjs',
  './src/reelvorlagen.mjs',
  './src/reeltipps.mjs',
  './src/clipreel.mjs',
  './src/vorschau.mjs',
  './src/musik.mjs',
  './src/ansichten/clips.mjs',
  './src/ansichten/reeltipps.mjs',
  './src/metadaten.mjs',
  './src/collage.mjs',
  './src/collagewerk.mjs',
  './src/ausgabe.mjs',
  './src/kamera.mjs',
  './src/kern.mjs',
  './src/kern.worker.mjs',
  './src/masse.mjs',
  './src/naehwerk.mjs',
  './src/rechner.mjs',
  './src/serie.mjs',
  './src/serienwerk.mjs',
  './src/uebergang.mjs',
  './src/vergleich.mjs',
  './src/speicher.mjs',
  './src/texte.mjs',
  './src/ui.mjs',
  './src/version.mjs',
  './src/zip.mjs',
  './src/zustand.mjs',
  './src/ansichten/aufdeckung.mjs',
  './src/ansichten/einfuehrung.mjs',
  './src/ansichten/ausfahrt.mjs',
  './src/ansichten/fahrplan.mjs',
  './src/ansichten/fein.mjs',
  './src/ansichten/serie.mjs',
  './src/ansichten/strecke.mjs',
  './src/ansichten/sucher.mjs',
  './src/ansichten/strecken.mjs',
  './src/ansichten/start.mjs',
  './src/ansichten/collage.mjs',
  './src/aac.mjs',
  './src/laden.mjs',
  './vendor/aac.mjs',
  './vendor/mp4-muxer.mjs',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './medien/start.mp4',
  './medien/start.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((l) => Promise.all(l.filter((k) => k.startsWith('nahtlos-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function teilantwort(antwort, bereich) {
  const daten = await antwort.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(bereich);
  const gesamt = daten.byteLength;
  let von = m && m[1] !== '' ? Number(m[1]) : null;
  let bis = m && m[2] !== '' ? Number(m[2]) : null;
  if (von === null && bis !== null) { von = Math.max(0, gesamt - bis); bis = gesamt - 1; }
  if (von === null) von = 0;
  if (bis === null || bis >= gesamt) bis = gesamt - 1;
  if (von > bis) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${gesamt}` } });
  return new Response(daten.slice(von, bis + 1), {
    status: 206,
    headers: {
      'Content-Type': antwort.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${von}-${bis}/${gesamt}`,
      'Content-Length': String(bis - von + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  if (r.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { ignoreSearch: true }).then((a) => a || fetch(r)));
    return;
  }
  // Safari lädt Videos per Range-Anfrage und spielt eine volle Antwort darauf nicht ab.
  const bereich = r.headers.get('range');
  if (bereich) {
    e.respondWith(
      caches.match(r, { ignoreSearch: true }).then((a) => (a ? teilantwort(a, bereich) : fetch(r))),
    );
    return;
  }
  e.respondWith(
    caches.match(r, { ignoreSearch: true }).then((a) => a || fetch(r).then((antwort) => {
      // Startbilder und Ähnliches nachträglich aufnehmen
      if (antwort.ok && url.pathname.includes('/icons/')) {
        const kopie = antwort.clone();
        caches.open(CACHE).then((c) => c.put(r, kopie));
      }
      return antwort;
    })),
  );
});
