# Boatiboat SBF Trainer

Interaktive Lern-Webapp fuer den deutschen Sportbootfuehrerschein Binnen und See.
Die App nutzt die amtlichen ELWIS-Fragenkataloge und liefert Erklaerungen statisch
aus der Datenbank aus. Es gibt keine Live-KI und keine LLM-Abhaengigkeit im Projekt.

## Bestandteile

- FastAPI Backend mit SQLite und SQLAlchemy
- Statische mobile-first Weboberflaeche
- JSON- und CSV-Import fuer Fragenkataloge
- Lernmodus mit sofortiger Erklaerung
- Pruefungsmodus mit Zeitlimit
- Pruefungsmodus nutzt feste amtliche Bogenform statt frei waehlbarer Fragenzahl
- Einfaches Spaced-Repetition-Scoring
- Moderne, responsive Single-Page-Oberflaeche (Dashboard, Statistik, Themen-Fortschritt)
- Lernfortschritt wird ohne Login lokal im Browser gespeichert (localStorage)
- Lernmodus mit Schnellrunden (10/25/50) oder komplettem Durchlauf aller Fragen
- Spaced Repetition: neue und falsch beantwortete Fragen kommen haeufiger
- Installierbare PWA mit Service Worker (Website funktioniert nach Erstbesuch offline)
- Android-App buendelt alle Inhalte und funktioniert vollstaendig ohne Internet
- Antwortreihenfolge wird pro Session gemischt
- Frageauswahl und -reihenfolge werden pro Session zufaellig gemischt
- Amtliche Grafiken (Lichter, Tonnen, Tagzeichen, Flaggen, Schallzeichen) werden
  aus den PDFs extrahiert und den Fragen zugeordnet
- Die 15 amtlichen See-Navigationsaufgaben werden als Lernkarten mit Szenario,
  Teilaufgaben und amtlichen Loesungen dargestellt
- Quellenstand wird in API und UI pro Session angezeigt
- ELWIS-Sync-Skript fuer die amtlichen PDF-Kataloge inkl. Bild- und Navigationsextraktion

## Navigationsaufgaben und Uebungskarte D49

Die See-Navigationsaufgaben werden in der amtlichen Pruefung an der **Uebungskarte
D49 (Muendungen der Jade, Weser und Elbe)** bearbeitet. Diese Karte ist
urheberrechtlich geschuetzt (BSH) und im Fachhandel erhaeltlich; sie darf nicht
mitgeliefert werden. Boatiboat zeigt die 15 Aufgaben mit allen Teilaufgaben und
den amtlichen Loesungen als Lernkarten sowie die acht Kartenausschnitt-Koordinaten
der D49. Erzeugt werden Bilder und Navigationskarten mit:

```powershell
.venv\Scripts\python scripts\extract_catalog_images.py
.venv\Scripts\python scripts\extract_nav_tasks.py
```

Beide werden auch vom Sync-Skript automatisch aufgerufen.

## Quellenstand

Aktuell eingelesen:

- ELWIS Fragenkatalog See, anzuwenden ab 01. August 2023, Stand 01. August 2023
- ELWIS Fragenkatalog Binnen, anzuwenden ab 01. August 2023, Stand 01. August 2023

Die amtlichen PDFs enthalten selbst den Hinweis, dass im Katalog immer Antwort a
richtig ist. Boatiboat mischt die Antworten daher beim Ausspielen und berechnet
den korrekten Index neu.

## Amtliche Pruefungsform

- SBF Binnen Motor: 30 Fragen, davon 7 Basisfragen und 23 spezifische Binnen-Fragen, 45 Minuten.
- SBF See: 30 Multiple-Choice-Fragen, davon 7 Basisfragen und 23 spezifische See-Fragen, plus eine Navigationsaufgabe mit 9 Teilaufgaben, 60 Minuten.
- In beiden MC-Bogen muessen mindestens 24 von 30 Fragen richtig sein; dabei mindestens 5 von 7 Basisfragen und 18 von 23 spezifischen Fragen. Bei SBF See muessen zusaetzlich mindestens 7 von 9 Navigationsteilaufgaben richtig sein.

## Lokal starten

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload
```

Dann `http://127.0.0.1:8000` oeffnen.

## Android-App bauen

Die Android-App ist eine native WebView-Huelle um die Live-App:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_android.ps1
```

Das erzeugt `build\android\boatiboat-debug.apk`.

## Amtliche Kataloge synchronisieren

```powershell
.venv\Scripts\python scripts\sync_elwis_catalogs.py
```

Das Skript schreibt `app/official_catalog.json`. Die generischen Erklaerungen
werden deterministisch aus Frage, richtiger Antwort und Themenbereich erzeugt;
ausgewaehlte Navigations- und Regelthemen haben handgeschriebene Erklaerungen.

## Katalogformat

JSON:

```json
[
  {
    "external_id": "SEE-001",
    "license_type": "see",
    "category": "Navigation",
    "prompt": "Fragetext",
    "choices": ["Antwort A", "Antwort B", "Antwort C"],
    "correct_index": 0,
    "explanation": "Vorab erzeugte Erklaerung",
    "source_name": "ELWIS Fragenkatalog See",
    "source_url": "https://www.elwis.de/...",
    "source_stand": "01. August 2023"
  }
]
```

CSV nutzt dieselben Spalten. `choices` koennen mit `|` getrennt werden.
