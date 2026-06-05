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
- Einfaches Spaced-Repetition-Scoring
- Antwortreihenfolge wird pro Session gemischt
- Quellenstand wird in API und UI pro Session angezeigt
- ELWIS-Sync-Skript fuer die amtlichen PDF-Kataloge

## Quellenstand

Aktuell eingelesen:

- ELWIS Fragenkatalog See, anzuwenden ab 01. August 2023, Stand 01. August 2023
- ELWIS Fragenkatalog Binnen, anzuwenden ab 01. August 2023, Stand 01. August 2023

Die amtlichen PDFs enthalten selbst den Hinweis, dass im Katalog immer Antwort a
richtig ist. Boatiboat mischt die Antworten daher beim Ausspielen und berechnet
den korrekten Index neu.

## Lokal starten

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload
```

Dann `http://127.0.0.1:8000` oeffnen.

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
