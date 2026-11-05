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

## Serie aus der Mediathek (0.8.0)

- **Eigener Wartebereich statt halbfertiger Halte.** Serienfotos liegen bis zum Bauen im neuen Speicher `serie` (Format 2). Würden sie sofort als Halte angelegt, würde der Start sie in der Auswahlreihenfolge fertignähen. Der Übergang zum Halt ist eine einzige Transaktion.
- **Motivkarte:** Farbabweichung zur Umgebung (stark weichgezeichnetes Bild), nicht zum Bildmittel. Bei einem zweifarbigen Bild (Himmel und Meer) weicht sonst jeder Pixel vom Mittel ab und ein kleines Motiv ginge unter. Die Werte werden quadriert, damit Deutliches zählt.
- **Motivschutz relativ zum besten Ausschnitt.** Ein Querformat verliert im 4:5-Rahmen immer Fläche. Gemessen wird deshalb, wie viel ein Ausschnitt gegenüber dem besten möglichen behält. Unter 80 % ist er verboten, darüber kostet jeder Prozentpunkt 2,5 Punkte. Im Test behalten alle erlaubten Ausschnitte mindestens 95 % des Motivs.
- **Held-Karp mit geschätzten Kanten:** Für die Reihenfolge zählt je Fotopaar der beste Paarwert der 10 günstigsten Ausschnitte. Die exakte Ausschnittwahl macht danach Viterbi über alle erlaubten Ausschnitte. Beide Schritte sind exakt für ihr Teilproblem, zusammen eine sehr gute Näherung des Gesamtproblems.
- **Werte in der Vorschau sind Schätzungen** aus dem schnellen Paarwert. Der endgültige Wert kommt beim Bauen aus dem Bildkern und steht danach im Fahrplan.
- **Zeit eines Serienhalts** ist das Aufnahmedatum aus EXIF, sonst der Zeitpunkt des Bauens. Fahrplan und Tageswechsel zeigen so die Reise.
- **Weitere Fotos zu einer wartenden Serie** kommen dazu, statt sie zu ersetzen.
- **Blindfahrt:** Die Auswahl erlaubt nur ein Foto. Liefert das System trotzdem mehrere, zählt nur das erste.

## Ideen (0.9.0)

- **Satz aus zwei Teilen:** erst die Beschreibung des Rests („Linie auf halber Höhe, oben hell, unten dunkel.“), dann die Idee. Allgemeine Tipps und Kontrast-Ideen stehen ohne Beschreibung, Kontrast-Ideen mit dem Hinweis auf die letzten drei Halte.
- **Ort ist optional.** Ohne Ort sind Ideen mit Ort erlaubt, aber leicht im Nachteil. Mit Ort fallen Ideen für andere Orte weg. Nochmal Antippen hebt die Wahl auf.
- **Keine Wiederholung je Strecke**, auch über Neustarts hinweg (gemerkt in der Datenbank). Sind alle passenden durch, beginnt eine neue Runde.
- **Kontrast hat Vorrang**, solange die passende Kontrast-Idee in dieser Strecke noch nicht kam.
- **Richtung ab 3 % Abstand:** Darunter wird die Marke ohnehin grün. Über 12 % ist es kein „knapp daneben“ mehr. Der Hinweis erscheint erst nach drei gleichen Messungen, damit er nicht flackert. Er hat Vorrang vor Tipps und ruht, solange das Ideen-Feld offen ist.
- **Tipps bei niedrigem Wert** kommen jetzt aus der Ideenquelle. Die alten fünf Tipps sind dort allgemeine Ideen mit der niedrigsten Priorität.

## Fehler beim Bauen einer Serie (0.9.1)

