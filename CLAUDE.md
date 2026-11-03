# Nahtlos

Foto-Web-App fürs iPhone. „Nahtlos“ ist der Arbeitstitel.

Lies vor der ersten Änderung in dieser Reihenfolge:

1. `KONZEPT.md`: was die App ist und wie sie sich anfühlt
2. `ETAPPEN.md`: was in welcher Reihenfolge gebaut wird und wann es fertig ist
3. `TECHNIK.md`: Aufbau, iOS-Fallen, Speicher, Ausgaben
4. `TEXTE.md`: alle Texte der App
5. `REFERENZ.mjs` und `REFERENZ.test.mjs`: der fertige, getestete Bildkern

## Überraschung: nichts verraten

David hat die Idee bewusst nicht erklärt bekommen. Er soll sie in der App selbst entdecken.

- Erkläre ihm in deinen Antworten nicht, was die App macht oder wie sie funktioniert.
- Halte Commit-Nachrichten, Branch-Namen und PR-Titel neutral, zum Beispiel „Etappe 1“. Die PR-Beschreibung nennt nur Tests und offene Punkte, nicht das Konzept.
- Stelle ihm keine Fragen, die das Konzept verraten. Entscheide selbst, was du selbst entscheiden kannst.
- Der Erstlauf muss ohne jedes Vorwissen funktionieren. Das ist die wichtigste Anforderung an die Oberfläche.
- Fragt David ausdrücklich nach oder braucht er die Erklärung zum Beheben eines Problems, antworte ehrlich. Die Überraschung ist danach vorbei, das ist in Ordnung.

## So arbeitest du

- Leg direkt los und warte nicht auf Freigaben. Baue die Etappen der Reihe nach.
- Mach nach jeder Etappe: Tests laufen lassen, committen, pushen.
- Antworte David locker, kurz und auf Deutsch, per Du.
- Nenne am Ende jeder Sitzung nur: welche Etappen fertig sind, was du nicht testen konntest und was David jetzt tun muss.
- Wichtige Entscheidungen, die vom Konzept abweichen, gehören in `docs/ENTSCHEIDUNGEN.md`. Diese Datei darf das Konzept verraten, weil David sie nicht lesen muss.

## Beim ersten Lauf aufräumen

Die Dateien liegen zuerst flach im Hauptordner, weil David sie vom iPad hochlädt.

- `REFERENZ.mjs` wird `src/kern.mjs`.
- `REFERENZ.test.mjs` wird `test/kern.test.mjs`. Passe den Import an.
- `KONZEPT.md`, `TECHNIK.md`, `ETAPPEN.md` und `TEXTE.md` kommen nach `docs/`.
- `CLAUDE.md` bleibt im Hauptordner. Passe darin die Pfade an.

## Feste Regeln

- **Plattform:** PWA, ausgeliefert über GitHub Pages aus `main`, Ordner `/` (Root). Kein Mac, kein App Store, kein Server.
- **Kein Build-Schritt:** natives HTML, CSS und ES-Module. Fremdbibliotheken liegen als einzelne Datei in `vendor/`. Pakete dürfen per npm geholt und dorthin kopiert werden. Testwerkzeuge dürfen npm nutzen.
- **Relative Pfade überall:** Die App läuft unter `https://<name>.github.io/<repo>/`.
- **Alles bleibt auf dem Gerät:** keine Analyse-Dienste, keine externen Schriften, keine Netzabfragen zur Laufzeit. Nach dem ersten Start muss die App komplett offline laufen.
- **Das Repository ist öffentlich:** keine Nachnamen, Adressen, Reiseziele, Reisedaten oder andere persönliche Daten in Code, Doku, Commits oder Testbildern.
- **Bildkern:** `REFERENZ.mjs` ist getestet. Ändere das Verfahren nur, wenn ein Test auf echten Fotos oder dem iPhone es nötig macht, und halte die Tests grün. Werte in `KONFIG` darfst du anpassen.
- **Versionen:** Jede Auslieferung erhöht `APP_VERSION` und den Cache-Namen des Service Workers. Die Version steht sichtbar in der App.
- **Daten sind heilig:** Ein aufgenommenes Foto wird gespeichert, bevor irgendetwas anderes damit passiert. Stürzt das Nähen ab, ist das Foto noch da. Änderungen am Speicherformat brauchen eine Migration.

## Termin

Die Testversion muss bis **08.11.2026** auf dem iPhone laufen, danach folgt der Praxistest. Wird es knapp, gilt die Streichliste in `ETAPPEN.md`. Eine kleine App, die zuverlässig läuft, ist besser als eine große, die unterwegs Fotos verliert.
