// Genau ein Kamera-Stream. Stoppen, wenn der Sucher nicht sichtbar ist (TECHNIK.md, Abschnitt 2).
import { protokolliere, werte } from './diagnose.mjs';

let stream = null;
let geraetId = null;
let startVersprechen = null;
let beiEnde = null;

export const laeuft = () => !!stream && stream.getVideoTracks().some((t) => t.readyState === 'live');

export function setzeGeraet(id) { geraetId = id; }
export const aktuellesGeraet = () => geraetId;

export function beiStreamEnde(fn) { beiEnde = fn; }

export async function starte(video) {
  if (laeuft()) {
    if (video.srcObject !== stream) video.srcObject = stream;
    await spiele(video);
    return stream;
  }
  if (startVersprechen) return startVersprechen;
  startVersprechen = (async () => {
    const video_ = {
      width: { ideal: 3840 },
      height: { ideal: 2160 },
    };
    if (geraetId) video_.deviceId = { exact: geraetId };
    else video_.facingMode = 'environment';
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: false, video: video_ });
    } catch (err) {
      if (geraetId && err.name === 'OverconstrainedError') {
        geraetId = null;
        s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } } });
      } else throw err;
    }
    stream = s;
    const spur = s.getVideoTracks()[0];
    spur.addEventListener('ended', () => {
      protokolliere('kamera', 'Spur beendet');
      if (stream === s) stream = null;
      beiEnde?.();
    });
    video.srcObject = s;
    await spiele(video);
    const set = spur.getSettings ? spur.getSettings() : {};
    werte.stream = `${video.videoWidth}x${video.videoHeight}${set.frameRate ? ` @${Math.round(set.frameRate)}` : ''}${set.deviceId ? '' : ''}`;
    return s;
  })();
  try {
    return await startVersprechen;
  } finally {
    startVersprechen = null;
  }
}

async function spiele(video) {
  video.muted = true;
  video.setAttribute('playsinline', '');
  try { await video.play(); } catch (err) { if (err.name !== 'AbortError') throw err; }
  if (!video.videoWidth) {
    await new Promise((ok) => {
      const t = setTimeout(ok, 3000);
      video.addEventListener('loadedmetadata', () => { clearTimeout(t); ok(); }, { once: true });
    });
  }
}

export function stoppe(video) {
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null;
  if (video) video.srcObject = null;
}

// Rückkameras. Nur nach erteilter Freigabe tragen die Geräte Namen.
export async function rueckkameras() {
  try {
    const l = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    const vorne = /front|vorder|facetime|user/i;
    return l.filter((d) => d.label && !vorne.test(d.label));
  } catch {
    return [];
  }
}

export async function freigabeStatus() {
  try {
    const p = await navigator.permissions.query({ name: 'camera' });
    return p.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unbekannt';
  }
}
