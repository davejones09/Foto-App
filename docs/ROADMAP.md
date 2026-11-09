# Roadmap

Neue Funktionen kommen gebündelt als großes Update. Bugfixes kommen sofort als kleine Updates (0.22.1 …).
Die Nummern entsprechen der gemeinsamen Ideenliste.

## 0.22 Reel-Werkstatt (fertig)

- 16 Sofort-Vorschau
- 7 Reel-Entwürfe speichern
- 1 Einfach und Erweitert
- 2 Schnitte auf der Wellenform
- 3 Originalton der Clips
- 8 Musik auch für Foto-Reels
- 22 Tempo-Rampen und Freeze

## 0.23 Vielfalt (fertig)

- 14 Reel-Vorlagen in Stimmungsgruppen
- 18 Variante-Knopf für Reels und Collagen
- 19 Eigene Kombinationen aus Bausteinen
- 9 Eigene Vorlagen
- 6 Text im Reel
- 15 Neue Collage-Arten
- 12 Kanten-Regler für Collagen (mit Abstand zwischen den Bildern ausgeblendet)
- 23 Eigene Signatur

## 0.24 Teilen und Zeigen (fertig)

- 4 Instagram-Vorschau
- 10 Story-Format
- 11 Alles auf einmal sichern
- 21 Vorher und nachher
- 5 Tagesrückblick
- 24 Reiseroute als Grafik

## 0.25 Kamera und Erkennung (in Arbeit)

Stand für die nächste Sitzung:
- Anschluss-Kamera: Entwurf in `src/anschlusskamera.mjs` (Geisterbild des letzten Clips, Anschluss-Wert, Aufnahme über MediaRecorder, Clip direkt ins Reel und in den Entwurf). Noch nicht in der Oberfläche eingehängt, noch ohne Tests. Texte `akHinweis`, `akHinweisErster`, `akAufnehmen`, `akFertig`, `akZeit`, `akFehler`, `akKeineKamera`, `akNichtMoeglich` fehlen noch in `texte.mjs`.
- Erkennung: geplant mit MediaPipe Tasks Vision (`@mediapipe/tasks-vision`, Apache-2.0, per npm) und dem Segmentierungsmodell DeepLab v3 (21 Klassen, darunter Person, Auto, Bus, Zug, Flugzeug, Boot). Das Modell liegt bei Google auf storage.googleapis.com, das aus dieser Umgebung gesperrt ist. Entweder David lädt es einmal herunter und hängt es an, oder es kommt aus einer Kopie auf GitHub mit geprüfter Lizenz. Etwa 12 MB, wird erst bei Nutzung geladen und dann offline gecacht.
- Testmaterial: Zug- und Tram-Clips liegen bei David vor (nicht im Repository, das ist öffentlich).


- 17 Stehender Vordergrund
- 20 Fahrzeug-Übergang
- 13 Anschluss-Kamera für Clips

## Für alles gilt

- Fotos bleiben unverändert, gerechnet wird nur im Übergang.
- Alles bleibt auf dem Gerät, auch Erkennung und Musik.
- Keine App-Spuren in Ausgaben.
- Einfach zuerst, Regler wandern in den erweiterten Modus.
