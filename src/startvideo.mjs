// Startvideo beim Kaltstart. Es darf den Start nie blockieren: Die App lädt darunter weiter,
// Antippen überspringt es, und ohne Wiedergabe (z. B. Stromsparmodus) ist es sofort weg.
const LAENGE_MS = 4500;
const WARTEN_MS = 1200;

export function startVideo({ erzwingen = false } = {}) {
  const huelle = document.getElementById('startvideo');
  if (!huelle) return;
  const video = huelle.querySelector('video');
  let fertig = false;
  const weg = () => {
    if (fertig) return;
    fertig = true;
    huelle.classList.add('weg');
    setTimeout(() => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      huelle.remove();
    }, 350);
  };
  const ruhe = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!erzwingen && (navigator.webdriver || ruhe)) {
    huelle.remove();
    return;
  }
  huelle.addEventListener('pointerdown', weg);
  video.addEventListener('ended', weg);
  video.addEventListener('error', weg);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && video.paused) weg();
  });
  const versuch = video.play();
  if (versuch) versuch.catch(weg);
  setTimeout(() => { if (video.currentTime === 0) weg(); }, WARTEN_MS);
  setTimeout(weg, LAENGE_MS + WARTEN_MS + 1500);
}