- **Problem:** Scheiterte `fertigstellen()` einmal, blieb ein Halt ohne Bild zurück. Jeder weitere Druck auf „Bauen“ machte ein weiteres Foto zum Halt und scheiterte mit „Vorgänger ist nicht fertig“. Erst ein Neustart reparierte es.
- **Lösung:** „Bauen“ stellt zuerst alle offenen Halte fertig und fasst kein neues Foto an, solange das nicht klappt. Jeder Halt bekommt automatisch einen zweiten Versuch, mit frisch aus der Datenbank gelesenen Daten. Die Meldung sagt deshalb ehrlich „Tippe nochmal auf Bauen“.
- **Ein dauerhaft kaputter Halt** (Rohbild unlesbar) blockiert die Serie, bis er nachgerechnet werden kann. Die wartenden Fotos bleiben unberührt. Streichen lässt sich ein solcher Halt über die normale Aufdeckung nicht. Das ist bewusst so, weil das Rohbild der einzige Beleg ist. Taucht der Fall am iPhone auf, braucht es eine eigene Lösung.
- **Worker mit Zeitgrenze und Neustart**, Planer und Sucher-Rest bauen sich danach selbst wieder auf. In Tests lässt sich die Zeitgrenze über `localStorage` (`nahtlos-test-zeitgrenze`) verkürzen.
- **Die Erinnerung an eine wartende Serie** kommt beim Start und beim Verlassen der Serien-Ansicht. Sie hat „Später“ und verschwindet nach 10 s, damit sie Auslöser und Versionsnummer nicht verdeckt.
- **Mehr als 10 Fotos** entstehen, wenn man zu einer wartenden Serie nachlegt. Bis 12 Fotos bleibt die Reihenfolge exakt, darüber rechnet eine Näherung, weil Held-Karp sonst zu viel Speicher braucht.

## Speicherformat 3: keine Blobs in IndexedDB (0.10.0)

- **Befund vom iPhone (iOS 18.7):** „Error preparing Blob/File data to be stored in object store“ und „An error occured reading the Blob argument to createImageBitmap“, 0,9 MB belegt bei 5 Halten. WebKit macht Blobs in IndexedDB unlesbar. Eine Wiederholung hilft nicht, betroffen war auch jedes Kamerafoto.
- **Bilddaten als ArrayBuffer** in einem eigenen Speicher `dateien`. Die Bildfelder der Halte heißen gleich, halten aber nur einen Verweis. So bleiben alle Prüfungen wie `if (h.bild)` gültig, und jede Lesestelle geht über `blob()`. Der Test-Wächter in den Browser-Tests lässt jeden Test scheitern, der einen Blob schreiben will.
- **Verweis statt Umschreiben:** Ein Serienfoto wird zum Halt, indem der Halt den Schlüssel `<fotoId>/roh` übernimmt. Die Schlüssel tragen deshalb nicht immer die ID ihres Halts. Wer Daten löscht, folgt immer dem Verweis.
- **Prüfung nach dem Schreiben** gilt für alle Bilddaten, nicht nur fürs Rohbild. Sie kostet ein Zurücklesen (einige hundert Kilobyte je Halt) und deckt genau den Fehler auf, den das iPhone hatte.
- **Beschädigt heißt zweierlei:** Fehlt nur Abgeleitetes, wird es still nachgerechnet und der Halt ist wieder heil. Fehlt das Rohbild, bleibt der Halt nutzbar, aber mit „Beschädigt“ markiert (kein Feinjustieren, kein Neunähen). Fehlen Rohbild und Bild, ist er unrettbar und blockiert das Weiterbauen, bis er gelöscht ist.
- **Sicherung im Arbeitsspeicher:** Da die Daten jetzt als ArrayBuffer aus der Datenbank kommen, entsteht die ZIP-Datei im Arbeitsspeicher. Bei sehr langen Strecken (viele Rohbilder von der Lumix) kann das auf dem iPhone knapp werden. Unlesbare Dateien fehlen in der Sicherung und stehen im Manifest unter `fehlt`.
- **Auslöser** ist beim Betreten des Suchers gesperrt, bis die Kamera Bilder liefert. Vorher verpuffte ein Tipp still.
- **WebKit-Tests:** Playwright WebKit ist in dieser Umgebung nicht installiert, und Browser dürfen hier nicht nachinstalliert werden. Getestet ist in Chromium. Der eigentliche Fehler steckt ohnehin im iOS-Speicher von WebKit, das lässt sich nur am iPhone prüfen.

