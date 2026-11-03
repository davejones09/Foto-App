# Konzept

## In einem Satz

Eine Kamera, bei der jedes Foto genau dort beginnen muss, wo das letzte aufhört: Aus einem ganzen Urlaub wird ein einziges, durchgehendes Bild ohne sichtbaren Schnitt.

## Die Idee

Das Ende des letzten Fotos liegt halbtransparent im Sucher. Du suchst etwas in der echten Welt, das dort weitergeht. Der Horizont vom Meer wird zur Tischkante im Café, das Geländer am Hafen zum Grat eines Vulkans, der Schatten am Pool zur Straße. Orte und Zeiten dürfen beliebig wechseln, nur die Linien müssen sich treffen.

Das ändert, wie man durch einen Urlaub läuft: Man sucht nicht mehr nur Motive, sondern Anschlüsse. Am Ende steht kein Album, sondern eine einzige lange Strecke, durch die man fahren kann.

## Warum es das so noch nicht gibt

Recherche vom 03.11.2026, ohne Anspruch auf Vollständigkeit:

- Panorama-Apps brauchen überlappende Fotos vom selben Standort. Hier sind die Orte verschieden.
- Exquisite-Corpse-Apps wie [Art Swipe](https://apps.apple.com/us/app/art-swipe/id493872473), [Skwiz](https://apps.apple.com/cd/app/skwiz/id1611258643) oder [DrawnTogether](https://apps.apple.com/kh/app/drawntogether/id1616768845) arbeiten mit Zeichnungen oder Collagen aus fertigen Bildern. Keine führt live im Sucher zum passenden Motiv.
- Collagen- und Stitching-Tools kleben fertige Fotos nachträglich zusammen. Das Besondere hier passiert vor der Aufnahme.

Der Kern ist neu: der Live-Sucher, der misst, wie gut die Welt gerade an das letzte Foto anschließt, und die Kette daraus.

## Begriffe

Die App nutzt Bahnsprache, weil David vom Fach ist. Sie bleibt dabei trocken und knapp.

| Begriff | Bedeutung |
|---|---|
| Strecke | das durchgehende Bild, also das Projekt |
| Halt | ein Foto in der Strecke |
| Rest | die rechten 28 % des letzten Fotos, im Sucher sichtbar |
| Faden | die unsichtbare Schnittlinie zwischen zwei Halten |
| Anschluss | die Bewertung von 0 bis 100, wie gut zwei Halte zusammenpassen |
| Marken | kleine Dreiecke, die zeigen, auf welcher Höhe Linien aus dem Rest kommen |
| Fahrplan | die Liste aller Halte |
| Reel | das Hochkant-Video, das durch die Strecke fährt |
| Fahrt | das Finale der Blindfahrt, live abgespielt |
| Ausfahrt | der Bereich zum Teilen und Sichern |

„Anschluss“ ist nur Bewertungsbegriff, kein App-Name: International ist das Wort historisch belastet.

## Bildschirme

### 0. Einführung (nur beim ersten Start)

Drei kurze Bildschirme vor der Kamera-Freigabe, jeder mit einem gezeichneten, animierten Beispiel und zwei Sätzen. Keine fremden Fotos.

1. **Was die App macht:** Drei Fotos liegen durcheinander, sortieren sich, rücken zusammen und verschmelzen zu einer Strecke, die dann weiterfährt. Der Text nennt auch die Serie aus der Mediathek.
2. **Wie ein Anschluss funktioniert:** Ein Sucher mit Rest. Die Linie im Kamerabild wandert, Wert und Signal steigen, die Marke wird grün, dann Auslösen, Faden und Stempel.
3. **Was am Ende rauskommt:** Die ganze Strecke, in 4:5-Bilder geschnitten, daneben das Karussell und das Reel.

„Überspringen“ ist immer da, Wischen wechselt die Bildschirme. Später lässt sich die Einführung in den Strecken über „So funktioniert's“ wieder öffnen.

### 1. Sucher (Hauptbildschirm, danach immer der Einstieg)

- Hochformat. Großer 4:5-Rahmen mit dem Kamerabild.
- Beim ersten Halt ist der Sucher frei.
- Ab dem zweiten Halt liegt links der **Rest** über 28 % der Breite, halbtransparent. Die Deckkraft stellt man durch Wischen auf dem Rest zwischen 15 % und 85 % ein. Standard: 55 %.
- **Faden live:** In der Überlappung läuft eine feine Linie durch das Bild, genau dort, wo später geschnitten würde.
- **Marken:** Bis zu drei gelbe Dreiecke am rechten Rand des Rests zeigen die Höhe der stärksten Linien. Trifft eine Linie im Kamerabild die Marke, wird das Dreieck grün.
- **Signal:** Drei kleine Lichter oben. Rot unter 40, gelb von 40 bis 69, grün ab 70. Ab 90 blinkt grün langsam.
- **Wert und Text:** großer Zahlenwert mit Bewertungstext aus `TEXTE.md`.
- **Auslöser:** groß, unten mittig, immer erreichbar. Bei jedem Wert erlaubt: Auch ein verpasster Anschluss ist Teil der Reise.
- Nebenfunktionen: Foto aus der Mediathek holen, Strecke ansehen, Linse wechseln (sofern verfügbar).

### 2. Aufdeckung (direkt nach dem Auslösen, etwa 1,5 Sekunden)

Das ist der Moment, für den die App existiert.

1. Das Bild friert ein, der Rest blendet aus.
2. Der Faden zeichnet sich von oben nach unten. Dabei verschmelzen beide Fotos entlang der Linie.
3. Die Ansicht zoomt heraus und zeigt das Stück Strecke mit dem neuen Halt.
4. Der Wert erscheint als Stempel.

Danach: „Weiter“ als Hauptaktion, daneben „Feinjustieren“ und „Streichen“. Beim ersten Anschluss überhaupt läuft die Aufdeckung langsamer, siehe Erstlauf.

### 3. Feinjustieren

Rettet knappe Anschlüsse und ist der Weg für Fotos aus der Mediathek.

- Das neue Foto lässt sich unter dem Rest verschieben, zoomen (100 bis 200 %) und drehen (±8°). Der Anschluss rechnet live mit.
- Nur der jeweils letzte Halt ist änderbar. Das hält die Kette einfach und robust.

### 4. Strecke

- Die ganze Strecke zum horizontalen Durchwischen, flüssig auch bei 50 Halten.
- Darunter eine schmale Leiste mit allen Halten als Markierung, Tageswechsel deutlich sichtbar.
- Hineinzoomen bis 100 % und Herauszoomen auf die ganze Strecke.

### 5. Fahrplan

Sieht aus wie ein gelber Abfahrtsplan am Bahnsteig: schwarze Schrift auf Gelb, Spalten Zeit, Halt und Anschluss. Halte kann man benennen. Oben stehen Anzahl der Halte, Durchschnitt und die **Pünktlichkeit**, also der Anteil der Anschlüsse ab 70.

### 6. Ausfahrt

- **Karussell:** Die Strecke in passgenau geschnittenen 4:5-Bildern für Instagram. Beim Wischen läuft das Bild nahtlos durch.
- **Reel:** Hochkant-Video (MP4) für Instagram, das durch die Strecke fährt. Man wählt die Länge (15, 30, 60 oder 90 Sekunden) und per Von-bis-Halt den Abschnitt, das Tempo ergibt sich. Über 900 Pixel pro Sekunde schlägt die App einen kürzeren Abschnitt vor. Das Reel ist ab dem ersten Bild in Bewegung, nur das Ende läuft weich aus. Die Endstation am Schluss ist per Schalter abwählbar. Dazu entsteht ein Titelbild in 1080 × 1920, dessen Wichtigstes in den mittleren 1080 × 1350 liegt. Danach: „Teilen“ und „In Fotos speichern“ mit dem Hinweis, es in Instagram als Reel auszuwählen.
- **Gesamtbild:** Die ganze Strecke als ein langes Bild.
- **Sicherung:** Die ganze Strecke als Datei fürs Backup und zum Wiedereinspielen.

### 7. Strecken

Liste aller Strecken mit kleiner Vorschau. „Neue Strecke“ fragt nach einem Namen und bietet die Blindfahrt an.

## Blindfahrt

Eine Option pro Strecke für zwei Personen: Man sieht immer nur den Rest, nie die Strecke. Das Handy wandert hin und her, und jeder setzt fort, ohne zu wissen, wie der andere dahin gekommen ist. Erst mit „Ziel erreichen“ wird alles aufgedeckt, und die Fahrt läuft als Vollbild-Finale.

## Erstlauf

Die Einführung zeigt die Idee vorab in drei Bildschirmen. Danach lernt man die App beim Benutzen, mit knappen Sätzen aus `TEXTE.md`:

1. **Foto 1:** Die App bittet nur um irgendein Foto.
2. **Danach:** Der Rest erscheint im Sucher und wird in einem Satz erklärt. Die App fordert auf, etwas zu suchen, das hier weitergeht. Marken und Signal werden kurz hervorgehoben.
3. **Foto 2:** Die erste Aufdeckung läuft langsam, etwa 3 Sekunden, und zeigt zum ersten Mal mit eigenen Fotos das durchgehende Bild. Danach kommt der Satz, der alles zusammenfasst.

Wer nach Einführung und Schritt 3 die Idee nicht verstanden hat, dem hat der Erstlauf nicht geholfen. Das ist das Abnahmekriterium.

## Gestaltung

- **Das Foto ist der Held.** Die Oberfläche tritt zurück und verfälscht die Farbwahrnehmung nicht.
- **Farben:** fast schwarzer Grund (`#0E0F10`), Signalgelb (`#FFD400`) als einziger Akzent, helles Grau für Text. Signalrot und Signalgrün nur für Signal und Marken. Der Fahrplan ist die einzige große gelbe Fläche.
- **Schrift:** Systemschrift. Ziffern in `ui-monospace` mit Tabellenziffern, damit der Wert beim Rechnen nicht springt.
- **Bedienung:** einhändig, unter Sonne lesbar, Trefferflächen mindestens 44 pt, sichere Bereiche (`safe-area-inset`) beachten. Im Querformat erscheint ein kurzer Hinweis zum Drehen.
- **Bewegung:** knapp und mit Grund. Die Aufdeckung darf sich Zeit nehmen, alles andere nicht.
- **Keine Emojis**, keine Abzeichen, keine Punktelisten mit Belohnungen. Die Bahnsprache ist der ganze Spaß.

## Bewusst nicht drin

Konten, Cloud, Filter, KI-Bildgenerierung, soziale Funktionen. Die Linien sollen echt sein: Es wird nichts erfunden oder dazugemalt, nur angeglichen und entlang des Fadens überblendet.
