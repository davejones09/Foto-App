# Entscheidungen

Abweichungen vom Konzept und Festlegungen, die das Konzept offen ließ. Neueste unten.

## Etappe 1

- **ZIP ohne fflate.** Die Sicherung nutzt ein eigenes, kleines ZIP-Modul (`src/zip.mjs`, nur „stored“, also ohne Kompression, wie gefordert). Grund: Beim Schreiben hängt es die Original-Blobs an, beim Lesen schneidet es Blob-Stücke. So muss eine Strecke mit 50 Halten nie komplett in den Arbeitsspeicher, was auf dem iPhone sonst zum Absturz führen kann. Das Format ist Standard-ZIP (gegen Pythons `zipfile` getestet). `vendor/` enthält deshalb nur `mp4-muxer`.
- **Nähen rechnet im Worker, Bilder kodiert der Hauptthread.** Der Worker macht nur reine Rechnung (`kern.mjs`). Dekodieren, Transformieren und JPEG-Kodieren laufen im Hauptthread per Canvas. Grund: `OffscreenCanvas` im Worker ist auf iOS erst ab 16.4 vollständig und hat dort bekannte Lücken. So läuft es auf allen Zielgeräten gleich.
- **Zusätzliche Felder im Halt:** `rohB`, `rohH` (Maße des Rohbilds), `vorschau` (Höhe 240), `nahtVorschau`, `pfad` (Faden auf voller Auflösung, für die Aufdeckung). Strecke zusätzlich `gesichertBei` (Anzahl Halte bei der letzten Sicherung). Alles in `formatVersion` 1, es gab keine ältere Fassung.
- **Transformation:** `dx`/`dy` in Pixeln des 1296er-Rahmens, `zoom` relativ zum Füllmaß, `drehung` in Grad. Zoom und Verschiebung werden so begrenzt, dass nie ein leerer Rand entsteht (`src/geometrie.mjs`).
- **Rohbild der Kamera** als JPEG 0,95, längste Seite höchstens 4000 Pixel.
- **Erste Strecke** wird beim allerersten Start ohne Rückfrage mit dem Namensvorschlag angelegt. Der Erstlauf soll mit einem Foto beginnen, nicht mit einem Formular. „Neue Strecke“ fragt wie vorgesehen nach dem Namen.
- **Neue Version** wird per Service Worker im Hintergrund geladen und erst aktiv, wenn die App aus dem Hintergrund zurückkommt und der Sucher offen ist. Nie mitten in einer Aufdeckung oder Ausgabe.
- **Installationshinweis:** „Trotzdem im Browser testen“ gilt für die laufende Browser-Sitzung.
- **Kamera bleibt während der Aufdeckung an** (Video pausiert), damit sie nach „Weiter“ sofort wieder da ist. In allen anderen Ansichten wird der Stream gestoppt.
- **100 % in der Strecke** heißt: ein Bildpixel pro Bildschirmpunkt (CSS-Pixel). Auf dem iPhone mit dreifacher Pixeldichte wäre „ein Bildpixel pro Gerätepixel“ kaum größer als die normale Ansicht.

## Etappe 2

- **Erstlauf-Zustand** steht in `localStorage` und zusätzlich in der Datenbank. Liegen irgendwo schon zwei Halte, gilt er ohnehin als erledigt. So kommt der Erstlauf nach dem Löschen von Browserdaten nicht zurück, solange Strecken da sind.
- **Erste Aufdeckung zeigt nur „Weiterfahren“.** „Feinjustieren“ und „Streichen“ fehlen in diesem einen Moment, damit nichts vom Satz ablenkt, der alles erklärt.
- **Import geht immer durchs Feinjustieren**, auch beim ersten Halt (nur Bildausschnitt, ohne Wert). „Abbrechen“ übernimmt dort den Standardausschnitt; wer das Foto nicht will, streicht es danach.
- **Stempel** sitzt rechts unten auf der Bühne, damit der Faden sichtbar bleibt.
- **Strecken** erreicht man über die Strecke (Knopf oben links). Der Sucher bleibt frei.
- **Test-Chromium kodiert JPEGs nach Screenshots gelegentlich langsamer** (bis 2 s je Bild). Das ist ein Effekt der Testumgebung, nicht der App. Die Nähzeit auf dem iPhone zeigt die Diagnose.
