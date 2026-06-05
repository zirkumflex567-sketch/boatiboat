import json
from pathlib import Path

from sqlalchemy import select

from .database import Base, engine, ensure_sqlite_columns, session_scope
from .models import Question
from .services import upsert_questions


ELWIS_SEE_URL = "https://www.elwis.de/DE/Sportschifffahrt/Sportbootfuehrerscheine/Fragenkatalog-See/Fragenkatalog-See-August-2023.pdf?__blob=publicationFile&v=13"
ELWIS_BINNEN_URL = "https://www.elwis.de/DE/Sportschifffahrt/Sportbootfuehrerscheine/Fragenkatalog-Binnen/Fragenkatalog-Binnen-August-2023.pdf?__blob=publicationFile&v=8"
SOURCE_STAND = "01. August 2023"


SAMPLE_QUESTIONS = [
    {
        "external_id": "SEE-001",
        "license_type": "see",
        "category": "Ausweichregeln",
        "prompt": "Zwei Maschinenfahrzeuge laufen sich auf entgegengesetzten Kursen entgegen. Was ist zu tun?",
        "choices": [
            "Beide Fahrzeuge ändern ihren Kurs nach Steuerbord.",
            "Das schnellere Fahrzeug hält Kurs und Fahrt bei.",
            "Beide Fahrzeuge ändern ihren Kurs nach Backbord.",
            "Nur das kleinere Fahrzeug weicht aus.",
        ],
        "correct_index": 0,
        "explanation": "Bei Gegenkursen zwischen Maschinenfahrzeugen müssen beide rechtzeitig nach Steuerbord ausweichen. So wird die Begegnung klar und vorhersehbar: Die Fahrzeuge passieren einander Backbord an Backbord.",
        "source_name": "ELWIS Fragenkatalog See",
        "source_url": ELWIS_SEE_URL,
        "source_stand": SOURCE_STAND,
        "exam_section": "Basis/Spezifisch",
    },
    {
        "external_id": "SEE-002",
        "license_type": "see",
        "category": "Navigation",
        "prompt": "Was bedeutet die Missweisung in der Navigation?",
        "choices": [
            "Der Winkel zwischen rechtweisend Nord und magnetisch Nord.",
            "Der Abstand zwischen zwei Breitenkreisen.",
            "Die Abweichung durch Stromversatz.",
            "Die Geschwindigkeit über Grund.",
        ],
        "correct_index": 0,
        "explanation": "Die Missweisung ist der Winkel zwischen geografischem Nord und magnetischem Nord. Sie ist wichtig, weil der Magnetkompass magnetisch Nord anzeigt, Seekartenkurse aber rechtweisend angegeben werden.",
        "source_name": "ELWIS Fragenkatalog See",
        "source_url": ELWIS_SEE_URL,
        "source_stand": SOURCE_STAND,
        "exam_section": "Navigation",
        "image_url": "/assets/graphics/navigation-card.svg",
        "image_alt": "Schematische Seekarten- und Kursdarstellung",
    },
    {
        "external_id": "BINNEN-001",
        "license_type": "binnen",
        "category": "Schallsignale",
        "prompt": "Was bedeutet ein kurzer Ton in der Binnenschifffahrt?",
        "choices": [
            "Ich richte meinen Kurs nach Steuerbord.",
            "Ich richte meinen Kurs nach Backbord.",
            "Meine Maschine geht rückwärts.",
            "Ich bin manövrierunfähig.",
        ],
        "correct_index": 0,
        "explanation": "Ein kurzer Ton kündigt auf Binnengewässern eine Kursänderung nach Steuerbord an. Das Signal beschreibt die eigene Absicht, damit andere Fahrzeuge die Bewegung früh erkennen.",
        "source_name": "ELWIS Fragenkatalog Binnen",
        "source_url": ELWIS_BINNEN_URL,
        "source_stand": SOURCE_STAND,
        "exam_section": "Basis/Spezifisch",
    },
    {
        "external_id": "BINNEN-002",
        "license_type": "binnen",
        "category": "Fahrwasser",
        "prompt": "Wie verhält man sich in einem engen Fahrwasser grundsätzlich?",
        "choices": [
            "So weit wie möglich rechts fahren.",
            "Immer in der Mitte fahren.",
            "Sportboote haben dort grundsätzlich Vorfahrt.",
            "Nur bei Gegenverkehr ausweichen.",
        ],
        "correct_index": 0,
        "explanation": "In engen Fahrwassern gilt Rechtsfahrgebot. Wer früh rechts fährt, macht die eigene Absicht deutlich und lässt Berufsschifffahrt sowie Gegenverkehr genügend Raum.",
        "source_name": "ELWIS Fragenkatalog Binnen",
        "source_url": ELWIS_BINNEN_URL,
        "source_stand": SOURCE_STAND,
        "exam_section": "Basis/Spezifisch",
    },
]


def load_catalog_records() -> list[dict]:
    catalog = Path(__file__).resolve().parent / "official_catalog.json"
    if catalog.exists():
        return json.loads(catalog.read_text(encoding="utf-8"))
    return SAMPLE_QUESTIONS


def init_db(seed: bool = True) -> int:
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_columns()
    if not seed:
        return 0
    with session_scope() as session:
        records = load_catalog_records()
        return upsert_questions(session, records)
