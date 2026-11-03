// Service Worker: alles für den Offline-Betrieb vorhalten. Der Name enthält APP_VERSION.
const APP_VERSION = '0.6.0';
const CACHE = 'nahtlos-' + APP_VERSION;

const DATEIEN = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './src/app.mjs',
  './src/band.mjs',
  './src/bild.mjs',
  './src/diagnose.mjs',
  './src/einfuhr.mjs',
  './src/geometrie.mjs',
  './src/kennzahlen.mjs',
  './src/ausgabe.mjs',
  './src/kamera.mjs',
  './src/kern.mjs',
  './src/kern.worker.mjs',
  './src/masse.mjs',
  './src/naehwerk.mjs',
  './src/rechner.mjs',
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
  './src/ansichten/strecke.mjs',
  './src/ansichten/sucher.mjs',
  './src/ansichten/strecken.mjs',
  './vendor/mp4-muxer.mjs',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
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

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  if (r.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { ignoreSearch: true }).then((a) => a || fetch(r)));
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
