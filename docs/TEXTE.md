# Texte

Alle Texte der App auf Deutsch, per Du, sachlich und klar. Keine Witze, keine Themenwelt, keine Ausrufezeichen, keine Emojis. Die Quelle ist `src/texte.mjs`, `test/texte.test.mjs` prüft, dass kein Bahnbegriff sichtbar wird.

## Installation (beim Öffnen in Safari)

- **Titel:** Nahtlos auf den Home-Bildschirm legen
- **Text:** Damit keine Fotos verloren gehen, gehört Nahtlos auf deinen Home-Bildschirm.
- **Schritte:** Tippe auf Teilen. Wähle „Zum Home-Bildschirm“. Starte Nahtlos über das neue Icon.
- **Link:** Trotzdem im Browser testen

## Einführung (nur beim ersten Start, vor dem Hauptmenü)

| Bildschirm | Titel | Text |
|---|---|---|
| 1 | Fotos, die ineinander übergehen. | Jedes Foto beginnt dort, wo das letzte aufhört. So entsteht aus vielen Fotos ein durchgehendes Bild. Du kannst fotografieren oder bis zu 10 Fotos aus der Mediathek nehmen. |
| 2 | Die Passung finden. | Links im Sucher liegt das Ende deines letzten Fotos. Richte die Kamera so aus, dass Linien und Flächen weiterlaufen. Die Zahl oben zeigt, wie gut es passt. |
| 3 | Carousel, Reel oder Collage. | Aus deinen Fotos wird ein Carousel für Instagram, ein Reel oder eine Collage. Du wählst im Hauptmenü, was du erstellen möchtest. |

- **Knöpfe:** Überspringen · Weiter · auf dem letzten Bildschirm Los geht's
- **Beschriftung im Beispiel:** Carousel · Reel · Collage

## Hauptmenü

- **Abschnitt:** Neu erstellen
- **Karten:** Carousel · Bilder, die beim Wischen ineinander übergehen | Reel · Ein Video, das durch deine Fotos läuft | Collage · 2 bis 9 Fotos auf einer Fläche
- **Abschnitt:** Zuletzt bearbeitet · Alle Projekte
- **Leer:** Noch keine Projekte. Wähle oben, was du erstellen möchtest.
- **Eintrag:** {Name} · {Carousel | Reel | Collage} · {n} Fotos
- **Unten:** Alle Projekte · Einstellungen
- **Neues Carousel oder Reel:** Neues Carousel / Neues Reel · Name „Projekt {Monat} {Jahr}“ · Überraschungsmodus: Ihr seht immer nur das letzte Foto. Das ganze Bild erst beim Aufdecken. · Abbrechen · Mediathek · Kamera
- **Neue Collage:** Neue Collage · Name „Collage {Monat} {Jahr}“ · Abbrechen · Mediathek · Kamera

## Einstellungen

- **Titel:** Einstellungen
- **Zeilen:** Sicherung einspielen · Ein gesichertes Projekt wiederherstellen | Einführung ansehen · Die drei Bildschirme vom ersten Start | Diagnose · Technischer Bericht, falls etwas nicht klappt | Version · v{x.y.z}

## Kamera-Freigabe

- **Text:** Für Aufnahmen braucht Nahtlos die Kamera. Deine Fotos bleiben auf deinem iPhone.
- **Knopf:** Kamera freigeben
- **Verweigert:** Ohne Kamerazugriff sind hier keine Aufnahmen möglich. Erlaube ihn in den iPhone-Einstellungen bei Safari und öffne Nahtlos neu. Fotos aus der Mediathek gehen auch so.
- **Ausweg:** Fotos aus der Mediathek wählen

## Erstlauf

| Moment | Text |
|---|---|
| Leerer Sucher | Mach ein erstes Foto. Das Motiv ist egal. |
| Rest erscheint | Links siehst du das Ende deines letzten Fotos. |
| Direkt danach | Such etwas, das dort weitergeht. Der Ort ist egal. |
| Hilfslinien leuchten auf | Die Hilfslinien zeigen, wo Linien aus dem Bild kommen. Triff sie. |
| Passung leuchtet auf | Die Zahl zeigt, wie gut es passt. Ab 70 passt es gut. |
| Nach der ersten Aufdeckung | Kein sichtbarer Schnitt: Jedes Foto beginnt, wo das letzte endet. |
| Direkt danach | Das ist dein Projekt. Es wächst mit jedem Foto. |
| Knopf | Weiter |

## Sucher

**Passung** (in `bewertung()` im Kern), als Zahl mit schmalem Balken:

| Wert | Text |
|---|---|
| ab 90 | Perfekt |
| 70 bis 89 | Passt gut |
| 40 bis 69 | Passt teilweise |
| unter 40 | Passt nicht |

**Tipps**, wenn der Wert 15 Sekunden unter 40 bleibt, höchstens einer pro Minute: kommen aus derselben Quelle wie „Idee“.

**Idee:**

