# Konzept

## In einem Satz

Eine Foto-App, bei der jedes Foto genau dort beginnt, wo das letzte aufhört: Aus vielen Fotos wird ein durchgehendes Bild ohne sichtbaren Schnitt, als Carousel, Reel oder Collage.

## Die Idee

Das Ende des letzten Fotos liegt halbtransparent im Sucher. Du suchst etwas in der echten Welt, das dort weitergeht. Der Horizont vom Meer wird zur Tischkante im Café, das Geländer am Hafen zum Grat eines Vulkans, der Schatten am Pool zur Straße. Orte und Zeiten dürfen beliebig wechseln, nur die Linien müssen sich treffen.

Das ändert, wie man durch eine Reise läuft: Man sucht nicht mehr nur Motive, sondern Passungen. Am Ende steht kein Album, sondern ein durchgehendes Bild, durch das man wischen oder als Reel laufen kann.

## Warum es das so noch nicht gibt

Recherche vom 03.11.2026, ohne Anspruch auf Vollständigkeit:

- Panorama-Apps brauchen überlappende Fotos vom selben Standort. Hier sind die Orte verschieden.
- Exquisite-Corpse-Apps wie [Art Swipe](https://apps.apple.com/us/app/art-swipe/id493872473), [Skwiz](https://apps.apple.com/cd/app/skwiz/id1611258643) oder [DrawnTogether](https://apps.apple.com/kh/app/drawntogether/id1616768845) arbeiten mit Zeichnungen oder Collagen aus fertigen Bildern. Keine führt live im Sucher zum passenden Motiv.
- Collagen- und Stitching-Tools kleben fertige Fotos nachträglich zusammen. Das Besondere hier passiert vor der Aufnahme.

Der Kern ist neu: der Live-Sucher, der misst, wie gut die Welt gerade an das letzte Foto anschließt, und das durchgehende Bild daraus.

## Auftritt

Ruhig und hochwertig wie eine professionelle Foto-App. Sachliche Sprache per Du, keine Witze, keine Themenwelt. Der Name „Nahtlos“ bleibt.

## Begriffe

| Begriff | Bedeutung |
|---|---|
| Projekt | das durchgehende Bild aus mehreren Fotos (für Carousel und Reel) oder eine Collage |
| Foto | ein Foto im Projekt |
| Rest | die rechten 28 % des letzten Fotos, im Sucher sichtbar |
| Naht | die unsichtbare Schnittlinie zwischen zwei Fotos |
| Passung | die Bewertung von 0 bis 100, wie gut zwei Fotos zusammenpassen |
| Hilfslinien | kurze Striche am Rand des Rests, auf der Höhe der Linien, die aus dem Bild kommen |
| Fotos | die Liste aller Fotos eines Projekts |
| Exportieren | der Bereich für Carousel, Reel, Gesamtbild und Sicherung |
| Reel | das Hochkant-Video aus dem Projekt |
| Überraschungsmodus | Option eines Projekts: Man sieht nur das letzte Foto, das ganze Bild erst beim Aufdecken |

Bewertung: ab 90 „Perfekt“, ab 70 „Passt gut“, ab 40 „Passt teilweise“, darunter „Passt nicht“.

## Bildschirme

### 0. Einführung (nur beim ersten Start)

Drei kurze Bildschirme vor dem Hauptmenü, jeder mit einem gezeichneten, animierten Beispiel und zwei Sätzen. Keine fremden Fotos.

1. **Was die App macht:** Drei Fotos liegen durcheinander, sortieren sich, rücken zusammen und gehen ineinander über.
2. **Wie die Passung funktioniert:** Ein Sucher mit Rest. Die Linie im Kamerabild wandert, Zahl und Balken steigen, die Hilfslinie leuchtet, dann Auslösen und Naht.
3. **Was rauskommt:** Das Band in genau aufgehende Slides geschnitten, daneben Carousel, Reel und Collage.

„Überspringen“ ist immer da, Wischen wechselt die Bildschirme. Später lässt sich die Einführung in den Einstellungen wieder öffnen.

### 1. Hauptmenü (Start der App)

- **Neu erstellen:** drei große Karten, Carousel, Reel und Collage.
- **Zuletzt bearbeitet:** Vorschaubilder der letzten Projekte, dazu „Alle Projekte“.
- **Einstellungen:** Sicherung einspielen, Einführung, Diagnose, Version.

Ablauf bei Carousel und Reel: Karte wählen, Name (und auf Wunsch Überraschungsmodus), dann Kamera oder Mediathek, Vorschau, Export. Beide nutzen dasselbe Projekt: Aus einem Carousel-Projekt lässt sich auch ein Reel erstellen und umgekehrt. Wählt man die Mediathek, entsteht das Projekt erst, wenn wirklich Fotos gewählt sind.

### 2. Sucher

- Hochformat. Großer 4:5-Rahmen mit dem Kamerabild. Oben links zurück ins Hauptmenü.
- Beim ersten Foto ist der Sucher frei.
- Ab dem zweiten Foto liegt links der **Rest** über 28 % der Breite, halbtransparent. Die Deckkraft stellt man durch Wischen auf dem Rest zwischen 15 % und 85 % ein. Standard: 55 %.
- **Naht live:** In der Überlappung läuft eine feine Linie durch das Bild, genau dort, wo später geschnitten würde.
- **Hilfslinien:** Bis zu drei kurze Striche am rechten Rand des Rests zeigen die Höhe der stärksten Linien. Trifft eine Linie im Kamerabild, leuchtet der Strich im Akzent.
- **Passung:** oben als Zahl mit Bewertungstext und schmalem Balken. Ab 70 trägt der Balken den Akzent.
- **Auslöser:** groß, unten mittig, immer erreichbar. Bei jedem Wert erlaubt.
- Nebenfunktionen: Fotos aus der Mediathek, Projekt ansehen, Linse wechseln (sofern verfügbar).
- **Idee:** schlägt ein konkretes nächstes Motiv vor, passend zur Linie im Rest, zu Farben, Tageszeit und gemerktem Ort.
- **Richtung:** Liegt eine Linie der Kamera knapp neben einer Hilfslinie, sagt die App, ob das iPhone höher oder tiefer muss.

### 3. Aufdeckung (direkt nach dem Auslösen, etwa 1,5 Sekunden)

1. Das Bild friert ein, der Rest blendet aus.
2. Die Naht zeichnet sich von oben nach unten, beide Fotos gehen ineinander über.
3. Die Ansicht zoomt heraus und zeigt das Stück Band mit dem neuen Foto.
4. Oben steht die Passung als Zahl mit Balken.

Danach: „Weiter“ als Hauptaktion, daneben „Ausschnitt“ und „Verwerfen“.

### 4. Ausschnitt

Rettet knappe Passungen und ist der Weg für ein einzelnes Foto aus der Mediathek. Verschieben, zoomen (100 bis 200 %) und drehen (±8°), die Passung rechnet live mit. Nur das jeweils letzte Foto ist änderbar.

### 4a. Mehrere Fotos aus der Mediathek

- Bis zu 10 Fotos, jedes wird einzeln geöffnet und sofort gesichert.
- **Fotos bleiben ganz.** Jedes behält sein Seitenverhältnis (feste Höhe 1620). Nur was schmaler als 0,7 oder breiter als 2:1 ist, wird um das Motiv herum beschnitten. Das Motiv findet eine Karte über Schärfe.
- Die App sucht die beste Reihenfolge („Beste Passung“) oder folgt der Aufnahmezeit.
- Vorschau vor dem Zusammensetzen: Ziehen sortiert um, × entfernt, Antippen öffnet den Ausschnitt. Ein Abbruch verliert kein Foto.
- Im Überraschungsmodus bleibt es beim einzelnen Foto.

### 5. Projekt

Das ganze Band zum Durchwischen, flüssig auch bei 50 Fotos, mit Leiste und Tageswechseln. Unten: Fotos, Exportieren, Aufnehmen.

### 6. Fotos

Ruhige Liste: Zeit, Name, Passung. Fotos lassen sich benennen, beschädigte löschen. Oben Anzahl und Passung im Schnitt.

### 7. Exportieren

- **Carousel:** Das Band in 4:5-Slides für Instagram, ohne Abschluss-Slide: Das Band geht genau in ganze Slides auf. Erst wird bis 8 % vergrößert (oben und unten gleich viel weg). Reicht das nicht, nimmt die App die Slide-Anzahl, die am wenigsten Bild kostet, und schneidet den Rest am Anfang und Ende weg, ohne Motive zu treffen. Die Grenzen rücken weg vom Motiv, wenn das hilft. Die Vorschau zeigt jede Slide genau so, wie sie exportiert wird.
- **Reel:** MP4 in 1080 × 1920, Länge 15, 30, 60 oder 90 s (bei Vorlagen auch Auto), Abschnitt von bis. Elf lebhafte Vorlagen mit Schnitten im Takt, dazu Stile mit kurzer Live-Vorschau:
  - **Band:** das fortlaufende Band
  - **Sanft:** weiche Überblendung, dazu langsames Zoomen
  - **Schwung:** schneller Schwenk zum nächsten Foto mit Bewegungsunschärfe
  - **Zoom:** Fahrt ins Foto hinein, das nächste kommt aus der Tiefe
  - **Naht:** Das nächste Foto läuft entlang des echten Nahtverlaufs ins Bild

  Bei den vier Übergangsstilen füllt jedes Foto den Rahmen, der Ausschnitt folgt der Motivkarte. Standzeit und Übergänge ergeben sich aus der Länge, ist sie zu kurz, schlägt die App weniger Fotos vor. Das Reel endet auf dem letzten Bild. Dazu ein Titelbild in 1080 × 1920.
- **Gesamtbild:** das ganze Band als ein langes Bild.
- **Sicherung:** das ganze Projekt als Datei.

### 8. Collage

- 2 bis 9 Fotos aus Mediathek oder Kamera. Formate 4:5, 1:1 und 9:16, Ausgabe als JPEG mit 2160 Pixeln Breite.
- Über 50 Vorlagen passend zur Fotoanzahl: Raster, ein großes Foto mit kleinen, asymmetrische Aufteilungen.
- **Mit Rahmen:** Abstand und Rahmenfarbe einstellbar. **Nahtlos:** Die Felder gehen mit dem weichen Übergang ineinander über.
- Die Motivkarte schlägt den Ausschnitt vor. Antippen wählt ein Feld, Ziehen und Zoomen ändern den Ausschnitt, Ziehen auf ein anderes Feld tauscht die Fotos. Immer hineingezoomt, nie leere Bereiche. Keine Farbänderung.
- Eigener Projekttyp mit Sicherung.

### 9. Alle Projekte und Einstellungen

Liste aller Projekte (Carousel, Reel, Collage) mit Vorschau, öffnen, löschen. In den Einstellungen: Sicherung einspielen, Einführung, Diagnose, Version.

## Ideen

Regelbasiert und komplett offline, ohne KI und ohne Netz: Höhe, Stärke und Neigung der Linie im Rest, die Farben darüber und darunter, die Farben der letzten 3 Fotos, Tageszeit und ein gemerkter Ort. „Andere Idee“ wiederholt innerhalb eines Projekts nichts, bis alle passenden durch sind.

## Überraschungsmodus

Eine Option pro Projekt für zwei Personen: Man sieht immer nur den Rest, nie das Band. Das Handy wandert hin und her, und jeder setzt fort, ohne zu wissen, wie der andere dahin gekommen ist. Erst „Aufdecken“ zeigt alles, das Band läuft einmal im Vollbild durch.

## Erstlauf

Die Einführung zeigt die Idee vorab. Im ersten Projekt lernt man den Sucher beim Benutzen, mit knappen Sätzen aus `TEXTE.md`:

1. **Foto 1:** Die App bittet nur um irgendein Foto.
2. **Danach:** Der Rest erscheint und wird in einem Satz erklärt. Hilfslinien und Passung werden kurz hervorgehoben.
3. **Foto 2:** Die erste Aufdeckung läuft langsam und zeigt zum ersten Mal mit eigenen Fotos das durchgehende Bild.

Wer nach Einführung und Schritt 3 die Idee nicht verstanden hat, dem hat der Erstlauf nicht geholfen. Das ist das Abnahmekriterium.

## Gestaltung

- **Das Foto ist der Held.** Die Oberfläche tritt zurück und verfälscht die Farbwahrnehmung nicht.
- **Grundregel: Fotos werden außerhalb des Übergangs nicht verändert.** Fotografen stecken Stunden in die Bearbeitung. Ein Foto ist außerhalb der Überlappung das unveränderte Original: keine Farbangleichung, kein Verbiegen, keine Option dafür. Nur im Übergang wird weich überblendet, und auch dort gehen beide Ränder exakt ins Original über. Fotos in Display P3 bleiben P3. Für Instagram werden die Ausgaben sauber nach sRGB umgerechnet.
- **Keine Spuren der App im Ergebnis:** keine Logos, Texte, Statistiken, Abspänne oder Wasserzeichen in Carousel, Reel, Collage und Gesamtbild, neutrale Dateinamen, keine App-Hinweise in den Metadaten.
- **Farben:** neutrales dunkles Grau (`#111213`, Flächen `#1A1B1D`), helles Grau für Text, ein zurückhaltendes Blau (`#8FB1FF`) als einziger Akzent. Hauptknöpfe hell mit dunkler Schrift.
- **Schrift:** Systemschrift, klare Hierarchie, viel Luft. Ziffern in `ui-monospace` mit Tabellenziffern.
- **Bedienung:** einhändig, unter Sonne lesbar, Trefferflächen mindestens 44 pt, sichere Bereiche (`safe-area-inset`) beachten. Im Querformat ein kurzer Hinweis zum Drehen.
- **Bewegung:** knapp und mit Grund. Die Aufdeckung darf sich Zeit nehmen, alles andere nicht.
- **Keine Emojis**, keine Abzeichen, keine Belohnungen.

## Bewusst nicht drin

Konten, Cloud, Filter, KI-Bildgenerierung, soziale Funktionen. Die Linien sollen echt sein: Es wird nichts erfunden oder dazugemalt, nur im Übergang entlang der Naht überblendet. Eine Farbangleichung der Fotos gibt es nicht, auch nicht als Option.
