# Technik

Ziel ist iPhone-Safari ab iOS 16.4, als Home-Bildschirm-App. Auf dem iPhone gibt es keine Entwicklerkonsole, deshalb ist die Diagnose (Abschnitt 7) Pflicht.

**Namen im Code:** Interne Bezeichner und Speicherfelder stammen aus der ersten Fassung und bleiben, damit keine Daten umgezogen werden müssen: `strecke` (Projekt), `halt` (Foto), `pfad` (Naht), `marken` (Hilfslinien), `fahrplan` (Fotos), `ausfahrt` (Exportieren), `blind` (Überraschungsmodus). Sichtbar ist nur die neue Sprache.

## 1. Aufbau

```
index.html            einzige Seite, alle Ansichten als DOM-Bereiche
manifest.webmanifest  standalone, Hochformat, relative Pfade
sw.js                 Offline-Cache, Name enthält APP_VERSION
src/
  kern.mjs            Bildkern: Passung, Naht, Einfahrhilfe
  uebergang.mjs       Übergang: weiche Naht in der Überlappung, Linien biegen (reine Rechnung)
  farbe.mjs           Farbprofile lesen, Display-P3-Profil erzeugen und einsetzen, toBlob-Prüfung
  metadaten.mjs       Keine Spuren der App: JPEG nur mit JFIF und Profil, MP4 ohne Werkzeugnamen
  vergleich.mjs       Diagnose: Foto vor und nach dem Zusammensetzen vergleichen
  serie.mjs           Mehrere Fotos: Ausschnitte, Motivkarte, Paarwerte, Held-Karp (reine Rechnung)
  serienwerk.mjs      Mehrere Fotos: kleine Fassungen per Canvas
  collage.mjs         Collage: Formate, Vorlagen, Felder, Ausschnitte, Schnittbaum (reine Rechnung)
  collagewerk.mjs     Collage: Fotos einlesen, zeichnen, Ausgabe, Sicherung
  reelstil.mjs        Reel-Stile: Zeitplan, Bewegungen, Ausschnitt 9:16 (reine Rechnung)
  reelvorlagen.mjs    Reel-Vorlagen: Schnitte im Takt, Übergänge, Masken (reine Rechnung)
  reeltipps.mjs       Inhalte der Tipps für Reels, dargestellt in ansichten/reeltipps.mjs
  desktop.mjs         Browser-Fassung am Computer: Erkennung, Texte, Hereinziehen, Tastenkürzel
  clipreel.mjs        Reel aus Clips: Zeitplan, Suche im Clip, Zeichnen
  exif.mjs            Aufnahmezeit aus EXIF
  ideen.mjs           Ideen: 73 getaggte Sätze, Merkmale, Auswahl, Richtung (reine Rechnung)
  ideenquelle.mjs     Ideen im Sucher: Rest messen, Farben der letzten Fotos, Ort, benutzte Ideen
  kern.worker.mjs     Live-Analyse, Übergang, Motivkarte im Worker
  kamera.mjs          Stream-Verwaltung
  speicher.mjs        IndexedDB
  band.mjs            Band anzeigen, Kacheln laden
  ausgabe.mjs         Carousel, Reel mit Stilen, Titelbild, Gesamtbild, Sicherung
  ansichten/          Hauptmenü, Einführung, Sucher, Aufdeckung, Ausschnitt, Projekt, Fotos, Exportieren, Collage
vendor/               mp4-muxer, fflate, aac (je eine Datei)
test/                 Kern- und Browser-Tests
docs/                 Konzept, Technik, Etappen, Texte, Entscheidungen
```

App-Icon und Startbilder entstehen per Skript aus der Vorlage `werkzeuge/icon-quelle.png` und werden als PNG eingecheckt (`npm run icons`, braucht Pillow). Das Startbild zeigt das Symbol in derselben Größe und Lage wie das erste Bild des Startvideos.

Das Startvideo liegt in `medien/start.mp4` (1080 × 2340, H.264, ohne Ton) und läuft bei jedem Kaltstart. `src/startvideo.mjs` nimmt es nach dem Ende, beim Antippen oder ohne Wiedergabe (Stromsparmodus) weg, die App lädt darunter weiter. Weil Safari Videos per Range-Anfrage lädt, beantwortet der Service Worker diese aus dem Cache mit 206.

### Oberfläche und Ablauf

