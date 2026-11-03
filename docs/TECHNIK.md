# Technik

Ziel ist iPhone-Safari ab iOS 16.4, als Home-Bildschirm-App. Auf dem iPhone gibt es keine Entwicklerkonsole, deshalb ist die Diagnose (Abschnitt 7) Pflicht.

## 1. Aufbau

```
index.html            einzige Seite, alle Ansichten als DOM-Bereiche
manifest.webmanifest  standalone, Hochformat, relative Pfade
sw.js                 Offline-Cache, Name enthält APP_VERSION
src/
  kern.mjs            Bildkern
  kern.worker.mjs     Live-Analyse und Nähen im Worker
  kamera.mjs          Stream-Verwaltung
  speicher.mjs        IndexedDB
  band.mjs            Strecke anzeigen, Kacheln laden
  ausgabe.mjs         Karussell, Fahrt, Gesamtbild, Sicherung
  ansichten/          Einführung, Sucher, Aufdeckung, Feinjustieren, Strecke, Fahrplan, Ausfahrt
vendor/               mp4-muxer, fflate (je eine Datei)
test/                 Kern- und Browser-Tests
docs/                 Konzept, Technik, Etappen, Texte, Entscheidungen
```

App-Icon und Splash werden per Skript als PNG erzeugt und eingecheckt: gelber Faden auf fast Schwarz.

## 2. Kamera und iOS-Fallen

- **Stream anfordern:** `facingMode: environment`, `width: { ideal: 3840 }`, `height: { ideal: 2160 }`, kein Ton. Die tatsächliche Auflösung auslesen, nie annehmen.
- **Video-Element:** `playsinline muted autoplay`. Der Start braucht unter Umständen einen Fingertipp.
- **Keine Navigation:** In Standalone-Apps wurden Kamera-Streams bei Änderungen an Route oder Hash stummgeschaltet (WebKit-Bugs 212040, 215884). Deshalb gibt es kein `pushState` und keinen Hash: Ansichten wechseln nur im DOM.
- **Genau ein Stream:** Stoppen, wenn der Sucher nicht sichtbar ist. Bei `visibilitychange` und beim Ereignis `ended` der Spur neu starten, ohne Absturz und mit Lade-Anzeige. Erneute Rechte-Abfragen sind auf iOS normal.
- **Einzelbilder:** `ImageCapture` und erweiterte Kamerasteuerung gibt es auf iOS nicht. Ein Foto ist ein Videobild. Fokus und Belichtung lassen sich nicht sperren.
- **Bildschirm:** Wake Lock nutzen, falls verfügbar, und Fehler still schlucken.
- **Getrennter Speicher:** Safari und die Home-Bildschirm-App teilen ihren Speicher nicht. Die App erkennt das Öffnen in Safari und führt zuerst zur Installation, lässt aber „Trotzdem im Browser testen“ zu.
- **Haptik:** `navigator.vibrate` fehlt auf iOS. Rückmeldung läuft über Signal und Bewegung.

## 3. Bildkern

`src/kern.mjs` ist reine Rechnung ohne Browser-APIs und läuft im Worker.

| Größe | Volle Auflösung | Live-Analyse |
|---|---|---|
| Halt | 1296 × 1620 (4:5) | 96 × 120 |
| Überlappung | 363 (28 %) | 27 |

### Funktionen

- `analysiere(a, b)`: Rest gegen Kamera-Überlappung. Liefert `{ pfad, zeilen, wert, teile }`.
- `hauptlinien(bild, n)`: Höhe der stärksten Linien am rechten Bildrand, für die Marken.
- `bewertung(wert)`: Text zum Wert.
- `anschliessen(letztes, neues, ueberlappung)`: Liefert `{ naht, neu, pfad }`.
- `ausschnitt`, `zeilenGain`, `angleichen`, `naehen`, `fadenFinden`: Bausteine.

### Live-Schleife

1. Mit `requestVideoFrameCallback` (Fallback `requestAnimationFrame`) die Überlappung des Kamerabilds auf 27 × 120 herunterskalieren, maximal 12-mal pro Sekunde.
2. `getImageData` an den Worker, Ergebnis zurück.
3. Faden aus `pfad` zeichnen. Wert mit gleitendem Mittel beruhigen (Faktor 0,25). Text und Signal erst nach 300 ms stabilem Zustand wechseln, sonst flackert es.
4. Marken: `hauptlinien` einmal auf den Rest rechnen. Eine Marke wird grün, wenn die Kamera innerhalb von ±3 % der Höhe ebenfalls eine Hauptlinie hat. Dafür die Kamera-Überlappung mit `hauptlinien` messen, aber nur alle 3 Bilder.

Läuft ein Analysejob noch, wird das nächste Kamerabild verworfen, nicht eingereiht.

### Aufnahme

