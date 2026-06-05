# Boatiboat SBF Trainer

Interaktive Lern-Webapp fuer den deutschen Sportbootfuehrerschein Binnen und See.
Die App trennt KI-Erklaerungen bewusst vom Live-Betrieb: Erklaerungen werden einmalig
pregeneriert und danach nur noch schnell aus SQLite ausgeliefert.

## Bestandteile

- FastAPI Backend mit SQLite und SQLAlchemy
- Statische mobile-first Weboberflaeche
- JSON- und CSV-Import fuer Fragenkataloge
- Lernmodus mit sofortiger Erklaerung
- Pruefungsmodus mit Zeitlimit
- Einfaches Spaced-Repetition-Scoring
- LiteLLM-Skript zur Vorab-Erzeugung fehlender Erklaerungen

## Lokal starten

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload
```

Dann `http://127.0.0.1:8000` oeffnen.

## Erklaerungen pregenerieren

```powershell
$env:LITELLM_MODEL="ollama/gemma3:27b"
.venv\Scripts\python -m pip install -r requirements-ai.txt
.venv\Scripts\python scripts\pregenerate_explanations.py --limit 20
```

Fuer gehostete Modelle werden die jeweiligen LiteLLM-Umgebungsvariablen gesetzt,
zum Beispiel API Keys fuer Gemini/OpenAI-kompatible Provider.

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
    "explanation": "Vorab erzeugte Erklaerung"
  }
]
```

CSV nutzt dieselben Spalten. `choices` koennen mit `|` getrennt werden.