- **Start im Hauptmenü** (`ansichten/start.mjs`): Neu erstellen (Carousel, Reel, Collage), Zuletzt bearbeitet, Alle Projekte, Einstellungen. Die Einführung kommt beim ersten Start davor. `body[data-gestartet]` meldet, wann der Start durch ist (für Tests).
- **Carousel und Reel** legen dasselbe Band-Projekt an (`strecke.art` = `carousel` oder `reel`, entscheidet nur, welche Ausgabe in Exportieren oben steht). Kamera: Projekt sofort, dann Sucher. Mediathek: Der Dateidialog öffnet noch in der Geste (`frage(..., { sofort })`), das Projekt entsteht erst beim `change`-Ereignis (`vormerken`), bei `cancel` gar nicht.
- **Zurück** führt aus Sucher, Projekt, Collage, Alle Projekte und Einstellungen ins Hauptmenü. Import aus dem Hauptmenü landet danach im Projekt, nicht im Sucher.
- **Passung im Sucher:** Zahl, Text und ein schmaler Balken (`zeigePassung` in `ui.mjs`), Balken im Akzent ab 70. Hilfslinien sind kurze Striche.
- **Gestaltung:** Farben als CSS-Variablen in `style.css` (`--grund #111213`, `--flaeche`, `--linie`, `--text`, `--akzent #8fb1ff`). Hauptknöpfe hell mit dunkler Schrift.

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

**Grundregel: Fotos werden außerhalb des Übergangs nicht verändert.** Ein Halt ist außerhalb der Überlappung das unveränderte Original, nur gerahmt (Ausschnitt und Maßstab). Keine Farbangleichung, keine Option dafür. Gerechnet wird nur in der 363 Pixel breiten Überlappung, und auch dort gehen beide Ränder exakt ins Original über.

`src/kern.mjs` ist reine Rechnung ohne Browser-APIs und läuft im Worker. Er liefert Anschlusswert, Faden und Einfahrhilfe. Die Naht selbst rechnet `src/uebergang.mjs`.

| Größe | Volle Auflösung | Live-Analyse |
|---|---|---|
| Halt | 1296 × 1620 (4:5) | 96 × 120 |
| Überlappung | 363 (28 %) | 27 |

### Funktionen

- `analysiere(a, b)`: Rest gegen Kamera-Überlappung. Liefert `{ pfad, zeilen, wert, teile }`.
- `hauptlinien(bild, n)`: Höhe der stärksten Linien am rechten Bildrand, für die Marken.
- `bewertung(wert)`: Text zum Wert.
- `ausschnitt`, `zeilenGain`, `fadenFinden`: Bausteine. `zeilenGain` rechnet nur für die Bewertung (und damit die Lage des Fadens) und färbt kein Foto um.

### Übergang (`src/uebergang.mjs`)

Gilt für jeden Halt, ob Kamera, Import oder Serie. `anschliessen(letztes, neues, 363)` bekommt nur die beiden Randstreifen und liefert `{ naht, pfad, biegung }`. Ein verändertes neues Bild gibt es nicht mehr.

1. **Linien biegen:** Hauptlinien beider Streifen suchen (`randLinien`). Liegt das beste Paar gleicher Richtung höchstens 3 % der Höhe auseinander, werden beide Streifen spaltenweise senkrecht gebogen, oben und unten verankert, sodass die Linie in jeder Spalte auf `ya + (yb − ya) · smoothstep(x / (Breite − 1))` liegt. A bleibt am linken Rand, B am rechten Rand unverändert. Darüber wird nicht gebogen. Außerhalb der Überlappung wird nie gebogen.
2. **Faden:** `analysiere` auf den (gebogenen) Streifen.
3. **Weicher Übergang** (`ueberblenden`), je Farbkanal:
   - r = max(4, runde(Breite / 16)), la und lb = A und B, dreimal mit Box-Radius r weichgezeichnet
   - t = smoothstep(x / (Breite − 1)), tief = la × (1 − t) + lb × t
   - feder = max(6, runde(Breite × 0,03)), m = smoothstep((x − pfad[y] + feder) / (2 × feder)), fein = (A − la) × (1 − m) + (B − lb) × m
   - rand = min(1, min(x, Breite − 1 − x) / (2 × r)), Ergebnis = Original × (1 − rand) + (tief + fein) × rand, Original links der Mitte A, rechts B

   Bei 363 Pixeln: r = 23, feder = 11. Am Rand ist rand = 0, dort steht exakt das Original.

### Live-Schleife

