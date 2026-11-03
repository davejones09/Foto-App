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

## Streichliste, falls es knapp wird

Von oben nach unten zuerst streichen:

1. Linsenwechsel
2. Blindfahrt
3. Halt-Namen
4. Herauszoomen auf die ganze Strecke (Leiste bleibt)
5. Fahrt nur im Tempo Regionalexpress
6. Fahrt ganz

Nie streichen: Rohbild zuerst speichern, Offline-Betrieb, Diagnose, Sicherung, Karussell.

## Was David am Ende tun muss

Schreibe David nach dem ersten Merge genau das, ohne das Konzept zu verraten:

1. PR über „Create PR“ anlegen und auf GitHub mergen.
2. Im Repository unter **Settings → Pages** als Quelle `Deploy from a branch`, Branch `main`, Ordner `/ (root)` wählen. Das ist nur einmal nötig.
3. Nach ein, zwei Minuten die Adresse aus Safari auf dem iPhone öffnen: Teilen → Zum Home-Bildschirm.
4. Ab dann immer über das Icon starten.

## Abnahme am iPhone

Das kann nur David prüfen. Liste ihm die Punkte auf, die er vor dem Praxistest in etwa 15 Minuten durchgehen kann, ohne dass die Liste das Konzept verrät:

- Einmal den Erstlauf der App durchspielen, ohne vorher etwas darüber zu lesen.
- Flugmodus an, App aus dem App-Umschalter schließen, neu öffnen: Alles ist noch da und die Kamera läuft.
- Während der Nutzung auf den Home-Bildschirm wechseln und zurück: Die Kamera kommt wieder.
- Ein Foto aus der Mediathek holen, auch eines von der Lumix.
- Alles aus der Ausfahrt einmal auslösen und in Fotos oder Instagram prüfen.
- Fünfmal auf die Versionsnummer tippen und den Bericht kopieren. Er sollte in Claude Code einfügbar sein.

## Unterwegs

David kann unterwegs über die Claude-App eine neue Sitzung öffnen und den kopierten Bericht einfügen. Bugfixes müssen klein bleiben und dürfen vorhandene Strecken nie gefährden: Vor jeder Änderung am Speicherformat zuerst die Migration, dazu ein Test mit Daten der alten Fassung.
