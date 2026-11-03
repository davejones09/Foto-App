# Texte

Alle Texte der App auf Deutsch, per Du, trocken und knapp. Neue Texte im selben Ton schreiben. Keine Ausrufezeichen, keine Emojis.

## Installation (beim Öffnen in Safari)

- **Titel:** Einmal einsteigen, bitte.
- **Text:** Fotos sollen nicht verloren gehen. Dafür gehört die App auf deinen Home-Bildschirm.
- **Schritte:** Tippe auf Teilen. Wähle „Zum Home-Bildschirm“. Starte die App über das neue Icon.
- **Link:** Trotzdem im Browser testen

## Einführung (nur beim ersten Start, vor der Kamera-Freigabe)

| Bildschirm | Titel | Text |
|---|---|---|
| 1 | Eine Reise, ein Bild. | Jedes Foto beginnt genau dort, wo das letzte aufhört. Fotografier unterwegs oder hol bis zu 10 Fotos aus der Mediathek: Die App sucht die Reihenfolge, die am besten passt. |
| 2 | Anschluss suchen. | Links im Sucher liegt das Ende deines letzten Fotos. Such etwas, das dort weitergeht, egal wo: Horizont, Tischkante, Geländer. Grün heißt: Das passt. |
| 3 | Endstation: eine lange Strecke. | Am Ende fährst du durch alles durch: als Reel für Instagram, als Karussell oder als ein langes Bild. |

- **Knöpfe:** Überspringen · Weiter · auf dem letzten Bildschirm Einsteigen
- **Beschriftung im Beispiel:** Karussell · Reel
- **Wieder öffnen (in den Strecken):** So funktioniert's

## Kamera-Freigabe

- **Text:** Hier geht's nur mit Kamera. Deine Fotos bleiben auf deinem iPhone.
- **Knopf:** Kamera freigeben
- **Verweigert:** Ohne Kamera bleibt der Zug stehen. Erlaube den Kamerazugriff in den iPhone-Einstellungen bei Safari und öffne die App neu.
- **Mediathek als Ausweg:** Foto aus der Mediathek holen

## Erstlauf

| Moment | Text |
|---|---|
| Leerer Sucher | Mach ein Foto. Egal wovon. |
| Rest erscheint | Das ist das Ende deines letzten Fotos. |
| Direkt danach | Such etwas, das hier weitergeht. Egal wo. |
| Marken leuchten auf | Hier kommen Linien aus dem Bild. Triff sie. |
| Signal leuchtet auf | Grün heißt: Das passt. |
| Während der ersten Aufdeckung | (kein Text, nur das Bild) |
| Nach der ersten Aufdeckung | Kein Schnitt. Jedes Foto beginnt, wo das letzte endet. |
| Direkt danach | Das ist deine Strecke. Sie wird so lang wie deine Reise. |
| Knopf | Weiterfahren |

## Sucher

**Bewertungen** (in `bewertung()` im Kern):

| Wert | Text |
|---|---|
| ab 90 | Planmäßig. Auf die Sekunde. |
| 70 bis 89 | Anschluss erreicht |
| 40 bis 69 | Knapp, läuft aber |
| unter 40 | Anschluss verpasst |

**Tipps**, wenn der Wert 15 Sekunden unter 40 bleibt, höchstens einer pro Minute:

- Such eine Kante auf Höhe der Marke.
- Tisch, Mauer, Horizont, Geländer: Alles ist eine Linie.
- Geh näher ran, dann wird die Linie größer.
- Halt das iPhone tiefer oder höher. Die Linie wandert mit.
- Es muss nicht derselbe Ort sein. Es muss nur weitergehen.

**Sonstiges:**

- Kamera startet …
- Aus der Mediathek
- Strecke
- Halt {n}

## Aufdeckung

- **Knöpfe:** Weiter · Feinjustieren · Streichen
- **Streichen, Rückfrage:** Letzten Halt streichen? · Streichen · Behalten
- **Bei Fehler:** Das Nähen hat nicht geklappt. Dein Foto ist gespeichert. · Nochmal versuchen

## Serie

- **Titel:** Serie
- **Modus:** Beste Anschlüsse · Nach Aufnahmezeit
- **Während der Prüfung:** Foto {k} von {n} wird gesichert und geprüft …
- **Kopf:** Schließt an Halt {n} an.
- **Zeile:** Halt {n} · {Datum} {Uhrzeit} oder „Zeit unbekannt“ · Wert
- **Hinweis:** Ziehen sortiert um, Antippen wählt einen anderen Ausschnitt.
- **Auswahl:** Ausschnitt wählen · Schließen
- **Knöpfe:** Serie verwerfen · Bauen · während des Bauens Abbrechen
- **Verwerfen, Rückfrage:** Serie verwerfen? Die Fotos bleiben in deiner Mediathek. · Verwerfen · Behalten
- **Zu viele:** Höchstens 10 Fotos. Die ersten 10 sind dabei.
- **Kaputte Dateien:** {n} Fotos ließen sich nicht öffnen.
- **Angehalten:** Angehalten. {n} Fotos warten noch.
- **Beim Start:** Eine Serie aus der Mediathek wartet noch. · Weiter

