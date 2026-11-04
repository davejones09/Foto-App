# Etappen

Reihenfolge einhalten. Jede Etappe endet mit grünen Tests, Commit und Push. Eine Sitzung darf mehrere Etappen abarbeiten.

## Etappe 1: Die Kernschleife

Das Mindeste, das Spaß macht. Ohne das ist alles andere wertlos.

- Aufräumen laut `CLAUDE.md`
- PWA-Gerüst: Manifest, Icon, Service Worker, Version in der App, offline lauffähig
- Sucher mit Kamera, Rest, Live-Faden, Signal, Wert, Text und Auslöser
- Nähen im Worker, Speichern in IndexedDB, Rohbild zuerst
- Einfache Aufdeckung, Strecke zum Durchwischen, letzten Halt streichen
- Installationshinweis beim Öffnen in Safari
- Diagnosefenster

**Fertig, wenn:** Im Browser-Test ergeben zwei Aufnahmen ein Band von 2229 Pixeln Breite, Neuladen stellt alles wieder her, und die App lädt offline.

## Etappe 2: Erstlauf und Bedienung

- Erstlauf laut `KONZEPT.md`, mit langsamer erster Aufdeckung
- Marken
- Volle Aufdeckung mit zeichnendem Faden und Stempel
- Feinjustieren
- Import aus der Mediathek, auch für den ersten Halt
- Mehrere Strecken, „Neue Strecke“
- Alle Texte aus `TEXTE.md`, alle Fehlerzustände

**Fertig, wenn:** Der Erstlauf ohne Vorwissen verständlich ist, geprüft an Screenshots jedes Schritts, und ein 25-MP-Testbild im Import nicht abstürzt (im Test erzeugt).

## Etappe 3: Ausfahrt

- Karussell mit Endstation und Teilen
- Gesamtbild
- Sicherung und Wiedereinspielen
- Fahrt als Video mit den drei Tempi

**Fertig, wenn:** Die Karussell-Bilder aneinandergelegt das Band ohne Stufe ergeben (per Test nachgerechnet), die Sicherung sich verlustfrei einspielen lässt und die Fahrt ein abspielbares MP4 erzeugt.

## Etappe 4: Feinschliff

- Fahrplan mit Pünktlichkeit und Halt-Namen
- Blindfahrt mit Finale
- Tageswechsel in der Leiste, Herauszoomen auf die ganze Strecke
- Linsenwechsel, sofern `enumerateDevices` mehrere Rückkameras liefert

**Fertig, wenn:** Alles aus `KONZEPT.md` gebaut oder in `docs/ENTSCHEIDUNGEN.md` begründet gestrichen ist.

## Nachtrag: Einführung

- Drei Bildschirme vor der Kamera-Freigabe: was die App macht, wie ein Anschluss funktioniert, was am Ende rauskommt
- Gezeichnete, animierte Beispiele, keine fremden Fotos, bei reduzierter Bewegung als Standbild
- Überspringbar, nur beim ersten Start, in den Strecken wieder aufrufbar

**Fertig, wenn:** Die Einführung im Browser-Test vor jeder Kamera-Anfrage erscheint, sich überspringen und wieder öffnen lässt und nach dem ersten Mal nicht mehr von selbst kommt. Geprüft an Screenshots jedes Bildschirms.

## Nachtrag: Reel

- Die Fahrt in der Ausfahrt wird zum Reel: Länge statt Tempo, Abschnitt von bis Halt, Vorschlag bei zu hohem Tempo, Start in Bewegung, weiches Ende, Endstation abwählbar, Titelbild, nur MP4, „Teilen“ und „In Fotos speichern“.

**Fertig, wenn:** Ein 15-s-Reel eines Abschnitts im Browser-Test als MP4 mit 15 s Länge entsteht, sich ab dem ersten Bild bewegt, das Titelbild 1080 × 1920 misst und die Rechnung für Länge, Abschnitt, Vorschlag und Textränder in Node-Tests stimmt.

## Nachtrag: Serie aus der Mediathek

- Mehrfachauswahl bis 10, Rohbild zuerst, einzeln dekodieren, Fortschritt
- 75 Ausschnitte je Foto, Motivschutz, schnelle Paarwerte, Held-Karp, Viterbi, fester Start
- „Beste Anschlüsse“ oder „Nach Aufnahmezeit“ (EXIF), Vorschau mit Ziehen, Entfernen, Ausschnittwahl
- Bauen mit Fortschritt, Abbruch ohne Verlust, Blindfahrt nur Einzelfoto, Speicherformat 2 mit Migration

