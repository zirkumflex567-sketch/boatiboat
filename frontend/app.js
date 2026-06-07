"use strict";

/* ======================================================================
   Boatiboat SBF Trainer – local-first single page app
   Alle Nutzerdaten (Fortschritt, Einstellungen) liegen im localStorage.

   Architektur:
   - store      → persistenter Lernfortschritt + Einstellungen
   - CATALOG    → Fragen-Array (aus API oder window.__CATALOG__)
   - session    → laufende Quiz-/Prüfungs-Session
   - renderXxx  → pure View-Funktionen (ersetzen #app-Inhalt vollständig)
   ====================================================================== */

// ----------- Selektoren / Konstanten ------------------------------------
const APP        = document.getElementById("app");
const TOAST      = document.getElementById("toast");
const TOPACTIONS = document.getElementById("topbarActions");

const STORE_KEY  = "boatiboat.progress.v2"; // v2: Settings hinzugefügt
const CACHE_KEY  = "boatiboat.catalog.v1";
const MASTER_BOX = 5;

const CAT_ORDER = [
  "Basisfragen",
  "Spezifische Fragen See",
  "Spezifische Fragen Binnen",
  "Spezifische Fragen Segeln",
  "Navigationsaufgaben",
  "Fachkundenachweis Seenotsignalmittel",
  "Binnenschifffahrtsfunk",
  "Mobiler Seefunkdienst und GMDSS",
  "Mobiler Seefunkdienst, Satelliten und GMDSS",
  "Funkeinrichtungen und Seefunkstellen",
  "Funkeinrichtungen und Schiffsfunkstellen",
  "Digitaler Selektivruf (DSC)",
  "UKW/VHF-Sprechfunk",
  "GW/KW-Sprechfunk und Funkwellenausbreitung",
  "Verkehrskreise",
  "Sprechfunk",
  "Betriebsverfahren",
  "Betriebsverfahren und Rangfolgen",
  "NAVTEX",
  "SAR, EPIRB und SART",
  "Inmarsat",
];

const LICENSE_LABELS = {
  all: "Alle",
  see: "See",
  binnen: "Binnen",
  fkn: "FKN",
  src: "SRC",
  lrc: "LRC",
  ubi: "UBI",
};
const SBF_SCOPES = new Set(["all", "see", "binnen"]);
const RADIO_EXAM_RULES = {
  src: { question_count: 24, required_total: 19, max_wrong: 5, sheet_label: "SRC Prüfungssimulation", time_limit_seconds: 30 * 60 },
  lrc: { question_count: 14, required_total: 11, max_wrong: 3, sheet_label: "LRC Ergänzungsbogen", time_limit_seconds: 20 * 60 },
  ubi: { question_count: 22, required_total: 17, max_wrong: 5, sheet_label: "UBI Prüfungssimulation", time_limit_seconds: 30 * 60 },
};
const FKN_EXAM_SHEETS = {
  1: [1, 5, 12, 14, 18, 21, 23, 29, 33, 37, 41, 47, 54, 56, 60],
  2: [2, 7, 11, 13, 20, 24, 26, 28, 31, 34, 38, 46, 51, 57, 59],
  3: [3, 6, 10, 15, 19, 22, 30, 32, 36, 39, 42, 44, 50, 52, 58],
  4: [4, 8, 9, 16, 17, 25, 27, 35, 40, 43, 45, 48, 49, 53, 55],
};
const EXAM_SCOPES = new Set(["all", "see", "binnen", "fkn", "src", "lrc", "ubi"]);

const OFFICIAL_EXAM_SHEETS = {
  see: {
    1: [8, 16, 17, 32, 47, 60, 63, 79, 88, 92, 106, 124, 132, 140, 147, 150, 158, 159, 171, 176, 182, 194, 202, 209, 216, 224, 235, 253, 265, 271],
    2: [7, 15, 27, 39, 48, 67, 71, 78, 89, 93, 100, 118, 122, 134, 139, 152, 157, 166, 167, 177, 181, 187, 197, 207, 214, 218, 232, 243, 252, 279],
    3: [6, 18, 31, 37, 40, 53, 61, 77, 90, 94, 101, 126, 136, 142, 146, 151, 155, 160, 174, 178, 182, 188, 195, 204, 210, 221, 230, 234, 272, 282],
    4: [5, 21, 32, 38, 54, 59, 68, 76, 91, 100, 105, 130, 153, 163, 165, 166, 168, 177, 178, 188, 198, 203, 214, 223, 246, 255, 270, 273, 278, 284],
    5: [4, 23, 31, 44, 58, 65, 72, 75, 92, 101, 113, 121, 128, 136, 141, 146, 148, 154, 164, 170, 171, 179, 183, 196, 204, 211, 216, 225, 237, 266],
    6: [3, 8, 24, 41, 49, 62, 70, 74, 93, 99, 111, 114, 115, 127, 135, 140, 155, 157, 169, 178, 191, 208, 215, 226, 236, 243, 248, 260, 277, 281],
    7: [2, 7, 25, 42, 45, 59, 69, 73, 80, 111, 115, 117, 125, 131, 134, 145, 157, 162, 172, 175, 184, 191, 202, 213, 216, 229, 235, 249, 261, 274],
    8: [1, 26, 35, 42, 55, 64, 70, 80, 82, 95, 107, 116, 129, 138, 142, 147, 154, 167, 173, 180, 190, 192, 201, 210, 222, 231, 241, 247, 254, 266],
    9: [3, 15, 27, 38, 43, 48, 50, 78, 81, 86, 90, 96, 106, 117, 119, 128, 144, 153, 160, 165, 189, 195, 205, 219, 220, 240, 242, 247, 257, 269],
    10: [14, 27, 28, 39, 51, 67, 71, 82, 88, 97, 109, 118, 123, 130, 132, 149, 156, 161, 166, 172, 187, 190, 197, 206, 225, 239, 244, 276, 278, 280],
    11: [9, 13, 30, 40, 50, 57, 64, 73, 83, 84, 85, 98, 112, 119, 120, 126, 127, 131, 139, 143, 150, 158, 163, 179, 185, 200, 207, 238, 268, 283],
    12: [2, 12, 29, 36, 44, 52, 72, 84, 87, 99, 108, 120, 133, 137, 149, 162, 165, 170, 176, 188, 192, 199, 205, 219, 232, 245, 250, 258, 262, 285],
    13: [11, 16, 22, 34, 46, 56, 65, 85, 102, 110, 125, 136, 137, 141, 145, 161, 168, 180, 193, 196, 206, 212, 217, 228, 233, 248, 251, 258, 267, 275],
    14: [10, 15, 20, 33, 46, 68, 72, 86, 103, 109, 122, 126, 129, 133, 148, 156, 168, 172, 186, 189, 201, 209, 215, 217, 241, 244, 251, 256, 259, 263],
    15: [1, 9, 19, 31, 45, 53, 66, 87, 98, 104, 123, 124, 125, 127, 135, 138, 151, 152, 164, 175, 181, 185, 203, 212, 227, 242, 245, 264, 271, 279],
  },
  binnen: {
    1: [8, 16, 17, 32, 47, 60, 63, 77, 84, 86, 88, 92, 99, 102, 115, 118, 129, 137, 139, 147, 162, 168, 183, 191, 207, 214, 222, 237, 244, 251],
    2: [7, 15, 27, 39, 48, 67, 71, 83, 87, 88, 90, 98, 101, 106, 111, 117, 121, 130, 146, 162, 176, 192, 206, 210, 221, 231, 236, 241, 248, 253],
    3: [6, 18, 31, 37, 40, 53, 61, 73, 86, 89, 101, 104, 106, 116, 122, 125, 130, 145, 160, 175, 177, 185, 190, 205, 220, 240, 242, 243, 249, 250],
    4: [5, 21, 32, 38, 54, 59, 68, 76, 82, 97, 103, 114, 117, 120, 127, 133, 136, 144, 159, 164, 174, 188, 204, 219, 225, 227, 228, 234, 238, 246],
    5: [4, 23, 31, 44, 58, 65, 72, 79, 84, 91, 99, 113, 119, 128, 132, 142, 155, 158, 169, 173, 188, 196, 203, 209, 212, 213, 222, 230, 233, 248],
    6: [3, 8, 24, 41, 49, 62, 70, 83, 98, 113, 127, 138, 143, 147, 151, 157, 163, 172, 177, 180, 187, 195, 197, 198, 202, 217, 219, 223, 232, 247],
    7: [2, 7, 25, 42, 45, 59, 69, 75, 82, 97, 111, 126, 134, 141, 156, 157, 158, 160, 166, 171, 182, 186, 194, 201, 204, 206, 216, 224, 231, 246],
    8: [1, 26, 35, 42, 55, 64, 70, 81, 96, 108, 110, 116, 125, 140, 149, 155, 165, 169, 170, 175, 179, 181, 185, 189, 193, 200, 203, 215, 226, 245],
    9: [3, 15, 27, 38, 43, 48, 50, 80, 85, 95, 109, 124, 139, 150, 154, 156, 167, 174, 176, 181, 184, 187, 190, 192, 196, 208, 213, 229, 236, 249],
    10: [14, 27, 28, 39, 51, 67, 71, 79, 94, 108, 123, 135, 138, 153, 159, 161, 168, 172, 173, 183, 189, 198, 199, 207, 211, 221, 228, 235, 243, 252],
    11: [9, 13, 30, 40, 50, 57, 64, 78, 93, 107, 122, 129, 137, 144, 152, 167, 171, 182, 197, 202, 205, 212, 217, 218, 220, 222, 227, 234, 242, 251],
    12: [2, 12, 29, 36, 44, 52, 72, 77, 92, 100, 105, 112, 121, 123, 124, 131, 136, 141, 143, 151, 166, 181, 199, 211, 216, 226, 232, 241, 245, 250],
    13: [11, 16, 22, 34, 46, 56, 65, 74, 91, 102, 105, 107, 114, 120, 128, 135, 150, 161, 165, 172, 180, 195, 200, 210, 218, 225, 233, 240, 247, 252],
    14: [10, 15, 20, 33, 46, 68, 72, 73, 75, 90, 94, 100, 104, 109, 126, 132, 134, 136, 141, 149, 164, 179, 194, 209, 215, 224, 229, 235, 237, 239],
    15: [1, 9, 19, 31, 45, 53, 66, 74, 76, 78, 81, 87, 89, 95, 103, 118, 125, 131, 133, 148, 163, 175, 178, 193, 201, 208, 223, 230, 238, 253],
  },
};

const THEORY_LIBRARY = {
  see: {
    title: "SBF See",
    intro: "Grundlagen für Küstengewässer, Seeschifffahrtsstraßen, Navigation und Seemannschaft.",
    chapters: [
      {
        title: "Recht und Verantwortung",
        sections: [
          {
            id: "see-recht-schiffsfuehrer",
            title: "Schiffsführer und Sorgfaltspflichten",
            text: "Vor Fahrtantritt muss feststehen, wer Schiffsführer ist. Diese Person trägt die Verantwortung für Besatzung, Fahrzeug, Ausrüstung und sichere Fahrt. Dazu gehören Wetterbeurteilung, Fahrtplanung, Ausguck, angepasste Geschwindigkeit und das rechtzeitige Ergreifen von Manövern zur Kollisionsvermeidung.",
            bullets: ["Schiffsführer vor Fahrtbeginn bestimmen", "Nur fahren, wenn körperlich und geistig geeignet", "Ausguck und sichere Geschwindigkeit jederzeit sicherstellen"],
          },
          {
            id: "see-recht-seeschifffahrt",
            title: "Seeschifffahrtsstraßen und Regeln",
            text: "Auf Seeschifffahrtsstraßen gelten besondere Verkehrsregeln. Kleinfahrzeuge müssen Berufsschifffahrt, Fahrwasser, Verkehrstrennungsgebiete und örtliche Bekanntmachungen besonders beachten. Die Grundidee bleibt: frühzeitig, eindeutig und seemännisch handeln.",
            bullets: ["Fahrwasser und Tonnenrichtung beachten", "Berufsschifffahrt nicht behindern", "Lokale Bekanntmachungen und Sperrgebiete prüfen"],
          },
        ],
      },
      {
        title: "Navigation",
        sections: [
          {
            id: "see-navigation-position",
            title: "Position, Kurs und Peilung",
            text: "Eine Position wird in Breite und Länge angegeben. Kurse und Peilungen müssen sauber zwischen rechtweisend, magnetisch und missweisend unterschieden werden. Auf der Karte wird präzise gearbeitet: kleine Ablesefehler können auf See große Abweichungen erzeugen.",
            bullets: ["Breite zuerst, Länge danach", "Missweisung und Ablenkung getrennt behandeln", "Peilungen mit Uhrzeit und Objekt notieren"],
          },
          {
            id: "see-navigation-tonnen",
            title: "Betonnung und Seezeichen",
            text: "Laterale Zeichen kennzeichnen die Seiten eines Fahrwassers, kardinale Zeichen warnen vor Gefahrenstellen und zeigen die sichere Seite. Farbe, Form, Toppzeichen und Feuerkennung gehören immer zusammen.",
            bullets: ["Rote und grüne Fahrwasserseiten nach Betonnungsrichtung lesen", "Kardinalzeichen nach Quadrant deuten", "Feuerkennungen nicht isoliert betrachten"],
          },
        ],
      },
      {
        title: "Seemannschaft und Wetter",
        sections: [
          {
            id: "see-seemannschaft-sicherheit",
            title: "Sicherheit an Bord",
            text: "Zur sicheren Fahrt gehören Rettungsmittel, passende Ausrüstung, Einweisung der Crew und eine realistische Einschätzung von Boot, Revier und Wetter. Gute Seemannschaft beginnt vor dem Ablegen.",
            bullets: ["Rettungsmittel griffbereit und passend", "Crew in Notrollen einweisen", "Wetterentwicklung fortlaufend beobachten"],
          },
        ],
      },
    ],
  },
  binnen: {
    title: "SBF Binnen",
    intro: "Grundlagen für Binnenschifffahrtsstraßen, Verkehrszeichen, Ausweichregeln und sichere Bootsführung.",
    chapters: [
      {
        title: "Verkehrsregeln Binnen",
        sections: [
          {
            id: "binnen-regeln-fahrwasser",
            title: "Fahrwasser, Berg- und Talfahrt",
            text: "Auf Binnenwasserstraßen ist die Orientierung an Bergfahrt und Talfahrt zentral. Viele Zeichen und Seitenbezeichnungen beziehen sich darauf, ob ein Fahrzeug zu Berg oder zu Tal fährt. Kleinfahrzeuge müssen die Berufsschifffahrt besonders berücksichtigen.",
            bullets: ["Bergfahrt und Talfahrt sicher unterscheiden", "Fahrwasserseiten aus Sicht der jeweiligen Richtung lesen", "Berufsschifffahrt nicht behindern"],
          },
          {
            id: "binnen-regeln-ausweichen",
            title: "Ausweich- und Begegnungsregeln",
            text: "Ausweichregeln dienen dazu, Manöver frühzeitig und eindeutig zu machen. Maschinenfahrzeuge, Segelfahrzeuge, Kleinfahrzeuge und Fahrzeuge im Fahrwasser können je nach Situation unterschiedliche Pflichten haben.",
            bullets: ["Früh und deutlich manövrieren", "Engstellen und unübersichtliche Bereiche defensiv befahren", "Nur eindeutige Signale und Manöver verwenden"],
          },
        ],
      },
      {
        title: "Zeichen und Signale",
        sections: [
          {
            id: "binnen-signale-schall",
            title: "Schallsignale",
            text: "Schallsignale machen Manöver, Warnungen und besondere Situationen hörbar. Ihre Bedeutung hängt von Tonlänge, Anzahl und Kontext ab. Ein langer Ton ist nicht dasselbe wie mehrere kurze Töne.",
            bullets: ["Kurze und lange Töne unterscheiden", "Signale früh genug geben", "Bei Unsicherheit Geschwindigkeit reduzieren"],
          },
          {
            id: "binnen-zeichen-sichtzeichen",
            title: "Sichtzeichen und Tonnen",
            text: "Sichtzeichen regeln Sperrungen, Fahrverbote, Gebote, Liegestellen und Gefahren. Tonnen und Schwimmstangen markieren Fahrwasser, Hindernisse oder besondere Bereiche.",
            bullets: ["Form, Farbe und Toppzeichen zusammen lesen", "Verbots- und Gebotszeichen sicher unterscheiden", "Abstände zu Gefahrgut- und Sonderfahrzeugen beachten"],
          },
        ],
      },
      {
        title: "Boot und Sicherheit",
        sections: [
          {
            id: "binnen-sicherheit-ausruestung",
            title: "Ausrüstung und Fahrtvorbereitung",
            text: "Auch auf Binnenrevieren beginnt Sicherheit vor dem Ablegen. Dazu gehören ausreichender Kraftstoff oder Akkustand, passende Rettungsmittel, funktionsfähige Lichter und ein klarer Plan für Wetter, Strecke und Schleusen.",
            bullets: ["Ausrüstung vor Fahrt prüfen", "Schleusen und Brücken in die Planung einbeziehen", "Fahrt an Sicht, Verkehr und Wetter anpassen"],
          },
        ],
      },
    ],
  },
};