1. Volles Videobild als Rohbild in die Datenbank schreiben. Erst danach weiter.
2. Der Worker erzeugt mit dem Transformationswert (Abschnitt 4) den Halt in 1296 × 1620.
3. `anschliessen(letzter, neuer, 363)`, Ergebnisse speichern, Aufdeckung zeigen.
4. Der angezeigte Wert stammt von `analysiere` auf der 96×120-Fassung der fertig ausgerichteten Bilder. Die Einstellungen in `KONFIG` sind auf diese Größe abgestimmt. Der Faden wird auf voller Auflösung gesucht.

### Stand der Prüfung

- 12 Tests grün mit `npm test` (Datei `test/kern.test.mjs`).
- Zusätzlich mit fünf echten Beispielfotos von Hand geprüft: Eine Kette aus völlig verschiedenen Motiven ergibt ein durchgehendes Bild. Gleiche Überlappung ergibt 100, nicht passende Paare meist unter 40.
- Messwerte auf einem Linux-Server: Analyse rund 0,5 ms, Faden und Nähen bei voller Auflösung rund 0,5 Sekunden je Anschluss.
- **Nicht geprüft:** auf einem iPhone und mit bewusst gesuchten Anschlüssen aus der echten Welt. Der Wert reagiert bei sehr feinen Details empfindlich und schwankt dort auch leicht. Die Schwellen sind mit echten Testfotos nachzujustieren.

Die Tests liefern mit der Umgebungsvariable `SICHTPRUEFUNG=<datei.ppm>` ein Bild zum Ansehen.

## 4. Speicher

IndexedDB mit eigener kleiner Hülle, keine Bibliothek. Beim Start `navigator.storage.persist()` anfragen.

```
strecken: { id, name, erstellt, blind, ziel, formatVersion }
halte:    { id, streckeId, index, zeit, quelle: 'kamera'|'import',
            roh: Blob,          // volles Videobild oder Import, längste Seite maximal 4000 px
            transform: { dx, dy, zoom, drehung },
            bild: Blob,         // 1296×1620, angeglichen, JPEG 0,92
            naht: Blob|null,    // 363×1620 zum vorherigen Halt, JPEG 0,95
            wert, teile, name }
```

- **Rest für den Sucher:** rechte 363 Pixel von `bild`. Der Rest ist nie angeglichen, deshalb driftet die Farbe über die Kette nicht weg.
- **Wiederaufnahme:** iOS beendet Apps im Hintergrund jederzeit. Alles muss aus der Datenbank wiederherstellbar sein, ohne Zustand im Speicher vorauszusetzen.
- **Unterbrochenes Nähen:** Ein Halt mit `roh`, aber ohne `bild` wird beim Start automatisch fertiggestellt.
- **Letzten Halt streichen:** löscht nur den letzten Datensatz. Der vorherige Halt ist davon nicht betroffen.

## 5. Strecke anzeigen

Für `n` Halte gilt: **Bandbreite = n × 933 + 363 Pixel**, bei 1620 Pixeln Höhe (933 = 1296 − 363).

Die Stücke liegen so hintereinander:

```
Halt 0: bild, x von 0 bis 933
Naht 1: naht von Halt 1, 363 breit
Halt 1: bild, x von 363 bis 933
Naht 2: naht von Halt 2
...
Letzter Halt: bild, x von 363 bis 1296
```

- **Nie das ganze Band auf einmal dekodieren.** Nur sichtbare Stücke laden und im Speicher höchstens etwa 6 halten (LRU). Dekodierte Bilder mit `close()` freigeben.
- Kleine Vorschauen (Höhe 240) pro Halt beim Speichern erzeugen, für Herauszoomen und Leiste.

## 6. Ausgaben

Jede Ausgabe läuft mit Fortschrittsanzeige und über den LRU-Lader. Geteilt wird über `navigator.share({ files })`. Das braucht eine frische Nutzergeste: erst erzeugen, dann „Teilen“ antippen lassen. Fallback ist ein Download-Link.

### Karussell

- Ein Bild ist ein 1296 × 1620 breiter Ausschnitt des Bands, ausgegeben als 1080 × 1350 JPEG 0,92. Gleiches Seitenverhältnis, kein Rand, kein Überstand: Beim Wischen läuft das Bild durch.
- Anzahl: `ceil(Bandbreite / 1296)`. Instagram erlaubt in der App 20 Bilder pro Beitrag (Stand 2026), ältere Tools nur 10. Etwa 27 Halte passen in einen Beitrag. Längere Strecken werden in Teile zerlegt.
- Das letzte Bild ist selten voll. Der Rest der Strecke läuft dort in den dunklen Grund aus und trägt die Endstation (`TEXTE.md`).
- Schafft iOS das Teilen vieler Dateien nicht auf einmal, in Portionen zu je 10 anbieten.

### Fahrt