**Fertig, wenn:** Node-Tests Reihenfolge, festen Start, Aufnahmezeit-Modus, Motivschutz, Held-Karp und EXIF prüfen und der Browser-Test eine gemischte Serie richtig ordnet, nach einem Abbruch ohne Verlust weiterbaut und alte Strecken die Migration überstehen.

## Nachtrag: Ideen für den nächsten Halt

- Knopf „Idee“ im Sucher, „Andere Idee“, Ortswahl, Tipps bei niedrigem Wert aus derselben Quelle
- Mindestens 60 getaggte Ideen, regelbasiert, offline, keine Wiederholung je Strecke, Kontrast nach drei gleichfarbigen Halten
- Richtungshinweis, wenn eine Kameralinie knapp neben einer Marke liegt

**Fertig, wenn:** Node-Tests Merkmale, Auswahl, Wiederholungsfreiheit, Kontrast und die Richtung (gegen ein Kameramodell) prüfen und der Browser-Test Idee, Ort und Richtungshinweis im Sucher zeigt.

## Nachtrag: Serie ganz lassen

- Halte mit eigener Breite, Serienfotos ganz (nur außerhalb 0,7 bis 2:1 um das Motiv beschnitten), Format 4 mit Breite 1296 für alte Halte
- Motivkarte über Schärfe, Motiv per Antippen
- Serien-Übergang mit Linien verbiegen (abgelöst durch „Fotos unverändert“)
- Reihenfolge nach vollen Fotos, Feinjustieren statt Ausschnittwahl
- Karussell mit Versatz gegen Grenzen im Motiv

**Fertig, wenn:** Node-Tests Bandbreiten, Motivkarte (scharf gegen unscharf), Zuschnitt, Übergang und Karussell-Versatz prüfen und der Browser-Test eine Serie mit ganzen Fotos, Panorama-Zuschnitt und Feinjustieren baut.

## Nachtrag: Fotos unverändert

- Grundregel: Fotos werden außerhalb des Übergangs nicht verändert (CLAUDE.md, Feste Regeln)
- Keine Farbangleichung mehr, weder Kamera noch Import noch Serie, auch keine Option
- Neuer weicher Übergang statt Laplace-Naht, für alle Halte, Ränder exakt im Original
- Linien biegen nur in der Überlappung und nur bis 3 % der Höhe
- Farbprofil: erkennen, in Display P3 rechnen, toBlob prüfen und notfalls Profil einsetzen, JPEG 0,95, Ausgaben in sRGB
- Diagnose „Foto vergleichen“: vorher gegen nachher außerhalb der Überlappung, mittlere und größte Abweichung je Kanal
- Alte Strecken: nichts wird still neu gerechnet, „Neu nähen“ nur nach Rückfrage

**Fertig, wenn:** Node-Tests zeigen, dass ein Halt außerhalb der Überlappung verlustfrei exakt das Original ist, die Naht an beiden Rändern ohne Stufe ins Original übergeht, nur bis 3 % gebogen wird und keine Stelle `angleichen` aufruft. Die Browser-Tests bauen eine P3-Serie (Profil bleibt, nach JPEG im Mittel höchstens 3 Stufen Abweichung, Karussell in sRGB), führen den Fotovergleich der Diagnose aus und zeigen, dass alte Strecken nur nach Rückfrage neu genäht werden.

## Nachtrag: Professioneller Auftritt

Das Bahn-Thema fällt weg, der Name „Nahtlos“ bleibt. In sechs Schritten, jeder mit Tests, Commit und Push:

1. **Sprache:** Projekt, Foto, Passung, Naht, Hilfslinien, Fotos, Exportieren, Reel, Überraschungsmodus. Bewertung Perfekt, Passt gut, Passt teilweise, Passt nicht. Pünktlichkeit, Endstation, Stempel und Signallichter sind weg, der Sucher zeigt die Passung als Zahl mit Balken.
2. **Oberfläche:** neutrales dunkles Grau, ein zurückhaltender Akzent, neues Icon und neue Startbilder. Die App startet im Hauptmenü.
3. **Hauptmenü:** Neu erstellen (Carousel, Reel, Collage), Zuletzt bearbeitet, Alle Projekte, Einstellungen. Ablauf: Karte, Fotos, Vorschau, Export.
4. **Keine Spuren der App:** kein Text im Ergebnis, neutrale Dateinamen, saubere Metadaten, Carousel ohne Abschluss-Slide (Zoom bis 8 % oder Beschnitt an den Enden), Reel endet auf dem letzten Bild.
5. **Collage:** 2 bis 9 Fotos, drei Formate, 55 Vorlagen, Mit Rahmen oder Nahtlos, Gesten, eigener Projekttyp mit Sicherung (Format 5).
6. **Reel-Stile:** Band, Sanft, Schwung, Zoom, Naht mit Live-Vorschau.