1. Mit `requestVideoFrameCallback` (Fallback `requestAnimationFrame`) die Überlappung des Kamerabilds auf 27 × 120 herunterskalieren, maximal 12-mal pro Sekunde.
2. `getImageData` an den Worker, Ergebnis zurück.
3. Faden aus `pfad` zeichnen. Wert mit gleitendem Mittel beruhigen (Faktor 0,25). Text und Signal erst nach 300 ms stabilem Zustand wechseln, sonst flackert es.
4. Marken: `hauptlinien` einmal auf den Rest rechnen. Eine Marke wird grün, wenn die Kamera innerhalb von ±3 % der Höhe ebenfalls eine Hauptlinie hat. Dafür die Kamera-Überlappung mit `hauptlinien` messen, aber nur alle 3 Bilder.

Läuft ein Analysejob noch, wird das nächste Kamerabild verworfen, nicht eingereiht.

### Aufnahme

1. Volles Videobild als Rohbild in die Datenbank schreiben (JPEG 0,95). Erst danach weiter.
2. Mit dem Transformationswert (Abschnitt 4) den Halt in 1296 × 1620 rendern. Dieses Bild wird unverändert als JPEG 0,95 gespeichert.
3. Nur die beiden 363er-Randstreifen gehen an den Worker, `anschliessen` liefert die Naht. Ergebnisse speichern, Aufdeckung zeigen.
4. Der angezeigte Wert stammt von `analysiere` auf der 96×120-Fassung der fertig ausgerichteten Bilder. Die Einstellungen in `KONFIG` sind auf diese Größe abgestimmt. Der Faden wird auf voller Auflösung gesucht.

### Stand der Prüfung

- Kern: 9 Tests in `test/kern.test.mjs`. Übergang: 6 Tests in `test/uebergang.test.mjs` (Original verlustfrei unverändert, Ränder exakt, kein Sprung, Biegen bis 3 %, keine Stelle ruft `angleichen` auf).
- Zusätzlich mit fünf echten Beispielfotos von Hand geprüft: Eine Kette aus völlig verschiedenen Motiven ergibt ein durchgehendes Bild. Gleiche Überlappung ergibt 100, nicht passende Paare meist unter 40.
- Messwerte auf einem Linux-Server: Analyse rund 0,5 ms, Faden und weicher Übergang bei voller Auflösung rund 0,3 Sekunden je Anschluss.
- **Nicht geprüft:** auf einem iPhone und mit bewusst gesuchten Anschlüssen aus der echten Welt. Der Wert reagiert bei sehr feinen Details empfindlich und schwankt dort auch leicht. Die Schwellen sind mit echten Testfotos nachzujustieren.


## 4. Speicher

IndexedDB mit eigener kleiner Hülle, keine Bibliothek. Beim Start `navigator.storage.persist()` anfragen.

**Nie Blobs in IndexedDB.** WebKit auf dem iPhone macht gespeicherte Blobs unlesbar („Error preparing Blob/File data to be stored“, „An error occured reading the Blob argument“). Ab Format 3 liegen Bilddaten als ArrayBuffer im Speicher `dateien`. Halte und Serienfotos enthalten nur Metadaten. Ihre Bildfelder halten einen Verweis.

```
strecken: { id, name, erstellt, blind, ziel, formatVersion, gesichertBei }
halte:    { id, streckeId, index, zeit, quelle: 'kamera'|'import', rohB, rohH,
            transform: { dx, dy, zoom, drehung }, pfad, wert, teile, name,
            farbraum: 'srgb'|'display-p3', profil: { name, art } | null,
            nahtFarbraum, verfahren: 2 | null, biegung,
            roh, bild, naht, vorschau, nahtVorschau,   // je { schluessel, laenge, typ } oder null
            beschaedigt: null | { felder, grund, zeit } }
serie:    { id, streckeId, serieId, reihe, rohB, rohH, zeit, aufnahme, name, plan, farbraum, profil, roh: Verweis }
dateien:  { schluessel: '<besitzerId>/<feld>', typ, laenge, daten: ArrayBuffer }   // Index auf laenge
```