## Serie ganz lassen (0.11.0)

- **Ausgangspunkt:** Tests an echten Fotos. Das Zuschneiden auf 4:5 mit automatischem Zoom kostete zu viel Bild, die Laplace-Überblendung wirkte zwischen verschiedenen Fotos verwaschen. Deshalb weicht der Serien-Übergang hier bewusst vom Bildkern ab. Der Kern selbst ist unverändert und näht weiter die Kamerahalte.
- **Eigene Breite je Halt** (Format 4). Alte Halte bekommen 1296. Die Migration läuft nach dem Blob-Umzug in normalen Transaktionen, nie im Upgrade selbst: Datensätze mit alten Blobs dürfen auf dem iPhone nicht noch einmal geschrieben werden.
- **Biegen statt Schieben:** Die Spalten des neuen Fotos werden senkrecht verschoben, aber oben und unten verankert (stückweise lineare Verzerrung). So wandert die Linie genau um den gewünschten Betrag, ohne dass am oberen oder unteren Rand ein Streifen verschmiert oder leer bleibt.
- **Harter Schnitt mit 2 Pixeln Kante:** kein Weichzeichnen, nur gegen sichtbare Treppchen an schrägen Fäden. Drei Pixel neben dem Faden ist es im Test schon exakt das reine Foto.
- **Median der Umgebung über Blockmittel:** Mittel je 32er-Block, davon der Median über 5 × 5 Blöcke (160 Pixel). Ein echter gleitender Median wäre auf dem iPhone zu langsam, und ein kleines Motiv beeinflusst den Median der Blöcke kaum. Im Test: Motiv 93 % der Karte, unscharfer Vordergrund 0 %, Textur 3 %.
- **Motiv antippen:** Der Punkt wird im Rahmen gespeichert (`motiv` am Halt) und zählt für die Karussellgrenzen. Muss ein Foto beschnitten werden (außerhalb 0,7 bis 2:1), rückt der Zuschnitt um diesen Punkt.
- **Karussell, Ende:** Nach dem Versatz läuft das letzte Bild wie bisher in die Endstation aus. Abgeschnitten wird nur am Anfang. Am Ende wird nichts extra weggenommen, weil dort ohnehin die Endstation steht und die Anzahl nicht steigen kann.
- **Einzelnes Foto aus der Mediathek** bleibt wie bisher 4:5 mit Feinjustieren. Ganze Fotos gibt es nur in der Serie, wie gewünscht.

## Fotos unverändert (0.12.0)

