# Technik

Ziel ist iPhone-Safari ab iOS 16.4, als Home-Bildschirm-App. Auf dem iPhone gibt es keine Entwicklerkonsole, deshalb ist die Diagnose (Abschnitt 7) Pflicht.

## 1. Aufbau

```
index.html            einzige Seite, alle Ansichten als DOM-Bereiche
manifest.webmanifest  standalone, Hochformat, relative Pfade
sw.js                 Offline-Cache, Name enthält APP_VERSION
src/
  kern.mjs            Bildkern
  serie.mjs           Serie: Ausschnitte, Motivschutz, Paarwerte, Held-Karp, Viterbi (reine Rechnung)
  serienwerk.mjs      Serie: kleine Fassungen per Canvas, Ausschnitt in Transformation umrechnen
  exif.mjs            Aufnahmezeit aus EXIF
  ideen.mjs           Ideen: 73 getaggte Sätze, Merkmale, Auswahl, Richtung (reine Rechnung)
  ideenquelle.mjs     Ideen im Sucher: Rest messen, Farben der letzten Halte, Ort, benutzte Ideen
  kern.worker.mjs     Live-Analyse und Nähen im Worker
  kamera.mjs          Stream-Verwaltung
  speicher.mjs        IndexedDB
  band.mjs            Strecke anzeigen, Kacheln laden
  ausgabe.mjs         Karussell, Reel, Titelbild, Gesamtbild, Sicherung, Fahrt fürs Finale
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

**Nie Blobs in IndexedDB.** WebKit auf dem iPhone macht gespeicherte Blobs unlesbar („Error preparing Blob/File data to be stored“, „An error occured reading the Blob argument“). Ab Format 3 liegen Bilddaten als ArrayBuffer im Speicher `dateien`. Halte und Serienfotos enthalten nur Metadaten. Ihre Bildfelder halten einen Verweis.

```
strecken: { id, name, erstellt, blind, ziel, formatVersion, gesichertBei }
halte:    { id, streckeId, index, zeit, quelle: 'kamera'|'import', rohB, rohH,
            transform: { dx, dy, zoom, drehung }, pfad, wert, teile, name,
            roh, bild, naht, vorschau, nahtVorschau,   // je { schluessel, laenge, typ } oder null
            beschaedigt: null | { felder, grund, zeit } }