- **Knopf:** Idee
- **Satz:** {Beschreibung des Rests} {Idee}, zum Beispiel: Linie auf halber Höhe, oben hell, unten dunkel. Versuch's mit einer Tischkante vor einer hellen Wand.
- **Kontrast:** Die letzten drei Fotos waren alle {Farbe}. {Idee}
- **Ort:** Wo bist du gerade? · Strand · Stadt · Essen · Natur · Unterkunft · Unterwegs
- **Knöpfe:** Schließen · Andere Idee
- **Alle Ideen:** `src/ideen.mjs` (73 Stück, getaggt)

**Richtung**, wenn eine Kameralinie knapp neben einer Hilfslinie liegt:

- Etwas höher halten oder leicht nach oben kippen. Die Linie rutscht dann zur Hilfslinie.
- Etwas tiefer halten oder leicht nach unten kippen. Die Linie rutscht dann zur Hilfslinie.

**Sonstiges:** Kamera startet … · Mediathek · Projekt · Foto {n} · Zurück zum Hauptmenü (Beschriftung für Bildschirmleser: Hauptmenü)

## Aufdeckung

- **Kopf:** Passung als Zahl mit Balken
- **Knöpfe:** Weiter · Ausschnitt · Verwerfen
- **Verwerfen, Rückfrage:** Letztes Foto verwerfen? · Verwerfen · Behalten
- **Bei Fehler:** Der Übergang hat nicht geklappt. Dein Foto ist gespeichert. · Nochmal versuchen

## Mehrere Fotos aus der Mediathek

- **Titel:** Reihenfolge
- **Modus:** Beste Passung · Nach Aufnahmezeit
- **Während der Prüfung:** Foto {k} von {n} wird gesichert und geprüft …
- **Kopf:** Schließt an Foto {n} an.
- **Hinweis:** Am Griff ziehen ändert die Reihenfolge. Antippen öffnet den Ausschnitt.
- **Ausschnitt:** Ziehen verschiebt, zwei Finger zoomen. Antippen setzt das Motiv. · Ganzes Foto · Abbrechen · Übernehmen
- **Knöpfe:** Auswahl verwerfen · Zusammensetzen · währenddessen Abbrechen
- **Verwerfen, Rückfrage:** Auswahl verwerfen? Die Fotos bleiben in deiner Mediathek. · Verwerfen · Behalten
- **Zu viele:** Höchstens 10 Fotos. Die ersten 10 sind dabei.
- **Kaputte Dateien:** {n} Fotos ließen sich nicht öffnen.
- **Angehalten:** Angehalten. {n} Fotos warten noch.
- **Wartet noch:** Eine Auswahl aus der Mediathek wartet noch. · Später · Weiter
- **Fehler:** Das Zusammensetzen hat nicht geklappt. Tippe nochmal auf Zusammensetzen.
- **Farbprofil umgerechnet (selten, etwa Adobe RGB):** {n} Fotos haben das Farbprofil {profil}. Nahtlos rechnet sie nach {raum} um.

## Ausschnitt

- **Hinweis:** Schieben, zoomen, drehen. Die Passung rechnet mit.
- **Knöpfe:** Übernehmen · Abbrechen

## Projekt

- **Leer:** Noch kein Foto in diesem Projekt.
- **Kopfzeile:** {Name} · {n} Fotos
- **Knöpfe:** Fotos · Exportieren · Aufnehmen
- **Altes Projekt (einmal je Start):** Dieses Projekt ist noch mit Farbangleichung zusammengesetzt. Neu zusammensetzen lässt deine Fotos unverändert und rechnet nur die Übergänge neu. · Später · Neu zusammensetzen
- **Rückfrage:** {n} Übergänge neu rechnen? Deine Fotos bleiben erhalten. Sie sehen danach aus wie das Original, nur in den Übergängen wird überblendet. · Abbrechen · Neu zusammensetzen
- **Während:** Übergänge werden neu gerechnet … {p} %
- **Fertig:** Fertig. Das Projekt ist neu zusammengesetzt. · mit Fehlern: Fertig. {n} Fotos ließen sich nicht neu rechnen und bleiben, wie sie waren.

## Alle Projekte

- **Titel:** Alle Projekte
- **Leer:** Noch kein Projekt.
- **Eintrag:** {Name} · {Art} · {n} Fotos · {Datum} (· Überraschungsmodus)
- **Löschen, Rückfrage:** „{name}“ wirklich löschen? {n} Fotos sind dann weg. · Löschen · Behalten

## Überraschungsmodus

- **Statt Band:** Überraschungsmodus: Das Bild bleibt verdeckt, bis ihr es aufdeckt.
- **Knopf:** Aufdecken
- **Rückfrage:** Jetzt aufdecken? Danach seht ihr alles. · Aufdecken · Weiter fotografieren

## Fotos

- **Titel:** Fotos
- **Spalten:** Zeit · Foto · Passung
- **Kennzahlen:** {n} Fotos · Passung im Schnitt {x}
- **Unbenanntes Foto:** Foto {n}

