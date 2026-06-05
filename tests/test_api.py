import os
import tempfile

os.environ["BOATIBOAT_DATA_DIR"] = tempfile.mkdtemp(prefix="boatiboat-test-")

from fastapi.testclient import TestClient

from app.database import Base, engine, session_scope
from app.main import app
from app.models import Question, Progress


client = TestClient(app)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed_questions():
    with session_scope() as session:
        session.add_all(
            [
                Question(
                    external_id="see-1",
                    license_type="see",
                    category="Ausweichregeln",
                    prompt="Wer ist ausweichpflichtig?",
                    choices=["Segler", "Maschinenfahrzeug", "Beide"],
                    correct_index=1,
                    explanation="Ein Maschinenfahrzeug muss einem Segelfahrzeug ausweichen.",
                ),
                Question(
                    external_id="binnen-1",
                    license_type="binnen",
                    category="Schallsignale",
                    prompt="Was bedeutet ein langer Ton?",
                    choices=["Achtung", "Backbord", "Stopp"],
                    correct_index=0,
                    explanation="Ein langer Ton macht andere Verkehrsteilnehmer aufmerksam.",
                ),
            ]
        )


def test_lists_questions_with_stored_explanations():
    seed_questions()

    response = client.get("/api/questions?license_type=see")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["external_id"] == "see-1"
    assert data[0]["explanation"].startswith("Ein Maschinenfahrzeug")


def test_answer_updates_progress_and_returns_explanation():
    seed_questions()

    response = client.post(
        "/api/answer",
        json={"question_id": 1, "selected_index": 0, "mode": "learn"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["is_correct"] is False
    assert result["correct_index"] == 1
    assert "Segelfahrzeug" in result["explanation"]

    with session_scope() as session:
        progress = session.query(Progress).filter_by(question_id=1).one()
        assert progress.wrong_count == 1
        assert progress.box == 1


def test_learning_queue_prioritizes_wrong_answers():
    seed_questions()
    client.post("/api/answer", json={"question_id": 1, "selected_index": 0, "mode": "learn"})

    response = client.get("/api/session?mode=learn&license_type=see&limit=5")

    assert response.status_code == 200
    data = response.json()
    assert data["questions"][0]["external_id"] == "see-1"
    assert data["questions"][0]["priority"] > 1


def test_import_accepts_json_catalog_records():
    payload = [
        {
            "external_id": "SBF-42",
            "license_type": "see",
            "category": "Navigation",
            "prompt": "Was zeigt eine Seekarte?",
            "choices": ["Tiefen und Seezeichen", "Nur Hafennamen", "Nur Wetter"],
            "correct_index": 0,
            "explanation": "Seekarten zeigen nautisch relevante Informationen.",
        }
    ]

    response = client.post("/api/import/json", json=payload)

    assert response.status_code == 200
    assert response.json()["imported"] == 1
    assert client.get("/api/questions").json()[0]["external_id"] == "SBF-42"