serie:    { id, streckeId, serieId, reihe, rohB, rohH, zeit, aufnahme, name, plan, roh: Verweis }
dateien:  { schluessel: '<besitzerId>/<feld>', typ, laenge, daten: ArrayBuffer }   // Index auf laenge
```

- **Schreiben:** ArrayBuffer vor der Transaktion erzeugen (ein `await` auf einen Blob beendet sie sonst), Metadaten und Daten in einer Transaktion schreiben, danach zurücklesen und die Länge vergleichen. Scheitert das, wird der Datensatz entfernt und die App meldet „Das Foto ließ sich nicht sichern. Bitte nochmal.“
- **Lesen:** `blob(meta, feld)` baut aus dem ArrayBuffer einen frischen Blob im Arbeitsspeicher. `halte()` liefert nur Metadaten, Bilddaten kommen einzeln und nur bei Bedarf (Band und Ausgaben über den LRU-Lader).
- **Serienfoto zum Halt:** nur Metadaten. Der Halt übernimmt den Verweis auf das schon gesicherte Rohbild (`<fotoId>/roh`), die Daten werden nicht noch einmal geschrieben.
- **Format 3, Umzug:** Das Upgrade legt nur `dateien` an. Danach zieht `migriereBlobs()` Datensatz für Datensatz jeden alten Blob per `arrayBuffer()` um. Unlesbare Blobs brechen nicht ab: Das Feld wird leer, der Halt bekommt `beschaedigt`. Dann rechnet `ausbessern()` nach, was geht: Ohne Bild, aber mit Rohbild wird komplett neu genäht. Ohne Rohbild, aber mit Bild werden Vorschau und Naht aus dem Bild nachgerechnet. Ohne beides ist der Halt unrettbar.
- **Beschädigte Halte** stehen im Fahrplan mit „Beschädigt“ und „Löschen“, beim Start erscheint ein Hinweis. `loescheHalt()` lässt die späteren aufrücken. Der Nachfolger verliert seine Naht (und, falls sein Rohbild da ist, Bild und Vorschau) und wird an seinen neuen Vorgänger genäht. Ein unrettbarer Halt blockiert das Weiterbauen, bis er gelöscht ist.
- **Diagnose:** Anzahl und Größe der Einträge in `dateien` (über den Index, ohne Daten zu laden), Zahl beschädigter Halte mit Grund, Lesetest je Halt der aktiven Strecke.

- **Rest für den Sucher:** rechte 363 Pixel von `bild`. Der Rest ist nie angeglichen, deshalb driftet die Farbe über die Kette nicht weg.
- **Wiederaufnahme:** iOS beendet Apps im Hintergrund jederzeit. Alles muss aus der Datenbank wiederherstellbar sein, ohne Zustand im Speicher vorauszusetzen.
- **Unterbrochenes Nähen:** Ein Halt mit `roh`, aber ohne `bild` wird beim Start automatisch fertiggestellt.
- **Letzten Halt streichen:** löscht nur den letzten Datensatz. Der vorherige Halt ist davon nicht betroffen.

## 5. Strecke anzeigen

Jeder Halt hat eine eigene Breite `b_i` bei 1620 Höhe: Kamerahalte 1296 (4:5), Serienhalte `1620 × Seitenverhältnis`, begrenzt auf 1134 bis 3240. Die Überlappung ist immer 363. Halt `i` beginnt im Band bei `x_i = x_(i−1) + b_(i−1) − 363`.

**Bandbreite = Summe der Breiten − 363 × (n − 1)** (`bandBreite`, `lagen`, `stuecke` in `src/masse.mjs`; eine Zahl n steht dort für n Kamerahalte).

```
Halt 0: bild, x von 0 bis b_0 − 363
Naht 1: naht von Halt 1, 363 breit, liegt bei x_1
Halt 1: bild, x von 363 bis b_1 − 363
...
Letzter Halt: bild, x von 363 bis b_(n−1)
```

Sucher-Rest und Wert nutzen immer den 363 Pixel breiten Streifen am rechten bzw. linken Rand, egal wie breit der Halt ist. Der Sucher selbst bleibt 4:5.

- **Nie das ganze Band auf einmal dekodieren.** Nur sichtbare Stücke laden und im Speicher höchstens etwa 6 halten (LRU). Dekodierte Bilder mit `close()` freigeben.
- Kleine Vorschauen (Höhe 240) pro Halt beim Speichern erzeugen, für Herauszoomen und Leiste.

## 6. Ausgaben

Jede Ausgabe läuft mit Fortschrittsanzeige und über den LRU-Lader. Geteilt wird über `navigator.share({ files })`. Das braucht eine frische Nutzergeste: erst erzeugen, dann „Teilen“ antippen lassen. Fallback ist ein Download-Link.

### Karussell

- Ein Bild ist ein 1296 × 1620 breiter Ausschnitt des Bands, ausgegeben als 1080 × 1350 JPEG 0,92. Gleiches Seitenverhältnis, kein Rand, kein Überstand: Beim Wischen läuft das Bild durch.
- Anzahl: `ceil(Bandbreite / 1296)`. Instagram erlaubt in der App 20 Bilder pro Beitrag (Stand 2026), ältere Tools nur 10. Etwa 27 Halte passen in einen Beitrag. Längere Strecken werden in Teile zerlegt.
- Das letzte Bild ist selten voll. Der Rest der Strecke läuft dort in den dunklen Grund aus und trägt die Endstation (`TEXTE.md`).
- Schafft iOS das Teilen vieler Dateien nicht auf einmal, in Portionen zu je 10 anbieten.

### Reel

- 1080 × 1920, 30 Bilder pro Sekunde, H.264 als MP4. Ohne MP4-Weg (WebCodecs oder `MediaRecorder` mit `video/mp4`) gibt es kein Reel, nie WebM.
- Länge 15, 30, 60 oder 90 s. Abschnitt von Halt a bis b: Bandbereich `a × 933` bis `b × 933 + 1296`. Weg = Bereich × 1920/1620 − 1080.
- Bewegung: ab dem ersten Bild mit vollem Tempo, die letzten 1,6 s bremsen gleichmäßig auf null. Mit Endstation bleiben am Ende 3 s für die Einblendung. Tempo = Weg / (Bewegungszeit − 0,8 s).
- Über 900 Pixel pro Sekunde: Vorschlag des längsten Abschnitts ab „Von“, der darunter bleibt.
- Texte im Reel: oben und unten mindestens 250, links und rechts mindestens 60 Pixel Abstand (`endstationLayout`, Test).
- Titelbild: Band in 1350 Pixel Höhe mittig, zentriert auf den besten Anschluss im Abschnitt, außen Grund.

### Fahrt (Finale der Blindfahrt, unverändert)

- 1080 × 1920, 30 Bilder pro Sekunde, H.264. Das Band wird auf die volle Höhe skaliert (Faktor 1920 / 1620). Weiche Beschleunigung am Anfang und Ende, je 1,5 Sekunden. Ganz am Ende die Endstation.
- Tempo: Bummelzug 220, Regionalexpress 450, Sprinter 900 Pixel pro Sekunde. Länge vorab anzeigen.
- Weg 1: `VideoEncoder` plus `mp4-muxer` (auf iOS ab 16.4 für Video, siehe caniuse). Mit `isConfigSupported` prüfen, zum Beispiel `avc1.640028`.
- Weg 2, wenn das scheitert: `MediaRecorder` mit `canvas.captureStream`, verfügbar ab iOS 14.5.
- Kein Ton in der ersten Fassung. Verlässt der Nutzer die App während des Renderns, darf es abbrechen, die Meldung bietet einen Neustart an.

### Karussell ohne Grenze durchs Motiv

- Je Halt die Motivkarte auf 640 Pixeln (im Worker, zwischengespeichert), daraus ein Spaltenprofil, zusammengesetzt zum Profil des Bands (`bandProfil`, in der Überlappung zählt das stärkere).
- `karussellPlan`: Versatz von 0 bis 15 % einer Slide (194 Pixel, in Schritten von 2). Bewertet wird die mittlere Motivdichte ±40 Pixel um jede Grenze. Der Versatz lohnt sich nur, wenn er die Summe um mindestens 0,05 senkt. Anzahl = `ceil((Band − Versatz) / 1296)`, sie kann also nie steigen.
- Bleibt an einer Grenze eine Dichte ab 25 % der stärksten Stelle, zeigt die Ausfahrt den Hinweis mit einer Vorschau dieser Stelle. Gebaut wird trotzdem.

### Gesamtbild

JPEG der ganzen Strecke. iOS begrenzt die Canvas-Fläche. Grenze zur Laufzeit ermitteln, indem ein Pixel gezeichnet und zurückgelesen wird, Start mit 16 MP als sicherer Annahme. Bei längeren Strecken wird verkleinert und die Endgröße angezeigt, nie stillschweigend beschnitten.

### Sicherung

ZIP mit `fflate`, ohne Kompression: `manifest.json` und alle Blobs je Halt. Einspielen legt die Strecke unter neuer ID wieder an. Liegt die letzte Sicherung mehr als 5 Halte zurück, erinnert die Ausfahrt daran.

### Import

- `<input type="file" accept="image/*">` ohne `capture`.
- Lumix-Fotos haben rund 25 MP. Mit `createImageBitmap(datei, { resizeWidth oder resizeHeight })` direkt beim Dekodieren auf höchstens 4000 Pixel lange Seite begrenzen, sonst droht auf dem iPhone der Speichertod. Ignoriert Safari die Option, nach dem Dekodieren die Größe prüfen und per Canvas verkleinern.
- Quer- und Hochformat funktionieren, gefüllt wird immer der 4:5-Rahmen. Danach direkt ins Feinjustieren.

### Serie

1. Auswahl mit `multiple`, höchstens 10. Jedes Foto einzeln: dekodieren (höchstens 4000 Pixel), als JPEG in `serie` sichern, Aufnahmezeit aus EXIF (`DateTimeOriginal`, sonst `lastModified`).
2. **Ganze Fotos:** Arbeitsfassung mit langer Seite 640 Pixel. Rahmen = ganzes Foto, Breite `1620 × Seitenverhältnis`, Zoom 1. Nur außerhalb von 0,7 bis 2:1 wird beschnitten (`zuschnitt`), auf die Grenze und um das Motiv herum. Dafür und nur dafür wird die Motivkarte gerechnet.
3. **Motivkarte** (`motivKarte`, auf der 640er-Fassung): Detail = |L − L mit Sigma 1 weichgezeichnet|, über 9 × 9 Pixel gemittelt. Davon 1,5 × den Median der Umgebung (Mittel je 32er-Block, Median über 5 × 5 Blöcke) und 0,3 abziehen, dann mit Sigma 6 glätten, Mittengewicht mit Sigma 0,4. Ein per Antippen gesetztes Motiv kommt als kräftige Glocke dazu (`motivSetzen`).
4. **Paarwert:** Nachbildung von `analysiere` über Profile der 363er-Ränder, auf einer Fassung mit 120 Zeilen: Zeilenfarben nach Angleichung, Linientreffer eng und weit, Struktur. Im Worker zwischengespeichert.
5. **Reihenfolge:** Held-Karp exakt über die vollen Fotos (bei 10 Fotos rund 100 000 Schritte). Hat die Strecke Halte, ist die rechte Kante des letzten Halts der feste Start. Feinjustieren in der Vorschau ändert Zoom und Verschiebung eines Fotos, danach wird neu bewertet.
6. **Übergang** (`src/uebergang.mjs`, nur für Serienhalte, `uebergang: 'serie'`): Hauptlinien beider Ränder suchen. Liegt das beste Paar (gleiche Richtung) höchstens 8 % auseinander, wird das neue Foto spaltenweise senkrecht verbogen: voll am Übergang, auslaufend bis 45 % der Breite, oben und unten verankert. Dann `zeilenGain` mit `gainMin` 0,2, `gainMax` 3,5, `zeilenSigmaAnteil` 0,14 und `angleichen` über 85 % der Breite. Der Faden wie im Kern, aber ein harter Schnitt statt Laplace-Überblendung (2 Pixel Kante gegen Treppchen). Kamerahalte nähen weiter mit dem Bildkern.
7. **Bauen:** erst alle offenen Halte der Strecke fertigstellen (scheitert das, bricht der Bau ab und fasst kein Foto an), dann den Plan je Foto sichern, dann Foto für Foto `serienFotoZuHalt` und `fertigstellenMitWiederholung`. Nach einem Abbruch geht die wartende Serie mit derselben Reihenfolge weiter.
8. **Fehler:** `fertigstellenMitWiederholung` liest Halt und Vorgänger bei jedem Versuch frisch aus der Datenbank (nie Blobs aus der Übergabe-Transaktion) und versucht es höchstens zweimal. `fertigstellen` gibt Leinwände und Bitmaps im `finally` frei. Zwischen den Fotos wartet der Bau 150 ms, ab 12 Fotos 500 ms. Dauer und Fehler je Foto stehen im Serienprotokoll der Diagnose (`localStorage`, übersteht Abstürze).
9. **Ab 13 Fotos** (durch Nachlegen möglich) rechnet die Reihenfolge nicht mehr Held-Karp, sondern eine Näherung: gierig von jedem Anfang, dann Teilstücke verschieben und umdrehen.

### Feinjustieren

`transform` wird beim Start aus dem Rohbild abgeleitet, sodass der 4:5-Rahmen formatfüllend passt. Zoom unter dem Füllmaß ist nicht möglich. Die Live-Berechnung läuft über die 96×120-Fassung, gerendert per OffscreenCanvas. Erst „Übernehmen“ rechnet die volle Auflösung.

### Ideen

- **Merkmale:** Rest des letzten Halts auf 91 × 405 Pixel. Linienprofil über die ganze Breite: Höhe und Stärke der stärksten Linie. Neigung aus der Linienhöhe im linken und rechten Drittel, ab ±8° gilt sie als schräg. Mittelfarbe darüber und darunter, eingeordnet nach Helligkeit (hell, mittel, dunkel) und Ton (blau, grün, warm, grau).
- **Letzte 3 Halte:** Mittelfarbe der Vorschauen. Gleicher Ton bei allen drei (oder alle hell, alle dunkel) heißt eintönig. Dann gewinnt die passende Kontrast-Idee.
- **Auswahl:** Jede Idee hat Tags (Höhe, Neigung, Stärke, Farbe oben und unten, Ort, Tageszeit). Ein widersprechendes Tag schließt sie aus, passende Tags geben Punkte. Bei schräger Linie haben Ideen ohne Schräge Abzug. Gezogen wird die beste noch nicht benutzte. Benutzte IDs stehen je Strecke in der Datenbank (`ideen:<streckeId>`), der Ort unter `ideen-ort`.
- **Richtung:** Liegt eine Kameralinie (aus `hauptlinien`) 3 bis 12 % neben einer Marke und trifft keine andere, zeigt der Sucher nach drei gleichen Messungen die Richtung. Liegt die Linie über der Marke, muss das iPhone höher: Höher halten oder nach oben kippen schiebt das Bild nach unten. Ein Lochkamera-Modell im Test prüft das.

### Worker

Jeder Auftrag hat eine Zeitgrenze (Nähen und Serienplan 60 s, Analyse 15 s, sonst 20 bis 30 s). Antwortet der Worker nicht, stürzt er ab oder ist eine Nachricht unlesbar, wird er beendet. Alle offenen Aufträge scheitern mit `WorkerFehler`, der nächste Auftrag startet einen frischen Worker. `generation()` zählt die Neustarts: Der Sucher schickt dann seinen Rest neu, die Serie baut den Plan im Worker neu auf und wiederholt den Auftrag einmal.

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
