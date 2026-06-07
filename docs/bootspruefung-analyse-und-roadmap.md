# Wettbewerbsanalyse bootspruefung.de + Roadmap für Boatiboat

Analyse der Android-App **`de.sbfbinnen.app`** (bootspruefung.de), App-Version **7.2.5**,
live per WLAN-ADB auf einem Xiaomi 2311DRK48G untersucht (Stand: Juni 2026).
Ziel: Boatiboat funktional auf denselben Stand bringen, die kostenpflichtigen
PRO-Funktionen günstiger anbieten und am Ende mehr Wert liefern als bootspruefung.de.

---

## 1. Funktionsumfang bootspruefung.de (vollständige Bestandsaufnahme)

### 1.1 Abgedeckte Scheine (7 Stück – ein kompletter Bootsschein-Verlag)
- **SBF-Binnen** (Motor & Segel, Variante wählbar) – 300 Fragen, 15 amtliche Prüfungsbögen
- **SBF-See** – 300 Fragen
- **Bodenseeschifferpatent (BSP)**
- **Binnenfunkzeugnis UBI** – 180 Fragen
- **Seefunkzeugnis SRC (Voll/…)** – 180 Fragen, 12 amtliche Prüfungsbögen
- **Seefunkzeugnis LRC**
- **Pyroschein FKN** (pyrotechnische Seenotsignale)

### 1.2 Pro Schein: Theorie-Trainer
- **Kategorien** – Lernen nach Themenkategorien
- **Prüfungsmodus** – alle amtlichen Original-Prüfungsbögen (z. B. 15 Binnen, 12 SRC)
- **Gemerkte Fragen** (Lesezeichen) – *PRO*
- **Falsch beantwortete Fragen** (Fehler-Wiederholung) – *PRO*
- **Fragenkatalog durchsuchen** (Volltextsuche über alle Fragen) – *PRO*
- **Schein-Variante** umschaltbar (z. B. Motor & Segel)

### 1.3 Theoretische Grundlagen
- **Virtuelles Lehrbuch** – vollständiges, **illustriertes** Theoriebuch je Schein,
  durchsuchbar, **als PDF herunterladbar/druckbar**. SBF-Binnen: 7 Kapitel mit ~40
  Abschnitten (Recht, Motorboot, Verkehrskunde inkl. Lichter/Schallsignale/Betonnung,
  Seemannschaft, Wetterkunde, Segeln …). Voller Zugriff = *PRO*.
- **„Weg zur Prüfung"** – Leitfaden: Zulassung, Anmeldung, Durchführung, Wiederholung.

### 1.4 Praktische Prüfung
- **Knoten** – alle prüfungsrelevanten Knoten (Anleitungen) – *PRO*
- **Funkscheine zusätzlich:**
  - **Diktat-Aufgaben** – englischer Funktext wird **vorgelesen**, muss übersetzt werden – *PRO*
  - **Übersetzungs-Aufgaben** – deutschen Funktext schriftlich ins Englische – *PRO*
  - **Vokabel-Liste** – alle Vokabeln zum **Nachlesen und Anhören** – *PRO*
  - **Muster-Funksprüche** für die praktische Prüfung
  - **Buchstabiertafel**
- **FKN:** **KI-Auswertung** des Notsignal-Verfahrens – *PRO*

### 1.5 Konto & Sync
- **Einloggen/Registrieren** → **Online-Synchronisation des Lernfortschritts** über Geräte
- Push-**Benachrichtigungen**

### 1.6 Einstellungen
- Speicherstände zurücksetzen
- Schein-Einstellungen (Variante je Schein)
- Quiz: **„Jede Antwort vor der Auswertung bestätigen"** (gegen Fehltaps)
- Quiz: **„Im Prüfungsmodus erst am Schluss Ergebnis zeigen"**
- **Schlüsselwörter-Hervorhebung** in Fragen – *PRO*
- **Hinweise automatisch aufklappen** (immer / nur bei Fehlern / nie) – *PRO*
- **KI-Auswertung im FKN** – *PRO*
- **Farbenblind-Modus** (kräftigere Rot/Grün-Töne)
- **Dark Mode** (hell / dunkel / System)
- **Offline-Verfügbarkeit**: Download aller Fragen + Lehrbuch je Schein – *PRO*

### 1.7 Shop & Infos (Content/Community)
- Artikelsammlung, „Bootsführerschein in der Nähe", **Ausbildungsstätten-Verzeichnis**,
  FAQ, Blog, Newsletter, Social (Facebook-Lerngruppe, Instagram, TikTok, YouTube),
  Über uns, Jobs, „Für Bootsschulen" (Mengenrabatt), Impressum, Datenschutz, Kontakt.

---

## 2. Preis- / Geschäftsmodell bootspruefung.de