## Exportieren

- **Titel:** Exportieren
- **Carousel:** Carousel · {n} Bilder für Instagram · darunter die Vorschau der Slides
- **Grenze im Motiv:** An dieser Stelle läuft eine Bildgrenze durchs Motiv, das ließ sich nicht vermeiden. Das Carousel wird trotzdem erstellt.
- **Mehrere Beiträge:** Passt nicht in einen Beitrag. Wird auf {t} Beiträge aufgeteilt.
- **Reel:** Reel · Video für Instagram · {Länge} s
- **Stile:** Band · Sanft · Schwung · Zoom · Naht
- **Längen:** 15 s · 30 s · 60 s · 90 s
- **Abschnitt:** Von {Foto} bis {Foto}
- **Band:** {n} Fotos · {v} Pixel pro Sekunde · zu schnell: Bei {Länge} s wird es zu schnell. Vorschlag: Foto {von} bis {bis}. · Übernehmen
- **Übergangsstile:** {n} Fotos · {s} s je Foto · zu kurz: Bei {Länge} s bleibt zu wenig Zeit je Foto. Vorschlag: Foto {von} bis {bis}. · Übernehmen
- **Nach dem Erstellen:** Teilen · In Fotos speichern
- **Hinweis:** In Instagram „Reel“ wählen. „In Fotos speichern“ legt Video und Titelbild ab, das Titelbild nimmst du als Cover.
- **Kein MP4:** Dieses Gerät kann hier kein MP4 erstellen.
- **Gesamtbild:** Gesamtbild · {Breite} × {Höhe} Pixel · Für das iPhone zu groß, deshalb auf {Breite} × {Höhe} verkleinert.
- **Sicherung:** Sicherung · als Datei speichern · Die letzte Sicherung ist {n} Fotos her.
- **Während der Arbeit:** Wird erstellt … {p} %
- **Abbruch:** Abgebrochen, weil Nahtlos in den Hintergrund ging. · Nochmal
- **Dateinamen:** carousel-01.jpg … · reel.mp4 · reel-cover.jpg · gesamtbild.jpg · collage.jpg

## Collage

- **Kopf:** {Name} · Exportieren
- **Hinweis:** Antippen wählt ein Feld. Ziehen verschiebt, zwei Finger zoomen. Ziehen auf ein anderes Feld tauscht die Fotos.
- **Zu wenige:** Füge mindestens ein weiteres Foto hinzu.
- **Formate:** 4:5 · 1:1 · 9:16
- **Stile:** Mit Rahmen · Nahtlos · Abstand · Rahmenfarbe {n}
- **Knöpfe:** Mediathek · Kamera · Foto entfernen
- **Einlesen:** Foto {k} von {n} wird gesichert …
- **Zu viele:** Höchstens 9 Fotos. Die ersten sind dabei.
- **Kaputt:** {n} Fotos ließen sich nicht öffnen.
- **Exportieren, Rückfrage:** Was möchtest du exportieren? · Abbrechen · Sicherung · Collage als Bild
- **Fertig:** Die Collage ist fertig. · Stattdessen speichern · Teilen

## Fehler

- **Nicht gesichert:** Das Foto ließ sich nicht sichern. Bitte nochmal.
- **Mehrere nicht gesichert:** {n} Fotos ließen sich nicht sichern und sind nicht dabei.
- **Umzug beim Start:** Speicher wird umgestellt … {p} %
- **Beschädigt, Hinweis:** {n} Fotos sind beschädigt. Unter „Fotos“ kannst du sie löschen, der Rest bleibt. · Später · Fotos
- **Beschädigt, in der Liste:** Foto {n} · Beschädigt · Löschen
- **Beschädigt, Rückfrage:** Beschädigtes Foto {n} löschen? Das Projekt schließt danach an das vorherige Foto an. · Löschen · Behalten
- **Speicher voll:** Der Speicher ist voll. Sichere das Projekt und lösche ein altes.
- **Kamera weg:** Die Kamera antwortet nicht. · Neu starten
- **Import scheitert:** Dieses Foto lässt sich nicht öffnen. Versuch ein anderes.
- **Farbprofil umgerechnet (selten, etwa Adobe RGB):** Das Foto hat das Farbprofil {profil}. Nahtlos rechnet es nach {raum} um.
- **Teilen scheitert:** Teilen hat nicht geklappt. · Stattdessen speichern
- **Querformat:** Bitte hochkant halten.
- **Allgemein:** Da ist etwas schiefgelaufen. Deine Fotos sind sicher. · Neu laden

## Diagnose

- **Titel:** Diagnose
- **Knöpfe:** Bericht kopieren · Foto vergleichen · Naht und Teilwerte zeigen · Schließen
- **Während des Vergleichs:** Foto wird wie beim Zusammensetzen durchgerechnet …
- **Nach dem Kopieren:** Kopiert. In Claude Code einfügen.
