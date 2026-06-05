from sqlalchemy import select

from .database import Base, engine, session_scope
from .models import Question
from .services import upsert_questions


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
    },
]


def init_db(seed: bool = True) -> int:
    Base.metadata.create_all(bind=engine)
    if not seed:
        return 0
    with session_scope() as session:
        if session.scalar(select(Question.id).limit(1)):
            return 0
        return upsert_questions(session, SAMPLE_QUESTIONS)