**Fertig, wenn:** `test/texte.test.mjs` keinen Bahnbegriff findet. Die Browser-Tests starten im Hauptmenü, vergleichen jede Carousel-Slide Pixel für Pixel mit dem Band (letzte Slide gefüllt), finden keine App-Hinweise in JPEG und MP4, bauen eine Collage ohne Farbänderung außerhalb der Nähte samt Neuladen, Sicherung und Migration, und erzeugen ein Stil-Reel mit genau 450 Bildern in 15 s.

## Streichliste, falls es knapp wird

Von oben nach unten zuerst streichen:

1. Linsenwechsel
2. Überraschungsmodus
3. Namen für Fotos
4. Herauszoomen auf das ganze Band (Leiste bleibt)
5. Reel-Stile Schwung und Naht (Band, Sanft und Zoom bleiben)
6. Collage im Stil „Nahtlos“ (Mit Rahmen bleibt)

Nie streichen: Rohbild zuerst speichern, Offline-Betrieb, Diagnose, Sicherung, Carousel.

## Was David am Ende tun muss

Schreibe David nach dem ersten Merge genau das:

1. Den PR legt Claude selbst an. David mergt ihn auf GitHub.
2. Im Repository unter **Settings → Pages** als Quelle `Deploy from a branch`, Branch `main`, Ordner `/ (root)` wählen. Das ist nur einmal nötig.
3. Nach ein, zwei Minuten die Adresse aus Safari auf dem iPhone öffnen: Teilen → Zum Home-Bildschirm.
4. Ab dann immer über das Icon starten.

## Abnahme am iPhone

Das kann nur David prüfen. Liste ihm die Punkte auf, die er vor dem Praxistest in etwa 20 Minuten durchgehen kann:

- **Start:** Nach dem Update startet die App im Hauptmenü. Alte Projekte stehen unter „Zuletzt bearbeitet“ und „Alle Projekte“ (als Carousel), mit Titelbild. Icon und Startbild sind neu (eventuell erst nach erneutem „Zum Home-Bildschirm“).
- **Einführung:** Einstellungen → „Einführung ansehen“. Drei Bildschirme, am Ende zurück in die Einstellungen.
- **Carousel:** Karte „Carousel“, Kamera, drei bis vier Fotos mit Passung machen. Im Sucher: Zahl und Balken statt Lichtern, Hilfslinien als Striche. Dann Projekt → Exportieren: Die Vorschau der Slides ansehen, Carousel teilen und in Instagram prüfen, ob die letzte Slide voll ist und nirgends Text steht.
- **Reel aus demselben Projekt:** In Exportieren jeden Stil kurz in der Vorschau ansehen, dann je ein Reel mit „Naht“ und „Schwung“ in 15 s bauen, in Fotos speichern und ansehen. Ruckelt etwas, ist das ein Befund. Mit vielen Fotos und 15 s muss der Vorschlag „Foto 1 bis …“ kommen.
- **Mediathek:** Karte „Reel“, Mediathek, 5 Fotos von der Lumix, zusammensetzen, exportieren.
- **Collage:** Karte „Collage“, Mediathek, 4 bis 6 Fotos. Feld antippen, ziehen, mit zwei Fingern zoomen, ein Foto auf ein anderes Feld ziehen. Vorlage, Format 9:16 und „Nahtlos“ probieren, Abstand und Rahmenfarbe bei „Mit Rahmen“. Exportieren → Collage als Bild, in Fotos ansehen (2160 Pixel breit, Farben wie im Original). Einmal mit der Kamera eine Collage beginnen.
- **Sicherung:** Eine Collage sichern, in den Einstellungen einspielen, sie steht danach doppelt in „Alle Projekte“.
- **Metadaten:** Ein exportiertes Carousel-Bild und das Reel in Fotos öffnen, Infos (i) ansehen: kein Hinweis auf Nahtlos.
- **Offline:** Flugmodus an, App schließen, neu öffnen: Hauptmenü, Projekte und Kamera gehen.
- **Diagnose:** Einstellungen → Diagnose. „Beschädigte Fotos: 0“, „Lesetest: n von n Fotos vollständig lesbar“. Bericht kopieren und an Claude geben.

## Unterwegs

David kann unterwegs über die Claude-App eine neue Sitzung öffnen und den kopierten Bericht einfügen. Bugfixes müssen klein bleiben und dürfen vorhandene Projekte nie gefährden: Vor jeder Änderung am Speicherformat zuerst die Migration, dazu ein Test mit Daten der alten Fassung.