**Einmalkauf** (kein Abo), zeitlich unbegrenzt, **auf beliebig vielen Geräten** nutzbar.

| Produkt | Preis |
|---|---|
| **Alle Scheine** | **78,90 €** (−51 %) |
| Alle Bootsführerscheine (Binnen, See, Bodensee) | 48,90 € (−36 %) |
| Alle Funkscheine (UBI, SRC, LRC) | 38,90 € (−42 %) |
| SBF-See | 28,90 € |
| SBF-Binnen | 28,90 € |
| SRC | 28,90 € |
| Bodensee / UBI / LRC / Pyroschein FKN | je 18,90 € |

**Free-Tier** = Fragen üben (Kategorien, Prüfungsbögen), Lehrbuch ansehen, „Weg zur Prüfung".
**PRO schaltet frei:** Offline-Download, **Lernfortschritts-Anzeige**, voller Lehrbuch-Zugriff,
Lesezeichen, Fehler-Wiederholung, Suche, Knoten, Funk-Diktat/Übersetzung/Vokabeln, KI-FKN,
Schlüsselwort-Hervorhebung, Auto-Hinweise.

---

## 3. Wo Boatiboat schon gleichauf oder besser ist

| Funktion | bootspruefung.de | Boatiboat (aktuell) |
|---|---|---|
| Lernfortschritt anzeigen | **PRO (kostenpflichtig)** | **gratis** ✅ |
| Offline nutzen | **PRO (kostenpflichtig)** | **gratis** (PWA + Offline-APK) ✅ |
| Fehler gezielt wiederholen | **PRO** | **gratis** („Nur Schwächen") ✅ |
| Spaced Repetition | nein (klassisch) | **ja** ✅ |
| Statistik nach Themen | rudimentär | **Dashboard mit Themen-Balken** ✅ |
| Navigationsaufgaben mit amtl. Lösungen | ja (PRO-Download) | **ja, als Lernkarten** ✅ |

→ **Positionierung:** „Alles, was bei bootspruefung.de PRO kostet – bei uns ohne Aufpreis,
plus echtes Spaced-Repetition-Lernen." Das ist unser stärkstes Verkaufsargument.

---

## 4. Lücken von Boatiboat ggü. bootspruefung.de

1. Nur 2 Scheine (See/Binnen) statt 7.
2. Kein **virtuelles Lehrbuch** / Theorietexte.
3. Keine **Kategorien-Lernfunktion** (nur Statistik, kein kategoriefiltriertes Üben).
4. Keine **amtlichen Original-Prüfungsbögen** als feste Sätze (wir würfeln zufällig).
5. Keine **Lesezeichen / gemerkte Fragen**.
6. Keine **Volltextsuche**.
7. Keine **Knoten**-Anleitungen.
8. Keine **Funkschein-Inhalte** (Diktat/Audio/Vokabeln/Funksprüche/Buchstabiertafel).
9. Kein **Dark Mode**, kein **Farbenblind-Modus**, keine Quiz-Optionen (Antwort bestätigen, Ergebnis erst am Schluss).
10. Kein **„Weg zur Prüfung"**-Leitfaden.
11. Kein **Konto / Cross-Device-Sync** (bewusst lokal – optional nachrüstbar).
12. Keine **Schlüsselwort-Hervorhebung**, keine Auto-Hinweise.
13. Keine **Content-/Community-Sektion** (FAQ, Blog, Bootsschulen, Social).
14. Keine **Kauf-/Lizenz-Logik** (Free vs. PRO Freischaltung, Store-Billing).

---

## 5. Roadmap – Boatiboat wertvoller machen als bootspruefung.de

Priorisiert in Phasen. „Aufwand" = grobe Schätzung (S/M/L).

### Phase 0 – Schnelle Gleichstands-Gewinne (1–2 Wochen)
- [x] **Dark Mode** (hell/dunkel/System) – CSS-Variablen sind vorhanden, nur Theme-Switch + Speicherung. **(S)**
- [x] **Farbenblind-Modus** (kräftigere/alternative Rot-Grün-Töne, Muster/Icons statt nur Farbe). **(S)**
- [x] **Quiz-Einstellungen**: „Antwort vor Auswertung bestätigen", „im Prüfungsmodus Ergebnis erst am Schluss" (Letzteres haben wir schon – als Option ausweisen). **(S)**
- [x] **Kategorien-Lernmodus**: pro Kategorie üben (Daten sind da, nur Auswahl-UI + Filter). **(S)**
- [x] **Lesezeichen / gemerkte Fragen** (lokal, gratis – schlägt deren PRO). **(S)**
- [x] **Volltextsuche** über alle Fragen/Antworten (lokal, gratis). **(S)**
- [x] **Schlüsselwörter-Hervorhebung** in Frage/Antwort (gratis). **(M)**
- [x] **„Weg zur Prüfung"**-Infoseite je Schein (statischer Text). **(S)**
  - [x] SBF See, SBF Binnen, FKN, SRC, LRC und UBI abgedeckt.

### Phase 1 – Inhaltliche Tiefe (Kernwert) (3–6 Wochen)
- [x] **Amtliche Original-Prüfungsbögen** als feste Sätze hinterlegen (zusätzlich zum Zufallsbogen), damit „1:1 wie in der Prüfung" stimmt. Quelle: ELWIS-Bogenstruktur. **(M)**
  - [x] Infrastruktur umgesetzt: feste Prüfungsbögen per API und UI-Auswahl (`see-01` … `see-15`, `binnen-01` … `binnen-15`).
  - [x] Echte ELWIS-Originalsatz-Zuordnung für SBF See und SBF Binnen unter Antriebsmaschine hinterlegt.
- [ ] **Virtuelles Lehrbuch** (illustrierte Theorietexte) für See & Binnen, kapitelweise, durchsuchbar, mit Sprungmarken aus Fragen → „mehr dazu im Lehrbuch". **(L)**
  - [x] Erste Lehrbuch-Infrastruktur umgesetzt: Kapitel-/Abschnittsansicht für See & Binnen mit lokaler Suche.
  - [ ] Inhalte vollständig ausarbeiten, illustrieren und fachlich gegenprüfen.
  - [x] PDF-Export ergänzen.
    - [x] Druck-/PDF-Ansicht für das Lehrbuch ergänzt; Browser kann daraus „Als PDF speichern".
  - Inhalte aus freien/eigenen Quellen erstellen (kein Urheberrechtsverstoß), an die ELWIS-Themen angelehnt.
  - Optional **PDF-Export** des Lehrbuchs.
- [x] **Frage → Theorie-Verknüpfung**: jede Frage verlinkt auf den passenden Lehrbuch-Abschnitt. **(M)** (klarer Mehrwert ggü. bootspruefung.de)
  - [x] Erste Zuordnung umgesetzt: Fragen werden anhand von Schein, Kategorie und Schlüsselwörtern auf passende Lehrbuchabschnitte geroutet.
  - [ ] Später durch feingranulare, redaktionell geprüfte Abschnitts-IDs pro Frage ersetzen.
- [x] **Knoten-Modul** (animierte/Schritt-für-Schritt-Knoten für SBF). **(M)**
  - [x] Erste Knotenansicht mit Zweck, Schritten und Prüfpunkten umgesetzt.
  - [ ] Animationen/Illustrationen später ergänzen.

### Phase 2 – Scheine erweitern (parallelisierbar, je M–L)
- [ ] **Bodenseeschifferpatent** (Fragenkatalog integrieren).
  - [x] Behördenhinweis zum neuen Fragenkatalog recherchiert und als Referenzquelle erfasst.
  - [ ] Offiziellen, frei nutzbaren Behördenkatalog oder Genehmigung beschaffen; keine Drittanbieter-Abschrift importieren.
- [ ] **Funkscheine UBI / SRC / LRC**: Fragen + **Funk-Module**:
  - [x] Amtliche/behördennahe Katalogquellen für SRC, LRC und UBI abgerufen und mit Prüfsummen manifestiert.
  - [x] Parser/Importer für SRC, LRC und UBI gebaut und als Lernkataloge freigeschaltet.
  - [x] Zufalls-Prüfungssimulation für SRC, LRC und UBI mit Zeitlimit und Bestehensgrenzen ergänzt.
  - [ ] Amtliche feste Funk-Prüfungsbögen importieren, sobald belastbare Bogenverteilungen vorliegen.
  - [x] Muster-Funksprüche, Buchstabiertafel und UBI-Verkehrskreise als Funkpraxis-Modul ergänzt.
  - [x] **Vokabel-Liste mit Audio** per Browser-TTS ergänzt.
  - [x] Erste **Diktat-/Übersetzungsaufgaben** mit vorgelesenem englischem Funktext und Schlüsselwortprüfung ergänzt.
- [ ] **Pyroschein FKN** + ggf. **KI-Auswertung** des Notruf-Verfahrens (Sprach-/Texteingabe → Feedback). *Differenzierungs-Feature.*
  - [x] FKN Fragen- und Antwortenkatalog vom gemeinsamen Sportbootführerschein-Portal abgerufen und mit Prüfsumme manifestiert.
  - [x] FKN-PDF-Importer gebaut und 60 amtliche Frage-/Antwort-Flashcards strukturiert abgelegt.
  - [x] FKN-Lernmodus und Prüfungssimulation mit den 4 amtlichen Fragebögen freigeschaltet.
  - [x] Praktische Handhabungsaufgaben als sichere Selbstcheck-Karten ergänzt.
  - [ ] Teilpunkte-/Freitextbewertung und KI-Feedback ergänzen.

### Phase 3 – Monetarisierung & Konto (parallel ab Phase 1)
- [ ] **Free/PRO-Logik** definieren. Empfehlung: **mehr gratis als der Wettbewerb**
      (Lernfortschritt, Offline, Fehler-Wiederholung, Lesezeichen, Suche bleiben **gratis**),
      PRO = Lehrbuch-Vollzugriff + PDF, Knoten, Funk-Audio/Diktat, KI-FKN, erweiterte Statistik.
- [ ] **Preis-Positionierung (günstiger als bootspruefung.de):**
  | Produkt | bootspruefung.de | **Boatiboat (Vorschlag)** |
  |---|---|---|
  | SBF-See / SBF-Binnen einzeln | 28,90 € | **19,90 €** |
  | Bootsführerscheine (See+Binnen+BSP) | 48,90 € | **29,90 €** |
  | Alle Scheine | 78,90 € | **49,90 €** |
  - Einmalkauf, kein Abo, alle Geräte – wie Wettbewerb, aber klar günstiger. Optional Einführungs-/Bootsschul-Rabatt.
- [ ] **Store-Billing**: Google Play Billing (Android) + Web-Bezahlung (z. B. Stripe) mit
      Lizenz-Code/Account-Freischaltung. **(L)**
- [ ] **Optionales Konto + Cross-Device-Sync** (E-Mail-Login, Fortschritt + Käufe).
      Lokal-first bleibt Default; Sync ist opt-in. **(L)**

### Phase 4 – Mehr Wert als bootspruefung.de (Differenzierung)
- [x] **Adaptiver Prüfungs-Readiness-Score** („Du bist zu 87 % prüfungsbereit", Prognose pro Kategorie).
  - [x] Dashboard-Score aus gemeisterten Fragen, Trefferquote, Katalogabdeckung und schwächsten Themen umgesetzt.
- [ ] **Tagesziel / Streak / Erinnerungen** (Push/Local Notifications, Lern-Gewohnheit).
  - [x] Lokales Tagesziel mit Fortschrittsbalken und einstellbarer Zielhöhe umgesetzt.
  - [x] Tagesziel-Streak mit aktivem Serienstand und Bestwert ergänzt.
  - [ ] Push-/Local-Notifications ergänzen.
- [x] **Erklärungen aufwerten**: kurze, verständliche Begründung **+ Eselsbrücken** je Frage.
  - [x] Erste Lernhilfe im Quizfeedback ergänzt: Grundidee, Merksatz und korrekte Antwort als Anker.
  - [ ] Später redaktionell pro Frage verfeinern.
- [x] **Audio-Vorlesen** von Fragen/Theorie (Barrierefreiheit, Lernen unterwegs).
  - [x] Browser-TTS für Lernfragen, FKN-Antwortkarten und Lehrbuchabschnitte ergänzt.
- [ ] **Echte Navigationsaufgaben-Übung**: interaktive Kursdreieck-/Besteck-Tools statt nur Lösungsanzeige (großer Vorteil ggü. reinem „Siehe Karte").
- [ ] **Web + iOS**: PWA ist da; native iOS-Hülle (wie Android) ergänzen.
- [ ] **Content/Community light**: FAQ, „Weg zur Prüfung", Bootsschul-Finder-Link – als Vertrauens-/SEO-Booster.
  - [x] FAQ-/Vertrauensseite mit Quellen-, Datenschutz-, Lernstrategie- und Roadmap-Hinweisen ergänzt.
  - [x] Neutrale Verweislogik zu DMYV-Ausbildungsstätten, DMYV-Prüfungsausschüssen und DSV/Sportboot-Portal ergänzt.
- [ ] **Barrierefreiheit & Qualität**: WCAG-Kontraste, Tastatur/Screenreader (Web), saubere Skalierung – Verkaufsargument „beste UX".
  - [x] Erste A11y-Basis ergänzt: Skip-Link, sichtbare Fokusrahmen, Toast-Live-Region sowie ARIA-Zustände für Fortschritt und Lesezeichen.
  - [ ] Vollständigen WCAG-/Screenreader-Audit später durchführen.

---

## 6. Empfohlene Reihenfolge (Kurzfassung)
1. **Phase 0** (schnelle Gratis-Features, die deren PRO schlagen) → sofortiges Marketing-Argument.
2. **Lehrbuch + Frage-Verknüpfung + Original-Bögen** (Phase 1) → inhaltliche Augenhöhe.
3. **Monetarisierung/Preise** (Phase 3) parallel scharf schalten.
4. **Scheine erweitern** (Phase 2) nach Nachfrage (zuerst Funk SRC/UBI – hohe Nachfrage).
5. **Differenzierer** (Phase 4) für „wertvoller als bootspruefung.de".