const KNOTS = [
  {
    name: "Achtknoten",
    purpose: "Verhindert, dass eine Leine aus einer Öse oder einem Block ausrauscht.",
    steps: ["Bucht legen", "loses Ende einmal um die stehende Part führen", "Ende durch die Bucht stecken", "Knoten sauber dichtziehen"],
    check: "Der Knoten sieht wie eine Acht aus und lässt sich nach Belastung meist gut lösen.",
  },
  {
    name: "Kreuzknoten",
    purpose: "Verbindet zwei gleich starke Enden derselben Leine, nicht für kritische Lasten.",
    steps: ["rechtes Ende über linkes Ende legen", "einmal unterschlagen", "linkes Ende über rechtes Ende legen", "zweites Mal unterschlagen und dichtziehen"],
    check: "Beide kurzen Enden liegen auf derselben Seite. Liegen sie diagonal, ist es ein Altweiberknoten.",
  },
  {
    name: "Webeleinstek",
    purpose: "Befestigt eine Leine schnell an Poller, Pfahl oder Reling.",
    steps: ["Leine um den Gegenstand legen", "zweite Rundtörn kreuzen", "loses Ende unter der Kreuzung durchstecken", "beide Parten festziehen"],
    check: "Der Knoten hält unter Zug, kann ohne Zusatzsicherung bei wechselnder Last aber rutschen.",
  },
  {
    name: "Palstek",
    purpose: "Bildet ein festes Auge, das sich unter Last nicht zuzieht.",
    steps: ["kleines Auge in die stehende Part legen", "loses Ende von unten durch das Auge führen", "um die stehende Part herumlegen", "zurück durch das Auge führen und festziehen"],
    check: "Das Auge bleibt fest, die stehende Part wird vom losen Ende sauber umschlungen.",
  },
  {
    name: "Schotstek",
    purpose: "Verbindet zwei unterschiedlich starke Leinen oder eine Leine mit einer Bucht.",
    steps: ["Bucht mit der stärkeren Leine bilden", "dünnere Leine durch die Bucht führen", "um beide Parten der Bucht herumlegen", "unter sich selbst zurückstecken"],
    check: "Die beiden losen Enden liegen auf derselben Seite des Knotens.",
  },
  {
    name: "Stopperstek",
    purpose: "Legt eine dünnere Leine auf einer belasteten stärkeren Leine fest.",
    steps: ["Leine in Zugrichtung zweimal um die stärkere Leine legen", "eine weitere Windung entgegen der Zugrichtung legen", "Ende unter der letzten Windung durchstecken", "Knoten in Zugrichtung festschieben"],
    check: "Der Knoten blockiert in Zugrichtung und lässt sich entlastet verschieben.",
  },
  {
    name: "Belegen auf der Klampe",
    purpose: "Sichert eine Festmacherleine auf einer Klampe.",
    steps: ["Leine um den Fuß der Klampe führen", "Acht über beide Hörner legen", "letzte Kreuzung als Kopfschlag legen", "Leine flach und ohne lose Schlaufen festziehen"],
    check: "Die Leine liegt sauber in Achten; der Kopfschlag klemmt die letzte Lage.",
  },
  {
    name: "Rundtörn mit zwei halben Schlägen",
    purpose: "Befestigt eine Leine an Ring, Stange oder Poller.",
    steps: ["eine vollständige Rundtörn um den Gegenstand legen", "ersten halben Schlag um die stehende Part knüpfen", "zweiten halben Schlag in gleicher Richtung legen", "alles sauber dichtziehen"],
    check: "Die Rundtörn nimmt Last auf, die beiden halben Schläge sichern das Ende.",
  },
];

const PHONETIC_ALPHABET = [
  ["A", "Alfa"], ["B", "Bravo"], ["C", "Charlie"], ["D", "Delta"], ["E", "Echo"], ["F", "Foxtrot"],
  ["G", "Golf"], ["H", "Hotel"], ["I", "India"], ["J", "Juliett"], ["K", "Kilo"], ["L", "Lima"],
  ["M", "Mike"], ["N", "November"], ["O", "Oscar"], ["P", "Papa"], ["Q", "Quebec"], ["R", "Romeo"],
  ["S", "Sierra"], ["T", "Tango"], ["U", "Uniform"], ["V", "Victor"], ["W", "Whiskey"], ["X", "X-ray"],
  ["Y", "Yankee"], ["Z", "Zulu"],
  ["0", "Nadazero"], ["1", "Unaone"], ["2", "Bissotwo"], ["3", "Terrathree"], ["4", "Kartefour"],
  ["5", "Pantafive"], ["6", "Soxisix"], ["7", "Setteseven"], ["8", "Oktoeight"], ["9", "Novenine"],
];

const RADIO_PRACTICE = [
  {
    title: "Seenotmeldung",
    badge: "MAYDAY",
    purpose: "Unmittelbare Gefahr für Schiff oder Personen.",
    steps: [
      "MAYDAY dreimal",
      "THIS IS + Schiffsname/Rufzeichen",
      "Position",
      "Art des Notfalls",
      "Benötigte Hilfe",
      "Personenzahl und weitere wichtige Angaben",
      "OVER",
    ],
    example: "MAYDAY MAYDAY MAYDAY. This is BOATIBOAT, BOATIBOAT, DB1234. Position 54 degrees 10 minutes North, 010 degrees 20 minutes East. Fire on board. Require immediate assistance. Four persons on board. Over.",
  },
  {
    title: "Dringlichkeitsmeldung",
    badge: "PAN-PAN",
    purpose: "Dringende Lage ohne unmittelbare Seenot.",
    steps: [
      "PAN-PAN dreimal",
      "Adressat oder ALL STATIONS",
      "THIS IS + Schiffsname/Rufzeichen",
      "Lage und gewünschte Unterstützung",
      "OVER",
    ],
    example: "PAN-PAN PAN-PAN PAN-PAN. All stations, all stations, all stations. This is BOATIBOAT, DB1234. Engine failure near buoy 12, drifting slowly east. Request tow assistance. Over.",
  },
  {
    title: "Sicherheitsmeldung",
    badge: "SÉCURITÉ",
    purpose: "Wichtige Warnung für die Sicherheit der Schifffahrt.",
    steps: [
      "SÉCURITÉ dreimal",
      "Adressat oder ALL STATIONS",
      "THIS IS + Schiffsname/Rufzeichen",
      "Warninhalt knapp und eindeutig",
      "OUT oder OVER",
    ],
    example: "SÉCURITÉ SÉCURITÉ SÉCURITÉ. All stations. This is BOATIBOAT, DB1234. Large floating timber sighted north of fairway buoy 4. Out.",
  },
  {
    title: "Routine-Anruf",
    badge: "CALL",
    purpose: "Normale Kontaktaufnahme mit einer Funkstelle.",
    steps: [
      "Name der gerufenen Funkstelle",
      "THIS IS + eigener Schiffsname",
      "Rufzeichen oder MMSI, falls nötig",
      "Arbeitskanal oder Anliegen",
      "OVER",
    ],
    example: "Kiel Radio, Kiel Radio. This is BOATIBOAT, DB1234. Radio check on channel 16. Over.",
  },
];

const UBI_TRAFFIC_CIRCLES = [
  ["Nautische Information", "Meldungen mit Revierzentralen, Schleusen, Verkehrsposten und Behörden."],
  ["Schiff-Schiff", "Absprachen zwischen Fahrzeugen, z. B. Begegnung, Überholen oder Manöver."],
  ["Funkverkehr an Bord", "Kommunikation innerhalb eines Schiffsverbands oder an Bord."],
  ["Öffentlicher Nachrichtenaustausch", "Nachrichten über zugelassene Landfunkstellen, soweit verfügbar."],
];

const RADIO_VOCAB = [
  ["Mayday", "Seenot", "Unmittelbare Gefahr für Schiff oder Personen."],
  ["Pan-pan", "Dringlichkeit", "Dringende Lage, aber noch keine unmittelbare Seenot."],
  ["Sécurité", "Sicherheit", "Warnung oder wichtige Information für die Schifffahrt."],
  ["All stations", "Alle Funkstellen", "Anruf an alle mithörenden Funkstellen."],
  ["This is", "Hier ist", "Leitet den eigenen Stationsnamen ein."],
  ["Over", "Kommen", "Antwort wird erwartet."],
  ["Out", "Ende", "Funkverkehr ist beendet, keine Antwort erwartet."],
  ["Received", "Empfangen", "Nachricht wurde aufgenommen."],
  ["Say again", "Wiederholen Sie", "Aufforderung, eine Meldung erneut zu senden."],
  ["Stand by", "Warten Sie", "Bitte warten, Antwort folgt später."],
  ["Readability", "Verständlichkeit", "Bewertung, wie gut die Aussendung verstanden wurde."],
  ["Correction", "Berichtigung", "Korrigiert eine gerade gesendete Angabe."],
  ["Position", "Position", "Ort des Fahrzeugs, meist Breite und Länge."],
  ["Assistance", "Hilfeleistung", "Benötigte Unterstützung."],
  ["Persons on board", "Personen an Bord", "Wichtige Angabe in Notmeldungen."],
  ["Fire on board", "Feuer an Bord", "Typischer Notfallinhalt."],
  ["Taking water", "Wassereinbruch", "Schiff nimmt Wasser auf."],
  ["Adrift", "Treibend", "Nicht mehr kontrolliert manövrierfähig."],
];

const RADIO_DICTATION = [
  {
    title: "Seenotmeldung verstehen",
    prompt: "Mayday. This is Boatiboat. Fire on board. Four persons on board. Require immediate assistance.",
    expected: "Seenotmeldung: Feuer an Bord, vier Personen an Bord, sofortige Hilfe erforderlich.",
    keywords: ["feuer", "vier", "personen", "hilfe"],
  },
  {
    title: "Dringlichkeit übersetzen",
    prompt: "Pan-pan. Engine failure near buoy twelve. Drifting slowly east. Request tow assistance.",
    expected: "Dringlichkeitsmeldung: Maschinenausfall nahe Tonne 12, treibt langsam nach Osten, Schlepphilfe erbeten.",
    keywords: ["maschine", "tonne", "treibt", "schlepp"],
  },
  {
    title: "Sicherheitswarnung erfassen",
    prompt: "Sécurité. Large floating timber sighted north of fairway buoy four.",
    expected: "Sicherheitsmeldung: Großes treibendes Holz nördlich der Fahrwassertonne 4 gesichtet.",
    keywords: ["holz", "nördlich", "fahrwasser", "tonne"],
  },
];

const FKN_PRACTICE = [
  {
    title: "Vor dem Umgang prüfen",
    purpose: "Sicherstellen, dass Seenotsignalmittel nicht erst im Notfall verstanden werden.",
    checks: [
      "Gebrauchsanweisung vollständig gelesen",
      "Verbrauchsdauer und Zustand geprüft",
      "trocken, kühl und zugänglich gelagert",
      "Lee-Seite und Gefahrenbereich bedacht",
    ],
    examNote: "In der Prüfung wird erwartet, dass du Sicherheitsmaßnahmen begründen kannst.",
  },
  {
    title: "Handfackel sicher erklären",
    purpose: "Rote Handfackeln dienen der Positionsmarkierung, wenn Hilfe bereits in Sichtweite ist.",
    checks: [
      "nur im Notfall verwenden",
      "nach Lee und außenbords halten",
      "Abbrand von Körper, Augen und Boot fernhalten",
      "Gebrauchsanweisung des konkreten Mittels beachten",
    ],
    examNote: "Wichtig ist nicht Aktionismus, sondern kontrollierte und sichere Handhabung.",
  },
  {
    title: "Rauchsignal einordnen",
    purpose: "Rauchsignale sind vor allem tagsüber zur Positionskennzeichnung geeignet.",
    checks: [
      "nur am Tag sinnvoll einsetzen",
      "möglichst erst bei gesichteter Hilfe verwenden",
      "Windrichtung beachten",
      "nach Zündung zur Leeseite außenbords geben",
    ],
    examNote: "Rauch zeigt Position, ersetzt aber keine Alarmierung.",
  },
  {
    title: "Recht & Verlustmeldung",
    purpose: "FKN umfasst auch waffen- und sprengstoffrechtliche Grundkenntnisse.",
    checks: [
      "Signalpistole Kaliber 4 unterliegt dem Waffengesetz",
      "andere pyrotechnische Seenotsignale unterliegen dem Sprengstoffgesetz",
      "Verlust von Signalmitteln oder Waffen unverzüglich anzeigen",
      "Überlassen nur an berechtigte Personen",
    ],
    examNote: "Bei Rechtsfragen zählt präzise Sprache mehr als lange Erklärungen.",
  },
];

// ----------- State ------------------------------------------------------
let CATALOG = [];   // alle Fragen aus der API
let MC      = [];   // Nur MC-Fragen (kein card_type navigation)
let NAV     = [];   // Navigations-Lernkarten
let session = null; // aktive Quiz-Session
let timerId = null;

// ========================================================================
// STORE – persistenter Lernfortschritt + Einstellungen
// ========================================================================
function defaultStore() {
  return {
    v: 2,
    scope: "all",     // "all" | "see" | "binnen" | "fkn" | "src" | "lrc" | "ubi"
    byId:  {},         // Lernfortschritt je external_id
    streak: 0,
    best:   0,
    // --- Einstellungen ---
    settings: {
      theme:          "system",   // "light" | "dark" | "system"
      colorblind:     false,      // kräftigere Rot/Grün-Töne
      confirmAnswer:  false,      // Antwort vor Auswertung bestätigen
      showResultLate: true,       // Prüfungs-Ergebnis erst am Schluss
      highlightKeys:  true,       // Schlüsselwörter hervorheben
      autoHint:       "wrong",    // "always" | "wrong" | "never"
      dailyGoal:      20,         // Tagesziel beantwortete Fragen
    },
    today: { date: "", count: 0 },
    dailyStreak: { lastDate: "", current: 0, best: 0 },
    bookmarks: [],    // external_ids der gemerkten Fragen
  };
}

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && raw.byId) {
      const s = defaultStore();
      Object.assign(s, raw);
      s.settings = Object.assign(defaultStore().settings, raw.settings || {});
      return s;
    }
  } catch (e) { /* ignore */ }
  return defaultStore();
}

let store = loadStore();

function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* quota */ }
}

// Shortcut zu den Einstellungen
const cfg = () => store.settings;

// ----------- Lernfortschritt --------------------------------------------
function stat(id) {
  return store.byId[id] || { box: 1, c: 0, w: 0, seen: 0, last: 0, lastCorrect: null };
}

