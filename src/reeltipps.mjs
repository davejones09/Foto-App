// Tipps für Reels: Inhalte zum Drehen, nach Anlass. Die Längen sind Richtwerte, keine Regeln von Instagram.
// clips: [Was, Sekunden im fertigen Reel]. laenge: [von, bis] in Sekunden.

export const GRUNDLAGEN = [
  { titel: 'Format', text: 'Hochkant in 9:16 drehen, fertig 1080 × 1920. Dreh Clips ab 1080p, gern in 4K, dann kannst du noch zuschneiden.' },
  { titel: 'Bildrate', text: 'Nimm für normale Clips 30 Bilder pro Sekunde und für Zeitlupe 60 oder mehr. Mische im selben Reel möglichst keine anderen.' },
  { titel: 'Länger drehen', text: 'Dreh jeden Clip 3 bis 5 Sekunden länger, als du ihn brauchst. Geschnitten wird am Ende, nicht beim Filmen.' },
  { titel: 'Die erste Sekunde', text: 'Fang mit dem stärksten Bild an, nicht mit der Anreise. Ein Reel wird oft in den ersten Sekunden weggewischt.' },
  { titel: 'Ruhige Bewegung', text: 'Halte das Handy mit beiden Händen und nah am Körper und geh langsam aus den Knien. Bewege dich in einem Clip nur in eine Richtung.' },
  { titel: 'Sichere Bereiche', text: 'Instagram legt Texte und Knöpfe über das Bild. Lass oben und unten etwa 250 Pixel und rechts etwa 60 Pixel frei von Wichtigem.' },
  { titel: 'Licht', text: 'Dreh mit dem Licht im Rücken oder von der Seite. Morgens und kurz vor Sonnenuntergang wird es am schönsten.' },
  { titel: 'Ton', text: 'Musik wählst du am besten direkt in Instagram. Originalton lohnt sich bei Wellen, Regen oder dem Knistern in der Pfanne.' },
  { titel: 'Länge', text: 'Für kurze Eindrücke reichen 7 bis 15 Sekunden, für normale Reels 15 bis 30 und für Anleitungen bis 60. Länger nur, wenn wirklich genug passiert.' },
];