- **Schreiben:** ArrayBuffer vor der Transaktion erzeugen (ein `await` auf einen Blob beendet sie sonst), Metadaten und Daten in einer Transaktion schreiben, danach zurücklesen und die Länge vergleichen. Scheitert das, wird der Datensatz entfernt und die App meldet „Das Foto ließ sich nicht sichern. Bitte nochmal.“
- **Lesen:** `blob(meta, feld)` baut aus dem ArrayBuffer einen frischen Blob im Arbeitsspeicher. `halte()` liefert nur Metadaten, Bilddaten kommen einzeln und nur bei Bedarf (Band und Ausgaben über den LRU-Lader).
- **Serienfoto zum Halt:** nur Metadaten. Der Halt übernimmt den Verweis auf das schon gesicherte Rohbild (`<fotoId>/roh`), die Daten werden nicht noch einmal geschrieben.
- **Format 3, Umzug:** Das Upgrade legt nur `dateien` an. Danach zieht `migriereBlobs()` Datensatz für Datensatz jeden alten Blob per `arrayBuffer()` um. Unlesbare Blobs brechen nicht ab: Das Feld wird leer, der Halt bekommt `beschaedigt`. Dann rechnet `ausbessern()` nach, was geht: Ohne Bild, aber mit Rohbild wird komplett neu genäht. Ohne Rohbild, aber mit Bild werden Vorschau und Naht aus dem Bild nachgerechnet. Ohne beides ist der Halt unrettbar.
- **Beschädigte Halte** stehen im Fahrplan mit „Beschädigt“ und „Löschen“, beim Start erscheint ein Hinweis. `loescheHalt()` lässt die späteren aufrücken. Der Nachfolger verliert seine Naht (und, falls sein Rohbild da ist, Bild und Vorschau) und wird an seinen neuen Vorgänger genäht. Ein unrettbarer Halt blockiert das Weiterbauen, bis er gelöscht ist.
- **Diagnose:** Anzahl und Größe der Einträge in `dateien` (über den Index, ohne Daten zu laden), Zahl beschädigter Halte mit Grund, Lesetest je Halt der aktiven Strecke.

- **Rest für den Sucher:** rechte 363 Pixel von `bild`. Halte sind nie angeglichen, deshalb driftet die Farbe über die Kette nicht weg.
- **Format 5:** neuer Speicher `collagen` (Abschnitt Collage). Die Migration legt nur den Speicher an, Strecken und Halte bleiben unberührt. `strecke.art` fehlt bei alten Projekten und gilt dann als Carousel.
- **Format 6:** neuer Speicher `reelentwurf` mit einem Eintrag `aktuell` (Reel aus Clips: Medien, Musik, Stil, Länge, Ton-Anteil, Tempo, gesetzte Schnitte). Die Bytes von Clips, Fotos und Musik liegen in Stücken zu 8 MB in `dateien` unter `entwurf/<id>/<n>`, je Datei höchstens 500 MB. Die Migration legt nur den Speicher an.
- **Neue Felder ohne Migration:** `farbraum` fehlt bei alten Halten und gilt dann als `srgb` (so wurden sie gerechnet). `verfahren` fehlt bei Halten, die noch mit Farbangleichung genäht sind. Die App rechnet sie nie still neu: Die Strecken-Ansicht bietet einmal je Start „Neu nähen“ an, erst nach Rückfrage rechnet `neuNaehen()` Bild und Naht aus dem Rohbild neu.

### Farbprofil

- **Erkennen** (`profilAusDatei`): JPEG über die APP2-Abschnitte `ICC_PROFILE`, PNG über `iCCP` oder `sRGB`, HEIC und andere über die Kennung `acsp`. Eingeordnet wird nach den Primärfarben (`rXYZ`, `gXYZ`, `bXYZ`): `srgb`, `display-p3`, `weit` (etwa Adobe RGB) oder `anders`. Ohne Profil gilt sRGB.
- **Arbeitsfarbraum:** sRGB-Fotos bleiben sRGB, Display-P3-Fotos werden in Leinwänden mit `colorSpace: 'display-p3'` gerechnet, wenn das Gerät das kann und P3 auch speichern kann. Nur `weit` und `anders` werden umgerechnet (nach P3 bzw. sRGB), und dann sagt die App es. Jede Leinwand trägt ihren Farbraum (`c.farbraum`), alle Zwischenstufen laufen darin. P3-Bilder werden über ein Bild-Element dekodiert, weil `createImageBitmap` P3 nicht überall sicher erhält.
- **Naht:** in P3, sobald einer der beiden Halte P3 ist (`nahtFarbraum`).
- **toBlob:** `farbTest()` prüft beim ersten Gebrauch mit zwei Farbfeldern (eines auch in sRGB darstellbar, eines reines P3-Rot), ob ein P3-JPEG beim Zurücklesen gleich bleibt. `nativ`: toBlob schreibt das Profil selbst (Chromium tut das). `nachgesetzt`: Die App setzt ihr eigenes Display-P3-Profil (ICC v4, sRGB-Kurve) ins JPEG. `nein`: P3 geht verloren, dann rechnet die App in sRGB und sagt das beim Import. Am iPhone zeigt die Diagnose, welcher Fall gilt.
- **Qualität:** Rohbild und Bild als JPEG 0,95, Naht 0,95, Vorschauen 0,85.
- **Ausgaben:** Karussell, Reel, Titelbild und Gesamtbild entstehen auf sRGB-Leinwänden. Der Browser rechnet P3 beim Zeichnen sauber nach sRGB um. Die Sicherung enthält die gespeicherten Dateien unverändert.
- **Wiederaufnahme:** iOS beendet Apps im Hintergrund jederzeit. Alles muss aus der Datenbank wiederherstellbar sein, ohne Zustand im Speicher vorauszusetzen.
- **Unterbrochenes Nähen:** Ein Halt mit `roh`, aber ohne `bild` wird beim Start automatisch fertiggestellt.
- **Letzten Halt streichen:** löscht nur den letzten Datensatz. Der vorherige Halt ist davon nicht betroffen.