- 1080 × 1920, 30 Bilder pro Sekunde, H.264. Das Band wird auf die volle Höhe skaliert (Faktor 1920 / 1620). Weiche Beschleunigung am Anfang und Ende, je 1,5 Sekunden. Ganz am Ende die Endstation.
- Tempo: Bummelzug 220, Regionalexpress 450, Sprinter 900 Pixel pro Sekunde. Länge vorab anzeigen.
- Weg 1: `VideoEncoder` plus `mp4-muxer` (auf iOS ab 16.4 für Video, siehe caniuse). Mit `isConfigSupported` prüfen, zum Beispiel `avc1.640028`.
- Weg 2, wenn das scheitert: `MediaRecorder` mit `canvas.captureStream`, verfügbar ab iOS 14.5.
- Kein Ton in der ersten Fassung. Verlässt der Nutzer die App während des Renderns, darf es abbrechen, die Meldung bietet einen Neustart an.

### Gesamtbild

JPEG der ganzen Strecke. iOS begrenzt die Canvas-Fläche. Grenze zur Laufzeit ermitteln, indem ein Pixel gezeichnet und zurückgelesen wird, Start mit 16 MP als sicherer Annahme. Bei längeren Strecken wird verkleinert und die Endgröße angezeigt, nie stillschweigend beschnitten.

### Sicherung

ZIP mit `fflate`, ohne Kompression: `manifest.json` und alle Blobs je Halt. Einspielen legt die Strecke unter neuer ID wieder an. Liegt die letzte Sicherung mehr als 5 Halte zurück, erinnert die Ausfahrt daran.

### Import

- `<input type="file" accept="image/*">` ohne `capture`.
- Lumix-Fotos haben rund 25 MP. Mit `createImageBitmap(datei, { resizeWidth oder resizeHeight })` direkt beim Dekodieren auf höchstens 4000 Pixel lange Seite begrenzen, sonst droht auf dem iPhone der Speichertod. Ignoriert Safari die Option, nach dem Dekodieren die Größe prüfen und per Canvas verkleinern.
- Quer- und Hochformat funktionieren, gefüllt wird immer der 4:5-Rahmen. Danach direkt ins Feinjustieren.

### Feinjustieren

`transform` wird beim Start aus dem Rohbild abgeleitet, sodass der 4:5-Rahmen formatfüllend passt. Zoom unter dem Füllmaß ist nicht möglich. Die Live-Berechnung läuft über die 96×120-Fassung, gerendert per OffscreenCanvas. Erst „Übernehmen“ rechnet die volle Auflösung.

## 7. Diagnose

Fünfmal auf die Versionsnummer tippen. Das Fenster zeigt:

- Browser-Kennung, Stream-Auflösung, Bilder pro Sekunde, Analyse- und Nähzeit
- Speicherverbrauch aus `navigator.storage.estimate()`, Status von `persist`
- die letzten 50 Fehler (globale Handler für `error` und `unhandledrejection`)
- „Bericht kopieren“: Text für die Zwischenablage, den David in Claude Code einfügen kann

Zum Nachjustieren auf der Reise zusätzlich der Schalter „Faden und Teilwerte zeigen“. Er zeigt `farbe`, `linien` und `struktur` live im Sucher.

## 8. Tests

- `node --test` für den Kern, immer.
- Browser-Tests mit Playwright, soweit im Umfeld installierbar, erst WebKit, sonst Chromium, Viewport 390 × 844. Die Kamera per `addInitScript` ersetzen: `getUserMedia` liefert `canvas.captureStream()` einer bewegten Testszene. So braucht der Test keine Dateien.
- Pflichtfälle: Zwei Aufnahmen ergeben die Bandbreite 2229. Neuladen stellt alles wieder her. Karussell-Anzahl stimmt. Service Worker lädt offline. Abbruch beim Nähen verliert kein Foto.
- Screenshots im Viewport ansehen, nicht nur den Text prüfen.
- Lässt sich etwas nur am iPhone prüfen, gehört es in die Abnahmeliste in `ETAPPEN.md`, nicht unter den Teppich.

## 9. Bekannte Grenzen

- Ein Live-Foto ist ein Videobild und erreicht nicht die Qualität der iPhone-Foto-App. Für beste Qualität ist der Import aus der Mediathek da.
- Fokus und Belichtung bleiben automatisch.
- Die Lautstärketaste löst nicht aus, das erlaubt Safari nicht.
- Sollte es später nativ werden, ist `src/kern.mjs` die Vorlage für den Port.

## 10. Quellen

Stand 03.11.2026. Vor dem Festlegen auf ein Verhalten am Gerät selbst prüfen, die Angaben ändern sich.

- PWA-Fähigkeiten auf iOS: https://firt.dev/notes/pwa-ios/
- Kamera in Standalone-Apps: https://bugs.webkit.org/show_bug.cgi?id=185448, https://bugs.webkit.org/show_bug.cgi?id=212040, https://bugs.webkit.org/show_bug.cgi?id=215884
- WebCodecs: https://caniuse.com/webcodecs, https://caniuse.com/mdn-api_videoencoder_configure
- Karussell-Grenzen: https://www.stackedmarketer.com/?p=52933, https://adaptlypost.com/de/blog/how-to-schedule-carousel-posts-on-instagram-and-facebook
- Claude Code in der Cloud: https://code.claude.com/docs/en/web-quickstart.md