export const ANLAESSE = [
  {
    id: 'reise', titel: 'Reisen', stil: 'Mix oder Rush',
    ideen: [
      { titel: 'Ein Tag in 20 Sekunden', zweck: 'Zeigt, wie sich der Ort anfühlt.', laenge: [15, 25], clips: [['Blick aus dem Fenster nach dem Aufwachen', 2], ['Frühstück von oben', 2], ['Du gehst los, von hinten gefilmt', 3], ['Das Highlight des Tages, weit', 4], ['Ein Detail davon, ganz nah', 2], ['Du mittendrin', 3], ['Sonnenuntergang', 4]] },
      { titel: 'Drei Dinge, die du hier machen musst', zweck: 'Wird gern gespeichert und geteilt.', laenge: [20, 35], clips: [['Schönstes Bild, dazu der Titel als Text', 3], ['Erster Tipp: weit und nah', 6], ['Zweiter Tipp: weit und nah', 6], ['Dritter Tipp: weit und nah', 6], ['Abschlussbild mit Ort', 4]] },
    ],
    tipps: ['Filme an jedem Ort eine Totale, eine halbnahe Einstellung und ein Detail.', 'Dreh kurze Übergänge mit: Hand vor die Linse am Ende des einen Clips und am Anfang des nächsten.', 'Sammle Clips über mehrere Tage und schneide erst danach.'],
  },
  {
    id: 'restaurant', titel: 'Restaurant', stil: 'Beat',
    ideen: [
      { titel: 'Vom Eingang bis zum Teller', zweck: 'Kurz und appetitlich, gut für einen Restauranttipp.', laenge: [10, 20], clips: [['Schild oder Eingang', 2], ['Du gehst hinein, aus deiner Sicht', 2], ['Tisch und Stimmung', 2], ['Küche oder Theke', 2], ['Der Teller wird serviert', 3], ['Der erste Bissen', 2]] },
      { titel: 'Was ich bestellt habe', zweck: 'Zeigt die Karte und hilft bei der Entscheidung.', laenge: [15, 30], clips: [['Bestes Gericht ganz nah', 2], ['Die Karte', 2], ['Erstes Gericht von oben', 3], ['Zweites Gericht von oben', 3], ['Drittes Gericht von oben', 3], ['Anschneiden, Gießen oder Teilen', 3], ['Raum und Name des Restaurants', 3]] },
    ],
    tipps: ['Setz dich möglichst ans Fenster und lass den Blitz aus.', 'Filme Essen von oben oder im flachen Winkel von etwa 45 Grad.', 'Bewegung macht Appetit: Gießen, Schneiden, Löffel eintauchen.', 'Filme zuerst und iss danach, solange es noch heiß aussieht.'],
    achtung: 'Frag das Personal, bevor du länger filmst. Andere Gäste sollten nicht erkennbar sein.',
  },
  {
    id: 'hotel', titel: 'Hotel', stil: 'Slide',
    ideen: [
      { titel: 'Zimmer-Tour', zweck: 'Beantwortet die Frage, wie es dort wirklich aussieht.', laenge: [15, 30], clips: [['Tür öffnen, aus deiner Sicht', 3], ['Zimmer weit aus der Ecke', 3], ['Bett oder Kissen im Detail', 2], ['Bad', 3], ['Vorhang auf, Aussicht', 4], ['Kleines Detail wie der Begrüßungsgruß', 2], ['Pool oder Lobby', 3]] },
      { titel: 'Ein perfekter Hoteltag', zweck: 'Verkauft das Gefühl statt der Ausstattung.', laenge: [20, 40], clips: [['Morgens auf dem Balkon', 3], ['Frühstück', 4], ['Pool', 5], ['Lesen oder Spa', 4], ['Abends an der Bar', 4], ['Bett bei Nachtlicht', 3]] },
    ],
    tipps: ['Filme das Zimmer direkt nach der Ankunft, bevor du auspackst.', 'Mach alle Lichter an und die Vorhänge auf.', 'Nutze die Weitwinkel-Kamera, aber geh nicht zu nah an Möbel heran.', 'Bewege dich langsam und in einer Richtung durch den Raum.'],
    achtung: 'Im Pool, Spa und beim Frühstück sollten andere Gäste nicht erkennbar sein. Für Kooperationen sprich dich vorher mit dem Hotel ab.',
  },
  {
    id: 'flug', titel: 'Flüge', stil: 'Swipe',
    ideen: [
      { titel: 'Vom Abflug bis zur Ankunft', zweck: 'Klassiker für den Start einer Reiseserie.', laenge: [15, 25], clips: [['Koffer oder Pass', 2], ['Anzeigetafel im Terminal', 2], ['Flugzeug durchs Terminalfenster', 3], ['Gang zum Einsteigen', 2], ['Start aus dem Fenster', 4], ['Über den Wolken', 3], ['Landung oder erster Schritt am Ziel', 3]] },
      { titel: 'Aussicht vom Fensterplatz', zweck: 'Sehr kurz, läuft gut in Schleife.', laenge: [8, 15], clips: [['Fenster und Sitz weit', 2], ['Flügel und Wolken', 4], ['Sonnenaufgang oder Sonnenuntergang', 3], ['Das Ziel von oben', 3]] },
    ],
    tipps: ['Buch einen Fensterplatz vor oder hinter dem Flügel, je nachdem, ob du ihn im Bild haben willst.', 'Halte die Linse nah an die Scheibe und deck Spiegelungen mit dunkler Kleidung ab.', 'Halte den Fokus auf der Ferne, sonst springt er auf die Scheibe.', 'Filme lieber kurz und oft als einen langen Clip.'],
    achtung: 'Die Anweisungen der Crew gehen immer vor. Stell das Handy auf Flugmodus. Crew und Mitreisende nur mit Einverständnis filmen, Sicherheitsbereiche gar nicht.',
  },
  {
    id: 'bahn', titel: 'Bahnfahren', stil: 'Band',
    ideen: [
      { titel: 'Zugfahrt durch die Landschaft', zweck: 'Ruhig und atmosphärisch, viel Fernweh.', laenge: [10, 20], clips: [['Zug fährt am Bahnsteig ein', 3], ['Einsteigen, aus deiner Sicht', 2], ['Platz mit Kaffee oder Buch', 2], ['Landschaft durchs Fenster', 4], ['Deine Spiegelung in der Scheibe', 2], ['Ankunft mit Bahnhofsschild', 2]] },
      { titel: 'Die Strecke im Zeitraffer', zweck: 'Viel Strecke in wenigen Sekunden.', laenge: [10, 20], clips: [['Bahnhof weit', 2], ['Zeitraffer aus dem Seitenfenster', 7], ['Aus dem Tunnel ins Licht', 2], ['Ankunft mit Bahnhofsschild', 3]] },
    ],
    tipps: ['Setz dich ans Fenster, möglichst ohne Sonne im Rücken, das spart Spiegelungen.', 'Halte die Kamera nah an die Scheibe, aber berühr sie nicht, sonst überträgt sich das Rütteln.', 'Filme schräg nach vorn: Das wirkt ruhiger als im rechten Winkel zum Fenster.', 'Brücken, Küsten und Tunnelausfahrten lohnen sich besonders.'],
    achtung: 'Halte Abstand zur Bahnsteigkante und betritt nie Gleise. Filme Personal und Mitreisende nur mit Einverständnis. Für gewerbliche Aufnahmen brauchst du oft eine Genehmigung des Betreibers.',
  },
  {
    id: 'strand', titel: 'Strand', stil: 'Spotlight',
    ideen: [
      { titel: 'Von den Füßen bis zum Horizont', zweck: 'Kurz, sommerlich, gut in Schleife.', laenge: [8, 15], clips: [['Füße im Sand', 2], ['Welle von nah', 3], ['Handtuch von oben', 2], ['Sprung ins Wasser', 3], ['Sonne über dem Meer', 3]] },
      { titel: 'Goldene Stunde', zweck: 'Stimmung statt Handlung.', laenge: [15, 25], clips: [['Himmel, langsam nach unten schwenken', 3], ['Silhouette läuft am Wasser entlang', 5], ['Glitzern auf dem Wasser, nah', 3], ['Getränk in der Hand', 2], ['Die Sonne verschwindet', 5]] },
    ],
    tipps: ['Dreh früh oder kurz vor Sonnenuntergang, mittags ist das Licht hart.', 'Halte den Horizont gerade.', 'Zeitlupe passt gut zu Wellen und Sprüngen.', 'Schütze das Handy vor Sand und Salzwasser.'],
    achtung: 'Fremde sollten nicht erkennbar sein, Kinder nie.',
  },
  {
    id: 'stadt', titel: 'Städtetrip', stil: 'Drop',
    ideen: [
      { titel: 'Die Stadt in 15 Sekunden', zweck: 'Schnelle Schnitte, viel Energie.', laenge: [10, 20], clips: [['Skyline oder Wahrzeichen', 2], ['Straßenszene', 2], ['Tram oder Verkehr', 2], ['Kaffee in der Hand', 2], ['Markt oder Laden', 2], ['Detail wie Schild oder Fassade', 2], ['Dieselbe Stadt bei Nacht', 3]] },
      { titel: 'Mein Geheimtipp', zweck: 'Nützlich, wird gern gespeichert.', laenge: [20, 35], clips: [['Bester Blick, dazu der Titel als Text', 3], ['Der Weg dorthin', 5], ['Der Ort weit', 5], ['Details', 4], ['Essen oder Getränk dort', 4], ['Name und Adresse als Text', 4]] },
    ],
    tipps: ['Geh früh los, dann sind die Plätze noch leer.', 'Halte die Kamera auf Hüfthöhe, wenn du durch Gassen gehst.', 'Schneide auf den Takt der Musik, wenn du viele kurze Clips hast.', 'Filme denselben Ort bei Tag und bei Nacht.'],
    achtung: 'Bei Nahaufnahmen von Menschen vorher fragen.',
  },
  {
    id: 'natur', titel: 'Natur und Wandern', stil: 'Sanft',
    ideen: [
      { titel: 'Der Aufstieg zur Aussicht', zweck: 'Baut Spannung auf, die Aussicht ist der Lohn.', laenge: [12, 25], clips: [['Wanderschuhe binden', 2], ['Auf dem Weg, von hinten', 4], ['Detail wie Moos oder Stein', 2], ['Die letzten Schritte, die Aussicht öffnet sich', 5], ['Langsamer Schwenk übers Panorama', 5]] },
      { titel: 'Natur mit Originalton', zweck: 'Ruhepol im Feed, ganz ohne Musik.', laenge: [10, 20], clips: [['Wasser ganz nah', 4], ['Wind in den Bäumen', 4], ['Tier oder Detail', 3], ['Die weite Landschaft', 4]] },
    ],
    tipps: ['Stell das Handy für lange Einstellungen fest auf einen Stein oder ein Stativ.', 'Halte zum Größenvergleich eine Person im Bild.', 'Schwenk sehr langsam, in der Natur wirkt das am besten.', 'Nimm Ersatzakku oder Powerbank mit.'],
    achtung: 'Bleib auf den Wegen und halte Abstand zu Tieren. Drohnen sind vielerorts verboten, informiere dich vorher.',
  },
  {
    id: 'roadtrip', titel: 'Roadtrip', stil: 'Schwung',
    ideen: [
      { titel: 'Auf der Straße', zweck: 'Freiheit und Bewegung.', laenge: [15, 25], clips: [['Schlüssel oder Motorstart', 2], ['Straße durch die Frontscheibe', 3], ['Landschaft durchs Seitenfenster', 3], ['Stopp an einer Aussicht', 4], ['Snack auf dem Armaturenbrett', 2], ['Auto in der Kurve, von außen', 4], ['Sonnenuntergang über der Straße', 3]] },
      { titel: 'Zeitraffer der Route', zweck: 'Stunden in Sekunden.', laenge: [10, 20], clips: [['Karte oder Navi', 2], ['Zeitraffer durch die Frontscheibe', 10], ['Ankunft', 3]] },
    ],
    tipps: ['Befestige das Handy an einer stabilen Halterung.', 'Putz die Scheibe vor dem Filmen, innen und außen.', 'Halte für Außenaufnahmen an einer sicheren Stelle an und lass das Auto vorbeifahren.'],
    achtung: 'Wer fährt, bedient das Handy nie. Die Halterung darf die Sicht nicht verdecken.',
  },
  {
    id: 'event', titel: 'Events und Konzerte', stil: 'Blitz',
    ideen: [
      { titel: 'Die Highlights', zweck: 'Gibt die Energie des Abends wieder.', laenge: [15, 30], clips: [['Schild oder Eingang', 2], ['Stimmung vorher', 3], ['Die Menge', 3], ['Der Höhepunkt', 5], ['Detail wie Hände oder Licht', 2], ['Reaktionen', 3], ['Der Weg nach Hause', 3]] },
      { titel: 'Hinter den Kulissen', zweck: 'Zeigt, was sonst niemand sieht.', laenge: [20, 40], clips: [['Vorbereitung', 5], ['Die Menschen dahinter', 5], ['Details vom Aufbau', 4], ['Der große Moment', 6], ['Danach', 4]] },
    ],
    tipps: ['Reinige vorher die Linse.', 'Filme kurze Clips statt ganzer Songs, das hält auch das Handy kühl.', 'Bei wenig Licht lieber näher ran als digital zoomen.', 'Sichere nach dem Abend gleich die besten Clips.'],
    achtung: 'Prüfe die Regeln des Veranstalters. Eigene Konzertmitschnitte können Musikrechte berühren, und Menschen in der Menge sollten nicht im Mittelpunkt stehen.',
  },
];
