# Nahtlos

Foto-Web-App fürs iPhone. „Nahtlos“ ist der Arbeitstitel.

Lies vor der ersten Änderung in dieser Reihenfolge:

1. `docs/KONZEPT.md`: was die App ist und wie sie sich anfühlt
2. `docs/ETAPPEN.md`: was in welcher Reihenfolge gebaut wird und wann es fertig ist
3. `docs/TECHNIK.md`: Aufbau, iOS-Fallen, Speicher, Ausgaben
4. `docs/TEXTE.md`: alle Texte der App
5. `src/kern.mjs` und `test/kern.test.mjs`: der fertige, getestete Bildkern
6. `docs/ENTSCHEIDUNGEN.md`: was vom Konzept abweicht und warum

## So arbeitest du

- Leg direkt los und warte nicht auf Freigaben. Baue die Etappen der Reihe nach.
- Mach nach jeder Etappe: Tests laufen lassen, committen, pushen.
- Antworte David locker, kurz und auf Deutsch, per Du.
- Nenne am Ende jeder Sitzung nur: welche Etappen fertig sind, was du nicht testen konntest und was David jetzt tun muss.
- Wichtige Entscheidungen, die vom Konzept abweichen, gehören in `docs/ENTSCHEIDUNGEN.md`.
- Einführung und Erstlauf müssen ohne jedes Vorwissen funktionieren. Das ist die wichtigste Anforderung an die Oberfläche.
- Halte Commit-Nachrichten und PR-Titel kurz, zum Beispiel „Etappe 1“ oder „Einführung“.

## Aufräumen (erledigt)

Die hochgeladenen Dateien liegen inzwischen an ihrem Platz: Bildkern in `src/kern.mjs`, seine Tests in `test/kern.test.mjs`, Konzept, Technik, Etappen und Texte in `docs/`.

## Tests

- `npm test`: Bildkern, Geometrie, ZIP, Auslieferung (Node, ohne Browser)
- `npm run test:browser`: Ende-zu-Ende in Chromium mit Kamera-Ersatz, Screenshots landen in `test/ergebnisse/`
- `npm run icons`: Icons und Startbilder neu erzeugen

## Feste Regeln

- **Plattform:** PWA, ausgeliefert über GitHub Pages aus `main`, Ordner `/` (Root). Kein Mac, kein App Store, kein Server.
- **Kein Build-Schritt:** natives HTML, CSS und ES-Module. Fremdbibliotheken liegen als einzelne Datei in `vendor/`. Pakete dürfen per npm geholt und dorthin kopiert werden. Testwerkzeuge dürfen npm nutzen.
- **Relative Pfade überall:** Die App läuft unter `https://<name>.github.io/<repo>/`.
- **Alles bleibt auf dem Gerät:** keine Analyse-Dienste, keine externen Schriften, keine Netzabfragen zur Laufzeit. Nach dem ersten Start muss die App komplett offline laufen.
- **Das Repository ist öffentlich:** keine Nachnamen, Adressen, Reiseziele, Reisedaten oder andere persönliche Daten in Code, Doku, Commits oder Testbildern.
- **Bildkern:** `src/kern.mjs` ist getestet. Ändere das Verfahren nur, wenn ein Test auf echten Fotos oder dem iPhone es nötig macht, und halte die Tests grün. Werte in `KONFIG` darfst du anpassen.
- **Versionen:** Jede Auslieferung erhöht `APP_VERSION` und den Cache-Namen des Service Workers. Die Version steht sichtbar in der App.
- **Daten sind heilig:** Ein aufgenommenes Foto wird gespeichert, bevor irgendetwas anderes damit passiert. Stürzt das Nähen ab, ist das Foto noch da. Änderungen am Speicherformat brauchen eine Migration.

## Termin

Die Testversion muss bis **08.11.2026** auf dem iPhone laufen, danach folgt der Praxistest. Wird es knapp, gilt die Streichliste in `docs/ETAPPEN.md`. Eine kleine App, die zuverlässig läuft, ist besser als eine große, die unterwegs Fotos verliert.
