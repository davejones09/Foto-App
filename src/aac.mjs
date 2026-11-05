// Ton als AAC-LC, mit eigenem Encoder statt AudioEncoder: So läuft auf jedem Gerät derselbe, getestete Weg
// (siehe docs/ENTSCHEIDUNGEN.md). Der Encoder wird erst geladen, wenn wirklich Musik ins Video soll.
let laden = null;

async function encoder(kanaele, rate, bitrate) {
  if (!laden) laden = import('../vendor/aac.mjs').then(({ default: Modul }) => Modul());
  let m;
  try { m = await laden; } catch (err) { laden = null; throw err; }
  const c = (name, typ, args) => m.cwrap(name, typ, args);
  const f = {
    init: c('init_encoder', 'number', ['number', 'number', 'number']),
    rahmen: c('get_encoder_frame_size', 'number', ['number']),
    extra: c('get_encoder_extradata', 'number', ['number']),
    extraLaenge: c('get_encoder_extradata_size', 'number', ['number']),
    eingang: c('get_encode_input_ptr', 'number', ['number', 'number']),
    sende: c('send_frame', 'number', ['number', 'number']),
    hole: c('receive_packet', 'number', ['number']),
    daten: c('get_encoded_data', 'number', ['number']),
    ende: c('flush_encoder_start', null, ['number']),
    zu: c('close_encoder', null, ['number']),
  };
  const ctx = f.init(kanaele, rate, bitrate);
  if (!ctx) throw new Error('AAC-Encoder startet nicht');
  return { m, f, ctx };
}

// kanaele: Float32Array je Kanal, gleich lang. pause: wird zwischendurch abgewartet, damit die Oberfläche lebt.
// Liefert { beschreibung, pakete, rahmen }: AudioSpecificConfig, rohe AAC-Pakete, Abtastwerte je Paket.
export async function aacKodieren(kanaele, rate, { bitrate = 192000, pause = null } = {}) {
  const { m, f, ctx } = await encoder(kanaele.length, rate, bitrate);
  try {
    const rahmen = f.rahmen(ctx);
    const adr = f.extra(ctx);
    const beschreibung = m.HEAPU8.slice(adr, adr + f.extraLaenge(ctx));
    const n = kanaele[0].length;
    const k = kanaele.length;
    const pakete = [];
    const abholen = () => {
      for (let g = f.hole(ctx); g !== 0; g = f.hole(ctx)) {
        if (g < 0) throw new Error(`AAC-Fehler ${g}`);
        const d = f.daten(ctx);
        pakete.push(m.HEAPU8.slice(d, d + g));
      }
    };
    // Der Encoder hat einen Vorlauf von einem Rahmen. Wer ihn überspringt, hat den Ton exakt auf dem Bild.
    const stueck = new Float32Array(rahmen * k);
    let zaehler = 0;
    for (let start = rahmen; start < n; start += rahmen) {
      stueck.fill(0);
      const ende = Math.min(rahmen, n - start);
      for (let c = 0; c < k; c++) {
        const q = kanaele[c];
        for (let i = 0; i < ende; i++) stueck[i * k + c] = q[start + i];
      }
      const bytes = new Uint8Array(stueck.buffer);
      const zeiger = f.eingang(ctx, bytes.length);
      if (!zeiger) throw new Error('AAC: kein Speicher');
      m.HEAPU8.set(bytes, zeiger);
      const r = f.sende(ctx, BigInt(start));
      if (r < 0) throw new Error(`AAC-Fehler ${r}`);
      abholen();
      if (pause && ++zaehler % 200 === 0) await pause();
    }
    f.ende(ctx);
    abholen();
    // Nicht länger als das Bild.
    pakete.length = Math.min(pakete.length, Math.ceil(n / rahmen));
    return { beschreibung, pakete, rahmen };
  } finally {
    f.zu(ctx);
  }
}