## 5. Band anzeigen

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

### Carousel ohne Abschluss-Slide

- Eine Slide ist ein 4:5-Ausschnitt des Bands, ausgegeben als 1080 × 1350 JPEG 0,92. Beim Wischen läuft das Bild durch.
- **Das Band geht genau in ganze Slides auf** (`karussellGrund`, `karussellPlan` in `kennzahlen.mjs`): Für jede Anzahl n ist der kleinste Zoom `max(1, n × 1296 / Band)`, erlaubt bis 8 %. Gewählt wird die Anzahl, die am meisten Bild behält (sichtbar = n × 1296 / (Band × Zoom²)). Mit Zoom fällt oben und unten gleich viel weg. Bleibt seitlich Band übrig, fällt es am Anfang und Ende weg. Kürzer als eine Slide auch mit 8 %: eine Slide mit so viel Zoom wie nötig. Nie leere Flächen.
- Folge: Zwei Kamerafotos (2229 Pixel) ergeben eine Slide, drei (3162) zwei Slides.
- **Motivversatz:** Je Foto die Motivkarte auf 640 Pixeln (im Worker, zwischengespeichert), daraus ein Spaltenprofil, zusammengesetzt zum Profil des Bands (`bandProfil`). Gesucht werden Zoom (bis zu 15 % einer Slide mehr Spielraum, höchstens 8 %) und Start, bei denen die Grenzen und die Schnitte an den Enden am wenigsten Motiv treffen (±40 Pixel). Das lohnt sich nur ab 0,05 weniger, sonst bleibt der Grundplan mittig. Die Anzahl ändert sich nie.
- Bleibt eine Grenze im Motiv (ab 25 % der stärksten Stelle), zeigt Exportieren die Stelle. Die Vorschau zeigt jede Slide genau so geschnitten wie das Ergebnis (`karussellVorschau`).
- Instagram erlaubt 20 Bilder pro Beitrag (Stand 2026). Mehr werden in Beiträge geteilt. Schafft iOS das Teilen vieler Dateien nicht, in Portionen zu je 10.

### Reel

