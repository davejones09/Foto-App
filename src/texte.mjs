// Alle Texte der App (docs/TEXTE.md). Platzhalter in {geschweiften Klammern}.
export const T = {
  installTitel: 'Einmal einsteigen, bitte.',
  installText: 'Fotos sollen nicht verloren gehen. Dafür gehört die App auf deinen Home-Bildschirm.',
  installSchritte: ['Tippe auf Teilen.', 'Wähle „Zum Home-Bildschirm“.', 'Starte die App über das neue Icon.'],
  installTrotzdem: 'Trotzdem im Browser testen',

  einfuehrung: [
    {
      titel: 'Eine Reise, ein Bild.',
      text: 'Jedes Foto beginnt genau dort, wo das letzte aufhört. Fotografier unterwegs oder hol bis zu 10 Fotos aus der Mediathek: Die App sucht die Reihenfolge, die am besten passt.',
    },
    {
      titel: 'Anschluss suchen.',
      text: 'Links im Sucher liegt das Ende deines letzten Fotos. Such etwas, das dort weitergeht, egal wo: Horizont, Tischkante, Geländer. Grün heißt: Das passt.',
    },
    {
      titel: 'Endstation: eine lange Strecke.',
      text: 'Am Ende fährst du durch alles durch: als Reel für Instagram, als Karussell oder als ein langes Bild.',
    },
  ],
  einfUeberspringen: 'Überspringen',
  einfLos: 'Einsteigen',
  einfOeffnen: 'So funktioniert\'s',
  einfKarussell: 'Karussell',
  einfReel: 'Reel',

  kameraText: 'Hier geht\'s nur mit Kamera. Deine Fotos bleiben auf deinem iPhone.',
  kameraKnopf: 'Kamera freigeben',
  kameraVerweigert: 'Ohne Kamera bleibt der Zug stehen. Erlaube den Kamerazugriff in den iPhone-Einstellungen bei Safari und öffne die App neu.',
  kameraMediathek: 'Foto aus der Mediathek holen',

  erstLeer: 'Mach ein Foto. Egal wovon.',
  erstRest: 'Das ist das Ende deines letzten Fotos.',
  erstSuch: 'Such etwas, das hier weitergeht. Egal wo.',
  erstMarken: 'Hier kommen Linien aus dem Bild. Triff sie.',
  erstSignal: 'Grün heißt: Das passt.',
  erstNach: 'Kein Schnitt. Jedes Foto beginnt, wo das letzte endet.',
  erstStrecke: 'Das ist deine Strecke. Sie wird so lang wie deine Reise.',
  erstKnopf: 'Weiterfahren',

  // Tipps und Ideen stehen in src/ideen.mjs, beide aus derselben Quelle.
  idee: 'Idee',
  andereIdee: 'Andere Idee',
  ideeOrt: 'Wo bist du gerade?',
  richtungHoeher: 'Etwas höher halten oder leicht nach oben kippen. Die Linie rutscht dann zur Marke.',
  richtungTiefer: 'Etwas tiefer halten oder leicht nach unten kippen. Die Linie rutscht dann zur Marke.',
  kameraStartet: 'Kamera startet …',
  mediathek: 'Aus der Mediathek',
  strecke: 'Strecke',
  halt: 'Halt {n}',

  weiter: 'Weiter',
  feinjustieren: 'Feinjustieren',
  streichen: 'Streichen',
  streichenFrage: 'Letzten Halt streichen?',
  behalten: 'Behalten',
  naehFehler: 'Das Nähen hat nicht geklappt. Dein Foto ist gespeichert.',
  nochmalVersuchen: 'Nochmal versuchen',

  serieTitel: 'Serie',
  serieBeste: 'Beste Anschlüsse',
  serieZeit: 'Nach Aufnahmezeit',
  seriePruefen: 'Foto {k} von {n} wird gesichert und geprüft …',
  serieHinweis: 'Ziehen sortiert um, Antippen wählt einen anderen Ausschnitt.',
  serieAnschluss: 'Schließt an Halt {n} an.',
  serieBauen: 'Bauen',
  serieVerwerfen: 'Serie verwerfen',
  serieVerwerfenFrage: 'Serie verwerfen? Die Fotos bleiben in deiner Mediathek.',
  verwerfen: 'Verwerfen',
  serieZuViele: 'Höchstens 10 Fotos. Die ersten 10 sind dabei.',
  serieKaputt: '{n} Fotos ließen sich nicht öffnen.',
  serieWartet: 'Eine Serie aus der Mediathek wartet noch.',
  serieOeffnen: 'Weiter',
  serieAusschnitt: 'Ausschnitt wählen',
  serieZeitUnbekannt: 'Zeit unbekannt',
  serieAngehalten: 'Angehalten. {n} Fotos warten noch.',
  serieEntfernen: 'Entfernen',
  serieVerschieben: 'Verschieben',

  feinHinweis: 'Schieben, zoomen, drehen. Der Anschluss rechnet mit.',
  uebernehmen: 'Übernehmen',
  abbrechen: 'Abbrechen',

  streckeLeer: 'Noch kein Halt. Zeit für die Abfahrt.',
  streckeKopf: '{name} · {n} Halte',
  fahrplan: 'Fahrplan',
  ausfahrt: 'Ausfahrt',
  zumSucher: 'Zum Sucher',

  streckenTitel: 'Strecken',
  streckenLeer: 'Noch keine Strecke.',
  neueStrecke: 'Neue Strecke',
  nameFrage: 'Wie heißt die Strecke?',
  nameVorschlag: 'Strecke {monat} {jahr}',
  blindOption: 'Blindfahrt: Ihr seht immer nur das letzte Stück. Die ganze Strecke erst im Ziel.',
  loeschenFrage: '„{name}“ wirklich löschen? {n} Halte sind dann weg.',
  loeschen: 'Löschen',

  blindStatt: 'Die Strecke bleibt bis zum Ziel verdeckt.',
  zielKnopf: 'Ziel erreichen',
  zielFrage: 'Ziel erreichen? Danach seht ihr alles.',
  aufdecken: 'Aufdecken',
  weiterfahren: 'Weiterfahren',

  fahrplanTitel: 'Fahrplan',
  spalten: ['Zeit', 'Halt', 'Anschluss'],
  kennzahlen: '{n} Halte · Durchschnitt {x} · Pünktlichkeit {p} %',
  unbenannt: 'Halt {n}',
  puenktlich100: 'Das glaubt dir bei der Bahn keiner.',
  puenktlichSchlecht: 'Wir bitten um Entschuldigung.',

  ausfahrtTitel: 'Ausfahrt',
  karussell: 'Karussell · {n} Bilder für Instagram',
  mehrereBeitraege: 'Passt nicht in einen Beitrag. Wird auf {t} Teile aufgeteilt.',
  reel: 'Reel · Video für Instagram · {laenge} s',
  reelSekunden: '{s} s',
  reelVon: 'Von',
  reelBis: 'bis',
  reelTempo: '{n} Halte · Tempo {v} Pixel pro Sekunde',
  reelZuSchnell: 'Bei {laenge} s wird es zu schnell. Vorschlag: Halt {von} bis {bis}.',
  reelEndstation: 'Endstation am Ende',
  inFotos: 'In Fotos speichern',
  reelHinweis: 'In Instagram „Reel“ wählen. „In Fotos speichern“ legt Video und Titelbild ab, das Titelbild nimmst du als Cover.',
  mp4Fehlt: 'Dieses Gerät kann hier kein MP4 bauen.',
  gesamtbild: 'Gesamtbild · {b} × {h} Pixel',
  verkleinert: 'Für das iPhone zu groß, deshalb auf {b} × {h} verkleinert.',
  sicherung: 'Sicherung · als Datei speichern',
  einspielen: 'Sicherung einspielen',
  erinnerung: 'Letzte Sicherung ist {n} Halte her.',
  wirdGebaut: 'Wird gebaut … {p} %',
  teilen: 'Teilen',
  abbruchHintergrund: 'Abgebrochen, weil die App in den Hintergrund ging.',
  nochmal: 'Nochmal',

  endstation: 'Endstation',
  endHalte: '{n} Halte · Pünktlichkeit {p} %',
  endZeitraum: '{von} bis {bis}',

  speicherVoll: 'Der Speicher ist voll. Sichere die Strecke und lösche eine alte.',
  kameraWeg: 'Die Kamera antwortet nicht.',
  neuStarten: 'Neu starten',
  importFehler: 'Dieses Foto lässt sich nicht öffnen. Versuch ein anderes.',
  teilenFehler: 'Teilen hat nicht geklappt.',
  stattdessenSpeichern: 'Stattdessen speichern',
  querformat: 'Bitte hochkant halten.',
  allgemein: 'Da ist was schiefgelaufen. Deine Fotos sind sicher.',
  neuLaden: 'Neu laden',

  diagnoseTitel: 'Diagnose',
  berichtKopieren: 'Bericht kopieren',
  fadenZeigen: 'Faden und Teilwerte zeigen',
  schliessen: 'Schließen',
  kopiert: 'Kopiert. In Claude Code einfügen.',
};

export function f(text, werte = {}) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (werte[k] ?? `{${k}}`));
}

export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function namensVorschlag(d = new Date()) {
  return f(T.nameVorschlag, { monat: MONATE[d.getMonth()], jahr: d.getFullYear() });
}