## Feinjustieren

- **Hinweis:** Schieben, zoomen, drehen. Der Anschluss rechnet mit.
- **Knöpfe:** Übernehmen · Abbrechen

## Strecke

- **Leer:** Noch kein Halt. Zeit für die Abfahrt.
- **Kopfzeile:** {name} · {n} Halte
- **Knöpfe:** Fahrplan · Ausfahrt · Zum Sucher

## Strecken

- **Titel:** Strecken
- **Leer:** Noch keine Strecke.
- **Knopf:** Neue Strecke
- **Name:** Wie heißt die Strecke?
- **Vorschlag:** „Strecke {Monat} {Jahr}“
- **Blindfahrt:** Blindfahrt: Ihr seht immer nur das letzte Stück. Die ganze Strecke erst im Ziel.
- **Löschen, Rückfrage:** „{name}“ wirklich löschen? {n} Halte sind dann weg. · Löschen · Behalten

## Blindfahrt

- **Statt Strecke:** Die Strecke bleibt bis zum Ziel verdeckt.
- **Knopf:** Ziel erreichen
- **Rückfrage:** Ziel erreichen? Danach seht ihr alles. · Aufdecken · Weiterfahren

## Fahrplan

- **Titel:** Fahrplan
- **Spalten:** Zeit · Halt · Anschluss
- **Kennzahlen:** {n} Halte · Durchschnitt {x} · Pünktlichkeit {p} %
- **Unbenannter Halt:** Halt {n}
- **Bei 100 % Pünktlichkeit:** Das glaubt dir bei der Bahn keiner.
- **Unter 50 % Pünktlichkeit:** Wir bitten um Entschuldigung.

## Ausfahrt

- **Titel:** Ausfahrt
- **Karussell:** Karussell · {n} Bilder für Instagram
- **Mehrere Beiträge:** Passt nicht in einen Beitrag. Wird auf {t} Teile aufgeteilt.
- **Reel:** Reel · Video für Instagram · {Länge} s
- **Längen:** 15 s · 30 s · 60 s · 90 s
- **Abschnitt:** Von {Halt} bis {Halt}
- **Tempo:** {n} Halte · Tempo {v} Pixel pro Sekunde
- **Zu schnell:** Bei {Länge} s wird es zu schnell. Vorschlag: Halt {von} bis {bis}. · Übernehmen
- **Schalter:** Endstation am Ende
- **Nach dem Bauen:** Teilen · In Fotos speichern
- **Hinweis:** In Instagram „Reel“ wählen. „In Fotos speichern“ legt Video und Titelbild ab, das Titelbild nimmst du als Cover.
- **Kein MP4:** Dieses Gerät kann hier kein MP4 bauen.
- **Gesamtbild:** Gesamtbild · {Breite} × {Höhe} Pixel
- **Verkleinert:** Für das iPhone zu groß, deshalb auf {Breite} × {Höhe} verkleinert.
- **Sicherung:** Sicherung · als Datei speichern
- **Einspielen:** Sicherung einspielen
- **Erinnerung:** Letzte Sicherung ist {n} Halte her.
- **Während der Arbeit:** Wird gebaut … {p} %
- **Fertig:** Teilen
- **Abbruch:** Abgebrochen, weil die App in den Hintergrund ging. · Nochmal

## Endstation (letztes Karussellbild, Ende des Reels und des Finales)

```
Endstation
{name}
{erstes Datum} bis {letztes Datum}
{n} Halte · Pünktlichkeit {p} %
```

## Fehler

- **Speicher voll:** Der Speicher ist voll. Sichere die Strecke und lösche eine alte.
- **Kamera weg:** Die Kamera antwortet nicht. · Neu starten
- **Import scheitert:** Dieses Foto lässt sich nicht öffnen. Versuch ein anderes.
- **Teilen scheitert:** Teilen hat nicht geklappt. · Stattdessen speichern
- **Querformat:** Bitte hochkant halten.
- **Allgemein:** Da ist was schiefgelaufen. Deine Fotos sind sicher. · Neu laden

## Diagnose

- **Titel:** Diagnose
- **Knöpfe:** Bericht kopieren · Faden und Teilwerte zeigen · Schließen
- **Nach dem Kopieren:** Kopiert. In Claude Code einfügen.