- 1080 × 1920, 30 Bilder pro Sekunde, H.264 als MP4. Ohne MP4-Weg (WebCodecs oder `MediaRecorder` mit `video/mp4`) gibt es kein Reel, nie WebM.
- Länge 15, 30, 60 oder 90 s, Abschnitt von Foto a bis b. Das Reel endet auf dem letzten Bild, kein Abspann.
- **Band:** Weg = Bandbereich × 1920/1620 − 1080. Ab dem ersten Bild mit vollem Tempo, die letzten 1,6 s bremsen gleichmäßig auf null. Über 900 Pixel pro Sekunde: Vorschlag des längsten Abschnitts ab „Von“, der darunter bleibt.
- **Reel aus Clips** (`clipreel.mjs`, `ansichten/clips.mjs`): Videoclips und Fotos ohne Projekt. Jedes Ausgabebild sucht die passende Stelle per `currentTime` im versteckten Video-Element, höchstens zwei Clips sind gleichzeitig offen. Nur mit WebCodecs. Clips bleiben bewusst nur im Arbeitsspeicher, weil sie zu groß für die Datenbank sind. Je Medium lassen sich Ausschnitt (Ausfüllen mit Zoom und Lage, oder „Ganz zeigen“ mit unscharfem Hintergrund) und Länge einstellen. Musik (`musik.mjs`): Schläge per Einsatzkurve, Autokorrelation und dynamischer Programmierung, `musikPlan` legt jede Übergangsmitte auf einen Schlag. Der Ton wird als AAC über `AudioEncoder` ins MP4 geschrieben, ohne AAC-Encoder bleibt das Video stumm und die App sagt es. `?testton` erlaubt Opus, nur für Tests. Der Originalton der Clips wird weiterhin nicht übernommen.
- **Vorlagen** (`reelvorlagen.mjs`, gezeichnet in `stilMaler`): elf lebhafte Abläufe (Beat, Blitz, Slide, Swipe, Rush, Spotlight, Streifen, Mosaik, Wirbel, Drop, Mix) mit Schnitten im 120-BPM-Takt. Länge „Auto“ zeigt jedes Foto einmal im Originaltakt. Bei fester Länge wird das Tempo gestreckt, ab Faktor 1,8 kommt eine weitere Runde über die Fotos, unter 0,6 schlägt die App weniger Fotos vor. Nur mit WebCodecs. Kein Text und kein Logo, Farben ändern sich nur im Blitz. Die Vorschauen rechnen nur, solange sie sichtbar sind.
- **Übergangsstile** (`reelstil.mjs`, gezeichnet in `stilMaler`): Jedes Foto füllt den 9:16-Rahmen, der Ausschnitt (911 × 1620 aus dem Foto) liegt dort, wo das Spaltenprofil der Motivkarte am meisten Motiv zeigt. Standzeit = (Länge − (n − 1) × Übergang) / n.

  | Stil | Übergang | kleinste Standzeit | Bewegung |
  |---|---|---|---|
  | Sanft | 1,0 s | 1,6 s | Überblendung, jedes Foto zoomt langsam von 1,0 auf 1,06 |
  | Schwung | 0,45 s | 1,2 s | Schwenk um genau einen Rahmen, Bewegungsunschärfe aus 8 Teilbildern im laufenden Mittel |
  | Zoom | 0,7 s | 1,2 s | aktuelles Foto zoomt hinein (bis 2,2), das nächste kommt von 0,55 aus der Tiefe und blendet ein |
  | Naht | 0,9 s | 1,3 s | das nächste läuft von rechts ein, die Grenze hat die Form der echten Naht (`pfad`), weich über fünf Masken |

  Reicht die Länge nicht, schlägt die App die größte Fotoanzahl vor, die noch passt.
- **Nicht in Echtzeit:** Mit WebCodecs wird Bild für Bild kodiert, egal wie lange ein Bild braucht, deshalb ruckelt nichts. Im Ausweichweg (`MediaRecorder`, Echtzeit) sind Schwung und Naht ausgeblendet (`stileFuer`).
- **Live-Vorschau:** Jede Stil-Kachel spielt den Stil mit den ersten drei Fotos in Schleife, aus den kleinen Vorschauen (`stilVorschau`).
- **Titelbild:** 1080 × 1920 ganz mit Bild gefüllt. Band: das Band in voller Höhe, mittig auf der besten Passung. Stile: das Foto mit der besten Passung im Ausschnitt.

### Überraschungsmodus, Finale

Das Band läuft einmal im Vollbild durch (1080 × 1920, weiche Beschleunigung am Anfang und Ende), ohne Text am Ende.

### Keine Spuren der App

- Keine Logos, Texte, Statistiken, Abspänne oder Wasserzeichen in Carousel, Reel, Collage und Gesamtbild. Tests vergleichen jede Slide Pixel für Pixel mit dem Band.
- Dateinamen: `carousel-01.jpg` …, `reel.mp4`, `reel-cover.jpg`, `gesamtbild.jpg`, `collage.jpg`.
- **Metadaten** (`metadaten.mjs`): JPEG behält nur JFIF und das Farbprofil (kein EXIF, kein Kommentar, keine weiteren APP-Abschnitte). MP4: Namen in den `hdlr`-Kästen werden geleert, `udta` und `meta` werden zu leeren `free`-Kästen gleicher Größe. In `vendor/mp4-muxer.mjs` ist der eigene Handler-Name durch den neutralen „VideoHandler“ ersetzt.

### Gesamtbild