- **Grundregel:** Fotos werden außerhalb des Übergangs nicht verändert. Sie steht jetzt in `CLAUDE.md` unter den festen Regeln und geht allen anderen Wünschen an die Bildrechnung vor.
- **Keine Farbangleichung mehr**, bei keinem Halt und auch nicht als Option. `angleichen`, `naehen` (Laplace) und das alte `anschliessen` sind aus dem Kern entfernt, damit sie nicht aus Versehen wieder benutzt werden. Ein Test sucht in `src/` nach Aufrufen. `zeilenGain` bleibt im Kern, aber nur innerhalb von `analysiere`: Es beeinflusst den Wert und damit, wo der Faden liegt, aber keine einzige Farbe.
- **Ein Übergang für alle Halte**, Kamera, Import und Serie, genau nach dem getesteten Ablauf (weich, Box-Radius r = 23, Feder 11 bei 363 Pixeln). Die Unterscheidung `uebergang: 'serie'` wählt kein Verfahren mehr. Das Biegen gilt damit auch für Kamerahalte, aber nur in der Überlappung und nur bis 3 %.
- **Biegen auf eine gemeinsame Linie:** Statt nur das neue Foto zu biegen, werden beide Streifen der Überlappung auf dieselbe Kurve gezogen (links Höhe von A, rechts Höhe von B, dazwischen smoothstep). So treffen sich die Linien am Faden, egal wo er liegt, und A bleibt am linken, B am rechten Rand exakt unverändert. Das Bild des Vorgängers selbst bleibt dabei unberührt, gebogen wird nur seine Kopie in der Naht.
- **Der Worker bekommt nur noch die beiden Randstreifen** und schickt nur die Naht zurück. Das Bild des Halts ist das gerahmte Original und wird nicht mehr durch den Worker geschickt. Das spart auf dem iPhone pro Anschluss rund 20 MB Arbeitsspeicher.
- **JPEG 0,95** für Rohbild, Bild und Naht (bisher 0,92 bei Bild und Import-Rohbild). Zwei Generationen JPEG (Rohbild, dann Bild) liegen im Test bei rund 0,1 Stufen im Mittel.
- **Farbraum je Halt:** `farbraum` am Halt, `nahtFarbraum` an der Naht. P3-Fotos werden über ein Bild-Element dekodiert, weil unklar ist, ob Safari mit `createImageBitmap` P3 erhält. sRGB-Fotos laufen weiter über den bewährten Weg mit `createImageBitmap`. Die Kamera bleibt sRGB.
- **Erhält toBlob das Profil am iPhone?** Nicht sicher geklärt, hier gibt es kein iPhone und kein WebKit. Chromium schreibt bei einer P3-Leinwand das Profil selbst ins JPEG, und nach allem, was bekannt ist, tut WebKit das auch. Weil das nicht belegt ist, prüft die App es beim ersten Gebrauch selbst (`farbTest`). Fehlt das Profil, setzt sie ein eigenes Display-P3-Profil ein. Wird beim Kodieren nach sRGB umgerechnet, rechnet die App gleich in sRGB und sagt das beim Import, statt still Farben zu verlieren. Was am iPhone gilt, steht in der Diagnose in der Zeile „Farbe“.
- **Nur unvermeidbare Umrechnungen**, und die mit Hinweis: Adobe RGB und andere weite Profile nach P3, Graustufen und CMYK nach sRGB. Canvas kennt nur sRGB und Display P3.
- **Alte Strecken bleiben, wie sie sind.** Beim Start wird nur Fehlendes nachgerechnet (wie bisher). Halte ohne `verfahren` gelten als „mit Farbangleichung genäht“. Die Strecken-Ansicht bietet einmal je Start „Neu nähen“ an, erst nach einer Rückfrage wird gerechnet. Ein Halt, der dabei scheitert, behält seine alten Dateien. Halte ohne Rohbild behalten ihr Bild und bekommen nur eine neue Naht.
- **Kein neues Speicherformat:** Die neuen Felder sind optional. Fehlen sie, gilt sRGB und „altes Verfahren“, und genau so wurden diese Halte gerechnet. Deshalb ist keine Migration nötig.

## Professioneller Auftritt (0.13.0)