function recordAnswer(id, correct) {
  const st = stat(id);
  st.seen += 1;
  st.last  = Date.now();
  st.lastCorrect = correct;
  if (correct) {
    st.c += 1;
    st.box   = Math.min(MASTER_BOX, st.box + 1);
    store.streak += 1;
  } else {
    st.w += 1;
    st.box   = 1;
    store.streak = 0;
  }
  store.best      = Math.max(store.best, store.streak);
  store.byId[id]  = st;
  bumpToday();
  saveStore();
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayProgress() {
  const key = todayKey();
  if (!store.today || store.today.date !== key) {
    store.today = { date: key, count: 0 };
  }
  return store.today;
}

function bumpToday() {
  const today = todayProgress();
  const goal = Number(cfg().dailyGoal || 0);
  const wasOpen = goal > 0 && today.count < goal;
  today.count += 1;
  if (wasOpen && today.count >= goal) completeDailyGoal(today.date);
}

function dateDaysApart(a, b) {
  const start = new Date(`${a}T00:00:00`);
  const end = new Date(`${b}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end - start) / 86400000);
}

function completeDailyGoal(dateKey) {
  store.dailyStreak = store.dailyStreak || { lastDate: "", current: 0, best: 0 };
  const ds = store.dailyStreak;
  if (ds.lastDate === dateKey) return;
  ds.current = dateDaysApart(ds.lastDate, dateKey) === 1 ? ds.current + 1 : 1;
  ds.best = Math.max(ds.best || 0, ds.current);
  ds.lastDate = dateKey;
  toast(`Tagesziel erreicht · ${ds.current} Tage in Folge`);
}

function dailyStreakStatus(today) {
  const ds = store.dailyStreak || { lastDate: "", current: 0, best: 0 };
  const goalDoneToday = ds.lastDate === today.date;
  const active = goalDoneToday || dateDaysApart(ds.lastDate, today.date) === 1;
  return {
    current: active ? ds.current || 0 : 0,
    best: ds.best || 0,
    doneToday: goalDoneToday,
  };
}

// ========================================================================
// THEME ENGINE
// ========================================================================
function applyTheme() {
  const t = cfg().theme;
  const root = document.documentElement;
  if (t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
  root.classList.toggle("colorblind", cfg().colorblind);
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme();

// ========================================================================
// HELPER UTILITIES
// ========================================================================
function $(sel, root = document) { return root.querySelector(sel); }

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class")   n.className  = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    n.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return n;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toast(msg, durationMs = 2400) {
  TOAST.textContent = msg;
  TOAST.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => TOAST.classList.remove("show"), durationMs);
}

function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Umschließt Schlüsselwörter in einem Text mit <mark>-Tags.
 * Deaktiviert wenn cfg().highlightKeys === false.
 */
const KEYWORDS = /\b(nicht|kein|keine|keiner|niemals|immer|stets|muss|darf|verboten|recht(?:s|en)?|link(?:s|en)?|steuerbord|backbord|mindestens|höchstens|ausschließlich|sofort|unverzüglich|zuerst|vor|nach|erst dann|beide|alle|nur)\b/gi;

function highlightText(text) {
  if (!text) return "";
  if (!cfg().highlightKeys) return esc(text);
  return esc(text).replace(KEYWORDS, (m) => `<mark>${m}</mark>`);
}

// ========================================================================
// CATALOG LOADING
// ========================================================================
async function loadCatalog() {
  // 1) Offline-Bundle (Android-APK / benutzerdefiniertes Deployment)
  if (window.__CATALOG__?.length) {
    setCatalog(window.__CATALOG__);
    return;
  }
  // 2) localStorage-Cache → sofort rendern, im Hintergrund auffrischen
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached?.q?.length) {
      setCatalog(cached.q);
      refreshCatalog(); // fire-and-forget
      return;
    }
  } catch (e) { /* ignore */ }
  // 3) Erstbesuch → warten bis Daten geladen
  await refreshCatalog();
}

async function refreshCatalog() {
  try {
    const res = await fetch("api/questions");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      const changed = data.length !== CATALOG.length;
      setCatalog(data);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ q: data, t: Date.now() })); } catch (e) { /* quota */ }
      if (changed && !session) renderHome();
    }
  } catch (e) {
    if (!CATALOG.length) {
      APP.innerHTML = "";
      APP.appendChild(
        el("div", { class: "qcard" },
          el("h2", {}, "Fragen konnten nicht geladen werden"),
          el("p",  { class: "qhint" }, "Bitte Internetverbindung prüfen und Seite neu laden."),
        )
      );
    }
  }
}

function setCatalog(data) {
  CATALOG = data;
  MC  = data.filter((q) => q.card_type !== "navigation");
  NAV = data.filter((q) => q.card_type === "navigation");
}

// ========================================================================
// SCOPE / FILTER
// ========================================================================
function scopedMC() {
  return store.scope === "all"
    ? MC
    : MC.filter((q) => q.license_type === store.scope);
}

function scopedNAV() {
  return store.scope === "see" || store.scope === "all" ? NAV : [];
}

// ========================================================================
// SPACED REPETITION
// ========================================================================
function weight(q) {
  const st = store.byId[q.external_id];
  if (!st || st.seen === 0) return 12;
  const base = { 1: 8, 2: 5, 3: 3, 4: 2, 5: 0.6 }[st.box] ?? 3;
  return st.lastCorrect === false ? base * 1.7 : base;
}

function weightedOrder(pool) {
  return pool
    .map((q) => [Math.pow(Math.random(), 1 / Math.max(weight(q), 0.01)), q])
    .sort((a, b) => b[0] - a[0])
    .map(([, q]) => q);
}

// ========================================================================
// MASTERY STATS
// ========================================================================
function masteryFor(pool) {
  let seen = 0, mastered = 0, correct = 0, answered = 0;
  for (const q of pool) {
    const st = store.byId[q.external_id];
    if (st?.seen) {
      seen++;
      correct  += st.c;
      answered += st.c + st.w;
      if (st.box >= MASTER_BOX) mastered++;
    }
  }
  return { total: pool.length, seen, mastered, correct, answered };
}

function categoryStats(pool) {
  const cats = {};
  for (const q of pool) {
    const c = q.category || "Sonstige";
    cats[c] = cats[c] || { total: 0, seen: 0, mastered: 0, correct: 0, answered: 0 };
    cats[c].total++;
    const s = store.byId[q.external_id];
    if (s?.seen) {
      cats[c].seen++;
      cats[c].correct += s.c;
      cats[c].answered += s.c + s.w;
      if (s.box >= MASTER_BOX) cats[c].mastered++;
    }
  }
  return cats;
}

function readinessFor(pool) {
  const m = masteryFor(pool);
  if (!m.total) return { score: 0, level: "Noch keine Daten", weakest: [], detail: "Starte eine Lernrunde, damit Boatiboat deine Prüfungslage einschätzen kann." };

  const seenPct = m.seen / m.total;
  const masteredPct = m.mastered / m.total;
  const accuracy = m.answered ? m.correct / m.answered : 0;
  const cats = categoryStats(pool);
  const catRows = Object.entries(cats).map(([name, s]) => {
    const seen = s.total ? s.seen / s.total : 0;
    const mastered = s.total ? s.mastered / s.total : 0;
    const acc = s.answered ? s.correct / s.answered : 0;
    const score = Math.round((mastered * 0.55 + acc * 0.30 + seen * 0.15) * 100);
    return { name, score, seen: s.seen, total: s.total };
  }).sort((a, b) => a.score - b.score);
  const categoryFloor = catRows.length ? Math.min(...catRows.map((r) => r.score)) / 100 : 0;
  const score = Math.round((masteredPct * 0.45 + accuracy * 0.30 + seenPct * 0.15 + categoryFloor * 0.10) * 100);
  const level = score >= 88 ? "Prüfungsnah" : score >= 70 ? "Solide Basis" : score >= 45 ? "Im Aufbau" : "Frühphase";
  const weakest = catRows.slice(0, 3);
  const detail = score >= 88
    ? "Du bist nah an prüfungsreifer Stabilität. Halte jetzt Tempo und wiederhole gezielt Schwächen."
    : "Der Score gewichtet gemeisterte Fragen, Trefferquote, Katalogabdeckung und schwächste Themen.";
  return { score, level, weakest, detail };
}

// ========================================================================
// SESSION ENGINE
// ========================================================================
function makeLearnItem(q) {
  if (q.card_type === "navigation") return { q, nav: true };
  if (q.card_type === "flashcard" || !q.choices?.length) return { q, flashcard: true, revealed: false, picked: null, correct: null };
  const order       = shuffle(q.choices.map((_, i) => i));
  const correctIdx  = order.indexOf(q.correct_index);
  return { q, order, correctIdx, picked: null, correct: null, confirmed: false };
}

function makeExamItem(q) {
  if (q.card_type === "navigation") return { q, nav: true };
  if (q.card_type === "flashcard" || !q.choices?.length) return { q, flashcard: true, revealed: false, picked: null, correct: null };
  // /api/session liefert bereits gemischte choices + rebasierten correct_index
  return { q, order: q.choices.map((_, i) => i), correctIdx: q.correct_index, picked: null, correct: null, confirmed: false };
}

// ---------- Lern-Modus --------------------------------------------------
function startLearn(kind) {
  const pool = scopedMC();
  if (!pool.length) { toast("Keine Fragen im gewählten Bereich"); return; }

  let chosen;
  if (kind === "all") {
    chosen = weightedOrder(pool);
  } else if (kind === "wrong") {
    const wrong = pool.filter((q) => { const s = store.byId[q.external_id]; return s?.seen && s.box <= 2; });
    if (!wrong.length) { toast("Keine schwierigen Fragen – stark 💪"); return; }
    chosen = weightedOrder(wrong);
  } else if (kind === "bookmarks") {
    const bm = new Set(store.bookmarks);
    const bmPool = pool.filter((q) => bm.has(q.external_id));
    if (!bmPool.length) { toast("Keine gemerkten Fragen"); return; }
    chosen = weightedOrder(bmPool);
  } else if (typeof kind === "string" && kind.startsWith("cat:")) {
    const cat = kind.slice(4);
    const catPool = pool.filter((q) => q.category === cat);
    if (!catPool.length) { toast("Keine Fragen in dieser Kategorie"); return; }
    chosen = weightedOrder(catPool);
  } else {
    const n = Math.min(typeof kind === "number" ? kind : 20, pool.length);
    chosen = weightedOrder(pool).slice(0, n);
  }

  session = { mode: "learn", items: chosen.map(makeLearnItem), idx: 0, deadline: null, rules: null };
  renderQuiz();
}

// ---------- Navigation --------------------------------------------------
function startNav() {
  const pool = scopedNAV();
  if (!pool.length) { toast("Navigationsaufgaben gibt es nur für den Schein See"); return; }
  session = { mode: "nav", items: shuffle(pool).map((q) => ({ q, nav: true })), idx: 0, deadline: null, rules: null };
  renderQuiz();
}

// ---------- Prüfungs-Modus (mit Server-Fallback) -------------------------
async function startExam(sheetId = null) {
  const lic = ["binnen", "fkn", "src", "lrc", "ubi"].includes(store.scope) ? store.scope : "see";
  if (!EXAM_SCOPES.has(store.scope)) {
    toast("Prüfungsmodus kommt für diesen Schein als nächster Schritt");
    return;
  }
  if (!window.__CATALOG__) {
    try {
      const url = `api/session?mode=exam&license_type=${lic}` + (sheetId ? `&sheet_id=${encodeURIComponent(sheetId)}` : "");
      const res  = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      session = {
        mode:    "exam",
        items:   data.questions.map(makeExamItem),
        idx:     0,
        rules:   data.passing_rules ?? {},
        deadline: data.time_limit_seconds ? Date.now() + data.time_limit_seconds * 1000 : null,
      };
      renderQuiz();
      return;
    } catch (e) { /* Offline-Fallback */ }
  }
  startExamLocal(lic, sheetId);
}

function seededShuffle(arr, seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function examSheetLabel(lic, sheetId) {
  if (!sheetId) return null;
  const n = sheetId.split("-")[1];
  return `${lic === "see" ? "SBF See" : "SBF Binnen"} Bogen ${n}`;
}

function questionNumber(q) {
  const m = String(q.external_id || "").match(/-(\d{3})$/);
  return m ? Number(m[1]) : null;
}

function officialSheetItems(lic, sheetId) {
  if (!sheetId) return null;
  const sheetNumber = Number(sheetId.split("-")[1]);
  const numbers = OFFICIAL_EXAM_SHEETS[lic]?.[sheetNumber];
  if (!numbers) return null;
  const byNumber = new Map(MC.filter((q) => q.license_type === lic).map((q) => [questionNumber(q), q]));
  const items = numbers.map((n) => byNumber.get(n)).filter(Boolean);
  if (items.length !== numbers.length) return null;
  if (lic === "see") {
    const nav = NAV.find((q) => q.external_id === `SEE-NAV-${String(sheetNumber).padStart(2, "0")}`);
    if (!nav) return null;
    return [nav].concat(items);
  }
  return items;
}

function startExamLocal(lic, sheetId = null) {
  if (lic === "fkn") {
    const sheetNumber = 1 + Math.floor(Math.random() * 4);
    const byNumber = new Map(MC.filter((q) => q.license_type === "fkn").map((q) => [questionNumber(q), q]));
    const items = FKN_EXAM_SHEETS[sheetNumber].map((n) => byNumber.get(n)).filter(Boolean);
    if (items.length !== 15) { toast("FKN-Prüfung offline unvollständig"); return; }
    session = {
      mode: "exam",
      items: items.map(makeLearnItem),
      idx: 0,
      rules: {
        question_count: 15,
        required_total: 12,
        point_total: 30,
        point_required: 24,
        points_per_full_answer: 2,
        sheet_id: `fkn-${String(sheetNumber).padStart(3, "0")}`,
        sheet_label: `FKN Fragebogen ${String(sheetNumber).padStart(3, "0")}`,
        official_distribution: true,
      },
      deadline: Date.now() + 30 * 60 * 1000,
    };
    renderQuiz();
    return;
  }

  if (RADIO_EXAM_RULES[lic]) {
    const rule = RADIO_EXAM_RULES[lic];
    const pool = MC.filter((q) => q.license_type === lic);
    if (pool.length < rule.question_count) { toast("Prüfung offline unvollständig"); return; }
    const items = shuffle(pool).slice(0, rule.question_count);
    session = {
      mode: "exam",
      items: items.map(makeLearnItem),
      idx: 0,
      rules: { ...rule, simulated_distribution: true },
      deadline: Date.now() + rule.time_limit_seconds * 1000,
    };
    renderQuiz();
    return;
  }

  const byCat = (c) => MC.filter((q) => q.license_type === lic && q.category === c);
  if (sheetId) {
    const official = officialSheetItems(lic, sheetId);
    if (!official) { toast("Amtlicher Bogen ist offline unvollständig"); return; }
    const rules = lic === "see"
      ? { question_count: 30, required_total: 24, required_basis: 5, required_specific: 18, navigation_required: 7, sheet_id: sheetId, sheet_label: examSheetLabel(lic, sheetId), official_distribution: true }
      : { question_count: 30, required_total: 24, required_basis: 5, required_specific: 18, sheet_id: sheetId, sheet_label: examSheetLabel(lic, sheetId), official_distribution: true };
    const secs = lic === "see" ? 60 * 60 : 45 * 60;
    session = { mode: "exam", items: official.map(makeLearnItem), idx: 0, rules, deadline: Date.now() + secs * 1000 };
    renderQuiz();
    return;
  }
  let items, rules, secs;
  if (lic === "binnen") {
    items = shuffle(byCat("Basisfragen")).slice(0, 7)
      .concat(shuffle(byCat("Spezifische Fragen Binnen")).slice(0, 23));
    rules = { question_count: 30, required_total: 24, required_basis: 5, required_specific: 18 };
    secs  = 45 * 60;
  } else {
    const nav = NAV.filter((q) => q.license_type === "see");
    items = shuffle(byCat("Basisfragen")).slice(0, 7)
      .concat(shuffle(byCat("Spezifische Fragen See")).slice(0, 23));
    if (nav.length) items = shuffle(nav).slice(0, 1).concat(items);
    rules = { question_count: 30, required_total: 24, required_basis: 5, required_specific: 18, navigation_required: 7 };
    secs  = 60 * 60;
  }
  session = { mode: "exam", items: items.map(makeLearnItem), idx: 0, rules, deadline: Date.now() + secs * 1000 };
  renderQuiz();
}

// ========================================================================
// BOOKMARKS
// ========================================================================
function isBookmarked(id) { return store.bookmarks.includes(id); }

function toggleBookmark(id) {
  const i = store.bookmarks.indexOf(id);
  if (i >= 0) store.bookmarks.splice(i, 1);
  else store.bookmarks.push(id);
  saveStore();
  return i < 0; // true = now bookmarked
}

// ========================================================================
// HOME / DASHBOARD
// ========================================================================
function ring(percent, sub) {
  const r = 56, circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);
  return el("div", {
    html: `<svg class="ring" viewBox="0 0 132 132" role="img" aria-label="${percent}% gemeistert">
      <circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--line)" stroke-width="12"/>
      <circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--sea)" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
        transform="rotate(-90 66 66)"/>
      <text x="66" y="62" text-anchor="middle" font-size="26" font-weight="700" fill="var(--ink)">${percent}%</text>
      <text x="66" y="84" text-anchor="middle" font-size="11" fill="var(--muted)">${sub}</text>
    </svg>`,
  });
}

function scopeSegmented() {
  const seg = el("div", { class: "segmented", role: "group", "aria-label": "Schein wählen" });
  [
    ["all", LICENSE_LABELS.all],
    ["see", LICENSE_LABELS.see],
    ["binnen", LICENSE_LABELS.binnen],
    ["fkn", LICENSE_LABELS.fkn],
    ["src", LICENSE_LABELS.src],
    ["lrc", LICENSE_LABELS.lrc],
    ["ubi", LICENSE_LABELS.ubi],
  ].forEach(([val, lbl]) => {
    seg.appendChild(el("button", {
      "aria-pressed": String(store.scope === val),
      onclick: () => { store.scope = val; saveStore(); renderHome(); },
    }, lbl));
  });
  return seg;
}

function tile(val, lbl, sub) {
  return el("div", { class: "tile" },
    el("div", { class: "val", html: String(val) }),
    el("div", { class: "lbl" }, lbl),
    sub ? el("div", { class: "lbl", style: "color:var(--muted);font-size:.78rem" }, sub) : null,
  );
}

function modecard(ic, t, d, onclick, extra = "") {
  return el("button", { class: `modecard ${extra}`, onclick },
    el("div", { class: "ic" }, ic),
    el("div", { class: "t"  }, t),
    el("div", { class: "d"  }, d),
  );
}

function renderHome() {
  session = null;
  stopTimer();
  TOPACTIONS.innerHTML = "";
  TOPACTIONS.appendChild(el("button", { class: "btn-icon", title: "Einstellungen", onclick: renderSettings, "aria-label": "Einstellungen" }, "⚙️"));

  const pool  = scopedMC();
  const m     = masteryFor(pool);
  const ready = readinessFor(pool);
  const today = todayProgress();
  const daySeries = dailyStreakStatus(today);
  const goalPct = cfg().dailyGoal ? Math.min(100, Math.round((today.count / cfg().dailyGoal) * 100)) : 0;
  const navPool = scopedNAV();
  const masterPct = m.total ? Math.round((m.mastered / m.total) * 100) : 0;
  const acc       = m.answered ? Math.round((m.correct / m.answered) * 100) : 0;

  const view = el("div", { class: "view" });

  // Hero
  view.appendChild(
    el("section", { class: "hero" },
      el("p",  { class: "eyebrow" }, "Sportbootführerschein · Funk · Pyro"),
      el("h1", {}, "Verstehen statt nur ankreuzen."),
      el("p",  {}, "Lerne mit den amtlichen ELWIS-Fragen, im eigenen Tempo. Falsch beantwortete Fragen kommen automatisch häufiger – dein Fortschritt bleibt auf diesem Gerät gespeichert."),
    )
  );

  view.appendChild(el("div", { style: "margin:4px 0 18px" }, scopeSegmented()));

  // Fortschritts-Karte
  view.appendChild(
    el("section", { class: "overview" },
      ring(masterPct, "gemeistert"),
      el("div", { class: "meta" },
        el("h3", {}, m.seen ? `${m.mastered} von ${m.total} Fragen gemeistert` : "Bereit, loszulegen?"),
        el("p",  {}, m.seen
          ? `${m.seen} Fragen geübt · Trefferquote ${acc}%`
          : "Starte eine Lernrunde – dein Fortschritt wird automatisch gespeichert."),
      ),
    )
  );

  // Stat-Tiles
  view.appendChild(
    el("div", { class: "tiles" },
      tile(m.seen,              "Fragen geübt"),
      tile(acc + "%",           "Trefferquote"),
      tile(m.mastered,          "Gemeistert"),
      tile("🔥 " + store.streak,"Serie", `Bestwert ${store.best}`),
    )
  );

  view.appendChild(
    el("section", { class: "readiness-card" },
      el("div", { class: "readiness-main" },
        el("div", { class: "readiness-score" }, `${ready.score}%`),
        el("div", {},
          el("p", { class: "section-label" }, "Prüfungs-Readiness"),
          el("h3", {}, ready.level),
          el("p", {}, ready.detail),
        ),
      ),
      ready.weakest.length
        ? el("div", { class: "readiness-weak" },
            el("strong", {}, "Nächste Themen"),
            ...ready.weakest.map((w) => el("span", {}, `${w.name}: ${w.score}%`)),
          )
        : null,
    )
  );

  view.appendChild(
    el("section", { class: "daily-card" },
      el("div", {},
        el("strong", {}, `Tagesziel: ${today.count}/${cfg().dailyGoal || 0} Fragen`),
        el("p", {}, daySeries.doneToday ? "Ziel erreicht. Die Tages-Serie bleibt aktiv." : "Kurze Runde starten und den Balken füllen."),
      ),
      el("div", { class: "daily-side" },
        el("div", { class: "daily-streak" },
          el("strong", {}, `🔥 ${daySeries.current}`),
          el("span", {}, `Tage in Folge · Bestwert ${daySeries.best}`),
        ),
        el("div", { class: "bar daily-bar" }, el("i", { style: `width:${goalPct}%` })),
      ),
    )
  );

  // Trainings-Modi
  view.appendChild(el("p", { class: "section-label" }, "Training starten"));
  const grid = el("div", { class: "modegrid" });
  grid.appendChild(modecard("📚", "Weiterlernen",       "Clevere Auswahl: neue & schwierige Fragen zuerst.", () => startLearn(20), "feature"));
  grid.appendChild(modecard("🗂️", "Alle Fragen",        `Kompletter Durchlauf (${pool.length} Fragen).`,    () => startLearn("all")));
  grid.appendChild(modecard("🎯", "Nur Schwächen",       "Wiederhole gezielt deine Fehler.",                 () => startLearn("wrong")));
  if (EXAM_SCOPES.has(store.scope)) {
    grid.appendChild(modecard("⏱️", "Prüfung simulieren",  SBF_SCOPES.has(store.scope) ? "Amtlicher Bogen mit Zeitlimit." : "Zufallsbogen mit Zeitlimit.", () => startExam()));
  }
  if (SBF_SCOPES.has(store.scope)) {
    grid.appendChild(modecard("📋", "Feste Prüfungsbögen", "15 reproduzierbare Bögen in amtlicher Form.",       renderExamSheets));
    grid.appendChild(modecard("📖", "Lehrbuch",            "Theorie kapitelweise lesen und durchsuchen.",       renderTheoryLibrary));
    grid.appendChild(modecard("🪢", "Knoten",              "Prüfungsknoten mit Schritten und Einsatz.",         renderKnots));
  }
  grid.appendChild(modecard("🧾", "Weg zur Prüfung", "Anmeldung, Unterlagen und Ablauf auf einen Blick.", renderExamGuide));
  grid.appendChild(modecard("❓", "FAQ & Vertrauen", "Quellen, Datenschutz und nächste Schritte kompakt.", renderSupportCenter));
  if (store.scope === "all" || ["src", "lrc", "ubi"].includes(store.scope)) {
    grid.appendChild(modecard("📻", "Funkpraxis", "Buchstabieren, Anrufschema und Notmeldung trainieren.", renderRadioPractice));
  }
  if (store.scope === "all" || store.scope === "fkn") {
    grid.appendChild(modecard("🧯", "FKN-Praxis", "Handhabung, Sicherheit und Rechtsfragen als Selbstcheck.", renderFknPractice));
  }
  if (store.bookmarks.length)
    grid.appendChild(modecard("🔖", "Gemerkte Fragen",   `${store.bookmarks.length} Lesezeichen`,            () => startLearn("bookmarks")));
  if (navPool.length)
    grid.appendChild(modecard("🧭", "Navigationsaufgaben", `${navPool.length} amtliche Kartenaufgaben.`,      startNav));
  view.appendChild(grid);

  // Schnell-Chips
  view.appendChild(el("p", { class: "section-label" }, "Schnelle Lernrunde"));
  const chips = el("div", { class: "chips" });
  [10, 25, 50].forEach((n) => chips.appendChild(
    el("button", { class: "chip", onclick: () => startLearn(n) }, `${n} Fragen`)
  ));
  view.appendChild(chips);

  // Kategorien lernen
  if (pool.length) {
    view.appendChild(el("p", { class: "section-label" }, "Nach Thema lernen"));
    const catChips = el("div", { class: "chips" });
    const cats = [...new Set(pool.map((q) => q.category))].sort(
      (a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b)
    );
    cats.forEach((c) => {
      const cPool = pool.filter((q) => q.category === c);
      const cm = masteryFor(cPool);
      const cpct = cm.total ? Math.round((cm.mastered / cm.total) * 100) : 0;
      catChips.appendChild(
        el("button", { class: "chip chip-cat", onclick: () => startLearn(`cat:${c}`) },
          el("span", {}, c),
          el("span", { class: "chip-pct" }, `${cpct}%`),
        )
      );
    });
    view.appendChild(catChips);
  }

  // Themen-Fortschritt
  if (m.seen) {
    view.appendChild(el("p", { class: "section-label" }, "Fortschritt nach Themen"));
    const cats = {};
    for (const q of pool) {
      const c = q.category;
      cats[c] = cats[c] || { total: 0, mastered: 0 };
      cats[c].total++;
      const s = store.byId[q.external_id];
      if (s?.box >= MASTER_BOX) cats[c].mastered++;
    }
    const list = el("div", { class: "catlist" });
    Object.keys(cats)
      .sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b))
      .forEach((c) => {
        const { total, mastered } = cats[c];
        const pct = total ? Math.round((mastered / total) * 100) : 0;
        list.appendChild(
          el("div", { class: "catrow" },
            el("div", { class: "top" },
              el("span", {}, c),
              el("span", {}, `${mastered}/${total}`),
            ),
            el("div", { class: "bar" }, el("i", { style: `width:${pct}%` })),
          )
        );
      });
    view.appendChild(list);

    view.appendChild(
      el("div", { style: "margin-top:20px" },
        el("button", { class: "btn btn-ghost", onclick: resetProgress }, "Fortschritt zurücksetzen"),
      )
    );
  }

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

function resetProgress() {
  if (!confirm("Gesamten Lernfortschritt auf diesem Gerät wirklich löschen?")) return;
  const s = defaultStore();
  s.settings   = store.settings;   // Einstellungen behalten
  s.scope      = store.scope;
  store        = s;
  saveStore();
  toast("Fortschritt zurückgesetzt");
  renderHome();
}

// ========================================================================
// EINSTELLUNGEN
// ========================================================================
function renderSettings() {
  TOPACTIONS.innerHTML = "";
  const view = el("div", { class: "view narrow" });

  const header = el("div", { class: "settings-header" },
    el("button", { class: "btn-icon", onclick: renderHome, "aria-label": "Zurück" }, "←"),
    el("h2", {}, "Einstellungen"),
  );
  view.appendChild(header);

  function section(title) {
    const s = el("div", { class: "settings-section" });
    s.appendChild(el("p", { class: "section-label" }, title));
    return s;
  }

  // ---- Darstellung ----
  const appearance = section("Darstellung");

  // Dark Mode
  appearance.appendChild(settingSelect(
    "🌙 Dark Mode",
    [["light", "Immer hell"], ["dark", "Immer dunkel"], ["system", "Systemeinstellungen"]],
    cfg().theme,
    (v) => { store.settings.theme = v; saveStore(); applyTheme(); },
  ));

  // Farbenblind
  appearance.appendChild(settingToggle(
    "👁 Farbenblind-Modus",
    "Kräftigere Rot/Grün-Töne für Personen mit Rot-Grün-Sehschwäche.",
    cfg().colorblind,
    (v) => { store.settings.colorblind = v; saveStore(); applyTheme(); },
  ));

  // Schlüsselwort-Hervorhebung
  appearance.appendChild(settingToggle(
    "🔍 Schlüsselwörter hervorheben",
    "Wichtige Begriffe in Fragen und Antworten werden markiert.",
    cfg().highlightKeys,
    (v) => { store.settings.highlightKeys = v; saveStore(); },
  ));

  view.appendChild(appearance);

  // ---- Quiz ----
  const quiz = section("Quiz-Verhalten");

  quiz.appendChild(settingToggle(
    "✋ Antwort vor Auswertung bestätigen",
    "Verhindert versehentliches Antippen einer Antwort.",
    cfg().confirmAnswer,
    (v) => { store.settings.confirmAnswer = v; saveStore(); },
  ));

  quiz.appendChild(settingToggle(
    "🏁 Im Prüfungsmodus: Ergebnis erst am Schluss",
    "Anzeige der Trefferquote erst nach der letzten Frage.",
    cfg().showResultLate,
    (v) => { store.settings.showResultLate = v; saveStore(); },
  ));

  quiz.appendChild(settingSelect(
    "💡 Erklärungen automatisch anzeigen",
    [["always", "Immer"], ["wrong", "Nur bei Fehlern"], ["never", "Nie"]],
    cfg().autoHint,
    (v) => { store.settings.autoHint = v; saveStore(); },
  ));

  quiz.appendChild(settingSelect(
    "🎯 Tagesziel",
    [[10, "10 Fragen"], [20, "20 Fragen"], [50, "50 Fragen"], [100, "100 Fragen"]],
    cfg().dailyGoal,
    (v) => { store.settings.dailyGoal = Number(v); saveStore(); },
  ));

  view.appendChild(quiz);

  // ---- Daten ----
  const data = section("Daten");
  data.appendChild(
    el("div", { class: "setting-row" },
      el("div", { class: "setting-info" },
        el("div", { class: "setting-label" }, "Gesamten Fortschritt löschen"),
        el("div", { class: "setting-desc"  }, "Alle Lernstände und Serien auf diesem Gerät zurücksetzen."),
      ),
      el("button", { class: "btn btn-ghost", style: "flex:none", onclick: () => { resetProgress(); renderSettings(); } }, "Zurücksetzen"),
    )
  );
  data.appendChild(
    el("div", { class: "setting-row" },
      el("div", { class: "setting-info" },
        el("div", { class: "setting-label" }, "Lesezeichen löschen"),
        el("div", { class: "setting-desc"  }, `${store.bookmarks.length} gemerkte Fragen.`),
      ),
      el("button", { class: "btn btn-ghost", style: "flex:none", onclick: () => {
        store.bookmarks = [];
        saveStore();
        toast("Lesezeichen gelöscht");
        renderSettings();
      }}, "Löschen"),
    )
  );
  view.appendChild(data);

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

function settingToggle(label, desc, value, onChange) {
  let current = value;
  const toggle = el("button", {
    class:       "toggle " + (current ? "on" : ""),
    role:        "switch",
    "aria-checked": String(current),
    onclick:     () => {
      current = !current;
      toggle.classList.toggle("on", current);
      toggle.setAttribute("aria-checked", String(current));
      onChange(current);
    },
  },
    el("span", { class: "toggle-thumb" }),
  );
  return el("div", { class: "setting-row" },
    el("div", { class: "setting-info" },
      el("div", { class: "setting-label" }, label),
      el("div", { class: "setting-desc"  }, desc),
    ),
    toggle,
  );
}

function settingSelect(label, options, value, onChange) {
  const sel = el("select", { class: "setting-select", "aria-label": label });
  options.forEach(([v, l]) => {
    const o = el("option", { value: v }, l);
    if (v === value) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("change", () => onChange(sel.value));
  return el("div", { class: "setting-row" },
    el("div", { class: "setting-info" },
      el("div", { class: "setting-label" }, label),
    ),
    sel,
  );
}

// ========================================================================
// FESTE PRÜFUNGSBÖGEN
// ========================================================================
function examSheetIds(lic) {
  return Array.from({ length: 15 }, (_, i) => `${lic}-${String(i + 1).padStart(2, "0")}`);
}

function renderExamSheets() {
  session = null;
  stopTimer();
  TOPACTIONS.innerHTML = "";
  TOPACTIONS.appendChild(el("button", { class: "btn-icon", onclick: renderHome, "aria-label": "Zurück" }, "←"));

  if (!SBF_SCOPES.has(store.scope)) {
    store.scope = "see";
    saveStore();
  }
  const lic = store.scope === "binnen" ? "binnen" : "see";
  const label = lic === "see" ? "SBF See" : "SBF Binnen";
  const view = el("div", { class: "view" });

  view.appendChild(
    el("section", { class: "sheets-hero" },
      el("p", { class: "eyebrow" }, "Prüfungsmodus"),
      el("h1", {}, "Feste Bögen statt Zufall."),
      el("p", {}, `${label}: Jeder Bogen nutzt die amtliche ELWIS-Fragenverteilung. Die Antwortreihenfolge wird pro Start weiterhin gemischt.`),
    )
  );

  view.appendChild(el("div", { style: "margin:4px 0 18px" }, scopeSegmentedFor(renderExamSheets)));

  const grid = el("div", { class: "sheet-grid" });
  examSheetIds(lic).forEach((sheetId) => {
    const n = sheetId.split("-")[1];
    grid.appendChild(
      el("button", { class: "sheet-card", onclick: () => startExam(sheetId) },
        el("span", { class: "sheet-kicker" }, label),
        el("strong", {}, `Bogen ${n}`),
        el("span", {}, lic === "see" ? "30 Fragen + Navigation" : "30 Fragen"),
      )
    );
  });
  view.appendChild(grid);

  view.appendChild(
    el("p", { class: "sheet-note" },
      "Quelle der Zuordnung: ELWIS-Bekanntmachungen zur Verteilung der Fragen auf die einzelnen Fragebogen. Die Inhalte stammen weiterhin aus dem amtlichen Fragenkatalog.",
    )
  );

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

function scopeSegmentedFor(onChange) {
  const seg = el("div", { class: "segmented", role: "group", "aria-label": "Schein wählen" });
  [["see", "See"], ["binnen", "Binnen"]].forEach(([val, lbl]) => {
    seg.appendChild(el("button", {
      "aria-pressed": String((store.scope === "all" ? "see" : store.scope) === val),
      onclick: () => { store.scope = val; saveStore(); onChange(); },
    }, lbl));
  });
  return seg;
}

// ========================================================================
// VIRTUELLES LEHRBUCH
// ========================================================================
function theoryKeys() {
  if (store.scope === "see") return ["see"];
  if (store.scope === "binnen") return ["binnen"];
  if (!SBF_SCOPES.has(store.scope)) return [];
  return ["see", "binnen"];
}

function allTheorySections(keys = theoryKeys()) {
  return keys.flatMap((key) =>
    THEORY_LIBRARY[key].chapters.flatMap((chapter) =>
      chapter.sections.map((section) => ({ key, chapter: chapter.title, ...section }))
    )
  );
}

function renderTheoryLibrary() {
  session = null;
  stopTimer();
  TOPACTIONS.innerHTML = "";
  TOPACTIONS.appendChild(el("button", { class: "btn-icon", onclick: renderHome, "aria-label": "Zurück" }, "←"));

  const view = el("div", { class: "view" });
  view.appendChild(
    el("section", { class: "theory-hero" },
      el("p", { class: "eyebrow" }, "Virtuelles Lehrbuch"),
      el("h1", {}, "Theorie dort lesen, wo du lernst."),
      el("p", {}, "Kurze, eigene Erklärtexte für die wichtigsten Prüfungsbereiche. Die Struktur ist vorbereitet für spätere Sprungmarken direkt aus den Fragen."),
    )
  );
  view.appendChild(el("div", { style: "margin:4px 0 18px" }, scopeSegmentedFor(renderTheoryLibrary)));

  const search = el("input", {
    type: "search",
    class: "search-input",
    placeholder: "Lehrbuch durchsuchen …",
    "aria-label": "Lehrbuch durchsuchen",
  });
  const results = el("div", { class: "theory-results" });

  function renderIndex() {
    results.innerHTML = "";
    theoryKeys().forEach((key) => {
      const book = THEORY_LIBRARY[key];
      const card = el("section", { class: "theory-book" },
        el("div", { class: "theory-book-head" },
          el("h2", {}, book.title),
          el("p", {}, book.intro),
        ),
      );
      book.chapters.forEach((chapter) => {
        const group = el("div", { class: "theory-chapter" }, el("h3", {}, chapter.title));
        chapter.sections.forEach((section) => {
          group.appendChild(
            el("button", { class: "theory-row", onclick: () => renderTheorySection(key, section.id) },
              el("strong", {}, section.title),
              el("span", {}, section.text),
            )
          );
        });
        card.appendChild(group);
      });
      results.appendChild(card);
    });
  }

  function runSearch() {
    const q = search.value.trim().toLowerCase();
    if (q.length < 2) { renderIndex(); return; }
    results.innerHTML = "";
    const hits = allTheorySections().filter((section) =>
      [section.title, section.chapter, section.text, ...(section.bullets || [])].join(" ").toLowerCase().includes(q)
    );
    if (!hits.length) {
      results.appendChild(el("p", { class: "qhint" }, "Keine Treffer im Lehrbuch."));
      return;
    }
    hits.forEach((section) => {
      results.appendChild(
        el("button", { class: "theory-row search-hit", onclick: () => renderTheorySection(section.key, section.id) },
          el("small", {}, `${THEORY_LIBRARY[section.key].title} · ${section.chapter}`),
          el("strong", { html: highlightSearch(section.title, q) }),
          el("span", { html: highlightSearch(section.text, q) }),
        )
      );
    });
  }

  search.addEventListener("input", runSearch);
  view.appendChild(search);
  view.appendChild(results);
  renderIndex();

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

function findTheorySection(key, sectionId) {
  for (const chapter of THEORY_LIBRARY[key].chapters) {
    const section = chapter.sections.find((s) => s.id === sectionId);
    if (section) return { chapter: chapter.title, section };
  }
  return null;
}

function renderTheorySection(key, sectionId) {
  const found = findTheorySection(key, sectionId);
  if (!found) { renderTheoryLibrary(); return; }
  TOPACTIONS.innerHTML = "";
  TOPACTIONS.appendChild(el("button", { class: "btn-icon", onclick: renderTheoryLibrary, "aria-label": "Zurück" }, "←"));

  const { chapter, section } = found;
  const view = el("div", { class: "view narrow" },
    el("article", { class: "theory-detail" },
      el("p", { class: "theory-kicker" }, `${THEORY_LIBRARY[key].title} · ${chapter}`),
      el("h1", {}, section.title),
      el("button", {
        class: "btn btn-ghost audio-action",
        onclick: () => speakTheorySection(section),
      }, "🔊 Abschnitt vorlesen"),
      el("p", {}, section.text),
      el("ul", {}, ...section.bullets.map((item) => el("li", {}, item))),
    )
  );

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

// ========================================================================
// KNOTEN
// ========================================================================
function renderKnots() {
  session = null;
  stopTimer();
  TOPACTIONS.innerHTML = "";
  TOPACTIONS.appendChild(el("button", { class: "btn-icon", onclick: renderHome, "aria-label": "Zurück" }, "←"));

  const view = el("div", { class: "view" });
  view.appendChild(
    el("section", { class: "knots-hero" },
      el("p", { class: "eyebrow" }, "Praktische Prüfung"),
      el("h1", {}, "Knoten sicher erklären und legen."),
      el("p", {}, "Die wichtigsten SBF-Knoten mit Zweck, Prüfpunkten und klaren Schritten. Animationen können später auf diese Struktur aufsetzen."),
    )
  );

  const list = el("div", { class: "knot-list" });
  KNOTS.forEach((knot) => {
    list.appendChild(
      el("details", { class: "knot-card" },
        el("summary", {},
          el("span", {}, knot.name),
          el("small", {}, knot.purpose),
        ),
        el("ol", {}, ...knot.steps.map((step) => el("li", {}, step))),
        el("p", { class: "knot-check" }, knot.check),
      )
    );
  });
  view.appendChild(list);

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

// ========================================================================
// FUNKPRAXIS
// ========================================================================
function renderRadioPractice() {
  session = null;
  stopTimer();
  TOPACTIONS.innerHTML = "";
  TOPACTIONS.appendChild(el("button", { class: "btn-icon", onclick: renderHome, "aria-label": "Zurück" }, "←"));

  const view = el("div", { class: "view" });
  view.appendChild(
    el("section", { class: "radio-hero" },
      el("p", { class: "eyebrow" }, "Funkpraxis"),
      el("h1", {}, "Klar sprechen, sauber buchstabieren."),
      el("p", {}, "Kurze Praxisbausteine für SRC, LRC und UBI: internationale Buchstabiertafel, Standard-Anrufschema und die wichtigsten Meldungsarten."),
    )
  );

  view.appendChild(
    el("section", { class: "radio-panel" },
      el("div", { class: "radio-title" },
        el("h2", {}, "Buchstabiertafel"),
        el("p", {}, "Für Namen, Rufzeichen, Kennungen und schwer verständliche Wörter."),
      ),
      el("div", { class: "alphabet-grid" },
        ...PHONETIC_ALPHABET.map(([char, word]) =>
          el("div", { class: "alphabet-cell" },
            el("strong", {}, char),
            el("span", {}, word),
          )
        ),
      ),
    )
  );

  view.appendChild(el("p", { class: "section-label" }, "Sprechfunkabläufe"));
  const cards = el("div", { class: "radio-card-grid" });
  RADIO_PRACTICE.forEach((item) => {
    cards.appendChild(
      el("details", { class: "radio-card" },
        el("summary", {},
          el("span", { class: "radio-badge" }, item.badge),
          el("strong", {}, item.title),
          el("small", {}, item.purpose),
        ),
        el("ol", {}, ...item.steps.map((step) => el("li", {}, step))),
        el("p", { class: "radio-example" }, item.example),
      )
    );
  });
  view.appendChild(cards);

  view.appendChild(
    el("section", { class: "radio-panel" },
      el("div", { class: "radio-title" },
        el("h2", {}, "Funkvokabeln"),
        el("p", {}, "Wichtige englische Funkbegriffe zum Nachlesen und Anhören."),
      ),
      el("div", { class: "vocab-list" },
        ...RADIO_VOCAB.map(([term, translation, note]) =>
          el("div", { class: "vocab-row" },
            el("button", {
              class: "btn-icon vocab-speak",
              title: `${term} anhören`,
              "aria-label": `${term} anhören`,
              onclick: () => speakRadioTerm(term),
            }, "▶"),
            el("div", {},
              el("strong", {}, term),
              el("span", {}, translation),
            ),
            el("p", {}, note),
          )
        ),
      ),
    )
  );

  view.appendChild(
    el("section", { class: "radio-panel" },
      el("div", { class: "radio-title" },
        el("h2", {}, "Diktat & Übersetzung"),
        el("p", {}, "Höre eine kurze Meldung, schreibe den Sinn auf Deutsch auf und prüfe die Schlüsselstellen."),
      ),
      el("div", { class: "dictation-list" },
        ...RADIO_DICTATION.map((task, index) => renderDictationTask(task, index)),
      ),
    )
  );

  view.appendChild(
    el("section", { class: "radio-panel" },
      el("div", { class: "radio-title" },
        el("h2", {}, "UBI-Verkehrskreise"),
        el("p", {}, "Die Verkehrskreise helfen, Zweck und Funkstelle sauber zuzuordnen."),
      ),
      el("div", { class: "traffic-list" },
        ...UBI_TRAFFIC_CIRCLES.map(([name, text]) =>
          el("div", { class: "traffic-row" },
            el("strong", {}, name),
            el("span", {}, text),
          )
        ),
      ),
    )
  );

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

function renderDictationTask(task, index) {
  const inputId = `dictation-${index}`;
  const feedbackId = `dictation-feedback-${index}`;
  return el("div", { class: "dictation-card" },
    el("div", { class: "dictation-head" },
      el("strong", {}, task.title),
      el("button", {
        class: "btn btn-ghost",
        onclick: () => speakRadioTerm(task.prompt),
      }, "Anhören"),
    ),
    el("textarea", {
      id: inputId,
      class: "dictation-input",
      rows: 3,
      placeholder: "Kurz auf Deutsch notieren...",
    }),
    el("div", { class: "dictation-actions" },
      el("button", { class: "btn btn-primary", onclick: () => checkDictation(task, inputId, feedbackId) }, "Prüfen"),
      el("button", { class: "btn btn-ghost", onclick: () => revealDictation(task, feedbackId) }, "Lösung anzeigen"),
    ),
    el("div", { id: feedbackId, class: "dictation-feedback hidden" }),
  );
}

function normalizeDictationText(value) {
  return value.toLowerCase()
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[ß]/g, "ss");
}

function checkDictation(task, inputId, feedbackId) {
  const input = document.getElementById(inputId);
  const feedback = document.getElementById(feedbackId);
  if (!input || !feedback) return;
  const value = normalizeDictationText(input.value || "");
  const hits = task.keywords.filter((keyword) => value.includes(normalizeDictationText(keyword)));
  feedback.className = `dictation-feedback ${hits.length >= Math.ceil(task.keywords.length * 0.75) ? "ok" : "no"}`;
  feedback.innerHTML = `<strong>${hits.length}/${task.keywords.length} Schlüsselstellen erkannt</strong><span>${task.expected}</span>`;
}

function revealDictation(task, feedbackId) {
  const feedback = document.getElementById(feedbackId);
  if (!feedback) return;
  feedback.className = "dictation-feedback";
  feedback.innerHTML = `<strong>Beispiellösung</strong><span>${task.expected}</span><small>Gehört: ${task.prompt}</small>`;
}

// ========================================================================
// FKN-PRAXIS
// ========================================================================
function renderFknPractice() {
  session = null;
  stopTimer();
  TOPACTIONS.innerHTML = "";
  TOPACTIONS.appendChild(el("button", { class: "btn-icon", onclick: renderHome, "aria-label": "Zurück" }, "←"));

  const view = el("div", { class: "view" });
  view.appendChild(
    el("section", { class: "fkn-hero" },
      el("p", { class: "eyebrow" }, "FKN-Praxis"),
      el("h1", {}, "Sicher handeln, sauber begründen."),
      el("p", {}, "Selbstchecks für die praktische FKN-Prüfung: Vorbereitung, sichere Handhabung, Aufbewahrung und rechtliche Kernpunkte."),
    )
  );

  const list = el("div", { class: "fkn-list" });
  FKN_PRACTICE.forEach((item) => {
    list.appendChild(
      el("details", { class: "fkn-card" },
        el("summary", {},
          el("span", {}, item.title),
          el("small", {}, item.purpose),
        ),
        el("ul", {}, ...item.checks.map((check) => el("li", {}, check))),
        el("p", { class: "fkn-note" }, item.examNote),
      )
    );
  });
  view.appendChild(list);

  view.appendChild(
    el("section", { class: "fkn-warning" },
      el("h2", {}, "Wichtig"),
      el("p", {}, "Dieses Modul ersetzt keine praktische Einweisung und fordert nicht zum Ausprobieren pyrotechnischer Signalmittel auf. Geübt wird hier das prüfungsreife Erklären sicherer Abläufe."),
    )
  );

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

function speakRadioTerm(term) {
  speakText(term, { lang: "en-GB", rate: 0.82 });
}

function speakText(text, options = {}) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    toast("Kein Text zum Vorlesen");
    return;
  }
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    toast("Vorlesen wird von diesem Browser nicht unterstützt");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = options.lang || "de-DE";
  utterance.rate = options.rate || 0.92;
  utterance.pitch = options.pitch || 1;
  window.speechSynthesis.speak(utterance);
}

function speakQuestion(q) {
  const choices = (q.choices || []).map((choice, idx) => `${String.fromCharCode(65 + idx)}: ${choice}`);
  speakText([q.prompt, ...choices].join(". "));
}

function speakTheorySection(section) {
  speakText([section.title, section.text, ...(section.bullets || [])].join(". "));
}

function theoryLinkForQuestion(q) {
  if (!q || q.card_type === "navigation") return { key: "see", id: "see-navigation-position" };
  if (!SBF_SCOPES.has(q.license_type)) return null;
  const key = q.license_type === "binnen" ? "binnen" : "see";
  const hay = [q.category, q.prompt, ...(q.choices || []), q.explanation || ""].join(" ").toLowerCase();

  if (key === "see") {
    if (/position|kurs|peil|karte|distanz|missweisung|navigation|koordinat|rwk|mgk/.test(hay)) {
      return { key, id: "see-navigation-position" };
    }
    if (/tonne|befeuer|feuer|licht|seezeichen|fahrwasser|kardinal|lateral|steuerbord|backbord/.test(hay)) {
      return { key, id: "see-navigation-tonnen" };
    }
    if (/wetter|rettung|sicherheit|ausrüst|not|mann über bord|seemannschaft|anker/.test(hay)) {
      return { key, id: "see-seemannschaft-sicherheit" };
    }
    if (/seeschifffahrt|fahrwasser|verkehrstrenn|berufsschifffahrt|kleinfahrzeug|ausweich/.test(hay)) {
      return { key, id: "see-recht-seeschifffahrt" };
    }
    return { key, id: "see-recht-schiffsfuehrer" };
  }

  if (/schall|ton|signal/.test(hay)) return { key, id: "binnen-signale-schall" };
  if (/zeichen|tonne|schwimmstange|sichtzeichen|tafel|licht|farbe|kegel|ball/.test(hay)) {
    return { key, id: "binnen-zeichen-sichtzeichen" };
  }
  if (/ausweich|begegn|überhol|kreuz|kollisionskurs|fahrzeug unter segel|maschinenfahrzeug/.test(hay)) {
    return { key, id: "binnen-regeln-ausweichen" };
  }
  if (/berg|tal|fahrwasser|fahrrinne|ufer|schleuse/.test(hay)) return { key, id: "binnen-regeln-fahrwasser" };
  return { key, id: "binnen-sicherheit-ausruestung" };
}

function theoryButtonForQuestion(q, extraClass = "") {
  const link = theoryLinkForQuestion(q);
  if (!link) return null;
  const found = findTheorySection(link.key, link.id);
  if (!found) return null;
  return el("button", {
    class: `btn btn-ghost btn-theory ${extraClass}`.trim(),
    onclick: () => renderTheorySection(link.key, link.id),
  }, `Mehr dazu: ${found.section.title}`);
}

// ========================================================================
// WEG ZUR PRÜFUNG
// ========================================================================
const EXAM_GUIDES = {
  see: {
    title: "SBF See",
    intro: "Der Sportbootführerschein See ist der amtliche Pflichtschein für motorisierte Sportboote auf Seeschifffahrtsstraßen ab 15 PS.",
    facts: [
      ["Mindestalter", "16 Jahre für Antriebsmaschine"],
      ["Prüfung", "Theoriefragebogen, Navigationsaufgabe und praktische Prüfung"],
      ["Theorie", "7 Basisfragen, 23 spezifische See-Fragen und eine Navigationsaufgabe"],
      ["Zeit", "60 Minuten für die theoretische Prüfung"],
    ],
    steps: [
      ["Prüfungsausschuss wählen", "Suche einen Prüfungstermin bei einem anerkannten Prüfungsausschuss in deiner Region und prüfe die Anmeldefrist."],
      ["Antrag einreichen", "Reiche den ausgefüllten Antrag mit Passbild, Identitätsnachweis und den geforderten Nachweisen ein."],
      ["Ärztliches Zeugnis besorgen", "Du brauchst in der Regel ein Tauglichkeitszeugnis für Sehvermögen, Farbunterscheidung und Hörvermögen."],
      ["Theorie vorbereiten", "Übe den amtlichen Fragenkatalog, bis Basisfragen, See-Fragen und Navigationsaufgaben zuverlässig sitzen."],
      ["Praxis trainieren", "Bereite Manöver, Knoten und Sicherheitsverhalten vor. Die praktische Prüfung kann separat oder am selben Tag stattfinden."],
      ["Prüfung ablegen", "Nimm Ausweis, Einladung und ggf. Zahlungs-/Nachweisunterlagen mit. Bei Nichtbestehen kann der nicht bestandene Teil wiederholt werden."],
    ],
  },
  binnen: {
    title: "SBF Binnen",
    intro: "Der Sportbootführerschein Binnen ist der amtliche Pflichtschein für motorisierte Sportboote auf Binnenschifffahrtsstraßen ab 15 PS.",
    facts: [
      ["Mindestalter", "16 Jahre für Antriebsmaschine"],
      ["Prüfung", "Theoriefragebogen und praktische Prüfung"],
      ["Theorie", "7 Basisfragen und 23 spezifische Binnen-Fragen"],
      ["Zeit", "45 Minuten für die theoretische Prüfung"],
    ],
    steps: [
      ["Prüfungstermin finden", "Wähle einen passenden Termin bei einem anerkannten Prüfungsausschuss und beachte die jeweilige Anmeldefrist."],
      ["Unterlagen vorbereiten", "Typisch sind Antrag, Passbild, Identitätsnachweis und ein Tauglichkeitszeugnis. Prüfe die aktuelle Liste beim Prüfungsausschuss."],
      ["Variante klären", "Für Motor brauchst du die Antriebsmaschinen-Prüfung; Segel kann je nach Revier und Ziel zusätzlich relevant sein."],
      ["Theorie lernen", "Trainiere Basis- und Binnen-Fragen gezielt nach Themen und wiederhole falsch beantwortete Fragen."],
      ["Praxis üben", "Bereite Anlegen, Ablegen, Mann-über-Bord, Kursfahren, Knoten und Sicherheitsfragen vor."],
      ["Prüfungstag", "Plane Puffer ein und bringe Ausweis sowie die Bestätigung des Prüfungsausschusses mit. Nicht bestandene Teile können wiederholt werden."],
    ],
  },
  fkn: {
    title: "FKN",
    intro: "Der Fachkundenachweis Seenotsignalmittel ist der Nachweis für den Umgang mit erlaubnispflichtigen pyrotechnischen Seenotsignalmitteln.",
    facts: [
      ["Mindestalter", "16 Jahre"],
      ["Voraussetzung", "Amtlicher Sportbootführerschein oder anerkannter Befähigungsnachweis"],
      ["Prüfung", "Theoretischer Fragebogen und praktische Handhabung"],
      ["Theorie", "15 Fragen aus 4 amtlichen Fragebögen"],
    ],
    steps: [
      ["Prüfungsausschuss wählen", "Melde dich bei einem zuständigen regionalen Prüfungsausschuss an und prüfe Termin, Frist und Gebühren."],
      ["Befähigungsnachweis bereitlegen", "Für die Zulassung brauchst du einen amtlichen Sportbootführerschein oder einen anerkannten gleichwertigen Nachweis."],
      ["Fragenkatalog lernen", "Übe alle 60 FKN-Fragen und die vier offiziellen Fragebogen, bis Rechtsfragen und Handhabungssicherheit sitzen."],
      ["Praktische Handhabung vorbereiten", "Bereite das sichere Erklären von Handfackel, Rauchsignal, Fallschirm-Signalrakete und Signalgeber vor."],
      ["Identität nachweisen", "Zum Prüfungstermin brauchst du einen amtlichen Identitätsnachweis und die geforderten Unterlagen."],
      ["Prüfung ablegen", "Die Prüfung umfasst Theorie und Praxis. Entscheidend sind sichere Begriffe, ruhiges Vorgehen und korrekte Sicherheitsregeln."],
    ],
  },
  src: {
    title: "SRC",
    intro: "Das Short Range Certificate ist das beschränkt gültige Funkbetriebszeugnis für UKW-Seefunk und GMDSS im Seegebiet A1.",
    facts: [
      ["Mindestalter", "15 Jahre"],
      ["Prüfung", "Theorie, Aufnahme von Meldungen und praktische Funkaufgaben"],
      ["Theorie", "24 Multiple-Choice-Fragen"],
      ["Praxis", "DSC-/UKW-Bedienung und Sprechfunkverfahren"],
    ],
    steps: [
      ["Prüfungsausschuss wählen", "Wähle einen regionalen Prüfungsausschuss und beachte dessen Fristen und Unterlagen."],
      ["Antrag stellen", "Reiche Antrag, Identitätsnachweis und ggf. weitere Nachweise so ein, wie der Prüfungsausschuss es verlangt."],
      ["Katalog lernen", "Trainiere den SRC-Fragenkatalog und wiederhole besonders DSC, GMDSS, Rangfolgen und SAR."],
      ["Meldungen aufnehmen", "Übe das schriftliche Erfassen von Not-, Dringlichkeits- und Sicherheitsmeldungen."],
      ["Praxis simulieren", "Trainiere Mayday, Pan-pan, Sécurité, Routine-Anruf und Gerätebedienung an prüfungsnahen Beispielen."],
      ["Prüfung ablegen", "Nimm Ausweis und Einladung mit. Theorie, Aufnahme und Praxis müssen prüfungsreif sitzen."],
    ],
  },
  lrc: {
    title: "LRC",
    intro: "Das Long Range Certificate erweitert das SRC um Grenz-/Kurzwelle und Satellitenfunk für weltweite Fahrtgebiete.",
    facts: [
      ["Mindestalter", "18 Jahre"],
      ["Prüfung", "Theorie, Meldungsaufnahme und praktische Funkaufgaben"],
      ["Theorie", "LRC-Ergänzungskatalog plus SRC-Anteile"],
      ["Praxis", "GMDSS-Verfahren über mehrere Systeme"],
    ],
    steps: [
      ["Voraussetzungen klären", "Prüfe beim Prüfungsausschuss, ob du LRC direkt oder als Erweiterung auf vorhandenes SRC ablegst."],
      ["Antrag einreichen", "Reiche die geforderten Unterlagen fristgerecht beim zuständigen Prüfungsausschuss ein."],
      ["LRC-Katalog lernen", "Trainiere Inmarsat, GW/KW, DSC, Ausbreitung und Betriebsverfahren gezielt."],
      ["SRC-Grundlagen wiederholen", "Da LRC auf SRC aufbaut, sollten UKW-Seefunk, GMDSS und Rangfolgen stabil sein."],
      ["Praxis vorbereiten", "Übe Meldungsaufnahme und Funkabläufe über die im Prüfungstermin eingesetzten Systeme."],
      ["Prüfung ablegen", "Plane genug Zeit ein: LRC kombiniert theoretische, schriftliche und praktische Anteile."],
    ],
  },
  ubi: {
    title: "UBI",
    intro: "Das UKW-Sprechfunkzeugnis für den Binnenschifffahrtsfunk ist der Befähigungsnachweis für UKW-Funk auf Binnenwasserstraßen.",
    facts: [
      ["Mindestalter", "15 Jahre"],
      ["Prüfung", "Theorie und praktische Funkaufgaben"],
      ["Theorie", "22 Multiple-Choice-Fragen"],
      ["Besonderheit", "Für SRC/LRC-Inhaber ist die UBI-Prüfung verkürzt"],
    ],
    steps: [
      ["Prüfungsausschuss wählen", "Melde dich bei einem regionalen Prüfungsausschuss an und prüfe, ob eine Kombination mit SRC/LRC möglich ist."],
      ["Unterlagen vorbereiten", "Reiche Antrag, Identitätsnachweis und ggf. vorhandene Funkzeugnisse fristgerecht ein."],
      ["Katalog lernen", "Trainiere Binnenschifffahrtsfunk, Verkehrskreise, Rangfolgen, Technik und Betriebsverfahren."],
      ["Verkehrskreise üben", "Ordne Nautische Information, Schiff-Schiff, Funkverkehr an Bord und öffentlichen Nachrichtenaustausch sicher zu."],
      ["Praxis vorbereiten", "Übe Anruf, Antwort, Kanalwechsel, Not-/Dringlichkeits-/Sicherheitsverkehr und klare Sprechweise."],
      ["Prüfung ablegen", "Nimm Ausweis und Einladung mit; halte vorhandene Zeugnisse bereit, falls du eine Ergänzungsprüfung ablegst."],
    ],
  },
};

function activeGuideKeys() {
  if (store.scope === "see") return ["see"];
  if (store.scope === "binnen") return ["binnen"];
  if (store.scope === "fkn") return ["fkn"];
  if (store.scope === "src") return ["src"];
  if (store.scope === "lrc") return ["lrc"];
  if (store.scope === "ubi") return ["ubi"];
  return ["see", "binnen", "fkn", "src", "lrc", "ubi"];
}

function renderExamGuide() {
  session = null;
  stopTimer();
  TOPACTIONS.innerHTML = "";
  TOPACTIONS.appendChild(el("button", { class: "btn-icon", onclick: renderHome, "aria-label": "Zurück" }, "←"));

  const view = el("div", { class: "view" });
  view.appendChild(
    el("section", { class: "guide-hero" },
      el("p", { class: "eyebrow" }, "Weg zur Prüfung"),
      el("h1", {}, "Von der Anmeldung bis zum Bestehen."),
      el("p", {}, "Die genauen Formulare, Gebühren und Fristen legt der zuständige Prüfungsausschuss fest. Diese Übersicht hilft dir, nichts Wichtiges zu vergessen."),
    )
  );

  activeGuideKeys().forEach((key) => view.appendChild(renderGuideSection(EXAM_GUIDES[key])));

  view.appendChild(
    el("section", { class: "guide-note" },
      el("h2", {}, "Vor dem Absenden prüfen"),
      el("p", {}, "Prüfungsausschüsse können Anforderungen und Fristen unterschiedlich auslegen. Vergleiche diese Checkliste deshalb vor der Anmeldung mit den aktuellen Angaben deines Prüfungsausschusses."),
    )
  );

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

function renderGuideSection(guide) {
  const facts = el("div", { class: "guide-facts" });
  guide.facts.forEach(([label, value]) => facts.appendChild(
    el("div", { class: "guide-fact" },
      el("strong", {}, label),
      el("span", {}, value),
    )
  ));

  const steps = el("ol", { class: "guide-steps" });
  guide.steps.forEach(([title, body]) => steps.appendChild(
    el("li", {},
      el("strong", {}, title),
      el("p", {}, body),
    )
  ));

  return el("section", { class: "guide-section" },
    el("div", { class: "guide-title" },
      el("h2", {}, guide.title),
      el("p", {}, guide.intro),
    ),
    facts,
    steps,
  );
}

// ========================================================================
// FAQ / TRUST CENTER
// ========================================================================
const FAQ_ITEMS = [
  {
    q: "Sind die Fragen amtlich?",
    a: "Boatiboat nutzt die hinterlegten amtlichen beziehungsweise behördennahen Katalogdaten für SBF, FKN, SRC, LRC und UBI. Quellen und Prüfsummen werden im Projekt dokumentiert, damit spätere Updates nachvollziehbar bleiben.",
  },
  {
    q: "Ersetzt Boatiboat eine Bootsschule?",
    a: "Nein. Boatiboat trainiert Theorie, Wiederholung und Selbstkontrolle. Praktische Ausbildung, Einweisung und Prüfungsanmeldung laufen weiterhin über zugelassene Stellen, Prüfungsausschüsse oder Bootsschulen.",
  },
  {
    q: "Bleibt mein Lernfortschritt privat?",
    a: "Ja. Der aktuelle Fortschritt, Lesezeichen, Tagesziel und Einstellungen werden lokal im Browser gespeichert. Ohne optionales Konto wird nichts zwischen Geräten synchronisiert.",
  },
  {
    q: "Was soll ich lernen, wenn ich wenig Zeit habe?",
    a: "Starte mit Weiterlernen, danach Nur Schwächen. Kurz vor der Prüfung sind feste Bögen, Prüfungssimulation und die schwächsten Themen im Readiness-Kasten am wichtigsten.",
  },
  {
    q: "Warum gibt es Lernhilfen zusätzlich zur amtlichen Antwort?",
    a: "Die amtliche Antwort sagt, was richtig ist. Die Lernhilfe erklärt die Denkspur dahinter und gibt einen Merksatz, damit du ähnliche Fragen schneller erkennst.",
  },
  {
    q: "Was fehlt noch?",
    a: "Auf der Roadmap stehen unter anderem redaktionell verfeinerte Erklärungen, Push- oder lokale Erinnerungen, PDF-Export, feinere Frage-zu-Lehrbuch-Zuordnung und später optionale Synchronisierung.",
  },
];

const TRUST_LINKS = [
  ["Weg zur Prüfung", "Unterlagen und Ablauf je Schein prüfen.", renderExamGuide],
  ["Lehrbuch", "SBF-Theorie kapitelweise lesen.", renderTheoryLibrary],
  ["Einstellungen", "Tagesziel, Darstellung und Quizverhalten anpassen.", renderSettings],
];

const EXTERNAL_TRUST_LINKS = [
  {
    title: "DMYV Bootsschule finden",
    desc: "Anerkannte Ausbildungsstätten nach Ort und Schein suchen.",
    url: "https://www.dmyv.de/fuehrerschein/-funk/ausbildung/ausbildungsstaette-finden",
  },
  {
    title: "DMYV Prüfungsausschüsse",
    desc: "Prüfstellen und regionale Ansprechpartner vergleichen.",
    url: "https://www.dmyv.de/fuehrerschein/-funk/pruefungen/pruefungsausschuesse",
  },
  {
    title: "DSV/Sportboot-Portal",
    desc: "Prüfungsausschuss und Termine über das zentrale Portal finden.",
    url: "https://www.sportbootfuehrerscheine.org/",
  },
];

function renderSupportCenter() {
  session = null;
  stopTimer();
  TOPACTIONS.innerHTML = "";
  TOPACTIONS.appendChild(el("button", { class: "btn-icon", onclick: renderHome, "aria-label": "Zurück" }, "←"));

  const view = el("div", { class: "view" });
  view.appendChild(
    el("section", { class: "faq-hero" },
      el("p", { class: "eyebrow" }, "FAQ & Vertrauen"),
      el("h1", {}, "Schnelle Antworten, bevor du weiterlernst."),
      el("p", {}, "Kurz erklärt: Quellen, Datenschutz, Prüfungsvorbereitung und der beste nächste Lernschritt."),
    )
  );

  const links = el("div", { class: "trust-links" });
  TRUST_LINKS.forEach(([title, desc, action]) => {
    if (title === "Lehrbuch" && !SBF_SCOPES.has(store.scope)) return;
    links.appendChild(
      el("button", { class: "trust-link", onclick: action },
        el("strong", {}, title),
        el("span", {}, desc),
      )
    );
  });
  view.appendChild(links);

  view.appendChild(
    el("section", { class: "finder-card" },
      el("div", {},
        el("p", { class: "section-label" }, "Bootsschule & Prüfung finden"),
        el("h2", {}, "Neutral weiterleiten statt Anbieter empfehlen."),
        el("p", {}, "Boatiboat listet keine einzelnen Schulen gegen Geld. Nutze die offiziellen beziehungsweise verbandsnahen Suchseiten und prüfe dort Termine, Scheinart, Praxisangebot und Entfernung."),
      ),
      el("div", { class: "external-links" },
        EXTERNAL_TRUST_LINKS.map((item) =>
          el("a", { class: "external-link", href: item.url, target: "_blank", rel: "noopener noreferrer" },
            el("strong", {}, item.title),
            el("span", {}, item.desc),
          )
        ),
      ),
    )
  );

  const list = el("section", { class: "faq-list" });
  FAQ_ITEMS.forEach((item, idx) => {
    list.appendChild(
      el("details", { class: "faq-card", open: idx === 0 },
        el("summary", {}, item.q),
        el("p", {}, item.a),
      )
    );
  });
  view.appendChild(list);

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

// ========================================================================
// SUCHE
// ========================================================================
function renderSearch() {
  session = null;
  stopTimer();
  TOPACTIONS.innerHTML = "";
  TOPACTIONS.appendChild(el("button", { class: "btn-icon", onclick: renderHome, "aria-label": "Zurück" }, "←"));

  const view = el("div", { class: "view" });
  view.appendChild(el("h2", { style: "margin-bottom:16px" }, "🔎 Fragenkatalog durchsuchen"));

  const input = el("input", {
    type: "search",
    placeholder: "Frage, Antwort oder Thema …",
    class: "search-input",
    "aria-label": "Sucheingabe",
  });

  const results = el("div", { class: "search-results" });

  function runSearch() {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = "";
    if (q.length < 2) {
      results.appendChild(el("p", { class: "qhint" }, "Mind. 2 Zeichen eingeben …"));
      return;
    }
    const pool = scopedMC();
    const hits = pool.filter((item) =>
      item.prompt.toLowerCase().includes(q) ||
      item.choices.some((c) => c.toLowerCase().includes(q)) ||
      (item.category || "").toLowerCase().includes(q)
    ).slice(0, 80);

    if (!hits.length) {
      results.appendChild(el("p", { class: "qhint" }, "Keine Treffer."));
      return;
    }
    results.appendChild(el("p", { class: "qhint" }, `${hits.length} Treffer`));

    hits.forEach((item) => {
      const st = store.byId[item.external_id];
      const row = el("div", { class: "search-item" },
        el("div", { class: "search-cat" }, item.category),
        el("div", { class: "search-prompt", html: highlightSearch(item.prompt, q) }),
        el("div", { class: "search-meta" },
          el("span", {}, item.external_id),
          st?.seen ? el("span", { class: "badge-box" }, `Box ${st.box}`) : null,
        ),
      );
      row.addEventListener("click", () => {
        // Diese Frage direkt üben
        session = { mode: "learn", items: [makeLearnItem(item)], idx: 0, deadline: null, rules: null, returnTo: "search" };
        renderQuiz();
      });
      results.appendChild(row);
    });
  }

  input.addEventListener("input", runSearch);

  view.appendChild(input);
  view.appendChild(results);
  runSearch();

  APP.innerHTML = "";
  APP.appendChild(view);
  input.focus();
}

function highlightSearch(text, q) {
  const safe = esc(text);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return safe.replace(re, "<mark>$1</mark>");
}

// ========================================================================
// QUIZ ENGINE
// ========================================================================
function renderQuiz() {
  const it = session.items[session.idx];
  if (!it) { renderResult(); return; }

  TOPACTIONS.innerHTML = "";

  const view = el("div", { class: "view narrow" });

  // ── Top-Bar ──────────────────────────────────────────────────────────
  const pct = session.items.length ? (session.idx / session.items.length) * 100 : 0;
  const top = el("div", { class: "qtop" },
    el("button", { class: "btn-icon", onclick: confirmExit, "aria-label": "Beenden" }, "✕"),
    el("div", { class: "progress-track" }, el("i", { style: `width:${pct}%` })),
  );
  if (session.deadline) {
    const tm = el("span", { class: "qtimer", id: "timer" }, "—:—");
    top.appendChild(tm);
    startTimer();
  } else {
    top.appendChild(el("span", { class: "qcount" }, `${session.idx + 1} / ${session.items.length}`));
  }
  view.appendChild(top);

  // ── Frage-Karte ───────────────────────────────────────────────────────
  const q    = it.q;
  const card = el("div", { class: "qcard" });

  // Meta-Zeile
  const licLabel = (q.license_type || "").toUpperCase();
  const modeLabel = session.rules?.sheet_label || ({ learn: "Lernmodus", exam: "Prüfung", nav: "Lernkarte" }[session.mode] ?? "");
  const metaRight = el("div", { class: "meta-right" });

  // Lesezeichen-Button (nicht im Prüfungsmodus)
  if (session.mode !== "exam") {
    metaRight.appendChild(el("button", {
      class: "btn-icon",
      title: "Frage vorlesen",
      "aria-label": "Frage vorlesen",
      onclick: () => speakQuestion(q),
    }, "🔊"));

    const bmBtn = el("button", {
      class: isBookmarked(q.external_id) ? "btn-icon bookmarked" : "btn-icon",
      title: isBookmarked(q.external_id) ? "Lesezeichen entfernen" : "Frage merken",
      onclick: () => {
        const now = toggleBookmark(q.external_id);
        bmBtn.classList.toggle("bookmarked", now);
        bmBtn.title = now ? "Lesezeichen entfernen" : "Frage merken";
        toast(now ? "Frage gemerkt 🔖" : "Lesezeichen entfernt");
      },
    }, isBookmarked(q.external_id) ? "🔖" : "🏷️");
    metaRight.appendChild(bmBtn);
  }
  metaRight.appendChild(el("span", {}, modeLabel));

  card.appendChild(
    el("div", { class: "qcat" },
      el("span", {}, `${licLabel} · ${q.category}`),
      metaRight,
    )
  );

  // Fragentext mit optionaler Hervorhebung
  card.appendChild(el("h2", { class: "qprompt", html: highlightText(q.prompt) }));
  if (session.mode !== "exam") {
    const theoryBtn = theoryButtonForQuestion(q, "inline");
    if (theoryBtn) card.appendChild(el("div", { class: "theory-jump" }, theoryBtn));
  }

  // Bild
  if (q.image_url) {
    const fig = el("figure", { class: "question-media" });
    const img = el("img", { alt: q.image_alt || "" });
    img.onload = () => { if (img.naturalWidth / img.naturalHeight >= 3.2) fig.classList.add("media-symbol"); };
    img.src = q.image_url.replace(/^\/assets\//, "assets/");
    fig.appendChild(img);
    card.appendChild(fig);
  }

  // Navigations-Lernkarte
  if (it.nav) {
    card.appendChild(renderNavCard(q));
    card.appendChild(quizFooter(it, true));
    view.appendChild(card);
    APP.innerHTML = "";
    APP.appendChild(view);
    window.scrollTo(0, 0);
    return;
  }

  // Offene Frage als Lernkarte
  if (it.flashcard) {
    card.appendChild(renderFlashcard(it));
    card.appendChild(quizFooter(it, false));
    view.appendChild(card);
    APP.innerHTML = "";
    APP.appendChild(view);
    window.scrollTo(0, 0);
    return;
  }

  // Antwort-Buttons
  const choicesEl = el("div", { class: "choices" });
  it.order.forEach((origIdx, displayIdx) => {
    const b = el("button", { class: "choice", onclick: () => handleAnswer(it, displayIdx, b) },
      el("span", { class: "badge" }, String.fromCharCode(65 + displayIdx)),
      el("span", { html: highlightText(q.choices[origIdx]) }),
    );
    choicesEl.appendChild(b);
  });
  card.appendChild(choicesEl);

  // Feedback-Box
  card.appendChild(el("div", { class: "feedback hidden", id: "feedback" }));

  // Footer
  card.appendChild(quizFooter(it, false));
  view.appendChild(card);

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);

  // Bereits beantwortete Frage (Rücksprung) wiederherstellen
  if (it.picked != null) restoreAnswered(it);
}

function quizFooter(it, isNav) {
  const isLast = session.idx === session.items.length - 1;
  const nextBtn = el("button", { class: "btn btn-primary", id: "nextBtn", onclick: nextItem },
    isLast ? "Abschließen" : "Weiter",
  );
  if (!isNav && it.picked == null) nextBtn.disabled = true;

  const hint = el("div", { class: "qhint" },
    it.flashcard
      ? el("span", {}, "Antwort aufdecken und selbst ehrlich bewerten")
      : isNav
      ? el("span", { html: "Tasten <kbd>→</kbd> weiter" })
      : el("span", { html: "Tasten <kbd>1</kbd>–<kbd>4</kbd> · <kbd>↵</kbd> weiter" }),
  );

  return el("div", { class: "qfoot" }, hint, nextBtn);
}

// ---------- Antwort verarbeiten -----------------------------------------
function handleAnswer(it, displayIdx, clickedBtn) {
  if (it.picked != null) return; // bereits beantwortet

  // Bestätigungs-Modus: erster Klick nur markieren
  if (cfg().confirmAnswer && !it.confirmed) {
    if (it._pendingIdx === displayIdx) {
      it.confirmed = true;
      commitAnswer(it, displayIdx);
      return;
    }
    // Ausstehende Markierung aufheben
    APP.querySelectorAll(".choice.pending").forEach((b) => b.classList.remove("pending"));
    clickedBtn.classList.add("pending");
    it._pendingIdx = displayIdx;

    const fb = $("#feedback");
    if (fb) {
      fb.className = "feedback";
      fb.innerHTML = `Antwort <strong>${String.fromCharCode(65 + displayIdx)}</strong> gewählt – zur Bestätigung nochmal tippen oder <kbd>↵</kbd> drücken.`;
    }
    return;
  }
  it.confirmed = true;
  commitAnswer(it, displayIdx);
}

function commitAnswer(it, displayIdx) {
  it.picked  = displayIdx;
  it.correct = displayIdx === it.correctIdx;
  if (session.mode !== "nav") recordAnswer(it.q.external_id, it.correct);
  paintAnswer(it);
  const nb = $("#nextBtn");
  if (nb) { nb.disabled = false; nb.focus(); }
  // Prüfungsmodus: auto-advance (kein langer Bestätigungs-Stopp)
  if (session.mode === "exam" && cfg().showResultLate) setTimeout(nextItem, 180);
}

function learningAidForQuestion(q) {
  const answer = q.choices?.[q.correct_index] || "";
  const hay = [q.license_type, q.category, q.prompt, answer, q.explanation || ""].join(" ").toLowerCase();
  let reason = "Prüfe erst, wonach genau gefragt wird, und streiche Antworten, die nur ähnlich klingen.";
  let memory = "Fragekern finden, falsche Extreme aussortieren, dann die präziseste Antwort wählen.";

  if (/funk|src|lrc|ubi|mayday|pan-pan|securite|ukw|kanal|rufzeichen/.test(hay)) {
    reason = "Im Funk zählt die feste Reihenfolge: Dringlichkeit, Adressat, eigene Kennung, Position, Lage und gewünschte Hilfe.";
    memory = "Erst wer spricht und wo, dann was passiert ist und welche Hilfe gebraucht wird.";
  } else if (/fkn|pyro|signal|seenot|rakete|rauch|handfackel|notsignal/.test(hay)) {
    reason = "Pyrotechnik-Fragen drehen sich fast immer um Seenot, sichere Handhabung, Zulassung und Abstand zu Personen.";
    memory = "Pyro nur im Notfall, weg vom Körper, frei nach Lee und nach Anleitung.";
  } else if (/navigation|karte|kurs|peil|position|missweisung|rwk|mgk|distanz|koordinat/.test(hay)) {
    reason = "Navigationsfragen lassen sich sicher lösen, wenn du Richtung, Bezugssystem und Einheiten sauber trennst.";
    memory = "Erst Karte und Bezug klären, dann rechnen, dann Plausibilität prüfen.";
  } else if (/tonne|zeichen|befeuer|licht|farbe|kegel|ball|seezeichen|schall/.test(hay)) {
    reason = "Zeichenfragen fragen meist nach Form, Farbe, Takt oder Bedeutung. Ein einzelnes Merkmal entscheidet oft.";
    memory = "Form, Farbe, Feuer: immer in dieser Reihenfolge lesen.";
  } else if (/ausweich|vorfahrt|begegn|überhol|kreuz|kollisions|fahrwasser|kurshalte/.test(hay)) {
    reason = "Bei Ausweichregeln ist zuerst wichtig, welche Fahrzeuge beteiligt sind und ob sie sich begegnen, kreuzen oder überholen.";
    memory = "Situation benennen, Rollen klären, dann handeln: Kurs halten oder früh und deutlich ausweichen.";
  } else if (/wetter|wind|sicht|nebel|gewitter|druck|front/.test(hay)) {
    reason = "Wetterfragen zielen auf rechtzeitiges Erkennen von Risiko und konservative Entscheidungen vor dem Ablegen.";
    memory = "Wetter entscheidet vor dem Start, nicht erst mitten auf dem Wasser.";
  } else if (/motor|maschine|kraftstoff|brand|bilge|kühl|propeller|öl/.test(hay)) {
    reason = "Technikfragen prüfen Ursache, Kontrolle und sichere Reihenfolge beim Handeln an Bord.";
    memory = "Erst sichern und prüfen, dann starten, reparieren oder Hilfe holen.";
  }

  return { reason, memory, answer };
}

function appendLearningAid(target, q) {
  const aid = learningAidForQuestion(q);
  target.appendChild(
    el("div", { class: "learning-aid" },
      el("strong", {}, "Lernhilfe"),
      el("p", {}, aid.reason),
      aid.answer ? el("p", {}, `Merksatz: ${aid.memory} Richtige Antwort: ${aid.answer}`) : el("p", {}, `Merksatz: ${aid.memory}`),
    )
  );
}

function paintAnswer(it) {
  const btns = APP.querySelectorAll(".choice");
  const hideExamResult = session.mode === "exam" && cfg().showResultLate;
  btns.forEach((b, i) => {
    b.disabled = true;
    b.classList.remove("pending");
    if (hideExamResult) { if (i === it.picked) b.classList.add("chosen"); return; }
    if (i === it.correctIdx) b.classList.add("correct");
    if (i === it.picked && !it.correct) b.classList.add("wrong");
  });

  if (!hideExamResult) {
    const fb    = $("#feedback");
    const show  = cfg().autoHint === "always" || (cfg().autoHint === "wrong" && !it.correct);
    if (fb && show) {
      fb.className = `feedback ${it.correct ? "ok" : "no"}`;
      fb.innerHTML  = `<span class="verdict">${it.correct ? "✓ Richtig" : "✗ Leider falsch"}</span>`
                    + highlightText(it.q.explanation || "");
      appendLearningAid(fb, it.q);
      const theoryBtn = theoryButtonForQuestion(it.q, "feedback-link");
      if (theoryBtn) fb.appendChild(theoryBtn);
    } else if (fb) {
      fb.className = `feedback ${it.correct ? "ok" : "no"} minimal`;
      fb.innerHTML  = `<span class="verdict">${it.correct ? "✓ Richtig" : "✗ Falsch"}</span>`;
      appendLearningAid(fb, it.q);
      const theoryBtn = theoryButtonForQuestion(it.q, "feedback-link");
      if (theoryBtn) fb.appendChild(theoryBtn);
    }
    if (fb) fb.classList.remove("hidden");
  }
}

function restoreAnswered(it) {
  if (it.nav || it.picked == null) return;
  if (it.flashcard) {
    const answer = $("#flashAnswer");
    if (answer) answer.classList.remove("hidden");
    const reveal = $("#flashReveal");
    if (reveal) reveal.classList.add("hidden");
    APP.querySelectorAll(".flash-actions button").forEach((btn) => btn.disabled = true);
    const nb = $("#nextBtn");
    if (nb) nb.disabled = false;
    return;
  }
  paintAnswer(it);
  const nb = $("#nextBtn");
  if (nb) nb.disabled = false;
}

// ---------- Navigation --------------------------------------------------
function nextItem() {
  if (!session) return;
  const it = session.items[session.idx];
  // Lernmodus: Antwort ist Pflicht
  if (it && !it.nav && it.picked == null && session.mode === "learn") {
    toast("Bitte zuerst antworten");
    return;
  }
  // Bestätigungs-Modus: ausstehenden Klick finalisieren
  if (it && !it.nav && it.picked == null && it._pendingIdx != null) {
    commitAnswer(it, it._pendingIdx);
    return;
  }
  session.idx++;
  if (session.idx >= session.items.length) renderResult();
  else renderQuiz();
}

function confirmExit() {
  if (session?.mode === "exam" && session.items.some((i) => i.picked != null)) {
    if (!confirm("Prüfung wirklich abbrechen?")) return;
  }
  if (session?.returnTo === "search") { renderSearch(); return; }
  renderHome();
}

function markFlashcard(it, correct) {
  if (it.picked != null) return;
  it.revealed = true;
  it.picked = correct ? 1 : 0;
  it.correct = correct;
  recordAnswer(it.q.external_id, correct);
  APP.querySelectorAll(".flash-actions button").forEach((btn) => btn.disabled = true);
  const nb = $("#nextBtn");
  if (nb) { nb.disabled = false; nb.focus(); }
}

function renderFlashcard(it) {
  const box = el("div", { class: "flash-card" });
  const answer = el("div", { class: "flash-answer hidden", id: "flashAnswer" },
    el("p", { class: "section-label" }, "Amtliche Antwort"),
    el("div", { html: highlightText(it.q.explanation || "Keine Antwort hinterlegt.") }),
    el("div", { class: "flash-actions" },
      el("button", { class: "btn btn-ghost", onclick: () => speakText(it.q.explanation || "Keine Antwort hinterlegt.") }, "🔊 Vorlesen"),
      el("button", { class: "btn btn-ghost", onclick: () => markFlashcard(it, false) }, "Wiederholen"),
      el("button", { class: "btn btn-primary", onclick: () => markFlashcard(it, true) }, "Gewusst"),
    ),
  );
  const reveal = el("button", {
    class: "btn btn-primary",
    id: "flashReveal",
    onclick: () => {
      it.revealed = true;
      answer.classList.remove("hidden");
      reveal.classList.add("hidden");
    },
  }, "Antwort anzeigen");
  box.appendChild(reveal);
  box.appendChild(answer);
  return box;
}

// ---------- Navigations-Lernkarte (inline) ------------------------------
const CHART_SECTIONS = [
  "1: N53°46,06' E007°43,12' – N54°00,42' E008°00,00'",
  "2: N53°50,48' E007°57,54' – N54°05,24' E008°14,48'",
  "3: N53°53,36' E007°51,12' – N54°13,80' E008°15,00'",
  "4: N53°46,00' E007°49,00' – N54°06,00' E008°13,00'",
  "5: N53°43,00' E007°24,00' – N53°57,00' E007°55,00'",
  "6: N53°48,20' E007°24,00' – N54°08,54' E007°48,00'",
  "7: N53°54,24' E008°15,24' – N54°09,00' E008°32,12'",
  "8: N53°50,00' E008°04,00' – N54°01,00' E008°32,00'",
];

function renderNavCard(q) {
  const box = el("div", { class: "choices nav-card" });
  box.appendChild(el("p", { class: "nav-scenario" }, q.scenario || ""));

  const tasks = el("div", { class: "nav-tasks" });
  (q.subtasks || []).forEach((sub) => {
    const answerEl = el("div", { class: "nav-a hidden" }, sub.answer);
    const btn = el("button", { class: "btn btn-ghost nav-reveal", onclick: () => {
      const hidden = answerEl.classList.toggle("hidden");
      btn.textContent = hidden ? "Lösung anzeigen" : "Lösung verbergen";
    }}, "Lösung anzeigen");
    tasks.appendChild(
      el("div", { class: "nav-task" },
        el("div", { class: "nav-q", html: `<strong>${sub.n}.</strong> ${esc(sub.question)}` }),
        btn,
        answerEl,
      )
    );
  });
  box.appendChild(tasks);

  const det = el("details", { class: "nav-chart" },
    el("summary", {}, "Kartenausschnitte der amtlichen Übungskarte D49"),
  );
  const ul = el("ul");
  CHART_SECTIONS.forEach((s) => ul.appendChild(el("li", {}, s)));
  det.appendChild(ul);
  box.appendChild(det);
  box.appendChild(el("p", { class: "nav-note" }, q.explanation || ""));
  return box;
}

// ========================================================================
// TIMER
// ========================================================================
function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    const tm = $("#timer");
    if (!tm || !session?.deadline) return;
    const rem = Math.max(0, Math.round((session.deadline - Date.now()) / 1000));
    tm.textContent = fmtTime(rem);
    tm.classList.toggle("warn", rem <= 300);
    if (rem <= 0) { stopTimer(); toast("Zeit abgelaufen"); renderResult(); }
  }, 500);
}

function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

// ========================================================================
// ERGEBNIS
// ========================================================================
function renderResult() {
  stopTimer();
  TOPACTIONS.innerHTML = "";

  const mcItems = session.items.filter((it) => !it.nav && it.picked != null);
  const correct = mcItems.filter((it) => it.correct).length;
  const total   = mcItems.length;
  const acc     = total ? Math.round((correct / total) * 100) : 0;

  const view = el("div", { class: "view" });

  if (session.mode === "nav") {
    view.appendChild(
      el("div", { class: "result-card" },
        el("div", { class: "result-badge" }, "🧭"),
        el("h2", {}, "Navigationsaufgaben durchgearbeitet"),
        el("p",  { class: "qhint" }, "Übe diese Aufgaben mit der amtlichen Übungskarte D49."),
        resultActions(),
      )
    );
    APP.innerHTML = "";
    APP.appendChild(view);
    window.scrollTo(0, 0);
    return;
  }

  let badge = "🎉", title = "Lernrunde geschafft!";
  if (session.mode === "exam") {
    const r = session.rules ?? {};
    const basis = mcItems.filter((it) => it.q.category === "Basisfragen");
    const spec  = mcItems.filter((it) => it.q.category !== "Basisfragen");
    const bc = basis.filter((it) => it.correct).length;
    const sc = spec.filter((it)  => it.correct).length;
    const isSbf = (r.required_basis ?? 0) || (r.required_specific ?? 0);
    const passed = correct >= (r.required_total ?? 0)
      && (!isSbf || bc >= (r.required_basis ?? 0))
      && (!isSbf || sc >= (r.required_specific ?? 0));
    badge = passed ? "✅" : "❌";
    title = passed ? "Bestanden!" : "Noch nicht bestanden";
    const statTiles = isSbf
      ? [
          tile(`${bc}/${basis.length}`, "Basisfragen"),
          tile(`${sc}/${spec.length}`, "Spezifisch"),
          tile(acc + "%", "Trefferquote"),
        ]
      : [
          tile(`${correct}/${total}`, "Richtig"),
          tile(`${Math.max(0, (r.required_total ?? 0) - correct)}`, "Noch nötig"),
          tile(acc + "%", "Trefferquote"),
        ];
    view.appendChild(
      el("div", { class: "result-card" },
        el("div",  { class: "result-badge" }, badge),
        el("h2",   {}, title),
        el("div",  { class: "result-score", html: `${correct}<small> / ${total} richtig</small>` }),
        el("div",  { class: "result-stats" }, ...statTiles),
        el("p", { class: "qhint" }, `Bestehensgrenze: mind. ${r.required_total ?? 0} von ${total} richtig`),
        resultActions(),
      )
    );
  } else {
    if (acc < 60) { badge = "💪"; title = "Weiter üben!"; }
    else if (acc < 85) { badge = "👍"; title = "Gut gemacht!"; }
    view.appendChild(
      el("div", { class: "result-card" },
        el("div", { class: "result-badge" }, badge),
        el("h2",  {}, title),
        el("div", { class: "result-score", html: `${correct}<small> / ${total} richtig</small>` }),
        el("div", { class: "result-stats" },
          tile(acc + "%",            "Trefferquote"),
          tile("🔥 " + store.streak, "Serie"),
          tile(total - correct,      "Zu wiederholen"),
        ),
        resultActions(),
      )
    );
  }

  // Falsch beantwortete Fragen zum Nachlesen
  const wrong = mcItems.filter((it) => !it.correct);
  if (wrong.length) {
    const rev = el("div", { class: "review" }, el("h3", {}, `Zum Nachlesen (${wrong.length})`));
    wrong.slice(0, 30).forEach((it) => {
      rev.appendChild(
        el("div", { class: "review-item" },
          el("div", { class: "q" }, it.q.prompt),
          el("div", { class: "a" }, "Richtig: " + it.q.choices[it.q.correct_index]),
          el("div", { class: "e" }, it.q.explanation || ""),
        )
      );
    });
    view.appendChild(rev);
  }

  APP.innerHTML = "";
  APP.appendChild(view);
  window.scrollTo(0, 0);
}

function resultActions() {
  const wrap = el("div", { class: "result-actions" });
  if (session.mode === "exam") {
    wrap.appendChild(el("button", { class: "btn btn-primary", onclick: startExam }, "Neue Prüfung"));
  } else {
    const wrong = session.items.filter((it) => !it.nav && it.correct === false);
    if (wrong.length)
      wrap.appendChild(el("button", { class: "btn btn-primary", onclick: () => {
        session = { mode: "learn", items: wrong.map((it) => makeLearnItem(it.q)), idx: 0, deadline: null, rules: null };
        renderQuiz();
      }}, `Fehler wiederholen (${wrong.length})`));
    wrap.appendChild(el("button", { class: "btn btn-sea", onclick: () => startLearn(20) }, "Weiterlernen"));
  }
  wrap.appendChild(el("button", { class: "btn btn-ghost", onclick: renderHome }, "Zur Übersicht"));
  return wrap;
}

// ========================================================================
// KEYBOARD SHORTCUTS
// ========================================================================
document.addEventListener("keydown", (e) => {
  // Suche global (S ohne modifier)
  if (!session && e.key === "s" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (document.activeElement.tagName !== "INPUT") { e.preventDefault(); renderSearch(); }
    return;
  }
  if (!session) return;

  const it = session.items[session.idx];
  if (!it) return;

  if (e.key === "Escape") { confirmExit(); return; }

  if (e.key === "Enter" || e.key === "ArrowRight") {
    const nb = $("#nextBtn");
    if (nb && !nb.disabled) { e.preventDefault(); nextItem(); }
    return;
  }

  // Antwort per 1–4 oder A–D
  if (!it.nav && it.picked == null) {
    let idx = -1;
    if (/^[1-4]$/.test(e.key)) idx = parseInt(e.key, 10) - 1;
    else if (/^[a-dA-D]$/.test(e.key)) idx = e.key.toLowerCase().charCodeAt(0) - 97;
    if (idx >= 0 && idx < it.order.length) {
      e.preventDefault();
      const btns = APP.querySelectorAll(".choice");
      handleAnswer(it, idx, btns[idx]);
    }
  }

  // Lesezeichen
  if (e.key === "b" && !it.nav && session.mode !== "exam") {
    e.preventDefault();
    const now = toggleBookmark(it.q.external_id);
    toast(now ? "Frage gemerkt 🔖" : "Lesezeichen entfernt");
    const bmBtn = $(".btn-icon.bookmarked, .btn-icon[title*='merken']");
    if (bmBtn) bmBtn.classList.toggle("bookmarked", now);
  }
});

// ========================================================================
// TOPBAR – Brand-Logo
// ========================================================================
document.getElementById("brand").addEventListener("click", () => {
  if (session?.mode === "exam" && session.items.some((it) => it.picked != null)) {
    if (!confirm("Prüfung verlassen?")) return;
  }
  renderHome();
});

// Suche-Button in Topbar aktivieren (globale Suche)
document.getElementById("brand").insertAdjacentElement("afterend",
  el("button", { class: "btn-icon topbar-search", title: "Suchen (S)", onclick: renderSearch, "aria-label": "Suchen" }, "🔎"),
);

// ========================================================================
// SERVICE WORKER
// ========================================================================
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// ========================================================================
// BOOT
// ========================================================================
(async function boot() {
  APP.appendChild(
    el("div", { class: "qcard" },
      el("p", { class: "qhint", style: "text-align:center;padding:24px" }, "Lade Fragenkatalog …"),
    )
  );
  await loadCatalog();
  if (CATALOG.length) renderHome();
})();