JPEG der ganzen Strecke. iOS begrenzt die Canvas-Fläche. Grenze zur Laufzeit ermitteln, indem ein Pixel gezeichnet und zurückgelesen wird, Start mit 16 MP als sicherer Annahme. Bei längeren Strecken wird verkleinert und die Endgröße angezeigt, nie stillschweigend beschnitten.

### Sicherung

ZIP mit `fflate`, ohne Kompression: `manifest.json` und alle Bilddaten je Foto. Einspielen legt das Projekt unter neuer ID wieder an. Liegt die letzte Sicherung mehr als 5 Fotos zurück, erinnert Exportieren daran. Collagen haben im Manifest `typ: 'collage'` und werden als Collage eingespielt.

### Collage

- **Speicher** (Format 5, Speicher `collagen`): `{ id, name, erstellt, geaendert, format, vorlage, stil, abstand, farbe, fotos, felder, vorschau }`. Je Foto `{ id, rohB, rohH, farbraum, profil, name, zeit, motiv, roh, vorschau }`, die Bilddaten in `dateien` (Rohbild JPEG 0,95 bis 4000 Pixel, Vorschau 1200 Pixel, Motivraster 24 Spalten). `felder: [{ foto, t: { x, y, zoom } | null }]`, `t = null` heißt: Ausschnitt aus der Motivkarte.
- **Formate** 4:5, 1:1, 9:16 bei 2160 Pixeln Breite. 55 Vorlagen für 2 bis 9 Fotos (Raster, ein großes mit kleinen, versetzt, Mosaik), alle in Anteilen der Fläche.
- **Mit Rahmen:** gleicher Abstand zwischen den Feldern und am Rand (bis 5 % der Breite), Farbe aus vier ruhigen Tönen.
- **Nahtlos:** Jede Vorlage lässt sich durchgehend schneiden (Guillotine, `baum`). Die Collage wird entlang des Schnittbaums zusammengesetzt: Jede Hälfte reicht um die halbe Übergangsbreite über die Schnittlinie (22 % des schmaleren Nachbarn, 16 bis 362 Pixel), dann rechnet `uebergang.mjs` den Streifen über die volle Länge. Waagerechte Schnitte werden dafür gedreht. So gibt es an T-Kreuzungen keine Kästchen. Außerhalb der Streifen ist jedes Feld das Foto.
- **Ausschnitt:** Das Foto füllt sein Feld (Zoom 1 bis 6), der Ausschnitt bleibt immer im Foto, nie leere Bereiche. Der Vorschlag schiebt das Fenster dorthin, wo die Motivkarte am meisten Motiv hat.
- **Gesten:** Antippen wählt, Ziehen im gewählten Feld verschiebt, zwei Finger oder Mausrad zoomen, Ziehen von einem anderen Feld auf ein Feld tauscht die Fotos. Beim Ziehen ohne Überblendung, danach mit.
- **Ausgabe:** sRGB, JPEG 0,95, Metadaten gesäubert. Die Rohbilder werden einzeln dekodiert und gleich freigegeben. Keine Farbänderung: Ein Test vergleicht jedes Feld außerhalb der Streifen mit dem Original (im Mittel unter 3 Stufen).

### Import

- `<input type="file" accept="image/*">` ohne `capture`.
- Erst das eingebettete Profil lesen, dann im passenden Farbraum dekodieren (Abschnitt Farbprofil). Das Rohbild wird als JPEG 0,95 gesichert.
- Lumix-Fotos haben rund 25 MP. Mit `createImageBitmap(datei, { resizeWidth oder resizeHeight })` direkt beim Dekodieren auf höchstens 4000 Pixel lange Seite begrenzen, sonst droht auf dem iPhone der Speichertod. Ignoriert Safari die Option, nach dem Dekodieren die Größe prüfen und per Canvas verkleinern.
- Quer- und Hochformat funktionieren, gefüllt wird immer der 4:5-Rahmen. Danach direkt ins Feinjustieren.

### Serie