- **Interne Namen bleiben.** Speicherfelder und Bezeichner wie `strecke`, `halt`, `pfad`, `fahrplan` oder `ausfahrt` stammen aus der ersten Fassung. Sie umzubenennen hätte jede vorhandene Strecke umziehen müssen. Sichtbar ist nur die neue Sprache. `test/texte.test.mjs` zerlegt dafür jede Zeichenkette im Code (ohne Kommentare) und prüft sie auf Bahnbegriffe, dazu Texte, Ideen, Bewertung, Seite und Manifest. Ideen mit Bahnmotiven (Bahnsteig, Zug) sind neutral umformuliert.
- **Punkte 2 und 3 in einem Commit.** Die App startet im Hauptmenü, das Hauptmenü ist Punkt 3. Getrennt hätte es einen Zwischenstand ohne Start gegeben.
- **Ein Projekt für Carousel und Reel.** Die Karte bestimmt nur `strecke.art` und damit, was in Exportieren oben steht. Alte Projekte gelten als Carousel. Über die Mediathek entsteht das Projekt erst, wenn Fotos gewählt sind, ein abgebrochener Dateidialog hinterlässt kein leeres Projekt.
- **Kein automatisches Projekt mehr.** Früher legte der Start eine Strecke an, wenn keine da war. Jetzt entsteht ein Projekt nur über das Hauptmenü.
- **Einstellungen statt Versionsnummer im Sucher.** Version und Diagnose stehen in den Einstellungen. Fünfmal auf die Version tippen öffnet die Diagnose weiterhin.
- **Carousel: 8 % Zoom sind eine harte Grenze.** Folge: Zwei Kamerafotos (2229 Pixel Band) ergeben eine Slide, weil zwei Slides 16 % Zoom bräuchten. Drei Kamerafotos ergeben zwei Slides. Wer mehr Slides will, macht mehr Fotos. Nur wenn das Band kürzer als eine Slide ist (ein schmales Einzelfoto), wird stärker vergrößert, weil sonst eine leere Fläche bliebe.
- **Motivversatz und Zoom:** Der Versatz bekommt höchstens 15 % einer Slide zusätzlichen Spielraum, auch über etwas mehr Zoom (bis 8 %). Ohne Motiv wird mittig beschnitten.
- **Titelbild ohne Ränder.** Früher stand das Band in der Mitte mit dunklem Grund darüber und darunter. Jetzt füllt es den Rahmen wie ein Bild des Reels.
- **Metadaten werden nach dem Kodieren gesäubert**, statt sich auf den Browser zu verlassen. Safari schreibt womöglich EXIF in JPEGs von `toBlob`, das wird entfernt. Im MP4 werden nur Namen geleert und Kästen umbenannt, die Größen bleiben gleich, damit nichts an den Videodaten verrutscht. `vendor/mp4-muxer.mjs` ist an einer Stelle angepasst (neutraler Handler-Name).
- **Collage als eigener Speicher (Format 5).** Die Migration legt nur `collagen` an. Eine Collage hält ihre Fotos selbst (Rohbild, Vorschau, Motivraster), unabhängig von Strecken. Löschen nimmt alle Bilddaten mit.
- **Collage „Nahtlos“ über den Schnittbaum.** Erst wurden alle gemeinsamen Kanten einzeln überblendet. An T-Kreuzungen überschrieben sich die Streifen und es blieben Kästchen. Alle 25 Vorlagen lassen sich durchgehend schneiden, deshalb setzt die App die Collage Schnitt für Schnitt zusammen und überblendet jeden Schnitt über die volle Länge. Die Übergangsbreite ist 22 % des schmaleren Nachbarn, höchstens 362 Pixel.
- **Collage mit der Kamera** über `<input capture="environment">`, also die Kamera von iOS. Der Sucher mit Rest und Passung gehört zum Band, bei einer Collage braucht es keine Passung.
- **Collage in sRGB.** Die Formate sind Instagram-Formate, deshalb gilt die Regel für Instagram-Ausgaben.
- **Reel-Stile im Ausweichweg:** Ohne WebCodecs nimmt `MediaRecorder` in Echtzeit auf. Schwung (8 Teilbilder je Bild) und Naht (fünf Masken je Bild) würden dabei ruckeln und sind dort ausgeblendet. Band, Sanft und Zoom bleiben.
- **Reel-Ausschnitt aus dem fertigen Foto.** Die Stile schneiden 9:16 aus dem gerahmten Foto (1620 hoch) und vergrößern auf 1920, wie das Band-Reel auch. Das Rohbild wäre schärfer, kostet am iPhone aber pro Foto viel Speicher.
- **Naht-Stil mit fünf Masken** statt Weichzeichner: `ctx.filter` ist in Safari nicht sicher verfügbar. Fünf versetzte Masken mit abgestufter Deckkraft ergeben eine weiche Kante von etwa 32 Pixeln.
- **Startvideo gekürzt und hochkant.** Das gelieferte Video ist quadratisch und ab etwa 4,4 Sekunden leer. Es endet deshalb nach 4,5 statt 6,5 Sekunden, der Rand ist um die Hintergrundfarbe des jeweiligen Bildes erweitert, damit auf dem Handy keine Kante sichtbar ist. In Browser-Tests läuft es nur mit `?startvideo`.
- **Reel-Vorlagen ohne Ton.** Die Schnitte liegen im 120-BPM-Takt, Musik kommt weiter in Instagram dazu. Das passt nur grob zu einem Song, weil die App die Musik nicht kennt. Fotos dürfen sich bei fester Länge in weiteren Runden wiederholen, damit keins zu lange steht.
- **Tipps für Reels.** Die Tipps beschreiben das Drehen von Videos, die App selbst baut Reels aber nur aus Fotos. Das steht offen im Hinweis der Ansicht. `src/reeltipps.mjs` ist von der Prüfung auf Bahnbegriffe ausgenommen, weil Bahnfahren dort ein Thema ist.
- **Reel aus Clips ohne Speichern und ohne Ton.** Clips sind oft Hunderte Megabyte groß und liegen ohnehin in der Mediathek, deshalb bleibt die Auswahl nur im Arbeitsspeicher. Ton würde `AudioEncoder` und das Mischen der Clips brauchen, das fehlt in dieser Fassung. Hochkant wird mittig ausgeschnitten, ohne Motivkarte.
- **Clips laufen im Übergang schon mit.** Der hereinkommende Clip läuft während des Übergangs und danach ohne Rücksprung weiter, damit er nicht ruckelt. Das verschiebt seine Bilder im Reel etwas nach vorn, der Startpunkt gilt für den Beginn des Übergangs.
- **Clips sanfter bewegt.** Zoom-Stöße und Pulse der Vorlagen gelten nur noch für Fotos. Clips bekommen eine sanfte, durchgehende Bewegung, weil harte Stöße auf laufendem Video wie Ruckeln wirken. Beim Suchen im Clip wird auf das wirklich dekodierte Bild gewartet (`requestVideoFrameCallback`), die Diagnose nennt je Clip Sprünge und fehlende Bilder.
- **Sprünge im Clip knapp hinter der Bildgrenze.** Ausgewertet an einem echten Reel: Bilder wiederholten sich alle drei Bilder, weil das Ziel genau auf der Grenze zweier Clip-Bilder lag. Das Ziel liegt jetzt 1/240 Sekunde dahinter.
- **Musik nur bei Reel aus Clips.** Reels aus Projekten haben noch keine Musik, Fotos lassen sich aber in „Reel aus Clips“ mischen. Der Originalton der Clips entfällt, wenn Musik läuft, und auch sonst. Die Musik bleibt wie die Clips nur im Arbeitsspeicher.
- **Musik mit eigenem AAC-Encoder statt `AudioEncoder`.** Am iPhone fehlte die Musik im fertigen Reel. Der AAC-Weg über `AudioEncoder` ließ sich hier nicht testen, weil der Testbrowser kein AAC kann, und Safari weicht laut Berichten ab: `description` als ES_Descriptor statt AudioSpecificConfig, die ersten 1024 Abtastwerte genullt, teils gar kein AAC auf Apple-Geräten. Jetzt läuft überall derselbe Encoder (`vendor/aac.mjs`, libavcodec als WebAssembly, 680 KB, wird erst bei Musik geladen, Lizenzen in `docs/lizenzen/`). Nach dem Bauen zählt `mp4TonProben` die Tonproben in der Datei. Fehlen welche, sagt die App das und schreibt die Ursache in die Diagnose. Der Opus-Testweg ist entfallen.
