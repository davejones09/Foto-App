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

## Etappe 3

- **Ausgaben starten durch Antippen ihrer Zeile.** Erst bauen, dann erscheint „Teilen“ (frische Nutzergeste für `navigator.share`). Scheitert das Teilen, gibt es „Stattdessen speichern“ und bei mehr als 10 Dateien Portionen zu je 10.
- **Karussell-Aufteilung:** Mehr als 20 Bilder werden auf möglichst gleich große Beiträge verteilt.
- **Letztes Karussellbild:** Das Band läuft in den Grund aus. Ist rechts zu wenig Platz für die Endstation, beginnt das Auslaufen spätestens bei 55 % der Bildbreite. So hat die Endstation immer Platz und die Bildanzahl bleibt `ceil(Bandbreite / 1296)`.
- **Fahrt:** 0,6 s Stand am Anfang, am Ende 3 s mit eingeblendeter Endstation. Ist die Strecke kürzer als eine Rampe, gibt es eine einzige weiche Bewegung. Bei Strecken schmaler als das Video steht das Band mittig.
- **Sicherung einspielen** gibt es in der Ausfahrt und in der Streckenliste (dort braucht man es, wenn die App neu installiert wurde). Jede Datei wird beim Einspielen per CRC geprüft; scheitert etwas, wird die halb eingespielte Strecke wieder entfernt.
- **Sicherungserinnerung:** Gezählt wird ab dem letzten erfolgreichen Teilen oder Speichern der Sicherung.

## Etappe 4

- **Alles aus dem Konzept ist gebaut**, nichts von der Streichliste wurde gestrichen.
- **Herauszoomen:** Zwei Finger (oder Mausrad) zoomen stufenlos von der ganzen Strecke bis 100 %, Doppeltipp wechselt zwischen Streckenhöhe und 100 %. Ein eigener Knopf dafür fehlt bewusst.
- **Tageswechsel** stehen in der Leiste als gelber Strich mit Kurzdatum und im Fahrplan als Zwischenzeile.
- **Pünktlichkeit** zählt nur Anschlüsse (ab dem zweiten Halt). Ohne Anschluss steht „–“ und kein Spruch.
- **Blindfahrt:** Die Aufdeckung zeigt nur den Faden und den Stempel, kein Herauszoomen. Strecke, Leiste, Streckenvorschau und Ausfahrt bleiben bis „Ziel erreichen“ verdeckt. Das Finale spielt die Fahrt im Tempo Regionalexpress im Vollbild, Antippen überspringt.
- **Linsenwechsel:** erscheint nur, wenn `enumerateDevices` nach der Freigabe mindestens zwei Kameras liefert, deren Name nicht nach Frontkamera klingt. Der Knopf zeigt „1/3“ usw. Nur am iPhone prüfbar.

## Einführung (0.5.0)

- **Die Überraschung ist vorbei.** Statt die Idee erst beim zweiten Foto zu zeigen, erklärt eine Einführung sie vorab in drei Bildschirmen. Die Spoiler-Regel ist aus `CLAUDE.md` gestrichen.
- **Nur beim ersten Start** heißt: Die Einführung wurde noch nie gesehen oder übersprungen, und es liegt noch kein einziger Halt in der Datenbank. Wer die App schon benutzt hat, bekommt sie nach dem Update nicht ungefragt, kann sie aber in den Strecken über „So funktioniert's“ öffnen. Gemerkt wird das in `localStorage` und zusätzlich in der Datenbank.
- **Reihenfolge beim ersten Start:** Installationshinweis (nur im Browser), Einführung, dann der Sucher mit der Kamera-Freigabe. Die Kamera wird erst nach der Einführung angefragt.
- **Beispiele sind gezeichnet** (`src/ansichten/einfuehrung.mjs`): fünf einfache Szenen mit einer Linie auf gleicher Höhe (Meer, Café, Hafengeländer, Berg, Straße), weich verschmolzen wie im echten Band. Keine Fotos, keine Dateien, nichts aus dem Netz. Wert und Signal im Beispiel sind gespielt, nicht vom Bildkern gerechnet.
- **Reduzierte Bewegung:** Ist sie im System eingestellt, zeigt jeder Bildschirm ein aussagekräftiges Standbild.
- **Der geführte Erstlauf bleibt** wie gehabt. Seine Hinweise im Sucher passen auch nach der Einführung und helfen beim ersten echten Anschluss.

## Reel (0.7.0)

- **Die Fahrt in der Ausfahrt heißt jetzt Reel.** Das Finale der Blindfahrt nutzt weiter die alte Fahrt mit Rampe und Regionalexpress-Tempo, unverändert.
- **Tempo aus der Länge:** konstantes Tempo ab dem ersten Bild, am Ende 1,6 s gleichmäßiges Bremsen. So stimmt die Länge exakt und es gibt keinen Stillstand am Anfang. Bei eingeschalteter Endstation gehören deren 3 s zur gewählten Länge.
- **Vorschlag bei zu hohem Tempo:** Der Anfang („Von“) bleibt, das Ende rückt vor. Es ist der längste Abschnitt, der unter 900 Pixeln pro Sekunde bleibt. Man kann trotzdem schneller bauen, der Vorschlag ist kein Zwang.
- **Endstation im Reel** zeigt die Zahlen des gewählten Abschnitts, nicht der ganzen Strecke.
- **Titelbild:** ohne Text. Mittig steht das Band in 1350 Pixeln Höhe, zentriert auf den Faden des besten Anschlusses im Abschnitt. Oben und unten bleibt dunkler Grund, damit Instagram es beliebig zuschneiden kann, ohne Bildinhalt zu verlieren.
- **„In Fotos speichern“** öffnet das Teilen-Menü mit Video und Titelbild, dort „Sichern“ wählen. Einen direkten Weg in die Fotos-App gibt es für Web-Apps nicht. Scheitert das Teilen, gibt es den Download.
- **Nur MP4:** Kann das Gerät weder per WebCodecs noch per `MediaRecorder` MP4 schreiben, ist das Reel ausgegraut, statt still ein WebM zu liefern.