1. Auswahl mit `multiple`, höchstens 10. Jedes Foto einzeln: dekodieren (höchstens 4000 Pixel), als JPEG in `serie` sichern, Aufnahmezeit aus EXIF (`DateTimeOriginal`, sonst `lastModified`).
2. **Ganze Fotos:** Arbeitsfassung mit langer Seite 640 Pixel. Rahmen = ganzes Foto, Breite `1620 × Seitenverhältnis`, Zoom 1. Nur außerhalb von 0,7 bis 2:1 wird beschnitten (`zuschnitt`), auf die Grenze und um das Motiv herum. Dafür und nur dafür wird die Motivkarte gerechnet.
3. **Motivkarte** (`motivKarte`, auf der 640er-Fassung): Detail = |L − L mit Sigma 1 weichgezeichnet|, über 9 × 9 Pixel gemittelt. Davon 1,5 × den Median der Umgebung (Mittel je 32er-Block, Median über 5 × 5 Blöcke) und 0,3 abziehen, dann mit Sigma 6 glätten, Mittengewicht mit Sigma 0,4. Ein per Antippen gesetztes Motiv kommt als kräftige Glocke dazu (`motivSetzen`).
4. **Paarwert:** Nachbildung von `analysiere` über Profile der 363er-Ränder, auf einer Fassung mit 120 Zeilen: Zeilenfarben nach Angleichung, Linientreffer eng und weit, Struktur. Im Worker zwischengespeichert.
5. **Reihenfolge:** Held-Karp exakt über die vollen Fotos (bei 10 Fotos rund 100 000 Schritte). Hat die Strecke Halte, ist die rechte Kante des letzten Halts der feste Start. Feinjustieren in der Vorschau ändert Zoom und Verschiebung eines Fotos, danach wird neu bewertet.
6. **Übergang:** derselbe wie für jeden Halt (Abschnitt 3, `src/uebergang.mjs`). Das Feld `uebergang: 'serie'` bleibt als Herkunftsangabe, wählt aber kein eigenes Verfahren mehr.
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

Einstellungen → Diagnose, oder fünfmal auf die Versionsnummer in den Einstellungen tippen. Das Fenster zeigt:

- Browser-Kennung, Stream-Auflösung, Bilder pro Sekunde, Analyse- und Nähzeit
- Speicherverbrauch aus `navigator.storage.estimate()`, Status von `persist`
- die letzten 50 Fehler (globale Handler für `error` und `unhandledrejection`)
- Farbe: ob die Leinwand Display P3 kann, ob P3 gespeichert werden kann (`nativ`, `nachgesetzt`, `nein`) und das Ergebnis der Probe
- „Foto vergleichen“: Ein Foto aus der Mediathek läuft wie beim Import und Bauen durch die App, nur im Speicher. Verglichen wird außerhalb der Überlappung mit dem Foto, wie der Browser es direkt aus der Datei zeigt: mittlere und größte Abweichung je Kanal, dazu Profil der Datei und des gespeicherten Bilds, ob das Nähen das Bild verändert hat (muss 0 sein) und die Nahtränder. Grenze: im Mittel höchstens 3 Stufen.
- „Bericht kopieren“: Text für die Zwischenablage, den David in Claude Code einfügen kann

Zum Nachjustieren auf der Reise zusätzlich der Schalter „Naht und Teilwerte zeigen“. Er zeigt `farbe`, `linien` und `struktur` live im Sucher.

## 8. Tests

- `node --test` für den Kern, immer.
- Browser-Tests mit Playwright, soweit im Umfeld installierbar, erst WebKit, sonst Chromium, Viewport 390 × 844. Die Kamera per `addInitScript` ersetzen: `getUserMedia` liefert `canvas.captureStream()` einer bewegten Testszene. So braucht der Test keine Dateien.
- Pflichtfälle: Zwei Aufnahmen ergeben die Bandbreite 2229. Neuladen stellt alles wieder her. Carousel geht genau auf, ohne Text, letzte Slide gefüllt. Metadaten sauber. Service Worker lädt offline. Abbruch beim Zusammensetzen verliert kein Foto. Collage ohne Farbänderung. Reel-Stile mit richtiger Dauer und Bildanzahl.
- `test/texte.test.mjs` prüft alle sichtbaren Texte, die Seite, das Manifest und jede Zeichenkette im Code auf Bahnbegriffe.
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

## Browser am Computer

Dieselbe App unter derselben Adresse, kein eigener Build. `src/desktop.mjs` erkennt den Computer (feine Maus, kein Mobilgerät, mindestens 700 Pixel breit). Dann entfällt der Hinweis zum Home-Bildschirm, Texte nennen Dateien und Maus, Teilen lädt herunter (mehrere Dateien als `export.zip`), Dateien lassen sich hereinziehen, Leertaste löst aus und Escape geht zurück. Ab 900 Pixel Breite ordnet `style.css` das Layout für große Bildschirme. Reels brauchen H.264 über WebCodecs oder MediaRecorder: In Browsern ohne das meldet die App, dass kein MP4 möglich ist.
